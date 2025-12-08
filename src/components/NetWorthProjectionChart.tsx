import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataPoint {
  year: string;
  netWorth: number;
}

interface NetWorthProjectionChartProps {
  chartData: ChartDataPoint[];
  currentNetWorth: number;
}

export const NetWorthProjectionChart = ({ chartData, currentNetWorth }: NetWorthProjectionChartProps) => {
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format Y-axis to show in millions
  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return formatCurrency(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{`Year: ${payload[0].payload.year}`}</p>
          <p className="text-blue-600">{`Net Worth: ${formatCurrency(payload[0].value)}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Net Worth Projection</h2>
        <p className="text-sm text-gray-600 mt-1">
          Current net worth: {formatCurrency(currentNetWorth)}
        </p>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="year" 
              stroke="#6b7280"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickFormatter={formatYAxis}
              domain={['dataMin - 100000', 'dataMax + 100000']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="netWorth" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={false}
              name="Net Worth"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
