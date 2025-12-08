import { useState, useMemo, useEffect } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { calcNetWorth, formatAccountType } from '../utils/calculations';
import { NetWorthProjectionChart } from '../components/NetWorthProjectionChart';
import { loadProjectionInputs, saveProjectionInputs, loadRetirementYears, saveRetirementYears, type ProjectionInputs, type RetirementYears } from '../utils/storage';
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
  
  // Inflation rate (as decimal, e.g., 0.02 for 2%)
  const [inflationRate, setInflationRate] = useState(0.02);

  // Retirement years by owner
  const [retirementYears, setRetirementYears] = useState<RetirementYears>(() => {
    const saved = loadRetirementYears();
    return saved || {};
  });

  // Save retirement years to localStorage whenever they change
  useEffect(() => {
    saveRetirementYears(retirementYears);
  }, [retirementYears]);

  // Expanded accounts state
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Projection model: account-specific inputs
  const [projectionInputs, setProjectionInputs] = useState<ProjectionInputs>(() => {
    // Load from localStorage on initial mount
    const saved = loadProjectionInputs();
    return saved || {};
  });

  // Save projection inputs to localStorage whenever they change
  useEffect(() => {
    saveProjectionInputs(projectionInputs);
  }, [projectionInputs]);

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
  const updateProjectionInput = (accountId: string, field: string, value: number | string | undefined) => {
    setProjectionInputs(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: value,
      },
    }));
  };

  // Generate list of years for contribute-until dropdown (per account)
  const getContributeUntilYearOptions = (account: Account) => {
    const years: Array<{ value: number | 'retirement'; label: string }> = [];
    const owner = account.owner || 'All / Joint';
    const retirementYear = getRetirementYearForOwner(owner);
    
    // Add "Retirement" option at the top if owner has retirement year set
    if (retirementYear) {
      years.push({ value: 'retirement', label: `Retirement (${retirementYear})` });
    }
    
    // Add all years in projection range
    for (let year = currentYear; year <= endOfPlanYear; year++) {
      years.push({ value: year, label: year.toString() });
    }
    
    return years;
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

  // Get all unique owners from accounts
  const allOwners = useMemo(() => {
    const owners = new Set<string>();
    accounts.forEach(account => {
      if (account.owner) {
        owners.add(account.owner);
      }
    });
    return Array.from(owners).sort();
  }, [accounts]);

  // Get retirement year for an owner (returns actual year or null)
  const getRetirementYearForOwner = (owner: string): number | null => {
    return retirementYears[owner] || null;
  };

  // Get contribute until year for an account (resolves 'retirement' to actual year)
  const getContributeUntilYear = (account: Account): number | null => {
    const inputs = projectionInputs[account.id];
    if (!inputs || inputs.contributeUntilYear === undefined) {
      return null; // Contribute forever
    }
    if (inputs.contributeUntilYear === 'retirement') {
      const owner = account.owner || 'All / Joint';
      return getRetirementYearForOwner(owner);
    }
    return inputs.contributeUntilYear as number;
  };

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
      retirementOwner: undefined,
    });
    
    // Project forward year by year
    for (let year = currentYear + 1; year <= endOfPlanYear; year++) {
      const yearsIntoProjection = year - currentYear;
      
      // Apply projection model calculations for each account
      accounts.forEach(account => {
        const inputs = projectionInputs[account.id];
        let balance = accountBalances[account.id];
        
        // Only process asset accounts with inputs
        if (account.kind === 'asset' && inputs) {
          // Check if contributions should continue this year
          const contributeUntilYear = getContributeUntilYear(account);
          const shouldContribute = contributeUntilYear === null || year <= contributeUntilYear;
          
          // Step 1: Add annual contribution (if specified and not past contribute-until year)
          if (shouldContribute && inputs.annualContribution !== undefined && inputs.annualContribution > 0) {
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
      
      const nominalNetWorth = projectedAssets - projectedLiabilities;
      
      // Apply inflation adjustment: convert nominal to real (today's purchasing power)
      // Formula: real = nominal / (1 + inflation)^years
      const inflationAdjustment = Math.pow(1 + inflationRate, yearsIntoProjection);
      const realNetWorth = nominalNetWorth / inflationAdjustment;
      
      // Check if this year has a retirement milestone
      const retirementMilestone = Object.entries(retirementYears).find(([_, retYear]) => retYear === year);
      
      data.push({
        year: year.toString(),
        netWorth: realNetWorth,
        retirementOwner: retirementMilestone ? retirementMilestone[0] : undefined,
      });
    }
    
    return data;
  }, [currentYear, endOfPlanYear, currentNetWorth, accounts, projectionInputs, inflationRate, retirementYears]);

  // Collect retirement milestones for chart
  const retirementMilestones = useMemo(() => {
    const milestones: Array<{ year: number; owner: string; netWorth: number }> = [];
    Object.entries(retirementYears).forEach(([owner, year]) => {
      const yearData = chartData.find(d => d.year === year.toString());
      if (yearData) {
        milestones.push({
          year,
          owner,
          netWorth: yearData.netWorth,
        });
      }
    });
    return milestones;
  }, [retirementYears, chartData]);

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
                <div className="space-y-4">
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
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inflation Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={inflationRate * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 10) {
                          setInflationRate(value / 100);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Annual inflation rate: {(inflationRate * 100).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Adjusts projection to show real purchasing power
                    </p>
                  </div>
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

              {/* Retirement Planning */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Retirement Planning</h2>
                <div className="space-y-3">
                  {allOwners.length === 0 ? (
                    <p className="text-xs text-gray-500">No owners found. Add accounts to see retirement inputs.</p>
                  ) : (
                    allOwners.map((owner) => (
                      <div key={owner}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {owner} Retirement Year
                        </label>
                        <input
                          type="number"
                          min={currentYear}
                          max={endOfPlanYear}
                          value={retirementYears[owner] || ''}
                          onChange={(e) => {
                            const year = e.target.value === '' ? undefined : parseInt(e.target.value);
                            setRetirementYears(prev => {
                              if (year === undefined) {
                                const { [owner]: _, ...rest } = prev;
                                return rest;
                              }
                              return { ...prev, [owner]: year };
                            });
                          }}
                          placeholder="Enter retirement year"
                          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {retirementYears[owner] && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Retires in {retirementYears[owner]} ({retirementYears[owner] - currentYear} years from now)
                          </p>
                        )}
                      </div>
                    ))
                  )}
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
                            {inputs.contributeUntilYear !== undefined && (
                              <div>• Contribute until: {
                                inputs.contributeUntilYear === 'retirement' 
                                  ? `Retirement (${getRetirementYearForOwner(account.owner || 'All / Joint') || 'not set'})`
                                  : inputs.contributeUntilYear
                              }</div>
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
              retirementMilestones={retirementMilestones}
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

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Contribute Until
                                        </label>
                                        <select
                                          value={accountInputs.contributeUntilYear !== undefined ? accountInputs.contributeUntilYear : ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              updateProjectionInput(account.id, 'contributeUntilYear', undefined);
                                            } else if (value === 'retirement') {
                                              updateProjectionInput(account.id, 'contributeUntilYear', 'retirement');
                                            } else {
                                              updateProjectionInput(account.id, 'contributeUntilYear', parseInt(value));
                                            }
                                          }}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="">Forever (no end)</option>
                                          {getContributeUntilYearOptions(account).map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Stop contributing after this year
                                        </p>
                                        {accountInputs.contributeUntilYear !== undefined && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                            {accountInputs.contributeUntilYear === 'retirement' 
                                              ? `Will stop at retirement (${getRetirementYearForOwner(account.owner || 'All / Joint') || 'not set'})`
                                              : `Will stop contributing in ${accountInputs.contributeUntilYear}`
                                            }
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
