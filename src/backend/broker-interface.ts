import { TradingMode, TradeRequest } from './types';

interface OrderResponse {
  success: boolean;
  orderId?: string;
  executionPrice?: number;
  error?: string;
}

interface Position {
  tradeId: string;
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  trailingStop?: number;
}

export abstract class BrokerInterface {
  protected mode: TradingMode;
  protected supabaseClient: any;

  constructor(mode: TradingMode, supabaseClient: any) {
    this.mode = mode;
    this.supabaseClient = supabaseClient;
  }

  abstract placeOrder(request: TradeRequest): Promise<OrderResponse>;
  abstract modifyStopLoss(tradeId: string, newStopLoss: number): Promise<boolean>;
  abstract exitPosition(tradeId: string, exitReason: string): Promise<OrderResponse>;
  abstract getCurrentPrice(symbol: string): Promise<number>;
  abstract monitorPositions(): Promise<Position[]>;

  getMode(): TradingMode {
    return this.mode;
  }

  getLearningWeight(): number {
    return this.mode === 'PAPER' ? 0.3 : 1.0;
  }
}

export class PaperBroker extends BrokerInterface {
  private simulatedSlippage: number = 0.001;

  async placeOrder(request: TradeRequest): Promise<OrderResponse> {
    try {
      const slippageAdjustedPrice =
        request.entryPrice * (1 + this.simulatedSlippage);

      const { data: tradeData, error } = await this.supabaseClient
        .from('trades')
        .insert({
          radar_id: request.radarId,
          trade_mode: 'PAPER',
          stock_symbol: request.stockSymbol,
          option_symbol: request.optionSymbol,
          option_type: request.optionType,
          strike_price: request.strikePrice,
          strike_type: request.strikeType,
          entry_price: slippageAdjustedPrice,
          entry_time: new Date().toISOString(),
          lot_size: request.lotSize,
          capital_used:
            slippageAdjustedPrice * request.lotSize,
          stop_loss: request.stopLoss,
          calibrated_confidence: request.calibratedConfidence,
          raw_confidence: request.rawConfidence,
          llm_used: true,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        orderId: tradeData.id,
        executionPrice: slippageAdjustedPrice,
      };
    } catch (error: any) {
      console.error('Paper broker order error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async modifyStopLoss(tradeId: string, newStopLoss: number): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient
        .from('trades')
        .update({
          trailing_sl: newStopLoss,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Paper broker modify SL error:', error);
      return false;
    }
  }

  async exitPosition(tradeId: string, exitReason: string): Promise<OrderResponse> {
    try {
      const { data: trade } = await this.supabaseClient
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (!trade) {
        return { success: false, error: 'Trade not found' };
      }

      const currentPrice = await this.getCurrentPrice(trade.option_symbol);
      const exitPrice = currentPrice * (1 - this.simulatedSlippage);
      const pnl = (exitPrice - trade.entry_price) * trade.lot_size;
      const pnlPct = ((exitPrice - trade.entry_price) / trade.entry_price) * 100;

      const { error } = await this.supabaseClient
        .from('trades')
        .update({
          exit_price: exitPrice,
          exit_time: new Date().toISOString(),
          exit_reason: exitReason,
          pnl,
          pnl_pct: pnlPct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) throw error;

      await this.supabaseClient
        .from('radar')
        .update({
          current_state: 'IDLE',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.radar_id);

      return {
        success: true,
        executionPrice: exitPrice,
      };
    } catch (error: any) {
      console.error('Paper broker exit error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const cachedPrice = await this.getCachedPrice(symbol);
    if (cachedPrice) return cachedPrice;

    const simulatedPrice = 100 + Math.random() * 50;
    return simulatedPrice;
  }

  async monitorPositions(): Promise<Position[]> {
    try {
      const { data: activeTrades } = await this.supabaseClient
        .from('trades')
        .select('*')
        .eq('trade_mode', 'PAPER')
        .is('exit_time', null);

      if (!activeTrades) return [];

      const positions: Position[] = [];

      for (const trade of activeTrades) {
        const currentPrice = await this.getCurrentPrice(trade.option_symbol);

        positions.push({
          tradeId: trade.id,
          symbol: trade.option_symbol,
          quantity: trade.lot_size,
          entryPrice: trade.entry_price,
          currentPrice,
          stopLoss: trade.stop_loss,
          trailingStop: trade.trailing_sl,
        });
      }

      return positions;
    } catch (error) {
      console.error('Paper broker monitor error:', error);
      return [];
    }
  }

  private async getCachedPrice(symbol: string): Promise<number | null> {
    try {
      const { data } = await this.supabaseClient
        .from('market_data_cache')
        .select('data')
        .eq('symbol', symbol)
        .eq('data_type', 'CANDLE')
        .gt('expires_at', new Date().toISOString())
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();

      if (data && data.data?.close) {
        return data.data.close;
      }

      return null;
    } catch (error) {
      return null;
    }
  }
}

export class RealBroker extends BrokerInterface {
  constructor(
    _apiKey: string,
    _apiSecret: string,
    supabaseClient: any
  ) {
    super('REAL', supabaseClient);
  }

  async placeOrder(request: TradeRequest): Promise<OrderResponse> {
    try {
      const orderPayload = {
        symbol: request.optionSymbol,
        quantity: request.lotSize,
        order_type: 'MARKET',
        transaction_type: 'BUY',
        product: 'INTRADAY',
      };

      const response = await this.callGrowwAPI('/orders', 'POST', orderPayload);

      if (!response.success) {
        return {
          success: false,
          error: response.message || 'Order placement failed',
        };
      }

      const { data: tradeData, error } = await this.supabaseClient
        .from('trades')
        .insert({
          radar_id: request.radarId,
          trade_mode: 'REAL',
          stock_symbol: request.stockSymbol,
          option_symbol: request.optionSymbol,
          option_type: request.optionType,
          strike_price: request.strikePrice,
          strike_type: request.strikeType,
          entry_price: response.averagePrice,
          entry_time: new Date().toISOString(),
          lot_size: request.lotSize,
          capital_used: response.averagePrice * request.lotSize,
          stop_loss: request.stopLoss,
          calibrated_confidence: request.calibratedConfidence,
          raw_confidence: request.rawConfidence,
          llm_used: true,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        orderId: tradeData.id,
        executionPrice: response.averagePrice,
      };
    } catch (error: any) {
      console.error('Real broker order error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async modifyStopLoss(tradeId: string, newStopLoss: number): Promise<boolean> {
    try {
      const { data: trade } = await this.supabaseClient
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (!trade) return false;

      await this.callGrowwAPI('/orders/stoploss', 'PUT', {
        symbol: trade.option_symbol,
        stop_loss: newStopLoss,
      });

      const { error } = await this.supabaseClient
        .from('trades')
        .update({
          trailing_sl: newStopLoss,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Real broker modify SL error:', error);
      return false;
    }
  }

  async exitPosition(tradeId: string, exitReason: string): Promise<OrderResponse> {
    try {
      const { data: trade } = await this.supabaseClient
        .from('trades')
        .select('*')
        .eq('id', tradeId)
        .single();

      if (!trade) {
        return { success: false, error: 'Trade not found' };
      }

      const response = await this.callGrowwAPI('/orders', 'POST', {
        symbol: trade.option_symbol,
        quantity: trade.lot_size,
        order_type: 'MARKET',
        transaction_type: 'SELL',
        product: 'INTRADAY',
      });

      if (!response.success) {
        return {
          success: false,
          error: response.message || 'Exit order failed',
        };
      }

      const exitPrice = response.averagePrice;
      const pnl = (exitPrice - trade.entry_price) * trade.lot_size;
      const pnlPct = ((exitPrice - trade.entry_price) / trade.entry_price) * 100;

      const { error } = await this.supabaseClient
        .from('trades')
        .update({
          exit_price: exitPrice,
          exit_time: new Date().toISOString(),
          exit_reason: exitReason,
          pnl,
          pnl_pct: pnlPct,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tradeId);

      if (error) throw error;

      await this.supabaseClient
        .from('radar')
        .update({
          current_state: 'IDLE',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', trade.radar_id);

      return {
        success: true,
        executionPrice: exitPrice,
      };
    } catch (error: any) {
      console.error('Real broker exit error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const response = await this.callGrowwAPI(`/quotes/${symbol}`, 'GET');
      return response.lastPrice || 0;
    } catch (error) {
      console.error('Error fetching current price:', error);
      return 0;
    }
  }

  async monitorPositions(): Promise<Position[]> {
    try {
      const { data: activeTrades } = await this.supabaseClient
        .from('trades')
        .select('*')
        .eq('trade_mode', 'REAL')
        .is('exit_time', null);

      if (!activeTrades) return [];

      const positions: Position[] = [];

      for (const trade of activeTrades) {
        const currentPrice = await this.getCurrentPrice(trade.option_symbol);

        positions.push({
          tradeId: trade.id,
          symbol: trade.option_symbol,
          quantity: trade.lot_size,
          entryPrice: trade.entry_price,
          currentPrice,
          stopLoss: trade.stop_loss,
          trailingStop: trade.trailing_sl,
        });
      }

      return positions;
    } catch (error) {
      console.error('Real broker monitor error:', error);
      return [];
    }
  }

  private async callGrowwAPI(endpoint: string, method: string, _body?: any): Promise<any> {
    console.log(`Groww API call: ${method} ${endpoint}`);
    throw new Error('Groww API integration not implemented - placeholder for real API');
  }
}
