import { useState, useMemo } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { calcNetWorth, formatAccountType } from '../utils/calculations';
import { NetWorthProjectionChart } from '../components/NetWorthProjectionChart';
import type { Account } from '../types/models';

export const Projections = () => {
  const {
    household,
    accounts,
  } = useHouseholdStore();

  // Panel visibility state
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  
  // End of plan year
  const currentYear = new Date().getFullYear();
  const [endOfPlanYear, setEndOfPlanYear] = useState(currentYear + 30);

  // Expanded accounts state
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Projection model: account-specific inputs
  const [projectionInputs, setProjectionInputs] = useState<{
    [accountId: string]: {
      annualContribution?: number;
      annualInvestmentGrowth?: number; // As decimal (e.g., 0.06 for 6%)
      [key: string]: any; // For future custom modifiers
    };
  }>({});

  // Toggle account expansion
  const toggleAccountExpansion = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Update projection input for an account
  const updateProjectionInput = (accountId: string, field: string, value: number | undefined) => {
    setProjectionInputs(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: value,
      },
    }));
  };

  // Calculate current net worth
  const currentNetWorth = useMemo(() => {
    return calcNetWorth(accounts);
  }, [accounts]);

  // Group accounts by owner
  const accountsByOwner = useMemo(() => {
    const grouped: { [owner: string]: Account[] } = {};
    accounts.forEach(account => {
      const owner = account.owner || 'All / Joint';
      if (!grouped[owner]) {
        grouped[owner] = [];
      }
      grouped[owner].push(account);
    });
    return grouped;
  }, [accounts]);

  if (!household) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Projections</h1>
        <p className="text-gray-600">Please set up your household in Settings first.</p>
      </div>
    );
  }

  // Create chart data using projection model
  const chartData = useMemo(() => {
    const data = [];
    
    // Start with current account balances (create a copy to modify)
    const accountBalances: { [accountId: string]: number } = {};
    accounts.forEach(account => {
      accountBalances[account.id] = account.balance;
    });
    
    // Always include current year (year 0)
    data.push({
      year: currentYear.toString(),
      netWorth: currentNetWorth,
    });
    
    // Project forward year by year
    for (let year = currentYear + 1; year <= endOfPlanYear; year++) {
      // Apply projection model calculations for each account
      accounts.forEach(account => {
        const inputs = projectionInputs[account.id];
        let balance = accountBalances[account.id];
        
        // Only process asset accounts with inputs
        if (account.kind === 'asset' && inputs) {
          // Step 1: Add annual contribution (if specified)
          if (inputs.annualContribution !== undefined && inputs.annualContribution > 0) {
            balance += inputs.annualContribution;
          }
          
          // Step 2: Apply investment growth to the total (beginning balance + contributions)
          if (inputs.annualInvestmentGrowth !== undefined && inputs.annualInvestmentGrowth > 0) {
            balance = balance * (1 + inputs.annualInvestmentGrowth);
          }
        }
        
        // Update the balance for next iteration
        accountBalances[account.id] = balance;
      });
      
      // Calculate projected net worth from updated balances
      const projectedAssets = accounts
        .filter(a => a.kind === 'asset')
        .reduce((sum, a) => sum + (accountBalances[a.id] || a.balance), 0);
      
      const projectedLiabilities = accounts
        .filter(a => a.kind === 'liability')
        .reduce((sum, a) => sum + (accountBalances[a.id] || a.balance), 0);
      
      const projectedNetWorth = projectedAssets - projectedLiabilities;
      
      data.push({
        year: year.toString(),
        netWorth: projectedNetWorth,
      });
    }
    
    return data;
  }, [currentYear, endOfPlanYear, currentNetWorth, accounts, projectionInputs]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <h1 className="text-3xl font-bold text-gray-900">Projections</h1>
      </div>

      {/* Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden gap-2 px-2 pb-2 relative">
        {/* Left Panel - Settings */}
        <div className={`bg-blue-50 rounded-lg shadow-lg border-2 border-blue-200 flex flex-col transition-all duration-300 ease-in-out relative ${
          leftPanelVisible ? 'w-80 min-w-80' : 'w-12 min-w-12'
        }`}>
          {/* Toggle Button - Always visible in top-left corner */}
          <button
            onClick={() => setLeftPanelVisible(!leftPanelVisible)}
            className="absolute top-3 left-3 p-2.5 bg-blue-100 hover:bg-blue-200 text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all z-20 border border-blue-300"
            title={leftPanelVisible ? "Hide Settings Panel" : "Show Settings Panel"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {/* Rounded rectangle outline */}
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" fill="none" />
              {/* Vertical divider line (left side) */}
              <line x1="8" y1="4" x2="8" y2="20" stroke="currentColor" strokeWidth={1.5} />
              {/* Three horizontal lines on left (menu icon) */}
              <line x1="5" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="5" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="5" y1="13" x2="7" y2="13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </button>
          
          {leftPanelVisible && (
            <div className="flex-1 overflow-y-auto p-4 pt-14">
              {/* End of Plan Year */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Plan Settings</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End of Plan Year
                  </label>
                  <input
                    type="number"
                    min={currentYear}
                    max={currentYear + 100}
                    value={endOfPlanYear}
                                    onChange={(e) => {
                      const year = parseInt(e.target.value);
                      if (!isNaN(year) && year >= currentYear) {
                        setEndOfPlanYear(year);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Plan spans {endOfPlanYear - currentYear} years ({currentYear} - {endOfPlanYear})
                  </p>
                </div>
              </div>

              {/* Current Net Worth Summary */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Current Status</h2>
                <div className="space-y-2">
                  <div>
                    <div className="text-sm text-gray-600">Net Worth</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${currentNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Total Accounts</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {accounts.length}
                    </div>
                  </div>
                </div>
              </div>

              {/* Projection Model Summary */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Projection Model</h2>
                <div className="space-y-2 text-xs">
                  <div className="text-gray-600">
                    Accounts with inputs: {Object.keys(projectionInputs).length}
                  </div>
                  {Object.keys(projectionInputs).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(projectionInputs).map(([accountId, inputs]) => {
                        const account = accounts.find(a => a.id === accountId);
                        if (!account) return null;
                        return (
                          <div key={accountId} className="text-gray-500 border-l-2 border-blue-300 pl-2">
                            <div className="font-medium text-gray-700">{account.name}:</div>
                            {inputs.annualContribution !== undefined && (
                              <div>• Contribution: ${inputs.annualContribution.toLocaleString('en-CA')}/year</div>
                            )}
                            {inputs.annualInvestmentGrowth !== undefined && (
                              <div>• Growth: {(inputs.annualInvestmentGrowth * 100).toFixed(1)}%/year</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
                        </div>
          )}
                          </div>

        {/* Center Panel - Chart */}
        <div className="flex-1 bg-white rounded-lg shadow-lg border-2 border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 p-4">
            <NetWorthProjectionChart 
              chartData={chartData}
              currentNetWorth={currentNetWorth}
            />
                          </div>
                        </div>

        {/* Right Panel - Placeholder (empty for now) */}
        <div className={`bg-green-50 rounded-lg shadow-lg border-2 border-green-200 flex flex-col transition-all duration-300 ease-in-out relative ${
          rightPanelVisible ? 'w-80 min-w-80' : 'w-12 min-w-12'
        }`}>
          {/* Toggle Button - Always visible in top-right corner */}
                                          <button
            onClick={() => setRightPanelVisible(!rightPanelVisible)}
            className="absolute top-3 right-3 p-2.5 bg-green-100 hover:bg-green-200 text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all z-20 border border-green-300"
            title={rightPanelVisible ? "Hide Inputs Panel" : "Show Inputs Panel"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {/* Rounded rectangle outline */}
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" fill="none" />
              {/* Vertical divider line (right side) */}
              <line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" strokeWidth={1.5} />
              {/* Three horizontal lines on right (menu icon) */}
              <line x1="17" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="17" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="17" y1="13" x2="19" y2="13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
                                          </button>
          
          {rightPanelVisible && (
            <div className="flex-1 overflow-y-auto p-4 pt-14">
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Accounts</h2>
                
                {Object.keys(accountsByOwner).length === 0 ? (
                  <div className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-sm">
                    <p className="text-sm text-gray-600">No accounts configured yet.</p>
                  </div>
                ) : (
                  Object.entries(accountsByOwner).map(([owner, ownerAccounts]) => (
                    <div key={owner} className="bg-white rounded-lg p-4 border-2 border-green-200 shadow-sm">
                      <h3 className="text-md font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                        {owner}
                      </h3>
                      <div className="space-y-3">
                        {ownerAccounts.map((account) => {
                          const isExpanded = expandedAccounts.has(account.id);
                          const accountInputs = projectionInputs[account.id] || {};
                          
                          return (
                            <div key={account.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              {/* Account Header - Clickable to expand */}
                              <div 
                                className="flex items-start justify-between cursor-pointer"
                                onClick={() => toggleAccountExpansion(account.id)}
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">{account.name}</div>
                                  <div className="text-xs text-gray-500">{formatAccountType(account.type)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className={`text-sm font-semibold ${
                                      account.kind === 'asset' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {account.kind === 'asset' ? '+' : '-'}${Math.abs(account.balance).toLocaleString('en-CA', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </div>
                                  </div>
                                  <svg 
                                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                                  {/* Placeholder for all accounts */}
                                  <div className="text-xs text-gray-500 italic">
                                    Custom modifiers for {formatAccountType(account.type)} accounts
                                  </div>

                                  {/* RRSP-specific inputs */}
                                  {account.type === 'rrsp' && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Contribution ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          value={accountInputs.annualContribution || ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            updateProjectionInput(account.id, 'annualContribution', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Annual dollar amount contributed to this RRSP
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Investment Growth (%)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.1"
                                          value={accountInputs.annualInvestmentGrowth !== undefined ? accountInputs.annualInvestmentGrowth * 100 : ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                            updateProjectionInput(account.id, 'annualInvestmentGrowth', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Expected annual return (e.g., 6 for 6%)
                                        </p>
                                        {accountInputs.annualInvestmentGrowth !== undefined && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                            Current: {(accountInputs.annualInvestmentGrowth * 100).toFixed(1)}% annually
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
              </div>
    </div>
  );
};
