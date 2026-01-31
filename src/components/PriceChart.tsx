import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

interface ChartData {
  date: string;
  price: number;
  volume: number;
}

interface PriceChartProps {
  data: ChartData[];
  shockDate?: string;
  shockHigh?: number;
  shockLow?: number;
}

export default function PriceChart({ data, shockDate, shockHigh, shockLow }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-background rounded-lg border border-surface-light">
        <div className="text-center">
          <p className="text-text-muted">No chart data available</p>
          <p className="text-xs text-text-secondary mt-2">
            Price data will appear here once fetched
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
          <XAxis
            dataKey="date"
            stroke="#666"
            tick={{ fill: '#999', fontSize: 12 }}
            tickFormatter={(value) => format(new Date(value), 'dd MMM')}
          />
          <YAxis
            stroke="#666"
            tick={{ fill: '#999', fontSize: 12 }}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#fff' }}
            itemStyle={{ color: '#3b82f6' }}
            labelFormatter={(value) => format(new Date(value), 'dd MMM yyyy')}
            formatter={(value: any) => [`₹${value.toFixed(2)}`, 'Price']}
          />
          {shockDate && (
            <ReferenceLine
              x={shockDate}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{
                value: 'Shock Candle',
                position: 'top',
                fill: '#ef4444',
                fontSize: 12,
              }}
            />
          )}
          {shockHigh && (
            <ReferenceLine
              y={shockHigh}
              stroke="#10b981"
              strokeDasharray="3 3"
              label={{
                value: `High: ₹${shockHigh}`,
                position: 'right',
                fill: '#10b981',
                fontSize: 10,
              }}
            />
          )}
          {shockLow && (
            <ReferenceLine
              y={shockLow}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{
                value: `Low: ₹${shockLow}`,
                position: 'right',
                fill: '#f59e0b',
                fontSize: 10,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
