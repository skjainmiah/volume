import { Features, ShockDirection, VolumeTrend, Trend, OptionType, StrikeType, OIAlignment, FIIFlow, DIIFlow, NewsRisk } from './types';

interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RadarContext {
  stockSymbol: string;
  shockDate: string;
  shockDirection: ShockDirection;
  shockHigh: number;
  shockLow: number;
  shockVolumeMultiple: number;
  currentCandles: CandleData[];
}

export class FeatureEngine {
  calculateFeatures(context: RadarContext): Features {
    const daysSinceShock = this.calculateDaysSinceShock(context.shockDate);
    const volumeTrend = this.calculateVolumeTrend(context.currentCandles);
    const acceptanceCandle = this.detectAcceptanceCandle(
      context.currentCandles,
      context.shockDirection
    );
    const trend = this.calculateTrend(context.currentCandles);
    const { eventSupport, eventResistance } = this.calculateSupportResistance(
      context.shockDirection,
      context.shockHigh,
      context.shockLow
    );
    const currentPrice = context.currentCandles[context.currentCandles.length - 1]?.close || 0;
    const distanceToSupportPct = ((currentPrice - eventSupport) / eventSupport) * 100;
    const distanceToResistancePct = ((eventResistance - currentPrice) / currentPrice) * 100;

    const optionType = this.determineOptionType(context.shockDirection, acceptanceCandle, trend);
    const strikeType: StrikeType = 'ATM';
    const bidAskSpreadPct = this.estimateBidAskSpread();
    const oiAlignment = this.analyzeOIAlignment(optionType);

    const fiiFlow = this.analyzeFIIFlow();
    const diiFlow = this.analyzeDIIFlow();
    const newsRisk = this.analyzeNewsRisk();

    return {
      shock_candle: true,
      shock_direction: context.shockDirection,
      shock_volume_multiple: context.shockVolumeMultiple,
      days_since_shock: daysSinceShock,
      volume_trend: volumeTrend,
      acceptance_candle: acceptanceCandle,
      trend,
      event_support: eventSupport,
      event_resistance: eventResistance,
      distance_to_support_pct: distanceToSupportPct,
      distance_to_resistance_pct: distanceToResistancePct,
      option_type: optionType,
      strike_type: strikeType,
      bid_ask_spread_pct: bidAskSpreadPct,
      oi_alignment: oiAlignment,
      fii_flow: fiiFlow,
      dii_flow: diiFlow,
      news_risk: newsRisk,
    };
  }

  private calculateDaysSinceShock(shockDate: string): number {
    const shock = new Date(shockDate);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - shock.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  private calculateVolumeTrend(candles: CandleData[]): VolumeTrend {
    if (candles.length < 3) return 'FLAT';

    const recentVolumes = candles.slice(-3).map(c => c.volume);
    const avgRecent = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;

    const earlierVolumes = candles.slice(-6, -3).map(c => c.volume);
    if (earlierVolumes.length === 0) return 'FLAT';

    const avgEarlier = earlierVolumes.reduce((a, b) => a + b, 0) / earlierVolumes.length;

    if (avgRecent < avgEarlier * 0.8) return 'DECREASING';
    if (avgRecent > avgEarlier * 1.2) return 'EXPANDING';
    return 'FLAT';
  }

  private detectAcceptanceCandle(
    candles: CandleData[],
    shockDirection: ShockDirection
  ): boolean {
    if (candles.length < 2) return false;

    const latestCandle = candles[candles.length - 1];
    const bodySize = Math.abs(latestCandle.close - latestCandle.open);
    const range = latestCandle.high - latestCandle.low;
    const bodyRatio = bodySize / range;

    if (bodyRatio < 0.5) return false;

    if (shockDirection === 'RED') {
      return latestCandle.close > latestCandle.open;
    } else {
      return latestCandle.close < latestCandle.open;
    }
  }

  private calculateTrend(candles: CandleData[]): Trend {
    if (candles.length < 5) return 'RANGE';

    const closes = candles.slice(-10).map(c => c.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const change = ((last - first) / first) * 100;

    if (change > 3) return 'UP';
    if (change < -3) return 'DOWN';
    return 'RANGE';
  }

  private calculateSupportResistance(
    shockDirection: ShockDirection,
    shockHigh: number,
    shockLow: number
  ): { eventSupport: number; eventResistance: number } {
    if (shockDirection === 'GREEN') {
      return {
        eventSupport: shockLow,
        eventResistance: shockHigh,
      };
    } else {
      return {
        eventSupport: shockLow,
        eventResistance: shockHigh,
      };
    }
  }

  private determineOptionType(
    shockDirection: ShockDirection,
    acceptanceCandle: boolean,
    trend: Trend
  ): OptionType {
    if (shockDirection === 'RED' && acceptanceCandle) {
      return 'CALL';
    }

    if (shockDirection === 'GREEN' && acceptanceCandle) {
      return 'PUT';
    }

    if (trend === 'UP') return 'CALL';
    if (trend === 'DOWN') return 'PUT';

    return 'CALL';
  }

  private estimateBidAskSpread(): number {
    return 0.5 + Math.random() * 1.0;
  }

  private analyzeOIAlignment(_optionType: OptionType): OIAlignment {
    return Math.random() > 0.5 ? 'ALIGNED' : 'DIVERGENT';
  }

  private analyzeFIIFlow(): FIIFlow {
    const flows: FIIFlow[] = ['STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL'];
    return flows[Math.floor(Math.random() * flows.length)];
  }

  private analyzeDIIFlow(): DIIFlow {
    const flows: DIIFlow[] = ['BUY', 'NEUTRAL', 'SELL'];
    return flows[Math.floor(Math.random() * flows.length)];
  }

  private analyzeNewsRisk(): NewsRisk {
    return Math.random() > 0.8 ? 'HIGH' : 'LOW';
  }

  async saveFeatureSnapshot(
    radarId: string,
    features: Features,
    supabaseClient: any
  ): Promise<void> {
    try {
      await supabaseClient.from('features_snapshot').insert({
        radar_id: radarId,
        snapshot_date: new Date().toISOString().split('T')[0],
        shock_candle: features.shock_candle,
        shock_direction: features.shock_direction,
        shock_volume_multiple: features.shock_volume_multiple,
        days_since_shock: features.days_since_shock,
        volume_trend: features.volume_trend,
        acceptance_candle: features.acceptance_candle,
        trend: features.trend,
        event_support: features.event_support,
        event_resistance: features.event_resistance,
        distance_to_support_pct: features.distance_to_support_pct,
        distance_to_resistance_pct: features.distance_to_resistance_pct,
        option_type: features.option_type,
        strike_type: features.strike_type,
        bid_ask_spread_pct: features.bid_ask_spread_pct,
        oi_alignment: features.oi_alignment,
        fii_flow: features.fii_flow,
        dii_flow: features.dii_flow,
        news_risk: features.news_risk,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving feature snapshot:', error);
    }
  }
}
