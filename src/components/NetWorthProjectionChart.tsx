import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ProjectionResult } from '../types/models';

interface NetWorthProjectionChartProps {
  result: ProjectionResult;
}

export const NetWorthProjectionChart = ({ result }: NetWorthProjectionChartProps) => {
  // Prepare data for chart - use yearly data for cleaner visualization
  const chartData = result.yearlyData.map(year => ({
    year: year.year.toString(),
    netWorth: Math.round(year.endingNetWorth),
    assets: result.monthlyData
      .filter(m => m.year === year.year)
      .reduce((sum, m) => sum + m.totalAssets, 0) / 12, // Average assets for the year
    liabilities: result.monthlyData
      .filter(m => m.year === year.year)
      .reduce((sum, m) => sum + m.totalLiabilities, 0) / 12, // Average liabilities for the year
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="year" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="#3b82f6"
            strokeWidth={3}
            name="Net Worth"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};



