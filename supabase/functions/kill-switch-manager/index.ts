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

    if (req.method === 'GET') {
      const { data: currentState } = await supabase
        .from('kill_switch_state')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return new Response(
        JSON.stringify({
          success: true,
          killSwitch: currentState || { is_active: false, reason: 'Not initialized' },
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, activated_by, reason, metadata } = body;

      if (!action || !['ACTIVATE', 'DEACTIVATE'].includes(action)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid action. Must be ACTIVATE or DEACTIVATE',
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const isActivating = action === 'ACTIVATE';
      const timestamp = new Date().toISOString();

      const newState = {
        is_active: isActivating,
        activated_by: activated_by || 'UNKNOWN',
        activated_at: isActivating ? timestamp : null,
        deactivated_at: !isActivating ? timestamp : null,
        reason: reason || (isActivating ? 'Manual activation' : 'Manual deactivation'),
        metadata: metadata || {},
        created_at: timestamp,
        updated_at: timestamp,
      };

      await supabase
        .from('kill_switch_state')
        .insert(newState);

      await supabase
        .from('system_config')
        .update({
          config_value: {
            active: isActivating,
            reason: newState.reason,
            timestamp,
          },
        })
        .eq('config_key', 'kill_switch_status');

      await supabase
        .from('safety_events')
        .insert({
          event_type: isActivating ? 'KILL_SWITCH_ACTIVATED' : 'KILL_SWITCH_DEACTIVATED',
          severity: isActivating ? 'CRITICAL' : 'INFO',
          description: newState.reason,
          action_taken: isActivating ? 'All trading stopped' : 'Trading resumed',
          created_at: timestamp,
        });

      console.log(`Kill Switch ${action} by ${activated_by}: ${reason}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Kill Switch ${action.toLowerCase()}d successfully`,
          killSwitch: newState,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed. Use GET or POST',
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Kill switch manager error:', error);

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

export async function checkKillSwitch(supabase: any): Promise<{ active: boolean; reason?: string }> {
  try {
    const { data } = await supabase
      .from('kill_switch_state')
      .select('is_active, reason')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.is_active) {
      return {
        active: true,
        reason: data.reason || 'Kill switch is active',
      };
    }

    return { active: false };
  } catch (error) {
    console.error('Error checking kill switch:', error);
    return {
      active: true,
      reason: 'Error checking kill switch - defaulting to SAFE mode',
    };
  }
}

export async function autoTriggerKillSwitch(
  supabase: any,
  triggerType: string,
  reason: string,
  metadata: any = {}
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    await supabase
      .from('kill_switch_state')
      .insert({
        is_active: true,
        activated_by: triggerType,
        activated_at: timestamp,
        reason,
        metadata,
        created_at: timestamp,
        updated_at: timestamp,
      });

    await supabase
      .from('system_config')
      .update({
        config_value: {
          active: true,
          reason,
          timestamp,
          trigger: triggerType,
        },
      })
      .eq('config_key', 'kill_switch_status');

    await supabase
      .from('safety_events')
      .insert({
        event_type: 'AUTO_KILL_SWITCH_TRIGGERED',
        severity: 'CRITICAL',
        description: `${triggerType}: ${reason}`,
        action_taken: 'All trading stopped automatically',
        created_at: timestamp,
      });

    console.error(`🚨 AUTO KILL SWITCH TRIGGERED: ${triggerType} - ${reason}`);
  } catch (error) {
    console.error('Error auto-triggering kill switch:', error);
  }
}
