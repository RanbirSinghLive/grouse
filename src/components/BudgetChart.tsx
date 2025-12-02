import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { normalizeMonthly } from '../utils/calculations';
import type { Cashflow } from '../types/models';

interface BudgetChartProps {
  cashflows: Cashflow[];
}

export const BudgetChart = ({ cashflows }: BudgetChartProps) => {
  console.log('[BudgetChart] Rendering with cashflows:', cashflows.length);

  // Group by category
  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  cashflows.forEach(cf => {
    const monthlyAmount = normalizeMonthly(cf.amount, cf.frequency);
    if (cf.type === 'income') {
      incomeByCategory[cf.category] = (incomeByCategory[cf.category] || 0) + monthlyAmount;
    } else {
      expenseByCategory[cf.category] = (expenseByCategory[cf.category] || 0) + monthlyAmount;
    }
  });

  // Combine all categories
  const allCategories = new Set([
    ...Object.keys(incomeByCategory),
    ...Object.keys(expenseByCategory),
  ]);

  const data = Array.from(allCategories).map(category => ({
    category,
    Income: incomeByCategory[category] || 0,
    Expenses: expenseByCategory[category] || 0,
  }));

  if (data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-bold mb-4">Monthly Budget Flow</h3>
        <p className="text-gray-500">No cashflows to display</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 p-6 rounded-2xl shadow-lg border-2 border-blue-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">📈</span>
        Monthly Budget Flow
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="category" />
          <YAxis />
          <Tooltip
            formatter={(value: number) => `$${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          />
          <Legend />
          <Bar dataKey="Income" fill="#10b981" />
          <Bar dataKey="Expenses" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

