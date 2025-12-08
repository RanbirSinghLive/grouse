import { useState } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import type { Account, Holding } from '../types/models';
import {
  calcNetWorth,
  calcMonthlyCashflowFromTransactions,
  calcSavingsRateFromTransactions,
  calcEmergencyFundMonthsFromTransactions,
  calcDebtToIncomeRatioFromTransactions,
  calcDebtToAssetRatio,
  calcMortgageEquity,
  calcTotalAssets,
} from '../utils/calculations';
import { AssetMixChart } from '../components/AssetMixChart';
import { CashflowGauge } from '../components/CashflowGauge';

export const Dashboard = () => {
  const { accounts, transactions, refreshAllHoldingPrices } = useHouseholdStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; ticker: string } | null>(null);

  const netWorth = calcNetWorth(accounts);
  const monthlyCashflow = calcMonthlyCashflowFromTransactions(transactions);
  const savingsRate = calcSavingsRateFromTransactions(transactions);
  const emergencyFundMonths = calcEmergencyFundMonthsFromTransactions(accounts, transactions);
  const debtToIncomeRatio = calcDebtToIncomeRatioFromTransactions(accounts, transactions);
  const debtToAssetRatio = calcDebtToAssetRatio(accounts);
  const mortgageEquity = calcMortgageEquity(accounts);
  const totalAssets = calcTotalAssets(accounts);

  const handleRefreshAllPrices = async () => {
    // Capture values BEFORE refresh (important: do this before any async operations)
    const netWorthBefore = calcNetWorth(accounts);
    const accountsBefore = JSON.parse(JSON.stringify(accounts)); // Deep copy for comparison
    
    setIsRefreshing(true);
    setRefreshProgress(null);

    try {
      await refreshAllHoldingPrices(
        (current, total, ticker) => {
          setRefreshProgress({ current, total, ticker });
        }
      );
      setRefreshProgress(null);
      
      // Wait a moment for state to update, then log
      setTimeout(() => {
        const updatedAccounts = useHouseholdStore.getState().accounts;
        const updatedNetWorth = calcNetWorth(updatedAccounts);
        
        // Check if prices actually changed by comparing holdings
        let priceChangesFound = false;
        accountsBefore
          .filter((a: Account) => a.kind === 'asset' && a.useHoldings && a.holdings)
          .forEach((account: Account) => {
            const updatedAccount = updatedAccounts.find((a: Account) => a.id === account.id);
            if (updatedAccount && updatedAccount.holdings) {
              account.holdings?.forEach((holding: Holding) => {
                const updatedHolding = updatedAccount.holdings?.find((h: Holding) => h.id === holding.id);
                if (updatedHolding) {
                  if (updatedHolding.currentPrice !== holding.currentPrice) {
                    priceChangesFound = true;
                  } else {
                  }
                }
              });
            }
          });
        
        if (!priceChangesFound) {
        }
      }, 200);
      
      alert('All prices updated successfully!');
    } catch (error) {
      console.error('[Dashboard] Error refreshing prices:', error);
      alert('Error updating prices: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  // Count unique tickers across all accounts
  const accountsWithHoldings = accounts.filter(
    acc => acc.useHoldings && acc.holdings && acc.holdings.length > 0
  );
  const uniqueTickers = new Set<string>();
  accountsWithHoldings.forEach(account => {
    account.holdings?.forEach(holding => {
      if (holding.ticker && holding.ticker !== 'CASH') {
        uniqueTickers.add(holding.ticker);
      }
    });
  });
  const tickerCount = uniqueTickers.size;
  const estimatedTime = tickerCount > 0 ? (tickerCount - 1) * 12 + 2 : 0; // ~1-2s for first, 12s for subsequent

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        {tickerCount > 0 && (
          <button
            onClick={handleRefreshAllPrices}
            disabled={isRefreshing}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-all flex items-center gap-2 ${
              isRefreshing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
            }`}
          >
            <span className={`text-lg ${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
            {isRefreshing ? (
              <span>
                Refreshing {refreshProgress ? `${refreshProgress.current}/${refreshProgress.total}` : '...'} 
                {refreshProgress && refreshProgress.ticker && ` (${refreshProgress.ticker})`}
              </span>
            ) : (
              <span>Refresh All Prices</span>
            )}
          </button>
        )}
      </div>
      
      {isRefreshing && refreshProgress && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">
              Refreshing prices: {refreshProgress.current} of {refreshProgress.total}
            </span>
            <span className="text-sm text-blue-700">
              {refreshProgress.ticker}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(refreshProgress.current / refreshProgress.total) * 100}%` }}
            />
          </div>
          {estimatedTime > 0 && (
            <p className="text-xs text-blue-600 mt-2">
              Estimated time remaining: ~{Math.ceil((refreshProgress.total - refreshProgress.current) * 12 / 60)} minutes
            </p>
          )}
        </div>
      )}

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

      {/* Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-2xl shadow-lg border-2 border-amber-200 hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Emergency Fund</h2>
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🛡️</span>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-900 mb-1">
            {emergencyFundMonths.toFixed(1)} months
          </p>
          <p className="text-xs text-amber-700">
            {emergencyFundMonths >= 6 ? '✅ Excellent' : emergencyFundMonths >= 3 ? '✅ Good' : '⚠️ Build up'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl shadow-lg border-2 border-orange-200 hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-orange-700 uppercase tracking-wider">Debt-to-Income</h2>
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">📊</span>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-orange-900 mb-1">
            {debtToIncomeRatio.toFixed(1)}%
          </p>
          <p className="text-xs text-orange-700">
            {debtToIncomeRatio <= 36 ? '✅ Healthy' : debtToIncomeRatio <= 43 ? '⚠️ Caution' : '🔴 High'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-2xl shadow-lg border-2 border-indigo-200 hover:shadow-xl transition-all hover:scale-105">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Debt-to-Asset</h2>
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">⚖️</span>
            </div>
          </div>
          <p className="text-3xl font-extrabold text-indigo-900 mb-1">
            {debtToAssetRatio.toFixed(1)}%
          </p>
          <p className="text-xs text-indigo-700">
            {debtToAssetRatio <= 30 ? '✅ Low' : debtToAssetRatio <= 50 ? '⚠️ Moderate' : '🔴 High'}
          </p>
        </div>

        {mortgageEquity ? (
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-2xl shadow-lg border-2 border-teal-200 hover:shadow-xl transition-all hover:scale-105">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-teal-700 uppercase tracking-wider">Real Estate Equity</h2>
              <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">🏠</span>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-teal-900 mb-1">
              {mortgageEquity.percentage.toFixed(1)}%
            </p>
            <p className="text-xs text-teal-700">
              ${mortgageEquity.equity.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} equity
            </p>
            <p className="text-xs text-teal-600 mt-1">
              ${mortgageEquity.totalValue.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} value
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-2xl shadow-lg border-2 border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Assets</h2>
              <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">💎</span>
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 mb-1">
              ${totalAssets.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-gray-600">
              Total Assets
            </p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssetMixChart accounts={accounts} />
        <CashflowGauge transactions={transactions} />
      </div>
    </div>
  );
};

