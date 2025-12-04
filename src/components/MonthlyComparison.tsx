import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { prepareMonthlyComparisonData, getAvailableMonths } from '../utils/calculations';
import type { Transaction } from '../types/models';
import { useState, useMemo } from 'react';

interface MonthlyComparisonProps {
  transactions: Transaction[];
}

export const MonthlyComparison = ({ transactions }: MonthlyComparisonProps) => {
  console.log('[MonthlyComparison] Rendering with transactions:', transactions.length);
  
  const availableMonths = useMemo(() => getAvailableMonths(transactions), [transactions]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(
    availableMonths.slice(-3) // Default to last 3 months
  );
  
  // Prepare data
  const data = useMemo(() => {
    return prepareMonthlyComparisonData(transactions, selectedMonths);
  }, [transactions, selectedMonths]);
  
  // Format month for display
  const formatMonth = (monthStr: string): string => {
    const [year, monthNum] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };
  
  if (data.length === 0 || selectedMonths.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">Monthly Comparison</h3>
        <p className="text-gray-500">
          {availableMonths.length === 0 
            ? 'No transaction data available' 
            : 'Select months to compare'}
        </p>
      </div>
    );
  }
  
  // Color palette for months
  const monthColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  
  return (
    <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-blue-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        Monthly Comparison
      </h3>
      
      {/* Month selector */}
      <div className="mb-4 flex flex-wrap gap-2">
        {availableMonths.map(month => (
          <button
            key={month}
            onClick={() => {
              setSelectedMonths(prev => 
                prev.includes(month)
                  ? prev.filter(m => m !== month)
                  : prev.length < 6 
                    ? [...prev, month]
                    : prev
              );
            }}
            className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all ${
              selectedMonths.includes(month)
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-50'
            }`}
          >
            {formatMonth(month)}
          </button>
        ))}
        {selectedMonths.length > 0 && (
          <button
            onClick={() => setSelectedMonths([])}
            className="px-3 py-1 rounded-lg text-sm font-semibold bg-gray-500 text-white hover:bg-gray-600 transition-all"
          >
            Clear
          </button>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="category" 
            angle={-45}
            textAnchor="end"
            height={100}
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
          {selectedMonths.map((month, index) => (
            <Bar 
              key={month} 
              dataKey={month} 
              name={formatMonth(month)}
              fill={monthColors[index % monthColors.length]}
            >
              {data.map((entry, entryIndex) => {
                // Color based on type
                const fillColor = entry.type === 'income' 
                  ? '#10b981' 
                  : '#ef4444';
                return (
                  <Cell 
                    key={`cell-${entryIndex}`} 
                    fill={fillColor}
                    opacity={0.7}
                  />
                );
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

