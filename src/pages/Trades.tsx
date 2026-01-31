import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface Trade {
  id: string;
  trade_mode: 'PAPER' | 'REAL';
  stock_symbol: string;
  option_symbol: string;
  option_type: 'CALL' | 'PUT';
  entry_price: number;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  pnl_pct: number | null;
  exit_reason: string | null;
}

export default function Trades() {
  const [activeTab, setActiveTab] = useState<'PAPER' | 'REAL'>('PAPER');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrades();
  }, [activeTab]);

  const loadTrades = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('trade_mode', activeTab)
        .order('entry_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTrades(data || []);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Trades</h1>
        <p className="text-text-secondary">Trade history and performance</p>
      </div>

      <div className="flex gap-2 border-b border-surface-light">
        <button
          onClick={() => setActiveTab('PAPER')}
          className={clsx(
            'px-6 py-3 font-medium transition-colors border-b-2',
            activeTab === 'PAPER'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          )}
        >
          Paper Trades
        </button>
        <button
          onClick={() => setActiveTab('REAL')}
          className={clsx(
            'px-6 py-3 font-medium transition-colors border-b-2',
            activeTab === 'REAL'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          )}
        >
          Real Trades
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : trades.length === 0 ? (
        <div className="bg-surface rounded-lg p-12 border border-surface-light text-center">
          <p className="text-text-muted text-lg">No {activeTab.toLowerCase()} trades yet</p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Option</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Entry</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Exit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">P&L</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-light">
                {trades.map((trade) => (
                  <tr key={trade.id} className="hover:bg-surface-light/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-text-primary">
                        {trade.stock_symbol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <span className={clsx(
                          'font-medium',
                          trade.option_type === 'CALL' ? 'text-success' : 'text-danger'
                        )}>
                          {trade.option_type}
                        </span>
                        <span className="text-text-secondary ml-2">{trade.option_symbol}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        <div className="text-text-primary">₹{trade.entry_price}</div>
                        <div className="text-text-secondary text-xs">
                          {format(new Date(trade.entry_time), 'dd MMM, HH:mm')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {trade.exit_price ? (
                        <div className="text-sm">
                          <div className="text-text-primary">₹{trade.exit_price}</div>
                          <div className="text-text-secondary text-xs">
                            {trade.exit_time && format(new Date(trade.exit_time), 'dd MMM, HH:mm')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-muted text-sm">Open</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {trade.pnl !== null ? (
                        <div className="flex items-center gap-2">
                          {trade.pnl >= 0 ? (
                            <TrendingUp className="w-4 h-4 text-success" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-danger" />
                          )}
                          <div className="text-sm">
                            <div className={clsx(
                              'font-semibold',
                              trade.pnl >= 0 ? 'text-success' : 'text-danger'
                            )}>
                              ₹{trade.pnl.toFixed(2)}
                            </div>
                            <div className={clsx(
                              'text-xs',
                              trade.pnl >= 0 ? 'text-success' : 'text-danger'
                            )}>
                              {trade.pnl_pct?.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-text-muted text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {trade.exit_reason ? (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-surface-light text-text-secondary">
                          {trade.exit_reason}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-primary/20 text-primary">
                          ACTIVE
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
