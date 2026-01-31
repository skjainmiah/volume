interface TradeOutcome {
  tradeId: string;
  features: string[];
  outcome: 'WIN' | 'LOSS';
  pnl: number;
  tradeMode: 'PAPER' | 'REAL';
}

export class LearningEngine {
  private supabaseClient: any;
  private learningRatePaper: number = 0.3;
  private learningRateReal: number = 1.0;

  constructor(supabaseClient: any) {
    this.supabaseClient = supabaseClient;
  }

  async updateWeightsFromTrade(tradeOutcome: TradeOutcome): Promise<void> {
    try {
      const learningRate =
        tradeOutcome.tradeMode === 'PAPER'
          ? this.learningRatePaper
          : this.learningRateReal;

      const { data: currentWeights } = await this.supabaseClient
        .from('learning_weights')
        .select('*');

      if (!currentWeights) return;

      const updates: any[] = [];

      for (const weight of currentWeights) {
        if (tradeOutcome.features.includes(weight.feature_name)) {
          const adjustment = this.calculateWeightAdjustment(
            tradeOutcome.outcome,
            tradeOutcome.pnl,
            learningRate
          );

          const newWeight = this.clampWeight(
            weight.current_weight + adjustment,
            weight.min_weight,
            weight.max_weight
          );

          const newPerformanceImpact =
            weight.performance_impact + (tradeOutcome.pnl * learningRate);

          updates.push({
            id: weight.id,
            current_weight: newWeight,
            performance_impact: newPerformanceImpact,
            update_count: weight.update_count + 1,
            last_updated: new Date().toISOString(),
          });
        }
      }

      for (const update of updates) {
        await this.supabaseClient
          .from('learning_weights')
          .update({
            current_weight: update.current_weight,
            performance_impact: update.performance_impact,
            update_count: update.update_count,
            last_updated: update.last_updated,
          })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating weights:', error);
    }
  }

  private calculateWeightAdjustment(
    outcome: 'WIN' | 'LOSS',
    pnl: number,
    learningRate: number
  ): number {
    const pnlNormalized = Math.max(-1, Math.min(1, pnl / 1000));

    if (outcome === 'WIN') {
      return 0.05 * learningRate * (1 + pnlNormalized);
    } else {
      return -0.05 * learningRate * (1 + Math.abs(pnlNormalized));
    }
  }

  private clampWeight(weight: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, weight));
  }

  async applyTimeDecay(daysSinceLastUpdate: number): Promise<void> {
    if (daysSinceLastUpdate < 7) return;

    try {
      const { data: weights } = await this.supabaseClient
        .from('learning_weights')
        .select('*');

      if (!weights) return;

      const decayRate = 0.98;
      const periodsToDecay = Math.floor((daysSinceLastUpdate - 7) / 7);

      for (const weight of weights) {
        const decayedWeight =
          weight.current_weight * Math.pow(decayRate, periodsToDecay);

        const boundedWeight = Math.max(0.5, Math.min(1.5, decayedWeight));

        await this.supabaseClient
          .from('learning_weights')
          .update({
            current_weight: boundedWeight,
            last_updated: new Date().toISOString(),
          })
          .eq('id', weight.id);
      }
    } catch (error) {
      console.error('Error applying time decay:', error);
    }
  }

  async getLearningStats(): Promise<{
    topPerformingFeatures: Array<{ name: string; impact: number }>;
    worstPerformingFeatures: Array<{ name: string; impact: number }>;
    avgUpdateCount: number;
  }> {
    try {
      const { data: weights } = await this.supabaseClient
        .from('learning_weights')
        .select('*')
        .order('performance_impact', { ascending: false });

      if (!weights) {
        return {
          topPerformingFeatures: [],
          worstPerformingFeatures: [],
          avgUpdateCount: 0,
        };
      }

      const topPerformingFeatures = weights
        .slice(0, 5)
        .map((w: any) => ({
          name: w.feature_name,
          impact: w.performance_impact,
        }));

      const worstPerformingFeatures = weights
        .slice(-5)
        .reverse()
        .map((w: any) => ({
          name: w.feature_name,
          impact: w.performance_impact,
        }));

      const avgUpdateCount =
        weights.reduce((sum: number, w: any) => sum + w.update_count, 0) /
        weights.length;

      return {
        topPerformingFeatures,
        worstPerformingFeatures,
        avgUpdateCount,
      };
    } catch (error) {
      console.error('Error getting learning stats:', error);
      return {
        topPerformingFeatures: [],
        worstPerformingFeatures: [],
        avgUpdateCount: 0,
      };
    }
  }

  async resetWeightIfPoorPerformance(featureName: string): Promise<void> {
    try {
      const { data: weight } = await this.supabaseClient
        .from('learning_weights')
        .select('*')
        .eq('feature_name', featureName)
        .single();

      if (!weight) return;

      if (weight.performance_impact < -5000) {
        await this.supabaseClient
          .from('learning_weights')
          .update({
            current_weight: 1.0,
            performance_impact: 0,
            last_updated: new Date().toISOString(),
          })
          .eq('feature_name', featureName);

        console.log(`Reset weight for ${featureName} due to poor performance`);
      }
    } catch (error) {
      console.error('Error resetting weight:', error);
    }
  }

  canModify(configKey: string): boolean {
    const nonModifiableByLearning = [
      'entry_timing',
      'stop_loss_logic',
      'exit_logic',
      'position_sizing',
      'state_machine',
      'risk_limits',
    ];

    return !nonModifiableByLearning.includes(configKey);
  }
}
