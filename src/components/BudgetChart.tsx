import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { normalizeMonthly } from '../utils/calculations';
import type { Cashflow, Transaction } from '../types/models';

interface BudgetChartProps {
  cashflows: Cashflow[];
  transactions?: Transaction[]; // Optional transactions for month-by-month view
  selectedMonth?: string; // YYYY-MM format, if provided shows only that month
}

export const BudgetChart = ({ cashflows, transactions = [], selectedMonth }: BudgetChartProps) => {
  console.log('[BudgetChart] Rendering with cashflows:', cashflows.length, 'transactions:', transactions.length);

  // If transactions are provided and a month is selected, use transaction data
  // Otherwise, use cashflows (recurring budget)
  const useTransactions = transactions.length > 0 && selectedMonth;

  let categoryData: Record<string, { amount: number; type: 'income' | 'expense' }> = {};

  if (useTransactions) {
    // Group transactions by category for the selected month
    const monthStart = `${selectedMonth}-01`;
    const [year, month] = selectedMonth.split('-');
    const nextMonth = month === '12' ? `${parseInt(year) + 1}-01` : `${year}-${String(parseInt(month) + 1).padStart(2, '0')}`;
    const monthEnd = `${nextMonth}-01`;

    transactions
      .filter(tx => {
        const txDate = tx.date;
        return txDate >= monthStart && txDate < monthEnd && 
               (tx.type === 'income' || tx.type === 'expense') && 
               tx.category;
      })
      .forEach(tx => {
        const category = tx.category!;
        // Type guard ensures tx.type is 'income' | 'expense' (filtered above)
        const txType = tx.type as 'income' | 'expense';
        if (!categoryData[category]) {
          categoryData[category] = {
            amount: tx.amount,
            type: txType,
          };
        } else {
          categoryData[category].amount += tx.amount;
        }
      });
  } else {
    // Group cashflows by category (recurring budget)
    cashflows.forEach(cf => {
      const monthlyAmount = normalizeMonthly(cf.amount, cf.frequency);
      const category = cf.category;
      
      if (!categoryData[category]) {
        categoryData[category] = {
          amount: monthlyAmount,
          type: cf.type,
        };
      } else {
        categoryData[category].amount += monthlyAmount;
      }
    });
  }

  const data = Object.entries(categoryData).map(([category, { amount, type }]) => ({
    category,
    amount,
    type,
  })).sort((a, b) => {
    // Sort by type (income first), then by amount (descending)
    if (a.type !== b.type) {
      return a.type === 'income' ? -1 : 1;
    }
    return b.amount - a.amount;
  });

  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">
          {useTransactions ? `Monthly Budget Flow - ${selectedMonth}` : 'Monthly Budget Flow'}
        </h3>
        <p className="text-gray-500">
          {useTransactions ? 'No transactions for this month' : 'No cashflows to display'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-blue-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">📈</span>
        {useTransactions ? `Monthly Budget Flow - ${selectedMonth}` : 'Monthly Budget Flow (Recurring)'}
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip
            formatter={(value: number, _name: string, props: any) => {
              const type = props.payload.type;
              return [
                `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                type.charAt(0).toUpperCase() + type.slice(1)
              ];
            }}
            labelFormatter={(label) => label}
          />
          <Legend 
            formatter={() => ''}
          />
          <Bar dataKey="amount">
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.type === 'income' ? '#10b981' : '#ef4444'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

