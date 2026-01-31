export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stocks: {
        Row: {
          id: string
          symbol: string
          name: string
          has_options: boolean
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['stocks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['stocks']['Insert']>
      }
      radar: {
        Row: {
          id: string
          stock_id: string
          shock_date: string
          shock_direction: 'RED' | 'GREEN'
          shock_candle_high: number
          shock_candle_low: number
          shock_volume_multiple: number
          current_state: 'IDLE' | 'SHOCK_DETECTED' | 'DIGESTION' | 'ACCEPTANCE_READY' | 'TRADE_ACTIVE' | 'FAILED_RESET'
          days_since_shock: number
          entry_reason: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['radar']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['radar']['Insert']>
      }
      trades: {
        Row: {
          id: string
          radar_id: string | null
          trade_mode: 'PAPER' | 'REAL'
          stock_symbol: string
          option_symbol: string
          option_type: 'CALL' | 'PUT'
          strike_price: number
          strike_type: 'ATM' | 'ITM1'
          entry_price: number
          entry_time: string
          lot_size: number
          capital_used: number
          stop_loss: number
          trailing_sl: number | null
          exit_price: number | null
          exit_time: string | null
          exit_reason: 'SL_HIT' | 'TRAILING_SL' | 'NEXT_DAY_EXIT' | 'MANUAL' | 'EMERGENCY' | null
          pnl: number | null
          pnl_pct: number | null
          calibrated_confidence: number | null
          raw_confidence: number | null
          llm_used: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['trades']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['trades']['Insert']>
      }
      learning_weights: {
        Row: {
          id: string
          feature_name: string
          current_weight: number
          min_weight: number
          max_weight: number
          update_count: number
          last_updated: string
          performance_impact: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['learning_weights']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['learning_weights']['Insert']>
      }
      decisions_log: {
        Row: {
          id: string
          radar_id: string | null
          decision_time: string
          decision_type: 'BUY_CALL' | 'BUY_PUT' | 'WAIT'
          pre_llm_score: number | null
          llm_provider: 'openai' | 'claude' | 'gemini' | 'grok' | 'deepseek' | null
          llm_model: string | null
          prompt_version_id: string | null
          raw_confidence: number | null
          calibrated_confidence: number | null
          calibration_factor: number | null
          decision_reason: string | null
          trade_executed: boolean
          trade_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['decisions_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['decisions_log']['Insert']>
      }
      system_config: {
        Row: {
          id: string
          config_key: string
          config_value: Json
          config_type: 'RISK' | 'STRATEGY' | 'LEARNING' | 'API' | 'TIMING'
          is_editable_during_trading: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['system_config']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['system_config']['Insert']>
      }
      safety_events: {
        Row: {
          id: string
          event_type: string
          severity: 'INFO' | 'WARNING' | 'CRITICAL'
          description: string
          action_taken: string | null
          system_state_before: Json | null
          system_state_after: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['safety_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['safety_events']['Insert']>
      }
    }
  }
}
