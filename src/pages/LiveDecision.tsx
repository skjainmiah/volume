import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Target, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

interface AcceptanceStock {
  id: string;
  stock_symbol: string;
  shock_direction: string;
  current_state: string;
  days_since_shock: number;
}

export default function LiveDecision() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDecisionWindow, setIsDecisionWindow] = useState(false);
  const [acceptanceStocks, setAcceptanceStocks] = useState<AcceptanceStock[]>([]);
  const [isRunningDecision, setIsRunningDecision] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const hours = now.getHours();
      const minutes = now.getMinutes();
      const inWindow = hours === 15 && minutes >= 0 && minutes <= 15;
      setIsDecisionWindow(inWindow);
    }, 1000);

    loadAcceptanceStocks();

    return () => clearInterval(interval);
  }, []);

  const loadAcceptanceStocks = async () => {
    try {
      const { data } = await supabase
        .from('radar')
        .select('id, stock_symbol, shock_direction, current_state, days_since_shock')
        .eq('is_active', true)
        .eq('current_state', 'ACCEPTANCE_READY')
        .order('created_at', { ascending: false });

      if (data) {
        setAcceptanceStocks(data);
      }
    } catch (error) {
      console.error('Error loading acceptance stocks:', error);
    }
  };

  const runDecisionEngine = async () => {
    setIsRunningDecision(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/decision-engine`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
      });

      const result = await response.json();

      if (result.success) {
        alert(`Decision engine ran successfully.\nDecisions processed: ${result.decisionsProcessed}\n\nCheck Trades page for results.`);
        await loadAcceptanceStocks();
      } else {
        alert(`Decision engine: ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error running decision engine:', error);
      alert('Error running decision engine. Check console for details.');
    } finally {
      setIsRunningDecision(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Live Decision Window</h1>
        <p className="text-text-secondary">Real-time decision making (3:00 PM - 3:15 PM)</p>
      </div>

      <div className="bg-surface rounded-lg p-8 border border-surface-light text-center">
        <Clock className="w-16 h-16 text-primary mx-auto mb-4" />

        <div className="text-5xl font-bold text-text-primary mb-4">
          {currentTime.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })}
        </div>

        {isDecisionWindow ? (
          <div className="bg-success/20 border border-success/30 rounded-lg p-6 mt-6">
            <TrendingUp className="w-8 h-8 text-success mx-auto mb-3" />
            <p className="text-success font-semibold text-lg">
              Decision Window is ACTIVE
            </p>
            <p className="text-text-secondary text-sm mt-2">
              System is evaluating stocks for potential trades
            </p>
          </div>
        ) : (
          <div className="bg-surface-light rounded-lg p-6 mt-6">
            <p className="text-text-muted font-medium">
              Decision Window is Closed
            </p>
            <p className="text-text-secondary text-sm mt-2">
              Next window: Today 3:00 PM - 3:15 PM
            </p>
          </div>
        )}
      </div>

      <div className="bg-surface rounded-lg p-6 border border-surface-light">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Stocks Ready for Decision ({acceptanceStocks.length})
          </h3>
          {acceptanceStocks.length > 0 && (
            <button
              onClick={runDecisionEngine}
              disabled={isRunningDecision}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isRunningDecision ? 'Running...' : 'Run Decision Engine'}
            </button>
          )}
        </div>
        {acceptanceStocks.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <p>No stocks ready for decision currently</p>
            <p className="text-sm mt-2 text-text-secondary">
              System is tracking stocks in DIGESTION phase
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {acceptanceStocks.map((stock) => (
              <div
                key={stock.id}
                className="bg-background border border-surface-light rounded-lg p-4 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-bold text-text-primary">
                        {stock.stock_symbol}
                      </span>
                      {stock.shock_direction === 'GREEN' ? (
                        <TrendingUp className="w-5 h-5 text-success" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-danger" />
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-text-secondary">
                        State: <span className="text-text-primary font-medium">{stock.current_state}</span>
                      </span>
                      <span className="text-text-secondary">
                        Days: <span className="text-text-primary font-medium">{stock.days_since_shock}</span>
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className={clsx(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      stock.shock_direction === 'GREEN'
                        ? 'bg-danger/20 text-danger'
                        : 'bg-success/20 text-success'
                    )}>
                      {stock.shock_direction === 'GREEN' ? 'PUT Setup' : 'CALL Setup'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
