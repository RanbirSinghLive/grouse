import { useHouseholdStore } from '../store/useHouseholdStore';
import { calcNetWorth, calcMonthlyCashflow, calcSavingsRate } from '../utils/calculations';
import { AssetMixChart } from '../components/AssetMixChart';
import { CashflowGauge } from '../components/CashflowGauge';

export const Dashboard = () => {
  const { accounts, cashflows } = useHouseholdStore();

  const netWorth = calcNetWorth(accounts);
  const monthlyCashflow = calcMonthlyCashflow(cashflows);
  const savingsRate = calcSavingsRate(cashflows);

  console.log('[Dashboard] Rendering with', accounts.length, 'accounts and', cashflows.length, 'cashflows');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-8 rounded-2xl shadow-lg border-2 border-blue-200 hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-blue-700 uppercase tracking-wider">Net Worth</h2>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">💰</span>
            </div>
          </div>
          <p className="text-5xl font-extrabold text-blue-900">
            ${netWorth.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className={`p-8 rounded-2xl shadow-lg border-2 hover:shadow-xl transition-all hover:scale-105 ${
          monthlyCashflow >= 0 
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200' 
            : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${
              monthlyCashflow >= 0 ? 'text-emerald-700' : 'text-red-700'
            }`}>Monthly Cashflow</h2>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              monthlyCashflow >= 0 ? 'bg-emerald-500' : 'bg-red-500'
            }`}>
              <span className="text-white text-xl">{monthlyCashflow >= 0 ? '📈' : '📉'}</span>
            </div>
          </div>
          <p className={`text-5xl font-extrabold ${
            monthlyCashflow >= 0 ? 'text-emerald-900' : 'text-red-900'
          }`}>
            {monthlyCashflow >= 0 ? '+' : ''}${monthlyCashflow.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-8 rounded-2xl shadow-lg border-2 border-purple-200 hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-purple-700 uppercase tracking-wider">Savings Rate</h2>
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">🎯</span>
            </div>
          </div>
          <p className="text-5xl font-extrabold text-purple-900">
            {savingsRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssetMixChart accounts={accounts} />
        <CashflowGauge cashflows={cashflows} />
      </div>
    </div>
  );
};

