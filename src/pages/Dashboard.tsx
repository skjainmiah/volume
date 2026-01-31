import { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { TrendingUp, TrendingDown, Activity, Target, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import clsx from 'clsx';

export default function Dashboard() {
  const { dashboardStats, setDashboardStats, setLoading } = useStore();

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      const today = new Date().toISOString().split('T')[0];

      const [paperTrades, realTrades, radarCount, activeTradesCount] = await Promise.all([
        supabase
          .from('trades')
          .select('pnl')
          .eq('trade_mode', 'PAPER')
          .gte('entry_time', today),
        supabase
          .from('trades')
          .select('pnl')
          .eq('trade_mode', 'REAL')
          .gte('entry_time', today),
        supabase
          .from('radar')
          .select('id', { count: 'exact' })
          .eq('is_active', true),
        supabase
          .from('trades')
          .select('id', { count: 'exact' })
          .is('exit_time', null),
      ]);

      const todayPnlPaper = paperTrades.data?.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) || 0;
      const todayPnlReal = realTrades.data?.reduce((sum: number, t: any) => sum + (t.pnl || 0), 0) || 0;

      setDashboardStats({
        todayPnlPaper,
        todayPnlReal,
        activeTradesCount: activeTradesCount.count || 0,
        activeRadarCount: radarCount.count || 0,
        nearDecisionCount: 0,
        lastSystemAction: 'System initialized',
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!dashboardStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Today's P&L (Paper)",
      value: `₹${dashboardStats.todayPnlPaper.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: dashboardStats.todayPnlPaper >= 0 ? TrendingUp : TrendingDown,
      color: dashboardStats.todayPnlPaper >= 0 ? 'success' : 'danger',
    },
    {
      label: "Today's P&L (Real)",
      value: `₹${dashboardStats.todayPnlReal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: dashboardStats.todayPnlReal >= 0 ? TrendingUp : TrendingDown,
      color: dashboardStats.todayPnlReal >= 0 ? 'success' : 'danger',
    },
    {
      label: 'Active Trades',
      value: dashboardStats.activeTradesCount,
      icon: Activity,
      color: 'primary',
    },
    {
      label: 'Stocks in Radar',
      value: dashboardStats.activeRadarCount,
      icon: Target,
      color: 'primary',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Dashboard</h1>
        <p className="text-text-secondary">High-level situational awareness</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-surface rounded-lg p-6 border border-surface-light"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-text-muted text-sm">{card.label}</span>
                <Icon className={clsx('w-5 h-5', `text-${card.color}`)} />
              </div>
              <div className={clsx('text-2xl font-bold', `text-${card.color}`)}>
                {card.value}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface rounded-lg p-6 border border-surface-light">
        <h3 className="text-lg font-semibold text-text-primary mb-4">Last System Action</h3>
        <p className="text-text-secondary">{dashboardStats.lastSystemAction}</p>
      </div>

      {dashboardStats.nearDecisionCount > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-warning" />
            <div>
              <h3 className="text-lg font-semibold text-text-primary">
                Decision Window Active
              </h3>
              <p className="text-text-secondary mt-1">
                {dashboardStats.nearDecisionCount} stocks are near decision threshold
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
