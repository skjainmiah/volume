export class ConfidenceCalibrationEngine {
  private supabaseClient: any;
  private minCalibrationFactor: number = 0.5;
  private maxCalibrationFactor: number = 1.2;

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
  }

  async calibrateConfidence(
    rawConfidence: number,
    featureSimilarity: number = 1.0
  ): Promise<number> {
    try {
      const historicalAccuracy = await this.calculateHistoricalAccuracy(rawConfidence);

      const calibrationFactor = this.calculateCalibrationFactor(
        historicalAccuracy,
        featureSimilarity
      );

      const calibratedConfidence = Math.max(
        0.0,
        Math.min(1.0, rawConfidence * calibrationFactor)
      );

      return calibratedConfidence;
    } catch (error) {
      console.error('Confidence calibration error:', error);
      return rawConfidence * 0.8;
    }
  }

  private async calculateHistoricalAccuracy(
    rawConfidence: number
  ): Promise<number> {
    try {
      const confidenceRange = 0.1;
      const minConfidence = rawConfidence - confidenceRange;
      const maxConfidence = rawConfidence + confidenceRange;

      const { data: historicalTrades } = await this.supabaseClient
        .from('calibration_history')
        .select('*')
        .gte('raw_confidence', minConfidence)
        .lte('raw_confidence', maxConfidence)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!historicalTrades || historicalTrades.length < 5) {
        return 1.0;
      }

      const wins = historicalTrades.filter(
        (t: any) => t.trade_outcome === 'WIN'
      ).length;
      const total = historicalTrades.length;

      return wins / total;
    } catch (error) {
      console.error('Error calculating historical accuracy:', error);
      return 1.0;
    }
  }

  private calculateCalibrationFactor(
    historicalAccuracy: number,
    featureSimilarity: number
  ): number {
    let baseFactor = 1.0;

    if (historicalAccuracy < 0.4) {
      baseFactor = 0.6;
    } else if (historicalAccuracy < 0.5) {
      baseFactor = 0.8;
    } else if (historicalAccuracy > 0.7) {
      baseFactor = 1.1;
    }

    const similarityAdjustment = (featureSimilarity - 0.5) * 0.2;
    let finalFactor = baseFactor + similarityAdjustment;

    finalFactor = Math.max(
      this.minCalibrationFactor,
      Math.min(this.maxCalibrationFactor, finalFactor)
    );

    return finalFactor;
  }

  async recordTradeOutcome(
    tradeId: string,
    rawConfidence: number,
    calibratedConfidence: number,
    outcome: 'WIN' | 'LOSS',
    pnl: number
  ): Promise<void> {
    try {
      const calibrationFactor = calibratedConfidence / rawConfidence;

      await this.supabaseClient.from('calibration_history').insert({
        trade_id: tradeId,
        raw_confidence: rawConfidence,
        calibration_factor_used: calibrationFactor,
        calibrated_confidence: calibratedConfidence,
        trade_outcome: outcome,
        pnl,
        feature_similarity_score: 1.0,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error recording trade outcome for calibration:', error);
    }
  }

  async getCalibrationStats(): Promise<{
    avgCalibrationFactor: number;
    winRate: number;
    totalSamples: number;
  }> {
    try {
      const { data: history } = await this.supabaseClient
        .from('calibration_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!history || history.length === 0) {
        return {
          avgCalibrationFactor: 1.0,
          winRate: 0.5,
          totalSamples: 0,
        };
      }

      const avgCalibrationFactor =
        history.reduce((sum: number, h: any) => sum + h.calibration_factor_used, 0) /
        history.length;

      const wins = history.filter((h: any) => h.trade_outcome === 'WIN').length;
      const winRate = wins / history.length;

      return {
        avgCalibrationFactor,
        winRate,
        totalSamples: history.length,
      };
    } catch (error) {
      console.error('Error getting calibration stats:', error);
      return {
        avgCalibrationFactor: 1.0,
        winRate: 0.5,
        totalSamples: 0,
      };
    }
  }

  shouldDecayCalibration(daysSinceLastTrade: number): boolean {
    return daysSinceLastTrade > 7;
  }

  applyTimeDecay(currentFactor: number, daysSinceLastTrade: number): number {
    if (daysSinceLastTrade <= 7) {
      return currentFactor;
    }

    const decayRate = 0.95;
    const periodsToDecay = Math.floor((daysSinceLastTrade - 7) / 7);
    const decayedFactor = currentFactor * Math.pow(decayRate, periodsToDecay);

    return Math.max(0.8, Math.min(1.0, decayedFactor));
  }
}
