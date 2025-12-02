import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { calcMonthlyCashflow, calcSavingsRate, calcMonthlyIncome } from '../utils/calculations';
import type { Cashflow } from '../types/models';

interface CashflowGaugeProps {
  cashflows: Cashflow[];
}

export const CashflowGauge = ({ cashflows }: CashflowGaugeProps) => {
  console.log('[CashflowGauge] Rendering with cashflows:', cashflows.length);
  const monthlyCashflow = calcMonthlyCashflow(cashflows);
  const savingsRate = calcSavingsRate(cashflows);
  const monthlyIncome = calcMonthlyIncome(cashflows);

  // For the gauge, we show savings rate as a percentage
  // The donut shows the savings rate (0-100%)
  const savingsPercent = Math.max(0, Math.min(100, savingsRate));

  // Color based on surplus/deficit
  const color = monthlyCashflow >= 0 ? '#10b981' : '#ef4444'; // emerald for surplus, red for deficit

  // Data for the donut chart (savings rate)
  const gaugeData = [
    { name: 'Saved', value: savingsPercent },
    { name: 'Spent', value: 100 - savingsPercent },
  ];

  return (
    <div className="bg-gradient-to-br from-white to-emerald-50 p-6 rounded-2xl shadow-lg border-2 border-emerald-200">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">💵</span>
        Monthly Cashflow
      </h3>
      <div className="relative" style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={120}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
            >
              <Cell fill={color} />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={`text-3xl font-bold ${monthlyCashflow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {monthlyCashflow >= 0 ? '+' : ''}${monthlyCashflow.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month
          </div>
          {monthlyIncome > 0 && (
            <div className="text-sm text-gray-600 mt-2">
              Savings rate: {savingsRate.toFixed(1)}% of net income
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

