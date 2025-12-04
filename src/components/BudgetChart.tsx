import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { calculateCategoryAverages, calculateMonthlyTotals } from '../utils/calculations';
import type { Transaction } from '../types/models';

interface BudgetChartProps {
  transactions: Transaction[];
  selectedMonth?: string; // YYYY-MM format, if provided shows only that month
}

export const BudgetChart = ({ transactions = [], selectedMonth }: BudgetChartProps) => {
  console.log('[BudgetChart] Rendering with transactions:', transactions.length, 'selectedMonth:', selectedMonth);

  // If a month is selected, show that month's data
  // Otherwise, show averages across all months
  const useSpecificMonth = selectedMonth !== undefined && selectedMonth !== '';

  let data: Array<{
    category: string;
    amount: number;
    type: 'income' | 'expense';
    trendPercentage?: number;
    trendDirection?: 'up' | 'down' | 'stable';
  }> = [];

  if (useSpecificMonth) {
    // Show specific month's totals
    const monthlyTotals = calculateMonthlyTotals(transactions, selectedMonth);
    data = Object.entries(monthlyTotals).map(([category, { amount, type }]) => ({
      category,
      amount,
      type,
    })).sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'income' ? -1 : 1;
      }
      return b.amount - a.amount;
    });
  } else {
    // Show averages with trends
    const averages = calculateCategoryAverages(transactions);
    data = averages.map(avg => ({
      category: avg.category,
      amount: avg.averageAmount,
      type: avg.type,
      trendPercentage: avg.trendPercentage,
      trendDirection: avg.trendDirection,
    }));
  }

  // Format month for display
  const formatMonth = (monthStr: string | undefined): string => {
    if (!monthStr) return '';
    const [year, monthNum] = monthStr.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(monthNum) - 1];
    return `${monthName} ${year}`;
  };

  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">
          {useSpecificMonth ? `Monthly Budget Flow - ${formatMonth(selectedMonth)}` : 'Average Monthly Budget Flow'}
        </h3>
        <p className="text-gray-500">
          {useSpecificMonth ? 'No transactions for this month' : 'No transaction data available'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-blue-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">📈</span>
        {useSpecificMonth ? `Monthly Budget Flow - ${formatMonth(selectedMonth)}` : 'Average Monthly Budget Flow (with Trends)'}
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="category" 
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => {
              const type = props.payload.type;
              const trend = props.payload.trendPercentage;
              const trendDir = props.payload.trendDirection;
              
              let tooltipContent = [
                `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                type.charAt(0).toUpperCase() + type.slice(1)
              ];
              
              if (trend !== undefined && !useSpecificMonth) {
                const trendIcon = trendDir === 'up' ? '📈' : trendDir === 'down' ? '📉' : '➡️';
                tooltipContent.push(
                  `${trendIcon} ${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`
                );
              }
              
              return tooltipContent;
            }}
            labelFormatter={(label) => label}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px',
            }}
          />
          <Legend 
            formatter={() => ''}
          />
          <Bar dataKey="amount">
            {data.map((entry, index) => {
              // Color bars based on trend if available
              let fillColor = entry.type === 'income' ? '#10b981' : '#ef4444';
              
              if (entry.trendDirection && !useSpecificMonth) {
                if (entry.trendDirection === 'up') {
                  fillColor = entry.type === 'income' ? '#059669' : '#dc2626'; // Darker for up trend
                } else if (entry.trendDirection === 'down') {
                  fillColor = entry.type === 'income' ? '#34d399' : '#f87171'; // Lighter for down trend
                }
              }
              
              return (
                <Cell 
                  key={`cell-${index}`}
                  fill={fillColor}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

