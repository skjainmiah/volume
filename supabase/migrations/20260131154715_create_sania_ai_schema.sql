/*
  # SANIA AI - Autonomous Trading System Database Schema
  
  ## Overview
  Complete database schema for the autonomous options trading system including
  stock tracking, radar management, state machine, features, trades, learning,
  and decision logging.

  ## 1. New Tables
  
  ### `stocks`
  - `id` (uuid, primary key)
  - `symbol` (text, unique) - Stock symbol
  - `name` (text) - Stock name
  - `has_options` (boolean) - Whether stock has options available
  - `is_active` (boolean) - Active for scanning
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `radar`
  - `id` (uuid, primary key)
  - `stock_id` (uuid, foreign key to stocks)
  - `shock_date` (date) - Date of shock candle
  - `shock_direction` (text) - RED or GREEN
  - `shock_candle_high` (decimal) - High price of shock candle
  - `shock_candle_low` (decimal) - Low price of shock candle
  - `shock_volume_multiple` (decimal) - Volume multiple vs 20-day average
  - `current_state` (text) - State machine state
  - `days_since_shock` (integer)
  - `entry_reason` (text) - Why added to radar
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `state_memory`
  - `id` (uuid, primary key)
  - `radar_id` (uuid, foreign key to radar)
  - `previous_state` (text)
  - `current_state` (text)
  - `transition_reason` (text)
  - `transitioned_at` (timestamptz)
  
  ### `features_snapshot`
  - `id` (uuid, primary key)
  - `radar_id` (uuid, foreign key to radar)
  - `snapshot_date` (date)
  - `shock_candle` (boolean)
  - `shock_direction` (text)
  - `shock_volume_multiple` (decimal)
  - `days_since_shock` (integer)
  - `volume_trend` (text) - DECREASING, FLAT, EXPANDING
  - `acceptance_candle` (boolean)
  - `trend` (text) - UP, DOWN, RANGE
  - `event_support` (decimal)
  - `event_resistance` (decimal)
  - `distance_to_support_pct` (decimal)
  - `distance_to_resistance_pct` (decimal)
  - `option_type` (text) - CALL, PUT
  - `strike_type` (text) - ATM, ITM1
  - `bid_ask_spread_pct` (decimal)
  - `oi_alignment` (text) - ALIGNED, DIVERGENT
  - `fii_flow` (text) - STRONG_BUY, BUY, NEUTRAL, SELL, STRONG_SELL
  - `dii_flow` (text) - BUY, NEUTRAL, SELL
  - `news_risk` (text) - LOW, HIGH
  - `created_at` (timestamptz)
  
  ### `trades`
  - `id` (uuid, primary key)
  - `radar_id` (uuid, foreign key to radar)
  - `trade_mode` (text) - PAPER or REAL
  - `stock_symbol` (text)
  - `option_symbol` (text)
  - `option_type` (text) - CALL or PUT
  - `strike_price` (decimal)
  - `strike_type` (text) - ATM or ITM1
  - `entry_price` (decimal)
  - `entry_time` (timestamptz)
  - `lot_size` (integer)
  - `capital_used` (decimal)
  - `stop_loss` (decimal)
  - `trailing_sl` (decimal)
  - `exit_price` (decimal)
  - `exit_time` (timestamptz)
  - `exit_reason` (text) - SL_HIT, TRAILING_SL, NEXT_DAY_EXIT, MANUAL
  - `pnl` (decimal)
  - `pnl_pct` (decimal)
  - `calibrated_confidence` (decimal)
  - `raw_confidence` (decimal)
  - `llm_used` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `learning_weights`
  - `id` (uuid, primary key)
  - `feature_name` (text, unique)
  - `current_weight` (decimal)
  - `min_weight` (decimal)
  - `max_weight` (decimal)
  - `update_count` (integer) - Number of times updated
  - `last_updated` (timestamptz)
  - `performance_impact` (decimal) - Historical impact on P&L
  - `created_at` (timestamptz)
  
  ### `decisions_log`
  - `id` (uuid, primary key)
  - `radar_id` (uuid, foreign key to radar)
  - `decision_time` (timestamptz)
  - `decision_type` (text) - BUY_CALL, BUY_PUT, WAIT
  - `pre_llm_score` (decimal)
  - `llm_provider` (text) - openai, claude, gemini, grok, deepseek
  - `llm_model` (text)
  - `prompt_version_id` (uuid)
  - `raw_confidence` (decimal)
  - `calibrated_confidence` (decimal)
  - `calibration_factor` (decimal)
  - `decision_reason` (text)
  - `trade_executed` (boolean)
  - `trade_id` (uuid)
  - `created_at` (timestamptz)
  
  ### `llm_prompts`
  - `id` (uuid, primary key)
  - `prompt_type` (text) - e.g., "Acceptance Judge"
  - `version` (text)
  - `prompt_text` (text)
  - `model_target` (text) - Target model(s)
  - `is_active` (boolean)
  - `notes` (text)
  - `created_at` (timestamptz)
  
  ### `system_config`
  - `id` (uuid, primary key)
  - `config_key` (text, unique)
  - `config_value` (jsonb)
  - `config_type` (text) - RISK, STRATEGY, LEARNING, API, TIMING
  - `is_editable_during_trading` (boolean)
  - `updated_at` (timestamptz)
  - `updated_by` (text)
  
  ### `safety_events`
  - `id` (uuid, primary key)
  - `event_type` (text) - RISK_BREACH, API_FAILURE, KILL_SWITCH, etc.
  - `severity` (text) - INFO, WARNING, CRITICAL
  - `description` (text)
  - `action_taken` (text)
  - `system_state_before` (jsonb)
  - `system_state_after` (jsonb)
  - `created_at` (timestamptz)
  
  ### `market_data_cache`
  - `id` (uuid, primary key)
  - `symbol` (text)
  - `data_type` (text) - CANDLE, VOLUME, OPTIONS_CHAIN
  - `timeframe` (text)
  - `data` (jsonb)
  - `fetched_at` (timestamptz)
  - `expires_at` (timestamptz)
  
  ### `calibration_history`
  - `id` (uuid, primary key)
  - `trade_id` (uuid, foreign key to trades)
  - `raw_confidence` (decimal)
  - `calibration_factor_used` (decimal)
  - `calibrated_confidence` (decimal)
  - `trade_outcome` (text) - WIN, LOSS
  - `pnl` (decimal)
  - `feature_similarity_score` (decimal)
  - `created_at` (timestamptz)

  ## 2. Security
  - Enable RLS on all tables
  - Add policies for authenticated users to manage their own data
  
  ## 3. Indexes
  - Performance indexes on frequently queried columns
  - Composite indexes for common query patterns
*/

-- Create stocks table
CREATE TABLE IF NOT EXISTS stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text UNIQUE NOT NULL,
  name text NOT NULL,
  has_options boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create radar table
CREATE TABLE IF NOT EXISTS radar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stocks(id) ON DELETE CASCADE,
  shock_date date NOT NULL,
  shock_direction text NOT NULL CHECK (shock_direction IN ('RED', 'GREEN')),
  shock_candle_high decimal(10,2) NOT NULL,
  shock_candle_low decimal(10,2) NOT NULL,
  shock_volume_multiple decimal(10,2) NOT NULL,
  current_state text NOT NULL CHECK (current_state IN ('IDLE', 'SHOCK_DETECTED', 'DIGESTION', 'ACCEPTANCE_READY', 'TRADE_ACTIVE', 'FAILED_RESET')),
  days_since_shock integer DEFAULT 0,
  entry_reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create state_memory table
CREATE TABLE IF NOT EXISTS state_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  radar_id uuid REFERENCES radar(id) ON DELETE CASCADE,
  previous_state text NOT NULL,
  current_state text NOT NULL,
  transition_reason text,
  transitioned_at timestamptz DEFAULT now()
);

-- Create features_snapshot table
CREATE TABLE IF NOT EXISTS features_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  radar_id uuid REFERENCES radar(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  shock_candle boolean DEFAULT false,
  shock_direction text CHECK (shock_direction IN ('RED', 'GREEN')),
  shock_volume_multiple decimal(10,2),
  days_since_shock integer,
  volume_trend text CHECK (volume_trend IN ('DECREASING', 'FLAT', 'EXPANDING')),
  acceptance_candle boolean DEFAULT false,
  trend text CHECK (trend IN ('UP', 'DOWN', 'RANGE')),
  event_support decimal(10,2),
  event_resistance decimal(10,2),
  distance_to_support_pct decimal(10,4),
  distance_to_resistance_pct decimal(10,4),
  option_type text CHECK (option_type IN ('CALL', 'PUT')),
  strike_type text CHECK (strike_type IN ('ATM', 'ITM1')),
  bid_ask_spread_pct decimal(10,4),
  oi_alignment text CHECK (oi_alignment IN ('ALIGNED', 'DIVERGENT')),
  fii_flow text CHECK (fii_flow IN ('STRONG_BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG_SELL')),
  dii_flow text CHECK (dii_flow IN ('BUY', 'NEUTRAL', 'SELL')),
  news_risk text CHECK (news_risk IN ('LOW', 'HIGH')),
  created_at timestamptz DEFAULT now()
);

-- Create trades table
CREATE TABLE IF NOT EXISTS trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  radar_id uuid REFERENCES radar(id) ON DELETE SET NULL,
  trade_mode text NOT NULL CHECK (trade_mode IN ('PAPER', 'REAL')),
  stock_symbol text NOT NULL,
  option_symbol text NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('CALL', 'PUT')),
  strike_price decimal(10,2) NOT NULL,
  strike_type text NOT NULL CHECK (strike_type IN ('ATM', 'ITM1')),
  entry_price decimal(10,2) NOT NULL,
  entry_time timestamptz NOT NULL,
  lot_size integer NOT NULL,
  capital_used decimal(15,2) NOT NULL,
  stop_loss decimal(10,2) NOT NULL,
  trailing_sl decimal(10,2),
  exit_price decimal(10,2),
  exit_time timestamptz,
  exit_reason text CHECK (exit_reason IN ('SL_HIT', 'TRAILING_SL', 'NEXT_DAY_EXIT', 'MANUAL', 'EMERGENCY')),
  pnl decimal(15,2),
  pnl_pct decimal(10,4),
  calibrated_confidence decimal(5,4),
  raw_confidence decimal(5,4),
  llm_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create learning_weights table
CREATE TABLE IF NOT EXISTS learning_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name text UNIQUE NOT NULL,
  current_weight decimal(10,6) NOT NULL,
  min_weight decimal(10,6) NOT NULL,
  max_weight decimal(10,6) NOT NULL,
  update_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  performance_impact decimal(10,6) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create decisions_log table
CREATE TABLE IF NOT EXISTS decisions_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  radar_id uuid REFERENCES radar(id) ON DELETE SET NULL,
  decision_time timestamptz NOT NULL,
  decision_type text NOT NULL CHECK (decision_type IN ('BUY_CALL', 'BUY_PUT', 'WAIT')),
  pre_llm_score decimal(10,6),
  llm_provider text CHECK (llm_provider IN ('openai', 'claude', 'gemini', 'grok', 'deepseek')),
  llm_model text,
  prompt_version_id uuid,
  raw_confidence decimal(5,4),
  calibrated_confidence decimal(5,4),
  calibration_factor decimal(5,4),
  decision_reason text,
  trade_executed boolean DEFAULT false,
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create llm_prompts table
CREATE TABLE IF NOT EXISTS llm_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_type text NOT NULL,
  version text NOT NULL,
  prompt_text text NOT NULL,
  model_target text,
  is_active boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(prompt_type, version)
);

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL,
  config_type text NOT NULL CHECK (config_type IN ('RISK', 'STRATEGY', 'LEARNING', 'API', 'TIMING')),
  is_editable_during_trading boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  updated_by text
);

-- Create safety_events table
CREATE TABLE IF NOT EXISTS safety_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  description text NOT NULL,
  action_taken text,
  system_state_before jsonb,
  system_state_after jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create market_data_cache table
CREATE TABLE IF NOT EXISTS market_data_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  data_type text NOT NULL CHECK (data_type IN ('CANDLE', 'VOLUME', 'OPTIONS_CHAIN')),
  timeframe text,
  data jsonb NOT NULL,
  fetched_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- Create calibration_history table
CREATE TABLE IF NOT EXISTS calibration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid REFERENCES trades(id) ON DELETE CASCADE,
  raw_confidence decimal(5,4) NOT NULL,
  calibration_factor_used decimal(5,4) NOT NULL,
  calibrated_confidence decimal(5,4) NOT NULL,
  trade_outcome text CHECK (trade_outcome IN ('WIN', 'LOSS')),
  pnl decimal(15,2),
  feature_similarity_score decimal(5,4),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stocks_symbol ON stocks(symbol);
CREATE INDEX IF NOT EXISTS idx_stocks_has_options ON stocks(has_options) WHERE has_options = true;
CREATE INDEX IF NOT EXISTS idx_radar_stock_id ON radar(stock_id);
CREATE INDEX IF NOT EXISTS idx_radar_current_state ON radar(current_state);
CREATE INDEX IF NOT EXISTS idx_radar_is_active ON radar(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_radar_shock_date ON radar(shock_date DESC);
CREATE INDEX IF NOT EXISTS idx_state_memory_radar_id ON state_memory(radar_id);
CREATE INDEX IF NOT EXISTS idx_features_snapshot_radar_id ON features_snapshot(radar_id);
CREATE INDEX IF NOT EXISTS idx_features_snapshot_date ON features_snapshot(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_radar_id ON trades(radar_id);
CREATE INDEX IF NOT EXISTS idx_trades_mode ON trades(trade_mode);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_log_radar_id ON decisions_log(radar_id);
CREATE INDEX IF NOT EXISTS idx_decisions_log_time ON decisions_log(decision_time DESC);
CREATE INDEX IF NOT EXISTS idx_llm_prompts_active ON llm_prompts(prompt_type, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_safety_events_severity ON safety_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_cache_symbol ON market_data_cache(symbol, data_type);
CREATE INDEX IF NOT EXISTS idx_calibration_history_trade ON calibration_history(trade_id);

-- Enable Row Level Security
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE features_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE calibration_history ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for authenticated users
CREATE POLICY "Authenticated users can read stocks"
  ON stocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage stocks"
  ON stocks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read radar"
  ON radar FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage radar"
  ON radar FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read state_memory"
  ON state_memory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage state_memory"
  ON state_memory FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read features_snapshot"
  ON features_snapshot FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage features_snapshot"
  ON features_snapshot FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read trades"
  ON trades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage trades"
  ON trades FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read learning_weights"
  ON learning_weights FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage learning_weights"
  ON learning_weights FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read decisions_log"
  ON decisions_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage decisions_log"
  ON decisions_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read llm_prompts"
  ON llm_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage llm_prompts"
  ON llm_prompts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read system_config"
  ON system_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage system_config"
  ON system_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read safety_events"
  ON safety_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage safety_events"
  ON safety_events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read market_data_cache"
  ON market_data_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage market_data_cache"
  ON market_data_cache FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read calibration_history"
  ON calibration_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage calibration_history"
  ON calibration_history FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default learning weights for all features
INSERT INTO learning_weights (feature_name, current_weight, min_weight, max_weight) VALUES
  ('shock_candle', 1.0, 0.1, 3.0),
  ('shock_volume_multiple', 0.8, 0.1, 2.5),
  ('days_since_shock', 0.6, 0.1, 2.0),
  ('volume_trend', 0.7, 0.1, 2.0),
  ('acceptance_candle', 1.2, 0.1, 3.0),
  ('trend', 0.9, 0.1, 2.5),
  ('distance_to_support_pct', 0.8, 0.1, 2.0),
  ('distance_to_resistance_pct', 0.8, 0.1, 2.0),
  ('bid_ask_spread_pct', 0.5, 0.1, 1.5),
  ('oi_alignment', 0.7, 0.1, 2.0),
  ('fii_flow', 0.6, 0.1, 2.0),
  ('dii_flow', 0.5, 0.1, 1.8),
  ('news_risk', 0.9, 0.1, 2.5)
ON CONFLICT (feature_name) DO NOTHING;

-- Insert default system configuration
INSERT INTO system_config (config_key, config_value, config_type, is_editable_during_trading) VALUES
  ('trading_mode', '{"mode": "PAPER"}', 'RISK', false),
  ('max_risk_per_trade_pct', '{"value": 2.0}', 'RISK', false),
  ('max_loss_per_day_pct', '{"value": 5.0}', 'RISK', false),
  ('max_trades_per_day', '{"value": 3}', 'RISK', false),
  ('consecutive_loss_throttle', '{"value": 3}', 'RISK', false),
  ('decision_window_start', '{"hour": 15, "minute": 0}', 'TIMING', true),
  ('decision_window_end', '{"hour": 15, "minute": 15}', 'TIMING', true),
  ('shock_volume_threshold', '{"value": 4.0}', 'STRATEGY', true),
  ('learning_rate_paper', '{"value": 0.3}', 'LEARNING', true),
  ('learning_rate_real', '{"value": 1.0}', 'LEARNING', true),
  ('llm_provider', '{"provider": "openai"}', 'API', true),
  ('score_threshold', '{"value": 0.6}', 'STRATEGY', true)
ON CONFLICT (config_key) DO NOTHING;