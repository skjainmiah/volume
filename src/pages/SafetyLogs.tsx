import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { Shield, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface SafetyEvent {
  id: string;
  event_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
  action_taken: string | null;
  created_at: string;
}

export default function SafetyLogs() {
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'CRITICAL'>('ALL');

  useEffect(() => {
    loadSafetyEvents();
  }, [filter]);

  const loadSafetyEvents = async () => {
    try {
      let query = supabase
        .from('safety_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter !== 'ALL') {
        query = query.eq('severity', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading safety events:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'INFO':
        return <Info className="w-5 h-5 text-primary" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      default:
        return <Info className="w-5 h-5 text-text-muted" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'INFO':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'WARNING':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'CRITICAL':
        return 'bg-danger/20 text-danger border-danger/30';
      default:
        return 'bg-surface-light text-text-muted border-surface-light';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Safety & Logs
        </h1>
        <p className="text-text-secondary">System safety events and audit trail</p>
      </div>

      <div className="flex gap-2">
        {['ALL', 'INFO', 'WARNING', 'CRITICAL'].map(severity => (
          <button
            key={severity}
            onClick={() => setFilter(severity as any)}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              filter === severity
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-light'
            )}
          >
            {severity}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-surface rounded-lg p-12 border border-surface-light text-center">
          <Shield className="w-16 h-16 text-text-muted mx-auto mb-4" />
          <p className="text-text-muted text-lg">No safety events recorded</p>
          <p className="text-text-secondary text-sm mt-2">
            System is operating normally
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <div
              key={event.id}
              className={clsx(
                'border rounded-lg p-6',
                getSeverityColor(event.severity)
              )}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(event.severity)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold">
                      {event.event_type.replace(/_/g, ' ')}
                    </h3>
                    <span className="text-sm text-text-muted">
                      {format(new Date(event.created_at), 'dd MMM yyyy, HH:mm:ss')}
                    </span>
                  </div>

                  <p className="text-sm mb-3">
                    {event.description}
                  </p>

                  {event.action_taken && (
                    <div className="bg-background/50 rounded p-3 mt-3">
                      <p className="text-sm font-medium mb-1">Action Taken:</p>
                      <p className="text-sm text-text-secondary">{event.action_taken}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
