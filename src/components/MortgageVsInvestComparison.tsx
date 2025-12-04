import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Account, MortgageVsInvestComparison as Comparison } from '../types/models';

interface MortgageVsInvestComparisonProps {
  mortgage: Account;
  comparison: Comparison;
  monthlySurplus: number;
}

export const MortgageVsInvestComparison = ({
  mortgage,
  comparison,
  monthlySurplus,
}: MortgageVsInvestComparisonProps) => {
  // Generate comparison data (simplified - showing net worth difference over time)
  const years = 30;
  const data = [];
  const mortgageRate = (mortgage.interestRate || 0) / 100;
  const investmentRate = 0.06; // Default 6%
  
  let mortgageBalance = mortgage.balance;
  let investmentBalance = 0;
  const monthlyMortgageRate = mortgageRate / 12;
  const monthlyInvestmentRate = investmentRate / 12;
  const monthlyPayment = mortgage.monthlyPayment || 0;
  
  for (let year = 0; year <= years; year++) {
    
    // Calculate mortgage balance
    for (let m = 0; m < 12 && mortgageBalance > 0.01; m++) {
      const interest = mortgageBalance * monthlyMortgageRate;
      const principal = monthlyPayment - interest;
      mortgageBalance = Math.max(0, mortgageBalance - principal);
    }
    
    // Calculate investment balance (if investing instead)
    investmentBalance = investmentBalance * Math.pow(1 + monthlyInvestmentRate, 12) + (monthlySurplus * 12);
    
    // Net worth difference: invest scenario - mortgage scenario
    const netWorthDifference = investmentBalance - (mortgage.balance - mortgageBalance);
    
    data.push({
      year: new Date().getFullYear() + year,
      mortgageScenario: mortgage.balance - mortgageBalance,
      investScenario: investmentBalance,
      difference: netWorthDifference,
    });
    
    if (mortgageBalance <= 0.01) break;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRecommendationColor = () => {
    switch (comparison.recommendation) {
      case 'invest':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'mortgage':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'hybrid':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Mortgage vs Invest Comparison</h2>
      
      <div className="mb-6">
        <div className={`p-4 rounded-lg border-2 ${getRecommendationColor()}`}>
          <h3 className="font-bold text-lg mb-2">Recommendation: {comparison.recommendation.toUpperCase()}</h3>
          <p className="text-sm">{comparison.reasoning}</p>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-600">Net Worth Difference</p>
              <p className="text-xl font-bold">
                {comparison.netWorthDifference >= 0 ? '+' : ''}
                {formatCurrency(comparison.netWorthDifference)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Mortgage Payoff</p>
              <p className="text-xl font-bold">
                {new Date(comparison.mortgagePayoffDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-600">Monthly Surplus</p>
              <p className="text-xl font-bold">{formatCurrency(monthlySurplus)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              dataKey="mortgageScenario"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Pay Mortgage"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="investScenario"
              stroke="#10b981"
              strokeWidth={2}
              name="Invest Surplus"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="difference"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              name="Difference"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

