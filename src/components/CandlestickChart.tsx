import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { useState } from 'react';
import clsx from 'clsx';

interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlestickChartProps {
  data: CandleData[];
  timeframe: '10min' | '1hour' | '1day';
  onTimeframeChange?: (timeframe: '10min' | '1hour' | '1day') => void;
}

export default function CandlestickChart({ data, timeframe, onTimeframeChange }: CandlestickChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background rounded-lg border border-surface-light">
        <div className="text-center">
          <p className="text-text-muted">No chart data available</p>
          <p className="text-xs text-text-secondary mt-2">
            Fetch candle data to see charts
          </p>
        </div>
      </div>
    );
  }

  const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;

  const chartData = data.map(candle => {
    const isGreen = candle.close >= candle.open;
    const bodyTop = Math.max(candle.open, candle.close);
    const bodyBottom = Math.min(candle.open, candle.close);
    const bodyHeight = bodyTop - bodyBottom;

    return {
      timestamp: candle.timestamp,
      high: candle.high,
      low: candle.low,
      bodyTop: bodyTop,
      bodyBottom: bodyBottom,
      bodyHeight: bodyHeight || 0.01,
      wickTop: candle.high - bodyTop,
      wickBottom: bodyBottom - candle.low,
      volume: candle.volume,
      isGreen: isGreen,
      open: candle.open,
      close: candle.close,
    };
  });

  const priceMin = Math.min(...data.map(d => d.low)) * 0.995;
  const priceMax = Math.max(...data.map(d => d.high)) * 1.005;
  const volumeMax = Math.max(...data.map(d => d.volume)) * 1.2;

  const formatTimestamp = (value: string) => {
    const date = new Date(value);
    if (timeframe === '10min') return format(date, 'HH:mm');
    if (timeframe === '1hour') return format(date, 'HH:mm');
    return format(date, 'dd MMM');
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-surface border border-surface-light rounded-lg p-3 shadow-lg">
        <p className="text-xs text-text-secondary mb-2">
          {format(new Date(data.timestamp), 'dd MMM yyyy HH:mm')}
        </p>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">O:</span>
            <span className="text-text-primary font-mono">₹{data.open.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">H:</span>
            <span className="text-success font-mono">₹{data.high.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">L:</span>
            <span className="text-danger font-mono">₹{data.low.toFixed(2)}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">C:</span>
            <span className={clsx('font-mono', data.isGreen ? 'text-success' : 'text-danger')}>
              ₹{data.close.toFixed(2)}
            </span>
          </div>
          <div className="border-t border-surface-light my-2" />
          <div className="flex justify-between gap-4">
            <span className="text-text-muted">Vol:</span>
            <span className="text-primary font-mono">{(data.volume / 1000).toFixed(0)}K</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {(['10min', '1hour', '1day'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange?.(tf)}
              className={clsx(
                'px-3 py-1.5 text-sm font-medium rounded transition-colors',
                timeframe === tf
                  ? 'bg-primary text-white'
                  : 'bg-surface-light text-text-secondary hover:bg-surface-lighter hover:text-text-primary'
              )}
            >
              {tf === '10min' ? '10M' : tf === '1hour' ? '1H' : '1D'}
            </button>
          ))}
        </div>
        <div className="text-xs text-text-secondary">
          Avg Volume: {(avgVolume / 1000).toFixed(0)}K
        </div>
      </div>

      <div className="flex-1" style={{ minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="70%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            onMouseMove={(e: any) => {
              if (e && e.activeTooltipIndex !== undefined) {
                setHoveredIndex(e.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              tickFormatter={formatTimestamp}
              minTickGap={30}
            />
            <YAxis
              yAxisId="price"
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              domain={[priceMin, priceMax]}
              tickFormatter={(value) => `₹${value.toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />

            <Bar
              yAxisId="price"
              dataKey="wickTop"
              stackId="candle"
              fill="transparent"
              stroke="transparent"
            />
            <Bar
              yAxisId="price"
              dataKey="bodyHeight"
              stackId="candle"
              radius={[2, 2, 2, 2]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isGreen ? '#10b981' : '#ef4444'}
                  opacity={hoveredIndex === index ? 1 : 0.85}
                  stroke={entry.isGreen ? '#10b981' : '#ef4444'}
                  strokeWidth={1}
                />
              ))}
            </Bar>
            <Bar
              yAxisId="price"
              dataKey="wickBottom"
              stackId="candle"
              fill="transparent"
              stroke="transparent"
            />

            <Line
              yAxisId="price"
              type="stepAfter"
              dataKey="high"
              stroke="transparent"
              dot={false}
              strokeWidth={0}
            />
            <Line
              yAxisId="price"
              type="stepAfter"
              dataKey="low"
              stroke="transparent"
              dot={false}
              strokeWidth={0}
            />
          </ComposedChart>
        </ResponsiveContainer>

        <ResponsiveContainer width="100%" height="30%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              tickFormatter={formatTimestamp}
              minTickGap={30}
            />
            <YAxis
              stroke="#666"
              tick={{ fill: '#999', fontSize: 11 }}
              domain={[0, volumeMax]}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#fff', fontSize: '12px' }}
              itemStyle={{ color: '#3b82f6', fontSize: '12px' }}
              labelFormatter={(value) => format(new Date(value), 'dd MMM HH:mm')}
              formatter={(value: any) => [`${(value / 1000).toFixed(0)}K`, 'Volume']}
            />

            <Bar dataKey="volume" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`vol-${index}`}
                  fill={entry.isGreen ? '#10b98140' : '#ef444440'}
                  stroke={entry.isGreen ? '#10b981' : '#ef4444'}
                  strokeWidth={0.5}
                />
              ))}
            </Bar>

            <Line
              type="monotone"
              dataKey={() => avgVolume}
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
