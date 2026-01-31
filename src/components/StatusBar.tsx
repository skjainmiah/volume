import { useStore } from '../store/useStore';
import { AlertCircle, Power, PowerOff } from 'lucide-react';
import clsx from 'clsx';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function StatusBar() {
  const { systemStatus, emergencyStop, resumeTrading } = useStore();
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [killSwitchReason, setKillSwitchReason] = useState('');

  useEffect(() => {
    fetchKillSwitchState();

    const subscription = supabase
      .channel('kill_switch_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kill_switch_state'
      }, () => {
        fetchKillSwitchState();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchKillSwitchState = async () => {
    const { data } = await supabase
      .from('kill_switch_state')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setKillSwitchActive((data as any).is_active || false);
      setKillSwitchReason((data as any).reason || '');
    }
  };

  const handleKillSwitchToggle = async () => {
    if (!killSwitchActive) {
      if (window.confirm('⚠️ ACTIVATE KILL SWITCH?\n\nThis will immediately:\n• Stop ALL trading\n• Block new orders\n• Cancel pending executions\n\nContinue?')) {
        await toggleKillSwitch(true, 'Manual activation via UI');
        emergencyStop();
      }
    } else {
      if (window.confirm('✅ DEACTIVATE KILL SWITCH?\n\nThis will resume normal trading operations.\n\nContinue?')) {
        await toggleKillSwitch(false, 'Manual deactivation via UI');
        resumeTrading();
      }
    }
  };

  const toggleKillSwitch = async (activate: boolean, reason: string) => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kill-switch-manager`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: activate ? 'ACTIVATE' : 'DEACTIVATE',
          activated_by: 'UI',
          reason,
        }),
      });

      await fetchKillSwitchState();
    } catch (error) {
      console.error('Error toggling kill switch:', error);
      alert('Failed to toggle kill switch. Check console for details.');
    }
  };

  return (
    <div className="bg-surface border-b border-surface-light px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">Market:</span>
            <span className={clsx(
              'font-semibold text-sm',
              systemStatus.marketStatus === 'OPEN' ? 'text-success' : 'text-text-secondary'
            )}>
              {systemStatus.marketStatus}
            </span>
          </div>

          <div className="w-px h-6 bg-surface-light" />

          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">Mode:</span>
            <span className={clsx(
              'font-semibold px-2 py-0.5 rounded text-xs',
              systemStatus.tradingMode === 'PAPER'
                ? 'bg-primary/20 text-primary'
                : 'bg-warning/20 text-warning'
            )}>
              {systemStatus.tradingMode}
            </span>
          </div>

          <div className="w-px h-6 bg-surface-light" />

          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">System:</span>
            <span className={clsx(
              'font-semibold text-sm flex items-center gap-1',
              systemStatus.systemState === 'RUNNING' && 'text-success',
              systemStatus.systemState === 'PAUSED' && 'text-text-secondary',
              systemStatus.systemState === 'EMERGENCY_STOP' && 'text-danger'
            )}>
              {systemStatus.systemState === 'EMERGENCY_STOP' && <AlertCircle className="w-4 h-4" />}
              {systemStatus.systemState}
            </span>
          </div>

          <div className="w-px h-6 bg-surface-light" />

          <div className="flex items-center gap-2">
            <span className="text-text-muted text-sm">Risk Used:</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-surface-light rounded-full overflow-hidden">
                <div
                  className={clsx(
                    'h-full transition-all',
                    systemStatus.riskUsageToday < 50 && 'bg-success',
                    systemStatus.riskUsageToday >= 50 && systemStatus.riskUsageToday < 80 && 'bg-warning',
                    systemStatus.riskUsageToday >= 80 && 'bg-danger'
                  )}
                  style={{ width: `${Math.min(systemStatus.riskUsageToday, 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{systemStatus.riskUsageToday.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {killSwitchActive && killSwitchReason && (
            <span className="text-xs text-danger font-medium">
              {killSwitchReason}
            </span>
          )}
          <button
            onClick={handleKillSwitchToggle}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-medium',
              killSwitchActive
                ? 'bg-success hover:bg-success/80 text-white animate-pulse'
                : 'bg-danger hover:bg-danger/80 text-white'
            )}
            title={killSwitchActive ? 'Trading DISABLED - Click to resume' : 'Trading ENABLED - Click to stop'}
          >
            {killSwitchActive ? (
              <>
                <PowerOff className="w-4 h-4" />
                TRADING OFF
              </>
            ) : (
              <>
                <Power className="w-4 h-4" />
                TRADING ON
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
