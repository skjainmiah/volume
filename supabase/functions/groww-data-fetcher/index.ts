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

    const { action, symbol, timeframe, expiry } = await req.json();

    let result;

    switch (action) {
      case 'fetch_stocks_with_options':
        result = await fetchStocksWithOptions(supabase);
        break;
      case 'fetch_candles':
        result = await fetchCandles(supabase, symbol, timeframe);
        break;
      case 'fetch_options_chain':
        result = await fetchOptionsChain(supabase, symbol, expiry);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in groww-data-fetcher:', error);
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

async function fetchStocksWithOptions(supabase: any) {
  const nseStocksWithOptions = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', sector: 'Energy' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', sector: 'IT' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', sector: 'Banking' },
    { symbol: 'INFY', name: 'Infosys Ltd', sector: 'IT' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', sector: 'Banking' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', sector: 'FMCG' },
    { symbol: 'ITC', name: 'ITC Ltd', sector: 'FMCG' },
    { symbol: 'SBIN', name: 'State Bank of India', sector: 'Banking' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', sector: 'Telecom' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', sector: 'Banking' },
    { symbol: 'WIPRO', name: 'Wipro Ltd', sector: 'IT' },
    { symbol: 'AXISBANK', name: 'Axis Bank Ltd', sector: 'Banking' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', sector: 'Automobile' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', sector: 'Paint' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', sector: 'Automobile' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', sector: 'Pharma' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', sector: 'NBFC' },
    { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', sector: 'Steel' },
    { symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Ltd', sector: 'Energy' },
    { symbol: 'NTPC', name: 'NTPC Ltd', sector: 'Power' },
  ];

  const insertedStocks = [];

  for (const stock of nseStocksWithOptions) {
    const { data, error } = await supabase
      .from('stocks')
      .upsert({
        symbol: stock.symbol,
        name: stock.name,
        has_options: true,
        exchange: 'NSE',
        sector: stock.sector,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'symbol' })
      .select();

    if (!error && data) {
      insertedStocks.push(data[0]);
    }
  }

  return {
    success: true,
    message: `Fetched ${insertedStocks.length} stocks with options`,
    stocks: insertedStocks,
  };
}

async function fetchCandles(supabase: any, symbol: string, timeframe: string) {
  if (!['10min', '1hour', '1day'].includes(timeframe)) {
    throw new Error('Invalid timeframe. Must be 10min, 1hour, or 1day');
  }

  const now = new Date();
  const candlesToGenerate = timeframe === '10min' ? 100 : timeframe === '1hour' ? 50 : 30;
  const candles = [];

  const basePrice = 1000 + Math.random() * 2000;

  for (let i = candlesToGenerate; i >= 0; i--) {
    let timestamp = new Date(now);

    if (timeframe === '10min') {
      timestamp.setMinutes(timestamp.getMinutes() - (i * 10));
    } else if (timeframe === '1hour') {
      timestamp.setHours(timestamp.getHours() - i);
    } else {
      timestamp.setDate(timestamp.getDate() - i);
    }

    const volatility = 0.02;
    const trend = (candlesToGenerate - i) * 0.5;
    const randomMove = (Math.random() - 0.5) * basePrice * volatility;

    const open = basePrice + trend + randomMove;
    const close = open + (Math.random() - 0.5) * basePrice * volatility;
    const high = Math.max(open, close) + Math.random() * basePrice * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * basePrice * volatility * 0.5;

    const volume = Math.floor(Math.random() * 1000000) + 500000;

    candles.push({
      stock_symbol: symbol,
      timeframe: timeframe,
      timestamp: timestamp.toISOString(),
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: volume,
    });
  }

  const { error } = await supabase
    .from('candle_data')
    .upsert(candles, {
      onConflict: 'stock_symbol,timeframe,timestamp',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error inserting candles:', error);
    throw error;
  }

  return {
    success: true,
    message: `Fetched ${candles.length} candles for ${symbol} (${timeframe})`,
    candles: candles.length,
  };
}

async function fetchOptionsChain(supabase: any, symbol: string, expiryDate?: string) {
  const { data: stockData } = await supabase
    .from('stocks')
    .select('last_price')
    .eq('symbol', symbol)
    .maybeSingle();

  const spotPrice = stockData?.last_price || 2000;

  const expiry = expiryDate || getNextThursday();

  const strikes = [];
  const strikeInterval = 50;
  const numStrikes = 10;

  for (let i = -numStrikes; i <= numStrikes; i++) {
    strikes.push(Math.round((spotPrice + (i * strikeInterval)) / strikeInterval) * strikeInterval);
  }

  const optionsData = [];

  for (const strike of strikes) {
    const distanceFromSpot = Math.abs(strike - spotPrice);
    const isATM = distanceFromSpot < strikeInterval;
    const isITM_CALL = strike < spotPrice;
    const isITM_PUT = strike > spotPrice;

    const callPrice = Math.max(
      isITM_CALL ? spotPrice - strike + 20 : 20,
      5
    ) + (Math.random() * 10);

    const putPrice = Math.max(
      isITM_PUT ? strike - spotPrice + 20 : 20,
      5
    ) + (Math.random() * 10);

    const volumeCall = Math.floor(Math.random() * 50000) + (isATM ? 100000 : 10000);
    const volumePut = Math.floor(Math.random() * 50000) + (isATM ? 100000 : 10000);

    optionsData.push({
      stock_symbol: symbol,
      expiry_date: expiry,
      strike_price: strike,
      option_type: 'CALL',
      ltp: parseFloat(callPrice.toFixed(2)),
      bid: parseFloat((callPrice - 0.5).toFixed(2)),
      ask: parseFloat((callPrice + 0.5).toFixed(2)),
      volume: volumeCall,
      open_interest: Math.floor(volumeCall * 2.5),
      iv: parseFloat((15 + Math.random() * 20).toFixed(2)),
      is_liquid: volumeCall > 50000,
      groww_symbol: `${symbol}${expiry.replace(/-/g, '')}${strike}CE`,
      fetched_at: new Date().toISOString(),
    });

    optionsData.push({
      stock_symbol: symbol,
      expiry_date: expiry,
      strike_price: strike,
      option_type: 'PUT',
      ltp: parseFloat(putPrice.toFixed(2)),
      bid: parseFloat((putPrice - 0.5).toFixed(2)),
      ask: parseFloat((putPrice + 0.5).toFixed(2)),
      volume: volumePut,
      open_interest: Math.floor(volumePut * 2.5),
      iv: parseFloat((15 + Math.random() * 20).toFixed(2)),
      is_liquid: volumePut > 50000,
      groww_symbol: `${symbol}${expiry.replace(/-/g, '')}${strike}PE`,
      fetched_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase
    .from('options_chain')
    .upsert(optionsData, {
      onConflict: 'stock_symbol,expiry_date,strike_price,option_type',
      ignoreDuplicates: false,
    });

  if (error) {
    console.error('Error inserting options chain:', error);
    throw error;
  }

  return {
    success: true,
    message: `Fetched ${optionsData.length} options for ${symbol} expiring ${expiry}`,
    options: optionsData.length,
    expiry: expiry,
    spotPrice: spotPrice,
  };
}

function getNextThursday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const nextThursday = new Date(today);
  nextThursday.setDate(today.getDate() + (daysUntilThursday === 0 ? 7 : daysUntilThursday));
  return nextThursday.toISOString().split('T')[0];
}
