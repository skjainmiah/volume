import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import clsx from 'clsx';
import PriceChart from '../components/PriceChart';

interface RadarDetails {
  stock_symbol: string;
  shock_date: string;
  shock_direction: 'RED' | 'GREEN';
  shock_volume_multiple: number;
  current_state: string;
  days_since_shock: number;
  entry_reason: string;
  shock_candle_high: number;
  shock_candle_low: number;
}

interface ChartData {
  date: string;
  price: number;
  volume: number;
}

export default function StockIntelligence() {
  const { radarId } = useParams<{ radarId: string }>();
  const [radarData, setRadarData] = useState<RadarDetails | null>(null);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (radarId) {
      loadRadarDetails();
    }
  }, [radarId]);

  const loadRadarDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('radar')
        .select('*')
        .eq('id', radarId!)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const radarItem = data as any;
        setRadarData({
          stock_symbol: radarItem.stock_symbol,
          shock_date: radarItem.shock_date,
          shock_direction: radarItem.shock_direction,
          shock_volume_multiple: radarItem.shock_volume_multiple,
          current_state: radarItem.current_state,
          days_since_shock: radarItem.days_since_shock,
          entry_reason: radarItem.entry_reason || 'No reason provided',
          shock_candle_high: radarItem.shock_candle_high,
          shock_candle_low: radarItem.shock_candle_low,
        });

        const startDate = new Date(radarItem.shock_date);
        startDate.setDate(startDate.getDate() - 30);
        const endDate = new Date();

        const mockChartData: ChartData[] = [];
        const currentDate = new Date(startDate);
        const basePrice = radarItem.shock_candle_low;

        while (currentDate <= endDate) {
          if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
            const daysFromStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const volatility = Math.sin(daysFromStart / 5) * 10;
            const trend = daysFromStart * 0.5;
            const randomNoise = (Math.random() - 0.5) * 20;

            mockChartData.push({
              date: currentDate.toISOString().split('T')[0],
              price: basePrice + volatility + trend + randomNoise,
              volume: Math.floor(Math.random() * 1000000) + 500000,
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        setChartData(mockChartData);
      }
    } catch (error) {
      console.error('Error loading radar details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading stock intelligence...</p>
        </div>
      </div>
    );
  }

  if (!radarData) {
    return (
      <div className="text-center py-12">
        <p className="text-text-muted">Stock data not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-text-primary">{radarData.stock_symbol}</h1>
          <span className="px-3 py-1 text-sm font-medium rounded bg-primary/20 text-primary">
            {radarData.current_state}
          </span>
        </div>
        <p className="text-text-secondary">Detailed intelligence and analysis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-surface rounded-lg p-6 border border-surface-light">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Price Chart</h2>
            <div className="h-96">
              <PriceChart
                data={chartData}
                shockDate={radarData.shock_date}
                shockHigh={radarData.shock_candle_high}
                shockLow={radarData.shock_candle_low}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface rounded-lg p-6 border border-surface-light">
            <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Shock Details
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-text-muted text-sm">Direction:</span>
                <div className="flex items-center gap-2 mt-1">
                  {radarData.shock_direction === 'GREEN' ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-danger" />
                  )}
                  <span className={clsx(
                    'font-semibold',
                    radarData.shock_direction === 'GREEN' ? 'text-success' : 'text-danger'
                  )}>
                    {radarData.shock_direction}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-text-muted text-sm">Volume Multiple:</span>
                <p className="text-text-primary font-semibold mt-1">
                  {radarData.shock_volume_multiple.toFixed(1)}×
                </p>
              </div>

              <div>
                <span className="text-text-muted text-sm">Days Since Shock:</span>
                <p className="text-text-primary font-semibold mt-1">
                  {radarData.days_since_shock} days
                </p>
              </div>

              <div>
                <span className="text-text-muted text-sm">Price Range:</span>
                <p className="text-text-primary font-semibold mt-1">
                  ₹{radarData.shock_candle_low} - ₹{radarData.shock_candle_high}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-lg p-6 border border-surface-light">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Why in Radar?</h3>
            <p className="text-text-secondary text-sm">{radarData.entry_reason}</p>
          </div>

          <div className="bg-surface rounded-lg p-6 border border-surface-light">
            <h3 className="text-lg font-semibold text-text-primary mb-4">System Assessment</h3>
            <p className="text-text-secondary text-sm">
              The system is currently in <span className="text-primary font-medium">{radarData.current_state}</span> state.
              {radarData.current_state === 'DIGESTION' && ' Monitoring for acceptance candle.'}
              {radarData.current_state === 'ACCEPTANCE_READY' && ' Ready for decision window evaluation.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
