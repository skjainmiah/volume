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

    const killSwitchCheck = await checkKillSwitch(supabase);
    if (killSwitchCheck.active) {
      return new Response(
        JSON.stringify({
          success: false,
          message: '🚨 KILL SWITCH ACTIVE - Trading disabled',
          reason: killSwitchCheck.reason,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const windowCheck = await checkDecisionWindow(supabase);
    if (!windowCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: windowCheck.reason,
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

    const { data: systemConfig } = await supabase
      .from('system_config')
      .select('*');

    const config = systemConfig?.reduce((acc: any, item: any) => {
      acc[item.config_key] = item.config_value;
      return acc;
    }, {});

    const tradingMode = config.trading_mode?.mode || 'PAPER';
    const scoreThreshold = config.score_threshold?.value || 0.6;
    const riskLimits = config.risk_limits || {
      maxRiskPerTradePct: 1.0,
      maxLossPerDayPct: 2.0,
      maxTradesPerDay: 5,
      consecutiveLossThrottle: 3,
    };

    const systemState = await getSystemState(supabase, tradingMode, riskLimits);

    const safetyCheck = await checkTradeAllowed(supabase, systemState, riskLimits);
    if (!safetyCheck.passed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: safetyCheck.reason,
          actionTaken: safetyCheck.actionTaken,
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

    const { data: weightsData } = await supabase
      .from('learning_weights')
      .select('feature_name, current_weight');

    const weights: any = {};
    weightsData?.forEach((w: any) => {
      weights[w.feature_name] = w.current_weight;
    });

    const { data: activeRadar } = await supabase
      .from('radar')
      .select('*')
      .eq('is_active', true)
      .eq('current_state', 'ACCEPTANCE_READY');

    if (!activeRadar || activeRadar.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
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
      const candles = await fetchCandles(supabase, radar.stock_symbol, 10);

      if (candles.length < 5) {
        console.log(`Insufficient candle data for ${radar.stock_symbol}`);
        continue;
      }

      const features = calculateFeatures(radar, candles);

      await saveFeatureSnapshot(supabase, radar.id, features);

      const score = calculateScore(features, weights);

      const calibrationData = await getCalibrationData(supabase, score);
      const calibratedScore = score * calibrationData.factor;

      let decision = 'WAIT';
      let shouldUseLLM = false;

      if (calibratedScore >= scoreThreshold) {
        decision = features.option_type === 'CALL' ? 'BUY_CALL' : 'BUY_PUT';
      } else if (Math.abs(calibratedScore - scoreThreshold) < 0.05) {
        shouldUseLLM = true;
      }

      let llmResponse = null;
      if (shouldUseLLM && config.llm_provider) {
        llmResponse = await consultLLM(
          supabase,
          config.llm_provider,
          radar,
          features,
          score,
          scoreThreshold
        );

        if (llmResponse.confidence >= scoreThreshold) {
          decision = llmResponse.decision;
        }
      }

      await supabase
        .from('decisions_log')
        .insert({
          radar_id: radar.id,
          decision_time: new Date().toISOString(),
          decision_type: decision,
          pre_llm_score: score,
          llm_provider: llmResponse?.provider || null,
          llm_model: llmResponse?.model || null,
          prompt_version_id: llmResponse?.promptId || null,
          raw_confidence: llmResponse?.rawConfidence || score,
          calibrated_confidence: llmResponse?.confidence || calibratedScore,
          calibration_factor: calibrationData.factor,
          decision_reason: llmResponse?.reasoning || `Automated scoring: ${score.toFixed(3)}`,
          trade_executed: false,
          trade_id: null,
        });

      if (decision !== 'WAIT') {
        const positionSize = calculatePositionSize(
          systemState.totalCapital,
          systemState.availableCapital,
          calibratedScore,
          systemState.consecutiveLosses,
          riskLimits
        );

        if (positionSize.finalLotCount > 0) {
          const tradeId = await executeTrade(
            supabase,
            tradingMode,
            radar,
            features,
            positionSize,
            calibratedScore,
            score
          );

          await supabase
            .from('decisions_log')
            .update({
              trade_executed: true,
              trade_id: tradeId,
            })
            .eq('radar_id', radar.id)
            .order('decision_time', { ascending: false })
            .limit(1);

          decisions.push({
            radarId: radar.id,
            stock: radar.stock_symbol,
            decision,
            score: score.toFixed(3),
            calibratedScore: calibratedScore.toFixed(3),
            tradeExecuted: true,
            tradeId,
            lotSize: positionSize.finalLotCount,
            capitalUsed: positionSize.capitalUsed,
          });
        } else {
          decisions.push({
            radarId: radar.id,
            stock: radar.stock_symbol,
            decision,
            score: score.toFixed(3),
            calibratedScore: calibratedScore.toFixed(3),
            tradeExecuted: false,
            reason: positionSize.reason,
          });
        }
      } else {
        decisions.push({
          radarId: radar.id,
          stock: radar.stock_symbol,
          decision: 'WAIT',
          score: score.toFixed(3),
          calibratedScore: calibratedScore.toFixed(3),
          reason: 'Score below threshold',
        });
      }
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

async function checkDecisionWindow(supabase: any): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'decision_window')
      .maybeSingle();

    const startTime = data?.config_value?.start_time || '15:00';
    const endTime = data?.config_value?.end_time || '15:15';

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    if (currentTime < startTime || currentTime > endTime) {
      return {
        allowed: false,
        reason: `Outside decision window (${startTime} - ${endTime})`,
      };
    }

    return { allowed: true };
  } catch (error) {
    return { allowed: false, reason: 'Error validating decision window' };
  }
}

async function getSystemState(supabase: any, tradingMode: string, _riskLimits: any): Promise<any> {
  const today = new Date().toISOString().split('T')[0];

  const { data: todayTrades } = await supabase
    .from('trades')
    .select('pnl')
    .eq('trade_mode', tradingMode)
    .gte('entry_time', today);

  const todayPnL = todayTrades?.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) || 0;
  const todayTradesCount = todayTrades?.length || 0;

  const { data: recentTrades } = await supabase
    .from('trades')
    .select('pnl')
    .eq('trade_mode', tradingMode)
    .order('exit_time', { ascending: false })
    .limit(10);

  let consecutiveLosses = 0;
  for (const trade of recentTrades || []) {
    if (trade.pnl && trade.pnl < 0) {
      consecutiveLosses++;
    } else {
      break;
    }
  }

  const { data: activePositions } = await supabase
    .from('trades')
    .select('capital_used')
    .eq('trade_mode', tradingMode)
    .is('exit_time', null);

  const activePositionsCount = activePositions?.length || 0;
  const capitalInUse = activePositions?.reduce((sum: number, p: any) => sum + (p.capital_used || 0), 0) || 0;

  const totalCapital = 100000;
  const availableCapital = totalCapital - capitalInUse;

  return {
    totalCapital,
    availableCapital,
    todayPnL,
    todayTradesCount,
    consecutiveLosses,
    activePositionsCount,
    tradingMode,
    marketDataHealthy: true,
    brokerApiHealthy: true,
    llmHealthy: true,
  };
}

async function checkTradeAllowed(supabase: any, systemState: any, riskLimits: any): Promise<any> {
  const maxLossAllowed = (riskLimits.maxLossPerDayPct / 100) * systemState.totalCapital;
  const currentLoss = Math.abs(Math.min(systemState.todayPnL, 0));

  if (currentLoss >= maxLossAllowed) {
    await autoTriggerKillSwitch(
      supabase,
      'DAILY_DRAWDOWN',
      `Daily loss limit breached: ₹${currentLoss.toFixed(2)} / ₹${maxLossAllowed.toFixed(2)}`,
      { currentLoss, maxLossAllowed, todayPnL: systemState.todayPnL }
    );

    await supabase
      .from('safety_events')
      .insert({
        event_type: 'DAILY_LOSS_LIMIT_BREACH',
        severity: 'CRITICAL',
        description: `Daily loss limit breached: ₹${currentLoss.toFixed(2)} / ₹${maxLossAllowed.toFixed(2)}`,
        action_taken: 'Kill switch activated - all trades blocked',
        created_at: new Date().toISOString(),
      });

    return {
      passed: false,
      reason: 'Daily loss limit breached - Kill Switch activated',
      actionTaken: 'KILL_SWITCH_ACTIVATED',
    };
  }

  if (systemState.todayTradesCount >= riskLimits.maxTradesPerDay) {
    return {
      passed: false,
      reason: `Max trades per day reached: ${systemState.todayTradesCount}`,
      actionTaken: 'BLOCKED_TRADE',
    };
  }

  if (systemState.consecutiveLosses >= riskLimits.consecutiveLossThrottle) {
    await autoTriggerKillSwitch(
      supabase,
      'CONSECUTIVE_LOSSES',
      `${systemState.consecutiveLosses} consecutive losses detected`,
      { consecutiveLosses: systemState.consecutiveLosses, threshold: riskLimits.consecutiveLossThrottle }
    );

    return {
      passed: false,
      reason: `Consecutive loss threshold breached - Kill Switch activated`,
      actionTaken: 'KILL_SWITCH_ACTIVATED',
    };
  }

  return { passed: true };
}

async function fetchCandles(supabase: any, symbol: string, days: number): Promise<any[]> {
  const { data } = await supabase
    .from('market_data_cache')
    .select('data')
    .eq('symbol', symbol)
    .eq('data_type', 'CANDLE')
    .gt('expires_at', new Date().toISOString())
    .order('fetched_at', { ascending: false })
    .limit(days);

  return data?.map((d: any) => d.data) || [];
}

function calculateFeatures(radar: any, candles: any[]): any {
  const latestCandle = candles[candles.length - 1];
  const currentPrice = latestCandle?.close || 0;

  const bodySize = Math.abs(latestCandle.close - latestCandle.open);
  const range = latestCandle.high - latestCandle.low;
  const bodyRatio = bodySize / range;

  const acceptanceCandle =
    bodyRatio >= 0.5 &&
    ((radar.shock_direction === 'RED' && latestCandle.close > latestCandle.open) ||
      (radar.shock_direction === 'GREEN' && latestCandle.close < latestCandle.open));

  const recentVolumes = candles.slice(-3).map((c: any) => c.volume);
  const avgRecent = recentVolumes.reduce((a: number, b: number) => a + b, 0) / recentVolumes.length;
  const earlierVolumes = candles.slice(-6, -3).map((c: any) => c.volume);
  const avgEarlier = earlierVolumes.reduce((a: number, b: number) => a + b, 0) / earlierVolumes.length;

  const volumeTrend =
    avgRecent < avgEarlier * 0.8 ? 'DECREASING' : avgRecent > avgEarlier * 1.2 ? 'EXPANDING' : 'FLAT';

  const closes = candles.slice(-10).map((c: any) => c.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const change = ((last - first) / first) * 100;

  const trend = change > 3 ? 'UP' : change < -3 ? 'DOWN' : 'RANGE';

  let optionType = 'CALL';
  if (radar.shock_direction === 'RED' && acceptanceCandle) {
    optionType = 'CALL';
  } else if (radar.shock_direction === 'GREEN' && acceptanceCandle) {
    optionType = 'PUT';
  } else if (trend === 'DOWN') {
    optionType = 'PUT';
  }

  return {
    shock_candle: true,
    shock_direction: radar.shock_direction,
    shock_volume_multiple: radar.shock_volume_multiple,
    days_since_shock: radar.days_since_shock || 0,
    volume_trend: volumeTrend,
    acceptance_candle: acceptanceCandle,
    trend,
    event_support: radar.shock_low,
    event_resistance: radar.shock_high,
    distance_to_support_pct: ((currentPrice - radar.shock_low) / radar.shock_low) * 100,
    distance_to_resistance_pct: ((radar.shock_high - currentPrice) / currentPrice) * 100,
    option_type: optionType,
    strike_type: 'ATM',
    bid_ask_spread_pct: 1.0,
    oi_alignment: 'ALIGNED',
    fii_flow: 'NEUTRAL',
    dii_flow: 'NEUTRAL',
    news_risk: 'LOW',
  };
}

async function saveFeatureSnapshot(supabase: any, radarId: string, features: any): Promise<void> {
  try {
    await supabase.from('features_snapshot').insert({
      radar_id: radarId,
      snapshot_date: new Date().toISOString().split('T')[0],
      ...features,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error saving feature snapshot:', error);
  }
}

function calculateScore(features: any, weights: any): number {
  let score = 0;
  let totalWeight = 0;

  const featureValues: any = {
    shock_candle: features.shock_candle ? 1 : 0,
    shock_volume_multiple: Math.min(features.shock_volume_multiple / 10, 1),
    acceptance_candle: features.acceptance_candle ? 1 : 0,
    volume_decreasing: features.volume_trend === 'DECREASING' ? 1 : 0,
    distance_to_support: Math.max(0, 1 - Math.abs(features.distance_to_support_pct) / 10),
    trend_aligned: (features.trend === 'UP' && features.option_type === 'CALL') ||
                   (features.trend === 'DOWN' && features.option_type === 'PUT') ? 1 : 0,
  };

  for (const [key, value] of Object.entries(featureValues)) {
    const weight = weights[key] || 1.0;
    score += (value as number) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? score / totalWeight : 0;
}

async function getCalibrationData(supabase: any, score: number): Promise<any> {
  const confidenceRange = 0.1;
  const { data: history } = await supabase
    .from('calibration_history')
    .select('*')
    .gte('raw_confidence', score - confidenceRange)
    .lte('raw_confidence', score + confidenceRange)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!history || history.length < 5) {
    return { factor: 0.9 };
  }

  const wins = history.filter((h: any) => h.trade_outcome === 'WIN').length;
  const accuracy = wins / history.length;

  let factor = 1.0;
  if (accuracy < 0.4) factor = 0.6;
  else if (accuracy < 0.5) factor = 0.8;
  else if (accuracy > 0.7) factor = 1.1;

  return { factor: Math.max(0.5, Math.min(1.2, factor)) };
}

async function consultLLM(supabase: any, provider: any, radar: any, features: any, score: number, threshold: number): Promise<any> {
  try {
    const { data: apiConfig } = await supabase
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'openai_api')
      .maybeSingle();

    const openaiKey = apiConfig?.config_value?.api_key || Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      console.warn('No OpenAI API key found, returning default decision');
      return {
        provider: provider.provider || 'openai',
        model: 'gpt-4',
        promptId: 'default',
        decision: 'WAIT',
        confidence: 0.5,
        rawConfidence: 0.5,
        reasoning: 'No API key configured - defaulting to WAIT',
      };
    }

    const prompt = `You are an expert options trading analyst. A stock has shown a ${radar.shock_direction} shock candle ${radar.days_since_shock} days ago.

Stock: ${radar.stock_symbol}
Shock Direction: ${radar.shock_direction}
Days Since Shock: ${radar.days_since_shock}
Current State: ${radar.current_state}

Features Analysis:
- Digestion Quality: ${features.digestion_quality.toFixed(2)}
- Acceptance Pattern: ${features.acceptance_pattern.toFixed(2)}
- Volume Behavior: ${features.volume_behavior.toFixed(2)}
- Historical Probability: ${features.historical_probability.toFixed(2)}

Algorithm Score: ${score.toFixed(3)} (Threshold: ${threshold})

The strategy is:
- GREEN shock → wait for acceptance (red candle after digestion) → BUY PUT
- RED shock → wait for acceptance (green candle after digestion) → BUY CALL

Based on this data, should we:
1. EXECUTE - Take the trade now (high confidence)
2. WAIT - Not enough confirmation yet

Respond in JSON format:
{
  "decision": "EXECUTE" or "WAIT",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a conservative options trading analyst. Respond only in valid JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return {
        provider: 'openai',
        model: 'gpt-4',
        promptId: 'default',
        decision: 'WAIT',
        confidence: 0.5,
        rawConfidence: 0.5,
        reasoning: 'API error - defaulting to WAIT',
      };
    }

    const result = await response.json();
    const llmText = result.choices[0]?.message?.content || '{}';

    let parsed;
    try {
      parsed = JSON.parse(llmText);
    } catch {
      const match = llmText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        parsed = { decision: 'WAIT', confidence: 0.5, reasoning: 'Failed to parse LLM response' };
      }
    }

    return {
      provider: 'openai',
      model: 'gpt-4',
      promptId: 'default',
      decision: parsed.decision || 'WAIT',
      confidence: parsed.confidence || 0.5,
      rawConfidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error: any) {
    console.error('Error in consultLLM:', error);
    return {
      provider: provider.provider || 'openai',
      model: 'gpt-4',
      promptId: 'default',
      decision: 'WAIT',
      confidence: 0.5,
      rawConfidence: 0.5,
      reasoning: `Error: ${error.message}`,
    };
  }
}

function calculatePositionSize(
  totalCapital: number,
  availableCapital: number,
  calibratedConfidence: number,
  consecutiveLosses: number,
  riskLimits: any
): any {
  if (calibratedConfidence < 0.4) {
    return {
      finalLotCount: 0,
      capitalUsed: 0,
      reason: 'Confidence too low',
    };
  }

  const maxLossPerTrade = (riskLimits.maxRiskPerTradePct / 100) * totalCapital;

  const confidenceMultiplier =
    calibratedConfidence < 0.55 ? 0.5 :
    calibratedConfidence < 0.7 ? 0.75 : 1.0;

  const baseRiskAmount = maxLossPerTrade * confidenceMultiplier;

  const lossThrottleMultiplier = Math.pow(0.7, consecutiveLosses);
  const adjustedRiskAmount = baseRiskAmount * lossThrottleMultiplier;

  const estimatedOptionPrice = 100;
  const baseLotSize = Math.floor(adjustedRiskAmount / (estimatedOptionPrice * 0.15));
  const finalLotCount = Math.max(1, baseLotSize);

  const capitalUsed = estimatedOptionPrice * finalLotCount;

  if (capitalUsed > availableCapital) {
    return {
      finalLotCount: 0,
      capitalUsed: 0,
      reason: 'Insufficient available capital',
    };
  }

  return {
    finalLotCount,
    capitalUsed,
    riskAmount: adjustedRiskAmount,
  };
}

async function executeTrade(
  supabase: any,
  tradingMode: string,
  radar: any,
  features: any,
  positionSize: any,
  calibratedConfidence: number,
  rawConfidence: number
): Promise<string> {
  const optionType = features.option_type;

  const { data: stockData } = await supabase
    .from('stocks')
    .select('last_price, has_options')
    .eq('symbol', radar.stock_symbol)
    .maybeSingle();

  if (!stockData?.has_options) {
    throw new Error(`${radar.stock_symbol} does not have tradable options - CANNOT EXECUTE`);
  }

  const spotPrice = stockData.last_price || 2000;

  const { data: optionsChain } = await supabase
    .from('options_chain')
    .select('*')
    .eq('stock_symbol', radar.stock_symbol)
    .eq('option_type', optionType)
    .eq('is_liquid', true)
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .order('expiry_date', { ascending: true });

  if (!optionsChain || optionsChain.length === 0) {
    throw new Error(`No liquid ${optionType} options available for ${radar.stock_symbol}`);
  }

  const nearestExpiry = optionsChain[0].expiry_date;
  const expiryOptions = optionsChain.filter((o: any) => o.expiry_date === nearestExpiry);

  let selectedOption = null;
  let minDistance = Infinity;

  for (const option of expiryOptions) {
    const distance = Math.abs(option.strike_price - spotPrice);
    if (distance < minDistance) {
      minDistance = distance;
      selectedOption = option;
    }
  }

  if (!selectedOption) {
    throw new Error(`Could not select appropriate option strike for ${radar.stock_symbol}`);
  }

  const isATM = Math.abs(selectedOption.strike_price - spotPrice) < 50;
  const strikeType = isATM ? 'ATM' :
    (optionType === 'CALL' && selectedOption.strike_price < spotPrice) ? 'ITM' :
    (optionType === 'PUT' && selectedOption.strike_price > spotPrice) ? 'ITM' : 'OTM';

  const entryPrice = selectedOption.ltp;
  const stopLoss = entryPrice * 0.85;

  const { data: tradeData } = await supabase
    .from('trades')
    .insert({
      radar_id: radar.id,
      trade_mode: tradingMode,
      stock_symbol: radar.stock_symbol,
      option_symbol: selectedOption.groww_symbol,
      option_type: optionType,
      strike_price: selectedOption.strike_price,
      strike_type: strikeType,
      expiry_date: selectedOption.expiry_date,
      entry_price: entryPrice,
      entry_time: new Date().toISOString(),
      lot_size: positionSize.finalLotCount,
      capital_used: positionSize.capitalUsed,
      stop_loss: stopLoss,
      calibrated_confidence: calibratedConfidence,
      raw_confidence: rawConfidence,
      llm_used: false,
      status: 'OPEN',
    })
    .select()
    .single();

  await supabase
    .from('radar')
    .update({
      current_state: 'TRADE_ACTIVE',
      updated_at: new Date().toISOString(),
    })
    .eq('id', radar.id);

  await supabase.from('safety_events').insert({
    event_type: 'OPTION_TRADE_EXECUTED',
    severity: 'INFO',
    description: `${tradingMode}: BUY ${optionType} ${radar.stock_symbol} ${selectedOption.strike_price} @ ₹${entryPrice}`,
    action_taken: `Lot Size: ${positionSize.finalLotCount}, Capital: ₹${positionSize.capitalUsed}`,
    metadata: {
      trade_id: tradeData?.id,
      option_symbol: selectedOption.groww_symbol,
      strike_type: strikeType,
      expiry: selectedOption.expiry_date,
    },
  });

  return tradeData?.id || 'unknown';
}

async function checkKillSwitch(supabase: any): Promise<{ active: boolean; reason?: string }> {
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

async function autoTriggerKillSwitch(
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
