import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, Eye } from 'lucide-react';
import clsx from 'clsx';

interface RadarItem {
  id: string;
  stock_symbol: string;
  shock_date: string;
  shock_direction: 'RED' | 'GREEN';
  shock_volume_multiple: number;
  current_state: string;
  days_since_shock: number;
}

export default function Radar() {
  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadRadarData();
  }, []);

  const loadRadarData = async () => {
    try {
      const { data, error } = await supabase
        .from('radar')
        .select(`
          id,
          shock_date,
          shock_direction,
          shock_volume_multiple,
          current_state,
          days_since_shock,
          stocks (symbol)
        `)
        .eq('is_active', true)
        .order('shock_date', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item: any) => ({
        id: item.id,
        stock_symbol: item.stocks?.symbol || 'N/A',
        shock_date: item.shock_date,
        shock_direction: item.shock_direction,
        shock_volume_multiple: item.shock_volume_multiple,
        current_state: item.current_state,
        days_since_shock: item.days_since_shock,
      })) || [];

      setRadarItems(formattedData);
    } catch (error) {
      console.error('Error loading radar data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading radar data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Radar</h1>
        <p className="text-text-secondary">Stocks being tracked by the system</p>
      </div>

      {radarItems.length === 0 ? (
        <div className="bg-surface rounded-lg p-12 border border-surface-light text-center">
          <p className="text-text-muted text-lg">No stocks in radar currently</p>
          <p className="text-text-secondary text-sm mt-2">
            The system is scanning for shock candles
          </p>
        </div>
      ) : (
        <div className="bg-surface rounded-lg border border-surface-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-light">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Shock Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Shock Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Volume Multiple
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Current State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Days Since Shock
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-light">
                {radarItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-light/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/stock/${item.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-text-primary">
                        {item.stock_symbol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {format(new Date(item.shock_date), 'dd MMM yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {item.shock_direction === 'GREEN' ? (
                          <TrendingUp className="w-4 h-4 text-success" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-danger" />
                        )}
                        <span className={clsx(
                          'text-sm font-medium',
                          item.shock_direction === 'GREEN' ? 'text-success' : 'text-danger'
                        )}>
                          {item.shock_direction}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium">
                      {item.shock_volume_multiple.toFixed(1)}×
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium rounded bg-primary/20 text-primary">
                        {item.current_state}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                      {item.days_since_shock} days
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/stock/${item.id}`);
                        }}
                        className="text-primary hover:text-primary-dark flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
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
