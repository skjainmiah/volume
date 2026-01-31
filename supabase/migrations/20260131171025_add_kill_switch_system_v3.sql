/*
  # Kill Switch System Implementation

  1. New Tables
    - `kill_switch_state`
      - `id` (uuid, primary key)
      - `is_active` (boolean) - Whether kill switch is ON (trading disabled)
      - `activated_by` (text) - Source: UI, SYSTEM, STRATEGY, MANUAL
      - `activated_at` (timestamptz) - When it was activated
      - `deactivated_at` (timestamptz) - When it was deactivated (null if active)
      - `reason` (text) - Why it was activated
      - `metadata` (jsonb) - Additional context
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `kill_switch_triggers`
      - `id` (uuid, primary key)
      - `trigger_type` (text) - Type of trigger
      - `trigger_condition` (jsonb) - The condition that triggered it
      - `is_enabled` (boolean) - Whether this trigger is active
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to read
    - Only service role can write to kill_switch_state

  3. Important Notes
    - Kill switch persists across restarts
    - Only explicit deactivation through UI/API can turn it off
    - All trading functions MUST check this before executing
*/

-- Create kill_switch_state table
CREATE TABLE IF NOT EXISTS kill_switch_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT false,
  activated_by text,
  activated_at timestamptz,
  deactivated_at timestamptz,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE kill_switch_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kill switch state"
  ON kill_switch_state FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage kill switch"
  ON kill_switch_state FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create kill_switch_triggers table
CREATE TABLE IF NOT EXISTS kill_switch_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type text NOT NULL,
  trigger_condition jsonb DEFAULT '{}'::jsonb,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE kill_switch_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view kill switch triggers"
  ON kill_switch_triggers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage triggers"
  ON kill_switch_triggers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert initial kill switch state (OFF by default)
INSERT INTO kill_switch_state (is_active, reason)
VALUES (false, 'Initial state - system ready')
ON CONFLICT DO NOTHING;

-- Insert default kill switch triggers
INSERT INTO kill_switch_triggers (trigger_type, trigger_condition, is_enabled)
VALUES
  ('CONSECUTIVE_LOSSES', '{"threshold": 3}'::jsonb, true),
  ('DAILY_DRAWDOWN', '{"threshold_pct": 2.0}'::jsonb, true),
  ('API_FAILURE', '{"consecutive_failures": 3}'::jsonb, true),
  ('EXECUTION_ANOMALY', '{"enabled": true}'::jsonb, true),
  ('DATA_CORRUPTION', '{"enabled": true}'::jsonb, true),
  ('MARKET_VOLATILITY', '{"threshold_pct": 5.0}'::jsonb, true)
ON CONFLICT DO NOTHING;

-- Add kill_switch_status to system_config for easy access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_config WHERE config_key = 'kill_switch_status'
  ) THEN
    INSERT INTO system_config (config_key, config_value, config_type, is_editable_during_trading)
    VALUES ('kill_switch_status', '{"active": false, "reason": "System ready"}'::jsonb, 'RISK', false);
  END IF;
END $$;
