export type TradingMode = 'PAPER' | 'REAL';

export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE_MARKET' | 'POST_MARKET';

export type SystemState = 'RUNNING' | 'PAUSED' | 'EMERGENCY_STOP';

export type ShockDirection = 'RED' | 'GREEN';

export type VolumeTrend = 'DECREASING' | 'FLAT' | 'EXPANDING';

export type Trend = 'UP' | 'DOWN' | 'RANGE';

export type OptionType = 'CALL' | 'PUT';

export type StrikeType = 'ATM' | 'ITM1';

export type OIAlignment = 'ALIGNED' | 'DIVERGENT';

export type FIIFlow = 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';

export type DIIFlow = 'BUY' | 'NEUTRAL' | 'SELL';

export type NewsRisk = 'LOW' | 'HIGH';

export type StateMachineState =
  | 'IDLE'
  | 'SHOCK_DETECTED'
  | 'DIGESTION'
  | 'ACCEPTANCE_READY'
  | 'TRADE_ACTIVE'
  | 'FAILED_RESET';

export type DecisionType = 'BUY_CALL' | 'BUY_PUT' | 'WAIT';

export type ExitReason = 'SL_HIT' | 'TRAILING_SL' | 'NEXT_DAY_EXIT' | 'MANUAL' | 'EMERGENCY';

export type LLMProvider = 'openai' | 'claude' | 'gemini' | 'grok' | 'deepseek';

export type SafetyEventSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Features {
  shock_candle: boolean;
  shock_direction: ShockDirection;
  shock_volume_multiple: number;
  days_since_shock: number;
  volume_trend: VolumeTrend;
  acceptance_candle: boolean;
  trend: Trend;
  event_support: number;
  event_resistance: number;
  distance_to_support_pct: number;
  distance_to_resistance_pct: number;
  option_type: OptionType;
  strike_type: StrikeType;
  bid_ask_spread_pct: number;
  oi_alignment: OIAlignment;
  fii_flow: FIIFlow;
  dii_flow: DIIFlow;
  news_risk: NewsRisk;
}

export interface LearningWeights {
  [key: string]: number;
}

export interface LLMRequest {
  features: Features;
  state: StateMachineState;
  stockSymbol: string;
  radarId: string;
}

export interface LLMResponse {
  decision: DecisionType;
  confidence: number;
  reason: string;
  provider: LLMProvider;
  model: string;
  latency_ms: number;
}

export interface PositionSizeRequest {
  totalCapital: number;
  availableCapital: number;
  currentDrawdown: number;
  consecutiveLosses: number;
  tradeMode: TradingMode;
  optionPrice: number;
  lotSize: number;
  direction: OptionType;
  calibratedConfidence: number;
}

export interface PositionSizeResponse {
  finalLotCount: number;
  capitalUsed: number;
  riskAmount: number;
  confidenceBucket: string;
  reason: string;
}

export interface TradeRequest {
  radarId: string;
  stockSymbol: string;
  optionSymbol: string;
  optionType: OptionType;
  strikePrice: number;
  strikeType: StrikeType;
  entryPrice: number;
  lotSize: number;
  stopLoss: number;
  tradeMode: TradingMode;
  calibratedConfidence: number;
  rawConfidence: number;
}

export interface SafetyCheck {
  passed: boolean;
  reason?: string;
  actionTaken?: string;
}

export interface RiskLimits {
  maxRiskPerTradePct: number;
  maxLossPerDayPct: number;
  maxTradesPerDay: number;
  consecutiveLossThrottle: number;
}

export interface CalibrationFactor {
  rawConfidence: number;
  historicalAccuracy: number;
  featureSimilarity: number;
  calibratedConfidence: number;
}
