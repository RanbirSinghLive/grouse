import { Treemap, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { prepareCategoryBreakdownData } from '../utils/calculations';
import type { Transaction } from '../types/models';

interface CategoryBreakdownProps {
  transactions: Transaction[];
}

export const CategoryBreakdown = ({ transactions }: CategoryBreakdownProps) => {
  console.log('[CategoryBreakdown] Rendering with transactions:', transactions.length);
  
  const data = prepareCategoryBreakdownData(transactions);
  
  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">Category Breakdown</h3>
        <p className="text-gray-500">No transaction data available</p>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-br from-white to-indigo-50 p-6 rounded-2xl shadow-lg border-2 border-indigo-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">🗺️</span>
        Category Breakdown (Average Monthly)
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <Treemap
          data={data}
          dataKey="value"
          aspectRatio={4/3}
          stroke="#fff"
          strokeWidth={2}
        >
          <Tooltip
            formatter={(value: number, name: string, props: any) => {
              const categoryName = props?.payload?.name || name || 'Unknown';
              return [
                `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                categoryName
              ];
            }}
            labelFormatter={(label) => label || 'Category'}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Treemap>
      </ResponsiveContainer>
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-emerald-500 rounded"></div>
          <span>Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span>Expenses</span>
        </div>
        <p className="text-gray-600 text-xs ml-auto">
          Size = Average Monthly Amount
        </p>
      </div>
    </div>
  );
};

