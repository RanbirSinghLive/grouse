import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { groupAccountsByCategory, type AssetCategory } from '../utils/calculations';
import type { Account } from '../types/models';

interface AssetMixChartProps {
  accounts: Account[];
}

const COLORS: Record<AssetCategory, string> = {
  'Cash & Cash-like': '#3b82f6', // blue
  'Registered Investments': '#10b981', // emerald
  'Non-Registered Investments': '#8b5cf6', // purple
  'Real Estate': '#f59e0b', // amber
  'Other Assets': '#6b7280', // gray
};

export const AssetMixChart = ({ accounts }: AssetMixChartProps) => {
  console.log('[AssetMixChart] Rendering with accounts:', accounts.length);
  const grouped = groupAccountsByCategory(accounts);
  const data = Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">Asset Mix Breakdown</h3>
        <p className="text-gray-500">No assets to display</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-2xl shadow-lg border-2 border-purple-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        Asset Mix Breakdown
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => {
              if (percent === undefined) return '';
              const percentValue = percent * 100;
              return percentValue > 5 ? `${name}: ${percentValue.toFixed(1)}%` : '';
            }}
            outerRadius={120}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name as AssetCategory]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

