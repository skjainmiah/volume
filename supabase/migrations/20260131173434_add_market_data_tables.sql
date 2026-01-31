/*
  # Market Data Storage Schema
  
  1. New Tables
    - `stocks`
      - `symbol` (text, primary key) - Stock symbol (e.g., 'RELIANCE')
      - `name` (text) - Full company name
      - `has_options` (boolean) - Whether this stock has tradable options
      - `exchange` (text) - Exchange code (NSE/BSE)
      - `is_active` (boolean) - Whether currently tracked
      - `sector` (text) - Industry sector
      - `avg_volume_20d` (bigint) - 20-day average volume for shock detection
      - `last_price` (numeric) - Last traded price
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `candle_data`
      - `id` (uuid, primary key)
      - `stock_symbol` (text, foreign key to stocks)
      - `timeframe` (text) - '10min', '1hour', '1day'
      - `timestamp` (timestamptz) - Candle start time
      - `open` (numeric)
      - `high` (numeric)
      - `low` (numeric)
      - `close` (numeric)
      - `volume` (bigint)
      - `created_at` (timestamptz)
    
    - `options_chain`
      - `id` (uuid, primary key)
      - `stock_symbol` (text, foreign key to stocks)
      - `expiry_date` (date)
      - `strike_price` (numeric)
      - `option_type` (text) - 'CALL' or 'PUT'
      - `ltp` (numeric) - Last traded price
      - `bid` (numeric)
      - `ask` (numeric)
      - `volume` (bigint)
      - `open_interest` (bigint)
      - `iv` (numeric) - Implied volatility
      - `is_liquid` (boolean) - Liquidity check
      - `groww_symbol` (text) - Groww API symbol for trading
      - `fetched_at` (timestamptz)
      - `created_at` (timestamptz)
  
  2. Indexes
    - Fast lookup by symbol and timeframe
    - Fast options chain filtering by expiry and strike
    - Time-series optimized indexes
  
  3. Security
    - Enable RLS on all tables
    - Read-only access for authenticated users
    - System writes only
  
  4. Important Notes
    - CASH market data stored in candle_data
    - OPTIONS data stored in options_chain
    - CASH used for analysis, OPTIONS for execution
    - Only stocks with has_options=true should enter radar
*/

-- Create stocks table
CREATE TABLE IF NOT EXISTS stocks (
  symbol text PRIMARY KEY,
  name text NOT NULL,
  has_options boolean DEFAULT false,
  exchange text DEFAULT 'NSE',
  is_active boolean DEFAULT true,
  sector text,
  avg_volume_20d bigint DEFAULT 0,
  last_price numeric(10, 2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create candle_data table
CREATE TABLE IF NOT EXISTS candle_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_symbol text NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
  timeframe text NOT NULL CHECK (timeframe IN ('10min', '1hour', '1day')),
  timestamp timestamptz NOT NULL,
  open numeric(10, 2) NOT NULL,
  high numeric(10, 2) NOT NULL,
  low numeric(10, 2) NOT NULL,
  close numeric(10, 2) NOT NULL,
  volume bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(stock_symbol, timeframe, timestamp)
);

-- Create options_chain table
CREATE TABLE IF NOT EXISTS options_chain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_symbol text NOT NULL REFERENCES stocks(symbol) ON DELETE CASCADE,
  expiry_date date NOT NULL,
  strike_price numeric(10, 2) NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('CALL', 'PUT')),
  ltp numeric(10, 2),
  bid numeric(10, 2),
  ask numeric(10, 2),
  volume bigint DEFAULT 0,
  open_interest bigint DEFAULT 0,
  iv numeric(5, 2),
  is_liquid boolean DEFAULT false,
  groww_symbol text,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(stock_symbol, expiry_date, strike_price, option_type)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_candle_data_symbol_timeframe ON candle_data(stock_symbol, timeframe, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_candle_data_timestamp ON candle_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_options_chain_symbol_expiry ON options_chain(stock_symbol, expiry_date, strike_price);
CREATE INDEX IF NOT EXISTS idx_options_chain_fetched ON options_chain(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_stocks_has_options ON stocks(has_options) WHERE has_options = true;

-- Enable RLS
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE candle_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE options_chain ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Read-only for authenticated users
CREATE POLICY "Authenticated users can view stocks"
  ON stocks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view candle data"
  ON candle_data FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view options chain"
  ON options_chain FOR SELECT
  TO authenticated
  USING (true);

-- Service role can write (for edge functions)
CREATE POLICY "Service role can manage stocks"
  ON stocks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage candle data"
  ON candle_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage options chain"
  ON options_chain FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Update radar table to link to stocks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'radar' AND column_name = 'stock_id'
  ) THEN
    ALTER TABLE radar ADD COLUMN stock_id text REFERENCES stocks(symbol);
    CREATE INDEX IF NOT EXISTS idx_radar_stock_id ON radar(stock_id);
  END IF;
END $$;

-- Function to update avg_volume_20d automatically
CREATE OR REPLACE FUNCTION update_stock_avg_volume()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE stocks
  SET avg_volume_20d = (
    SELECT AVG(volume)
    FROM candle_data
    WHERE stock_symbol = NEW.stock_symbol
      AND timeframe = '1day'
      AND timestamp >= now() - interval '20 days'
  ),
  last_price = NEW.close,
  updated_at = now()
  WHERE symbol = NEW.stock_symbol;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock metrics when new daily candle is added
DROP TRIGGER IF EXISTS trigger_update_stock_metrics ON candle_data;
CREATE TRIGGER trigger_update_stock_metrics
  AFTER INSERT ON candle_data
  FOR EACH ROW
  WHEN (NEW.timeframe = '1day')
  EXECUTE FUNCTION update_stock_avg_volume();
