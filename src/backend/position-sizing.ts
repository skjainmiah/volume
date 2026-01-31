import { PositionSizeRequest, PositionSizeResponse, RiskLimits } from './types';

export class PositionSizingEngine {
  private riskLimits: RiskLimits;

  constructor(riskLimits: RiskLimits) {
    this.riskLimits = riskLimits;
  }

  calculatePositionSize(request: PositionSizeRequest): PositionSizeResponse {
    const maxLossPerTrade =
      (this.riskLimits.maxRiskPerTradePct / 100) * request.totalCapital;

    if (request.calibratedConfidence < 0.4) {
      return {
        finalLotCount: 0,
        capitalUsed: 0,
        riskAmount: 0,
        confidenceBucket: 'TOO_LOW',
        reason: 'Confidence below minimum threshold (0.4)',
      };
    }

    const confidenceMultiplier = this.getConfidenceMultiplier(
      request.calibratedConfidence
    );

    const baseRiskAmount = maxLossPerTrade * confidenceMultiplier;

    const lossThrottleMultiplier = this.getLossThrottleMultiplier(
      request.consecutiveLosses
    );
    const adjustedRiskAmount = baseRiskAmount * lossThrottleMultiplier;

    const estimatedStopLossDistance = request.optionPrice * 0.15;
    const baseLotSize = Math.floor(adjustedRiskAmount / estimatedStopLossDistance);

    const finalLotCount = Math.max(1, Math.min(baseLotSize, request.lotSize));

    const capitalUsed = request.optionPrice * finalLotCount;

    if (capitalUsed > request.availableCapital) {
      return {
        finalLotCount: 0,
        capitalUsed: 0,
        riskAmount: 0,
        confidenceBucket: this.getConfidenceBucket(request.calibratedConfidence),
        reason: 'Insufficient available capital',
      };
    }

    return {
      finalLotCount,
      capitalUsed,
      riskAmount: adjustedRiskAmount,
      confidenceBucket: this.getConfidenceBucket(request.calibratedConfidence),
      reason: this.getPositionSizeReason(
        request.calibratedConfidence,
        confidenceMultiplier,
        request.consecutiveLosses,
        lossThrottleMultiplier
      ),
    };
  }

  private getConfidenceMultiplier(calibratedConfidence: number): number {
    if (calibratedConfidence < 0.4) return 0;
    if (calibratedConfidence < 0.55) return 0.5;
    if (calibratedConfidence < 0.7) return 0.75;
    if (calibratedConfidence < 0.85) return 1.0;
    return 1.0;
  }

  private getLossThrottleMultiplier(consecutiveLosses: number): number {
    if (consecutiveLosses === 0) return 1.0;
    return Math.pow(0.7, consecutiveLosses);
  }

  private getConfidenceBucket(confidence: number): string {
    if (confidence < 0.4) return 'TOO_LOW';
    if (confidence < 0.55) return 'LOW';
    if (confidence < 0.7) return 'MEDIUM';
    if (confidence < 0.85) return 'HIGH';
    return 'VERY_HIGH';
  }

  private getPositionSizeReason(
    confidence: number,
    confidenceMultiplier: number,
    consecutiveLosses: number,
    throttleMultiplier: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `Confidence: ${(confidence * 100).toFixed(1)}% → ${(confidenceMultiplier * 100).toFixed(0)}% size`
    );

    if (consecutiveLosses > 0) {
      parts.push(
        `${consecutiveLosses} consecutive losses → ${(throttleMultiplier * 100).toFixed(0)}% throttle`
      );
    }

    return parts.join(', ');
  }

  validatePositionSize(
    lotCount: number,
    capitalUsed: number,
    availableCapital: number,
    totalCapital: number
  ): { valid: boolean; reason?: string } {
    if (lotCount < 1) {
      return {
        valid: false,
        reason: 'Lot count must be at least 1',
      };
    }

    if (capitalUsed > availableCapital) {
      return {
        valid: false,
        reason: 'Insufficient capital available',
      };
    }

    const maxPositionSize = totalCapital * 0.2;
    if (capitalUsed > maxPositionSize) {
      return {
        valid: false,
        reason: 'Position size exceeds 20% of total capital',
      };
    }

    return { valid: true };
  }
}
