import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { prepareSpendingOverTimeData } from '../utils/calculations';
import type { Transaction } from '../types/models';
import { useState, useMemo } from 'react';

interface SpendingOverTimeProps {
  transactions: Transaction[];
}

export const SpendingOverTime = ({ transactions }: SpendingOverTimeProps) => {
  console.log('[SpendingOverTime] Rendering with transactions:', transactions.length);
  
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  // Get all available categories
  const allCategories = useMemo(() => {
    return [...new Set(transactions.filter(tx => tx.category).map(tx => tx.category!))].sort();
  }, [transactions]);
  
  // Prepare data
  const data = useMemo(() => {
    return prepareSpendingOverTimeData(transactions, selectedCategories.length > 0 ? selectedCategories : undefined);
  }, [transactions, selectedCategories]);
  
  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">Spending Over Time</h3>
        <p className="text-gray-500">No transaction data available</p>
      </div>
    );
  }
  
  // Build lines for selected categories
  const categoryLines = selectedCategories.map(category => (
    <Line
      key={category}
      type="monotone"
      dataKey={category}
      stroke="#8b5cf6"
      strokeWidth={2}
      dot={{ r: 4 }}
      name={category}
    />
  ));
  
  return (
    <div className="bg-gradient-to-br from-white to-purple-50 p-6 rounded-2xl shadow-lg border-2 border-purple-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">📈</span>
        Spending Over Time
      </h3>
      
      {/* Category selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategories([])}
          className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
            selectedCategories.length === 0
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-purple-50'
          }`}
        >
          All Categories
        </button>
        {allCategories.slice(0, 10).map(category => (
          <button
            key={category}
            onClick={() => {
              setSelectedCategories(prev => 
                prev.includes(category)
                  ? prev.filter(c => c !== category)
                  : [...prev, category]
              );
            }}
            className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
              selectedCategories.includes(category)
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-purple-50'
            }`}
          >
            {category}
          </button>
        ))}
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="monthDisplay" 
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis />
          <Tooltip
            formatter={(value: number) => 
              `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 5 }}
            name="Total Income"
          />
          <Line
            type="monotone"
            dataKey="expenses"
            stroke="#ef4444"
            strokeWidth={3}
            dot={{ r: 5 }}
            name="Total Expenses"
          />
          <Line
            type="monotone"
            dataKey="netCashflow"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4 }}
            name="Net Cashflow"
          />
          {categoryLines}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};



