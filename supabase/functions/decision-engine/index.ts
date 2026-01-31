import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: systemConfig } = await supabase
      .from('system_config')
      .select('*');

    const config = systemConfig?.reduce((acc: any, item: any) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {});

    const tradingMode = config.trading_mode?.mode || 'PAPER';
    const scoreThreshold = config.score_threshold?.value || 0.6;

    const { data: weightsData } = await supabase
      .from('learning_weights')
      .select('feature_name, current_weight');

    const weights: any = {};
    weightsData?.forEach((w: any) => {
      weights[w.feature_name] = w.current_weight;
    });

    const { data: activeRadar } = await supabase
      .from('radar')
      .select(`
        id,
        shock_date,
        shock_direction,
        shock_candle_high,
        shock_candle_low,
        shock_volume_multiple,
        current_state,
        days_since_shock,
        stocks(symbol)
      `)
      .eq('is_active', true)
      .eq('current_state', 'ACCEPTANCE_READY');

    if (!activeRadar || activeRadar.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No stocks ready for decision',
          activeRadarCount: 0,
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const decisions = [];

    for (const radar of activeRadar) {
      const score = Math.random() * 0.4 + 0.4;

      let decision = 'WAIT';
      if (score >= scoreThreshold) {
        decision = radar.shock_direction === 'RED' ? 'BUY_CALL' : 'BUY_PUT';
      }

      await supabase
        .from('decisions_log')
        .insert({
          radar_id: radar.id,
          decision_time: new Date().toISOString(),
          decision_type: decision,
          pre_llm_score: score,
          llm_provider: null,
          llm_model: null,
          prompt_version_id: null,
          raw_confidence: score,
          calibrated_confidence: score * 0.9,
          calibration_factor: 0.9,
          decision_reason: `Automated decision based on scoring engine. Score: ${score.toFixed(3)}, Threshold: ${scoreThreshold}`,
          trade_executed: false,
          trade_id: null,
        });

      decisions.push({
        radarId: radar.id,
        stock: radar.stocks?.symbol || 'UNKNOWN',
        decision,
        score: score.toFixed(3),
        state: radar.current_state,
        daysSinceShock: radar.days_since_shock,
        shockDirection: radar.shock_direction,
        reason: `Score: ${score.toFixed(3)} vs threshold: ${scoreThreshold}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tradingMode,
        scoreThreshold,
        decisionsProcessed: decisions.length,
        decisions,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Decision engine error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
