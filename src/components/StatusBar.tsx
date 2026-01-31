import { useStore } from '../store/useStore';
import { AlertCircle, Power } from 'lucide-react';
import clsx from 'clsx';

export default function StatusBar() {
  const { systemStatus, emergencyStop } = useStore();

  const handleKillSwitch = () => {
    if (window.confirm('Are you sure you want to activate the KILL SWITCH? This will stop all trading immediately and switch to PAPER mode.')) {
      emergencyStop();
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

        <button
          onClick={handleKillSwitch}
          className="flex items-center gap-2 px-4 py-2 bg-danger hover:bg-danger/80 text-white rounded-lg transition-colors font-medium"
        >
          <Power className="w-4 h-4" />
          KILL SWITCH
        </button>
      </div>
    </div>
  );
}
