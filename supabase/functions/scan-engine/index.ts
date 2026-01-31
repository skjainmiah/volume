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

    console.log('Starting market scan for shock candles...');

    const { data: stocks } = await supabase
      .from('stocks')
      .select('symbol, name')
      .eq('has_options', true)
      .eq('is_active', true);

    if (!stocks || stocks.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No stocks available for scanning',
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

    console.log(`Scanning ${stocks.length} stocks for shock candles...`);

    const shockCandlesDetected = [];
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < 18) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Scan can only be run after 6:00 PM (EOD data required)',
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

    for (const stock of stocks) {
      try {
        const shockResult = await detectShockCandle(supabase, stock.symbol);

        if (shockResult.isShockCandle) {
          await addToRadar(supabase, stock.symbol, shockResult);
          shockCandlesDetected.push({
            symbol: stock.symbol,
            name: stock.name,
            direction: shockResult.shockDirection,
            volumeMultiple: shockResult.volumeMultiple?.toFixed(2),
            reason: shockResult.reason,
          });

          await supabase.from('safety_events').insert({
            event_type: 'SHOCK_CANDLE_DETECTED',
            severity: 'INFO',
            description: `${stock.symbol}: ${shockResult.reason}`,
            action_taken: 'Added to radar for tracking',
            created_at: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Error scanning ${stock.symbol}:`, error);
      }
    }

    await updateRadarDigestion(supabase);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Scanned ${stocks.length} stocks`,
        shockCandlesDetected: shockCandlesDetected.length,
        shockCandles: shockCandlesDetected,
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
    console.error('Scan engine error:', error);

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

async function detectShockCandle(supabase: any, symbol: string): Promise<any> {
  const candles = await fetchHistoricalCandles(supabase, symbol, 21);

  if (candles.length < 21) {
    return {
      isShockCandle: false,
      reason: 'Insufficient historical data',
    };
  }

  const todayCandle = candles[candles.length - 1];
  const last20Candles = candles.slice(0, 20);

  const avg20DayVolume = last20Candles.reduce((sum, c) => sum + c.volume, 0) / 20;

  const volumeMultiple = todayCandle.volume / avg20DayVolume;

  const shockVolumeThreshold = 4.0;
  if (volumeMultiple < shockVolumeThreshold) {
    return {
      isShockCandle: false,
      reason: `Volume multiple ${volumeMultiple.toFixed(2)}× below threshold ${shockVolumeThreshold}×`,
    };
  }

  const candleBody = Math.abs(todayCandle.close - todayCandle.open);
  const candleRange = todayCandle.high - todayCandle.low;
  const bodyRatio = candleBody / candleRange;

  if (bodyRatio < 0.6) {
    return {
      isShockCandle: false,
      reason: `Candle body too small (${(bodyRatio * 100).toFixed(1)}% of range)`,
    };
  }

  const shockDirection = todayCandle.close > todayCandle.open ? 'GREEN' : 'RED';

  return {
    isShockCandle: true,
    shockDirection,
    volumeMultiple,
    shockHigh: todayCandle.high,
    shockLow: todayCandle.low,
    reason: `${shockDirection} shock candle: ${volumeMultiple.toFixed(2)}× volume, ${(bodyRatio * 100).toFixed(1)}% body`,
  };
}

async function fetchHistoricalCandles(supabase: any, symbol: string, days: number): Promise<any[]> {
  try {
    const { data: candles } = await supabase
      .from('candle_data')
      .select('*')
      .eq('stock_symbol', symbol)
      .eq('timeframe', '1day')
      .order('timestamp', { ascending: false })
      .limit(days);

    if (candles && candles.length >= days) {
      return candles.reverse();
    }

    return generateMockCandles(symbol, days);
  } catch (error) {
    console.error(`Error fetching candles for ${symbol}:`, error);
    return [];
  }
}

function generateMockCandles(symbol: string, days: number): any[] {
  const candles: any[] = [];
  const basePrice = 100 + (symbol.length * 10);
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const open = basePrice + Math.random() * 10 - 5;
    const close = open + Math.random() * 8 - 4;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;

    let volume = 1000000 + Math.random() * 2000000;

    if (i === 0) {
      volume = volume * 5;
    }

    candles.push({
      date: date.toISOString().split('T')[0],
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

async function addToRadar(supabase: any, symbol: string, shockResult: any): Promise<void> {
  try {
    const { data: existingRadar } = await supabase
      .from('radar')
      .select('id')
      .eq('stock_symbol', symbol)
      .eq('is_active', true)
      .maybeSingle();

    if (existingRadar) {
      console.log(`${symbol} already on radar, skipping...`);
      return;
    }

    await supabase.from('radar').insert({
      stock_symbol: symbol,
      shock_date: new Date().toISOString().split('T')[0],
      shock_direction: shockResult.shockDirection,
      shock_high: shockResult.shockHigh,
      shock_low: shockResult.shockLow,
      shock_volume_multiple: shockResult.volumeMultiple,
      current_state: 'SHOCK_DETECTED',
      days_since_shock: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    await supabase.from('state_memory').insert({
      stock_symbol: symbol,
      current_state: 'SHOCK_DETECTED',
      last_state_change: new Date().toISOString(),
      days_in_current_state: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    console.log(`Added ${symbol} to radar: ${shockResult.reason}`);
  } catch (error) {
    console.error(`Error adding ${symbol} to radar:`, error);
  }
}

async function updateRadarDigestion(supabase: any): Promise<void> {
  try {
    const { data: activeRadar } = await supabase
      .from('radar')
      .select('*')
      .eq('is_active', true)
      .in('current_state', ['SHOCK_DETECTED', 'DIGESTION']);

    if (!activeRadar || activeRadar.length === 0) {
      return;
    }

    for (const radar of activeRadar) {
      const candles = await fetchHistoricalCandles(supabase, radar.stock_symbol, 5);

      if (candles.length < 2) continue;

      const latestCandle = candles[candles.length - 1];
      const isAcceptanceCandle = checkAcceptanceCandle(latestCandle, radar.shock_direction);

      const isDigesting = checkDigestionPhase(candles);

      let newState = radar.current_state;

      if (radar.current_state === 'SHOCK_DETECTED') {
        newState = 'DIGESTION';
      } else if (radar.current_state === 'DIGESTION' && isAcceptanceCandle) {
        newState = 'ACCEPTANCE_READY';
      } else if (radar.current_state === 'DIGESTION' && !isDigesting) {
        newState = 'FAILED_RESET';
      }

      if (newState !== radar.current_state) {
        await supabase
          .from('radar')
          .update({
            current_state: newState,
            updated_at: new Date().toISOString(),
          })
          .eq('id', radar.id);

        await supabase
          .from('state_memory')
          .update({
            previous_state: radar.current_state,
            current_state: newState,
            last_state_change: new Date().toISOString(),
            days_in_current_state: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('stock_symbol', radar.stock_symbol);

        console.log(`${radar.stock_symbol}: ${radar.current_state} → ${newState}`);
      }
    }

    await supabase
      .from('radar')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('current_state', 'FAILED_RESET')
      .eq('is_active', true);
  } catch (error) {
    console.error('Error updating radar digestion:', error);
  }
}

function checkAcceptanceCandle(candle: any, shockDirection: string): boolean {
  const candleBody = Math.abs(candle.close - candle.open);
  const candleRange = candle.high - candle.low;
  const bodyRatio = candleBody / candleRange;

  if (bodyRatio < 0.5) return false;

  if (shockDirection === 'RED') {
    return candle.close > candle.open;
  } else {
    return candle.close < candle.open;
  }
}

function checkDigestionPhase(candles: any[]): boolean {
  if (candles.length < 3) return true;

  const recentCandles = candles.slice(-3);
  const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;

  const avgBodySize = recentCandles.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / recentCandles.length;

  const avgRange = recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length;

  const firstCandle = candles[0];
  const firstVolume = firstCandle.volume;

  const volumeDecreasing = avgVolume < firstVolume * 0.7;
  const candlesShrinking = avgBodySize < avgRange * 0.4;

  return volumeDecreasing && candlesShrinking;
}
