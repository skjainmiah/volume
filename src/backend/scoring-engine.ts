import { Features, LearningWeights } from './types';

export class ScoringEngine {
  private weights: LearningWeights;
  private threshold: number;

  constructor(weights: LearningWeights, threshold: number = 0.6) {
    this.weights = weights;
    this.threshold = threshold;
  }

  calculateScore(features: Features): number {
    let score = 0;
    let totalWeight = 0;

    const featureScores = this.convertFeaturesToScores(features);

    for (const [featureName, featureScore] of Object.entries(featureScores)) {
      const weight = this.weights[featureName] || 0;
      score += featureScore * weight;
      totalWeight += weight;
    }

    const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;

    return Math.max(0, Math.min(1, normalizedScore));
  }

  private convertFeaturesToScores(features: Features): Record<string, number> {
    return {
      shock_candle: features.shock_candle ? 1.0 : 0.0,
      shock_volume_multiple: this.scoreVolumeMultiple(features.shock_volume_multiple),
      days_since_shock: this.scoreDaysSinceShock(features.days_since_shock),
      volume_trend: this.scoreVolumeTrend(features.volume_trend),
      acceptance_candle: features.acceptance_candle ? 1.0 : 0.0,
      trend: this.scoreTrend(features.trend),
      distance_to_support_pct: this.scoreDistanceToSupport(
        features.distance_to_support_pct
      ),
      distance_to_resistance_pct: this.scoreDistanceToResistance(
        features.distance_to_resistance_pct
      ),
      bid_ask_spread_pct: this.scoreBidAskSpread(features.bid_ask_spread_pct),
      oi_alignment: features.oi_alignment === 'ALIGNED' ? 1.0 : 0.3,
      fii_flow: this.scoreFIIFlow(features.fii_flow),
      dii_flow: this.scoreDIIFlow(features.dii_flow),
      news_risk: features.news_risk === 'LOW' ? 1.0 : 0.2,
    };
  }

  private scoreVolumeMultiple(multiple: number): number {
    if (multiple < 3) return 0.2;
    if (multiple < 4) return 0.5;
    if (multiple < 6) return 0.8;
    return 1.0;
  }

  private scoreDaysSinceShock(days: number): number {
    if (days < 1) return 0.0;
    if (days <= 2) return 1.0;
    if (days <= 4) return 0.8;
    if (days <= 6) return 0.4;
    return 0.0;
  }

  private scoreVolumeTrend(trend: string): number {
    if (trend === 'DECREASING') return 1.0;
    if (trend === 'FLAT') return 0.6;
    return 0.2;
  }

  private scoreTrend(trend: string): number {
    if (trend === 'UP' || trend === 'DOWN') return 1.0;
    return 0.5;
  }

  private scoreDistanceToSupport(distance: number): number {
    const absDistance = Math.abs(distance);
    if (absDistance < 1) return 0.3;
    if (absDistance < 3) return 1.0;
    if (absDistance < 5) return 0.7;
    return 0.5;
  }

  private scoreDistanceToResistance(distance: number): number {
    if (distance < 1) return 0.2;
    if (distance < 3) return 0.5;
    if (distance < 5) return 0.8;
    return 1.0;
  }

  private scoreBidAskSpread(spread: number): number {
    if (spread < 0.5) return 1.0;
    if (spread < 1.0) return 0.8;
    if (spread < 2.0) return 0.5;
    return 0.2;
  }

  private scoreFIIFlow(flow: string): number {
    switch (flow) {
      case 'STRONG_BUY':
        return 1.0;
      case 'BUY':
        return 0.8;
      case 'NEUTRAL':
        return 0.5;
      case 'SELL':
        return 0.3;
      case 'STRONG_SELL':
        return 0.1;
      default:
        return 0.5;
    }
  }

  private scoreDIIFlow(flow: string): number {
    switch (flow) {
      case 'BUY':
        return 1.0;
      case 'NEUTRAL':
        return 0.5;
      case 'SELL':
        return 0.2;
      default:
        return 0.5;
    }
  }

  isAmbiguous(score: number): boolean {
    const ambiguityRange = 0.15;
    return Math.abs(score - this.threshold) < ambiguityRange;
  }

  shouldCallLLM(score: number): boolean {
    return this.isAmbiguous(score);
  }

  getDecisionFromScore(score: number, features: Features): string {
    if (score < this.threshold) {
      return 'WAIT';
    }

    if (features.option_type === 'CALL') {
      return 'BUY_CALL';
    } else {
      return 'BUY_PUT';
    }
  }

  getScoreExplanation(score: number, features: Features): string {
    const parts: string[] = [];

    parts.push(`Overall score: ${(score * 100).toFixed(1)}%`);
    parts.push(`Threshold: ${(this.threshold * 100).toFixed(0)}%`);

    if (features.acceptance_candle) {
      parts.push('✓ Acceptance candle detected');
    }

    if (features.volume_trend === 'DECREASING') {
      parts.push('✓ Volume digesting');
    }

    if (features.days_since_shock >= 1 && features.days_since_shock <= 4) {
      parts.push(`✓ ${features.days_since_shock} days since shock (optimal)`);
    }

    if (features.news_risk === 'HIGH') {
      parts.push('⚠ High news risk');
    }

    return parts.join(', ');
  }
}
