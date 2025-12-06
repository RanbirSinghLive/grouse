import { useState, useMemo, useEffect } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { projectNetWorth, createDefaultScenario } from '../utils/projections';
import type { ProjectionScenario, ProjectionResult, Account, Holding } from '../types/models';
import { NetWorthProjectionChart } from '../components/NetWorthProjectionChart';
import { getAllProvinces, getProvinceName, type Province } from '../utils/canadianTaxRates';
import { calcMonthlyIncomeFromTransactions, calcMonthlyExpensesFromTransactions } from '../utils/calculations';
import { fetchHistoricalReturns } from '../utils/stockApi';
import { isInvestmentAccount } from '../types/models';
import { ProjectionInputSection } from '../components/ProjectionInputSection';
import { PersonInputGroup } from '../components/PersonInputGroup';
import { ContributionRoomInput } from '../components/ContributionRoomInput';
import { calculateCPPBenefit, calculateOASBenefit, estimateCPPContributionRate } from '../utils/governmentBenefits';

export const Projections = () => {
  const {
    household,
    setHousehold,
    accounts,
    transactions,
    projectionScenarios,
    addProjectionScenario,
    updateProjectionScenario,
    deleteProjectionScenario,
    updateHolding,
    updateAccount,
  } = useHouseholdStore();

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  // Person profile state
  const [person1Nickname, setPerson1Nickname] = useState(household?.personProfiles?.person1?.nickname || '');
  const [person1Age, setPerson1Age] = useState(household?.personProfiles?.person1?.age || undefined);
  const [person2Nickname, setPerson2Nickname] = useState(household?.personProfiles?.person2?.nickname || '');
  const [person2Age, setPerson2Age] = useState(household?.personProfiles?.person2?.age || undefined);
  // Chart collapse state
  const [chartExpanded, setChartExpanded] = useState(true);
  // Investment rate configuration state (reversed hierarchy: holding first)
  const [selectedHoldingTicker, setSelectedHoldingTicker] = useState<string | null>(null);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [fetchedRates, setFetchedRates] = useState<{ 
    growthRate?: number; 
    dividendYield?: number; 
    yearsOfData?: number;
    monthsOfData?: number;
    dataQuality?: 'reliable' | 'limited' | 'insufficient';
    warning?: string;
  } | null>(null);

  // Get or create default scenario
  const currentScenario = useMemo(() => {
    if (selectedScenarioId) {
      return projectionScenarios.find(s => s.id === selectedScenarioId) || null;
    }
    if (projectionScenarios.length > 0) {
      return projectionScenarios[0];
    }
    return null;
  }, [selectedScenarioId, projectionScenarios]);

  // Calculate projection result
  const projectionResult = useMemo<ProjectionResult | null>(() => {
    if (!currentScenario || !household || accounts.length === 0) {
      return null;
    }

    try {
      console.log('[Projections] Calculating projection for scenario:', currentScenario.name);
      const result = projectNetWorth(accounts, transactions, currentScenario);
      console.log('[Projections] Projection calculated:', result.summary);
      return result;
    } catch (error) {
      console.error('[Projections] Error calculating projection:', error);
      return null;
    }
  }, [currentScenario, accounts, transactions, household]);

  // Find mortgage for comparison

  // Calculate auto-calculated taxable income from transactions
  const autoCalculatedTaxableIncome = useMemo(() => {
    const monthlyIncome = calcMonthlyIncomeFromTransactions(transactions);
    const annualIncome = monthlyIncome * 12;
    return annualIncome;
  }, [transactions]);

  // Calculate auto-calculated monthly expenses (excluding mortgage payments)
  const autoCalculatedMonthlyExpenses = useMemo(() => {
    console.log('[Projections] Calculating monthly expenses excluding mortgage payments');
    const totalExpenses = calcMonthlyExpensesFromTransactions(transactions);
    
    // Calculate total monthly mortgage payments from accounts
    const monthlyMortgagePayments = accounts
      .filter(a => a.kind === 'liability' && a.type === 'mortgage' && a.monthlyPayment)
      .reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);
    
    console.log('[Projections] Total expenses:', totalExpenses, 'Mortgage payments:', monthlyMortgagePayments);
    const expensesExcludingMortgage = totalExpenses - monthlyMortgagePayments;
    console.log('[Projections] Expenses excluding mortgage:', expensesExcludingMortgage);
    
    return expensesExcludingMortgage;
  }, [transactions, accounts]);

  // Auto-populate account balances for contribution rooms
  const accountBalances = useMemo(() => {
    const balances: {
      rrsp: { person1: number; person2: number };
      tfsa: { person1: number; person2: number };
      resp: number;
    } = {
      rrsp: { person1: 0, person2: 0 },
      tfsa: { person1: 0, person2: 0 },
      resp: 0,
    };

    accounts.forEach(acc => {
      if (acc.type === 'rrsp') {
        const owner = acc.owner || 'person1';
        if (owner.toLowerCase().includes('1') || owner.toLowerCase() === 'person 1') {
          balances.rrsp.person1 += acc.balance;
        } else {
          balances.rrsp.person2 += acc.balance;
        }
      } else if (acc.type === 'tfsa') {
        const owner = acc.owner || 'person1';
        if (owner.toLowerCase().includes('1') || owner.toLowerCase() === 'person 1') {
          balances.tfsa.person1 += acc.balance;
        } else {
          balances.tfsa.person2 += acc.balance;
        }
      } else if (acc.type === 'resp') {
        balances.resp += acc.balance;
      }
    });

    return balances;
  }, [accounts]);

  // Check if RESP accounts exist
  const hasRESPAccounts = useMemo(() => {
    return accounts.some(acc => acc.type === 'resp');
  }, [accounts]);

  // Get investment accounts
  const investmentAccounts = useMemo(() => {
    return accounts.filter(a => a.kind === 'asset' && isInvestmentAccount(a.type));
  }, [accounts]);

  // Get all unique holdings (tickers) across all investment accounts
  const allHoldings = useMemo(() => {
    const tickerSet = new Set<string>();
    investmentAccounts.forEach(acc => {
      acc.holdings?.forEach(holding => {
        if (holding.ticker && holding.ticker !== 'CASH') {
          tickerSet.add(holding.ticker);
        }
      });
    });
    return Array.from(tickerSet).sort();
  }, [investmentAccounts]);

  // Get all accounts that contain the selected holding ticker
  const accountsWithSelectedHolding = useMemo(() => {
    if (!selectedHoldingTicker) return [];
    return investmentAccounts.filter(acc => 
      acc.holdings?.some(h => h.ticker === selectedHoldingTicker)
    );
  }, [selectedHoldingTicker, investmentAccounts]);

  // Get first instance of selected holding (for display purposes - all instances should have same rates)
  const selectedHoldingInstance = useMemo(() => {
    if (!selectedHoldingTicker) return null;
    for (const acc of investmentAccounts) {
      const holding = acc.holdings?.find(h => h.ticker === selectedHoldingTicker);
      if (holding) return { account: acc, holding };
    }
    return null;
  }, [selectedHoldingTicker, investmentAccounts]);

  // Handle fetching historical rates
  const handleFetchHistoricalRates = async (forceRefresh: boolean = false) => {
    if (!selectedHoldingTicker) {
      alert('Please select a holding first');
      return;
    }

    setFetchingRates(true);
    setFetchedRates(null);
    try {
      // Bypass cache if force refresh is requested (to get updated calculations)
      const historicalData = await fetchHistoricalReturns(selectedHoldingTicker, forceRefresh);
      if (historicalData.error) {
        alert(`Error fetching historical data: ${historicalData.error}`);
      } else {
        setFetchedRates({
          growthRate: historicalData.growthRate,
          dividendYield: historicalData.dividendYield,
          yearsOfData: historicalData.yearsOfData,
          monthsOfData: historicalData.monthsOfData,
          dataQuality: historicalData.dataQuality,
          warning: historicalData.warning,
        });
        
        // Only auto-apply if data is reliable or limited (not insufficient)
        // User can still manually apply insufficient data if they want
        if (historicalData.dataQuality !== 'insufficient') {
        updateHoldingRatesForAllAccounts(selectedHoldingTicker, {
          growthRate: historicalData.growthRate,
          dividendYield: historicalData.dividendYield,
        });
        } else {
          // Show warning but don't auto-apply - user can manually apply if desired
          console.warn(`[Projections] Insufficient data for ${selectedHoldingTicker}, rates not auto-applied`);
        }
      }
    } catch (error) {
      console.error('[Projections] Error fetching historical rates:', error);
      alert('Failed to fetch historical rates. Please try again.');
    } finally {
      setFetchingRates(false);
    }
  };

  // Update holding rates for all accounts that contain this ticker
  const updateHoldingRatesForAllAccounts = (ticker: string, rates: { growthRate?: number; dividendYield?: number; dividendType?: Holding['dividendType'] }) => {
    investmentAccounts.forEach(acc => {
      acc.holdings?.forEach(holding => {
        if (holding.ticker === ticker) {
          updateHolding(acc.id, holding.id, rates);
        }
      });
    });
  };

  // Update account rates
  const updateAccountRates = (accountId: string, rates: { investmentGrowthRate?: number; investmentDividendYield?: number }) => {
    updateAccount(accountId, rates);
  };

  const handleCreateScenario = () => {
    if (!household) {
      alert('Please set up your household in Settings first.');
      return;
    }

    const defaultScenario = createDefaultScenario(household.id, household.province);
    addProjectionScenario(defaultScenario);
    setSelectedScenarioId(defaultScenario.id);
  };

  // Update person profiles when household changes
  useEffect(() => {
    console.log('[Projections] Updating person profile state from household');
    setPerson1Nickname(household?.personProfiles?.person1?.nickname || '');
    setPerson1Age(household?.personProfiles?.person1?.age);
    setPerson2Nickname(household?.personProfiles?.person2?.nickname || '');
    setPerson2Age(household?.personProfiles?.person2?.age);
  }, [household]);

  // Check if Person 2 exists
  const hasPerson2 = !!household?.personProfiles?.person2;

  // Helper functions to get display names (nickname if available, otherwise "Person 1"/"Person 2")
  const getPerson1Name = () => {
    return person1Nickname.trim() || 'Person 1';
  };

  const getPerson2Name = () => {
    return person2Nickname.trim() || 'Person 2';
  };

  // Scroll to section handler for milestone clicks
  const scrollToSection = (sectionId: string) => {
    console.log('[Projections] Scrolling to section:', sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Highlight the section briefly
      element.classList.add('highlight-section');
      setTimeout(() => element.classList.remove('highlight-section'), 2000);
    }
  };

  const handleSavePersonProfiles = () => {
    if (!household) return;
    console.log('[Projections] Saving person profiles');
    const personProfiles: { person1?: any; person2?: any } = {
      person1: {
        nickname: person1Nickname || undefined,
        age: person1Age || undefined,
      },
    };
    
    // Only include person2 if they have data or already exist
    if (hasPerson2 || person2Nickname || person2Age) {
      personProfiles.person2 = {
        nickname: person2Nickname || undefined,
        age: person2Age || undefined,
      };
    }
    
    setHousehold({
      ...household,
      personProfiles,
    });
    alert('Person profiles saved!');
  };

  const handleAddPerson2 = () => {
    if (!household) return;
    console.log('[Projections] Adding Person 2');
    setHousehold({
      ...household,
      personProfiles: {
        ...household.personProfiles,
        person2: {
          nickname: '',
          age: undefined,
        },
      },
    });
  };

  const handleRemovePerson2 = () => {
    if (!household) return;
    if (!window.confirm(`Are you sure you want to remove ${getPerson2Name()}?`)) return;
    console.log('[Projections] Removing Person 2');
    const personProfiles = { ...household.personProfiles };
    delete personProfiles.person2;
    setHousehold({
      ...household,
      personProfiles: Object.keys(personProfiles).length > 0 ? personProfiles : undefined,
    });
  };

  const handleDeleteScenario = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scenario?')) {
      deleteProjectionScenario(id);
      if (selectedScenarioId === id) {
        setSelectedScenarioId(null);
      }
    }
  };

  const handleAssumptionChange = (key: keyof ProjectionScenario['assumptions'], value: number | string | object | undefined) => {
    if (!currentScenario) return;
    console.log('[Projections] Updating assumption:', key, value);
    const updatedAssumptions = { ...currentScenario.assumptions };
    if (value === undefined) {
      delete updatedAssumptions[key];
    } else {
      // Type-safe assignment using index signature
      (updatedAssumptions as Record<string, any>)[key as string] = value;
    }
    updateProjectionScenario(currentScenario.id, {
      ...currentScenario,
      assumptions: updatedAssumptions,
    });
  };

  // Helper to update nested assumption fields (e.g., cpp.person1.yearsOfContributions)
  const handleNestedAssumptionChange = (
    path: string[],
    value: number | string | boolean | undefined
  ) => {
    if (!currentScenario) return;
    
    console.log('[Projections] Updating nested assumption:', path, value);
    const newAssumptions = { ...currentScenario.assumptions };
    let current: any = newAssumptions;
    
    // Navigate to the nested object
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!current[key]) {
        current[key] = {};
      }
      current = current[key];
    }
    
    // Set the final value
    const finalKey = path[path.length - 1];
    if (value === undefined || value === '') {
      delete current[finalKey];
    } else {
      current[finalKey] = value;
    }
    
    updateProjectionScenario(currentScenario.id, {
      ...currentScenario,
      assumptions: newAssumptions,
    });
  };

  // Helper to get nested assumption value
  const getNestedAssumption = (path: string[]): any => {
    if (!currentScenario) return undefined;
    let current: any = currentScenario.assumptions;
    for (const key of path) {
      if (current === undefined || current === null) return undefined;
      current = current[key];
    }
    return current;
  };

  const handleConfigChange = (key: keyof ProjectionScenario['config'], value: number | string | boolean) => {
    if (!currentScenario) return;
    
    console.log('[Projections] Updating config:', key, value);
    // Validate projectionYears
    if (key === 'projectionYears' && typeof value === 'number') {
      if (value < 1) value = 1;
      if (value > 60) value = 60;
    }
    
    updateProjectionScenario(currentScenario.id, {
      ...currentScenario,
      config: {
        ...currentScenario.config,
        [key]: value,
      },
    });
  };

  if (!household) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Projections</h1>
        <p className="text-gray-600">Please set up your household in Settings first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Projections</h1>
        <button
          onClick={handleCreateScenario}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all hover:scale-105"
        >
          + New Scenario
        </button>
      </div>


      {projectionScenarios.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl shadow-lg border-2 border-gray-200 text-center">
          <p className="text-gray-600 mb-6">No projection scenarios yet. Create your first scenario to get started.</p>
          <button
            onClick={handleCreateScenario}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all"
          >
            Create Base Case Scenario
          </button>
        </div>
      ) : (
        <>
          {/* Scenario Selector */}
          <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm font-medium text-gray-700">Scenario:</label>
              <select
                value={selectedScenarioId || ''}
                onChange={(e) => setSelectedScenarioId(e.target.value || null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {projectionScenarios.map(scenario => (
                  <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                ))}
              </select>
              {currentScenario && (
                <button
                  onClick={() => handleDeleteScenario(currentScenario.id)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all"
                >
                  🗑️ Delete
                </button>
              )}
            </div>
            {currentScenario && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scenario Name</label>
                  <input
                    type="text"
                    value={currentScenario.name}
                    onChange={(e) => updateProjectionScenario(currentScenario.id, { ...currentScenario, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Projection Years</label>
                  <select
                    value={currentScenario.config.projectionYears}
                    onChange={(e) => handleConfigChange('projectionYears', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 Year</option>
                    <option value={5}>5 Years</option>
                    <option value={10}>10 Years</option>
                    <option value={15}>15 Years</option>
                    <option value={20}>20 Years</option>
                    <option value={25}>25 Years</option>
                    <option value={30}>30 Years</option>
                    <option value={35}>35 Years</option>
                    <option value={40}>40 Years</option>
                    <option value={45}>45 Years</option>
                    <option value={50}>50 Years</option>
                    <option value={55}>55 Years</option>
                    <option value={60}>60 Years</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Projection Chart */}
          {projectionResult && currentScenario && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200 mb-6">
              <button
                onClick={() => setChartExpanded(!chartExpanded)}
                className="w-full flex items-center justify-between text-left mb-4"
              >
                <h2 className="text-2xl font-bold text-gray-900">Net Worth Projection</h2>
                <svg
                  className={`w-6 h-6 text-gray-500 transition-transform ${
                    chartExpanded ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {chartExpanded && (
                <>
                  <NetWorthProjectionChart 
                    result={projectionResult} 
                    scenario={currentScenario}
                    onMilestoneClick={scrollToSection}
                  />
                  
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Starting Net Worth</p>
                      <p className="text-xl font-bold text-blue-900">
                        ${projectionResult.summary.startingNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Ending Net Worth</p>
                      <p className="text-xl font-bold text-emerald-900">
                        ${projectionResult.summary.endingNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Growth</p>
                      <p className="text-xl font-bold text-purple-900">
                        ${projectionResult.summary.totalGrowth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Avg Annual Growth</p>
                      <p className="text-xl font-bold text-orange-900">
                        {projectionResult.summary.averageAnnualGrowth.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {projectionResult.summary.debtFreeDate && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800">
                        🎉 Debt-Free Date: {new Date(projectionResult.summary.debtFreeDate).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}


          {/* Projection Inputs - Always Visible */}
          {currentScenario && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Scenario Settings</h2>
              <div className="space-y-4">
                {/* Person Profiles */}
                {household && (
                  <ProjectionInputSection
                    id="person-profiles"
                    title="Person Profiles"
                    defaultExpanded={true}
                    helpText="Demographic and income information for each person"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Person 1 */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <h3 className="text-md font-semibold text-gray-900 mb-4">{getPerson1Name()}</h3>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nickname
                            </label>
                            <input
                              type="text"
                              value={person1Nickname}
                              onChange={(e) => setPerson1Nickname(e.target.value)}
                              placeholder="e.g., John, Sarah"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Age
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="120"
                              value={person1Age || ''}
                              onChange={(e) => setPerson1Age(e.target.value ? parseInt(e.target.value) : undefined)}
                              placeholder="Enter age"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Person 2 */}
                      {hasPerson2 ? (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-md font-semibold text-gray-900">{getPerson2Name()}</h3>
                            <button
                              onClick={handleRemovePerson2}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nickname
                              </label>
                              <input
                                type="text"
                                value={person2Nickname}
                                onChange={(e) => setPerson2Nickname(e.target.value)}
                                placeholder="e.g., John, Sarah"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Age
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="120"
                                value={person2Age || ''}
                                onChange={(e) => setPerson2Age(e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="Enter age"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 border-dashed flex items-center justify-center">
                          <button
                            onClick={handleAddPerson2}
                            className="px-6 py-3 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition-colors"
                          >
                            ➕ Add {getPerson2Name()}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={handleSavePersonProfiles}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
                      >
                        💾 Save Person Profiles
                      </button>
                    </div>
                  </ProjectionInputSection>
                )}

                {/* Income & Employment */}
                <ProjectionInputSection
                  id="income-employment"
                  title="Income & Employment"
                  defaultExpanded={true}
                  helpText="Annual income, expenses, and salary growth assumptions per person"
                >
                  <PersonInputGroup
                    person1Label={getPerson1Name()}
                    person2Label={getPerson2Name()}
                    showPerson2={hasPerson2}
                    person1Content={
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Annual Income (CAD)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={getNestedAssumption(['income', 'person1', 'annualIncome']) || ''}
                            onChange={(e) => handleNestedAssumptionChange(['income', 'person1', 'annualIncome'], e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="Enter annual income"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {/* FYI Info - Auto-calculated from transactions */}
                          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-600">
                            <span className="font-medium">FYI:</span> Auto-calculated from transactions: ${autoCalculatedTaxableIncome.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Annual Expenses (CAD)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={getNestedAssumption(['income', 'person1', 'annualExpenses']) || ''}
                            onChange={(e) => handleNestedAssumptionChange(['income', 'person1', 'annualExpenses'], e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="Enter annual expenses"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {/* FYI Info - Auto-calculated from transactions (excluding mortgage payments) */}
                          <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-gray-600">
                            <span className="font-medium">FYI:</span> Auto-calculated from transactions (excluding mortgage payments): ${(autoCalculatedMonthlyExpenses * 12).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Salary Growth Rate: {((getNestedAssumption(['income', 'person1', 'salaryGrowthRate']) ?? currentScenario.assumptions.salaryGrowthRate) * 100).toFixed(1)}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="0.10"
                            step="0.001"
                            value={getNestedAssumption(['income', 'person1', 'salaryGrowthRate']) ?? currentScenario.assumptions.salaryGrowthRate}
                            onChange={(e) => handleNestedAssumptionChange(['income', 'person1', 'salaryGrowthRate'], parseFloat(e.target.value))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">Annual salary growth rate (uses global rate if not set)</p>
                        </div>
                      </div>
                    }
                    person2Content={
                      hasPerson2 ? (
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Annual Income (CAD)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={getNestedAssumption(['income', 'person2', 'annualIncome']) || ''}
                              onChange={(e) => handleNestedAssumptionChange(['income', 'person2', 'annualIncome'], e.target.value ? parseFloat(e.target.value) : undefined)}
                              placeholder="Enter annual income"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Annual Expenses (CAD)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={getNestedAssumption(['income', 'person2', 'annualExpenses']) || ''}
                              onChange={(e) => handleNestedAssumptionChange(['income', 'person2', 'annualExpenses'], e.target.value ? parseFloat(e.target.value) : undefined)}
                              placeholder="Enter annual expenses"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Salary Growth Rate: {((getNestedAssumption(['income', 'person2', 'salaryGrowthRate']) ?? currentScenario.assumptions.salaryGrowthRate) * 100).toFixed(1)}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="0.10"
                              step="0.001"
                              value={getNestedAssumption(['income', 'person2', 'salaryGrowthRate']) ?? currentScenario.assumptions.salaryGrowthRate}
                              onChange={(e) => handleNestedAssumptionChange(['income', 'person2', 'salaryGrowthRate'], parseFloat(e.target.value))}
                              className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">Annual salary growth rate (uses global rate if not set)</p>
                          </div>
                        </div>
                      ) : undefined
                    }
                  />
                  {/* Global Salary Growth Rate (if no per-person rates set) */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Global Salary Growth Rate: {(currentScenario.assumptions.salaryGrowthRate * 100).toFixed(1)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="0.10"
                      step="0.001"
                      value={currentScenario.assumptions.salaryGrowthRate}
                      onChange={(e) => handleAssumptionChange('salaryGrowthRate', parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default annual salary growth rate (used if per-person rates not set)</p>
                  </div>
                </ProjectionInputSection>

                {/* Investments */}
                <ProjectionInputSection
                  id="investments"
                  title="Investments"
                  defaultExpanded={true}
                  helpText="Global investment return assumptions and per-account/holding overrides"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Total Investment Return: {((currentScenario.assumptions.investmentGrowthRate ?? 0) + (currentScenario.assumptions.investmentDividendYield ?? 0) || currentScenario.assumptions.investmentReturnRate * 100).toFixed(1)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="0.15"
                          step="0.001"
                          value={currentScenario.assumptions.investmentReturnRate}
                          onChange={(e) => handleAssumptionChange('investmentReturnRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Or specify growth + dividends below</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Inflation Rate: {(currentScenario.assumptions.inflationRate * 100).toFixed(1)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="0.05"
                          step="0.001"
                          value={currentScenario.assumptions.inflationRate}
                          onChange={(e) => handleAssumptionChange('inflationRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Investment Growth Rate: {((currentScenario.assumptions.investmentGrowthRate ?? currentScenario.assumptions.investmentReturnRate * 0.7) * 100).toFixed(1)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="0.12"
                          step="0.001"
                          value={currentScenario.assumptions.investmentGrowthRate ?? currentScenario.assumptions.investmentReturnRate * 0.7}
                          onChange={(e) => handleAssumptionChange('investmentGrowthRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Capital appreciation</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Dividend Yield: {((currentScenario.assumptions.investmentDividendYield ?? currentScenario.assumptions.investmentReturnRate * 0.3) * 100).toFixed(1)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="0.08"
                          step="0.001"
                          value={currentScenario.assumptions.investmentDividendYield ?? currentScenario.assumptions.investmentReturnRate * 0.3}
                          onChange={(e) => handleAssumptionChange('investmentDividendYield', parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500 mt-1">Dividend income (taxed differently)</p>
                      </div>
                    </div>
                  </div>
                </ProjectionInputSection>

                {/* Government Benefits */}
                <ProjectionInputSection
                      id="government-benefits"
                      title="Government Benefits (CPP/QPP & OAS)"
                      defaultExpanded={false}
                      helpText="Canada Pension Plan and Old Age Security benefit calculations"
                    >
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-md font-semibold text-gray-800 mb-3">CPP/QPP Benefits</h4>
                          <PersonInputGroup
                            person1Label="Person 1 CPP"
                            person2Label="Person 2 CPP"
                            showPerson2={true}
                            person1Content={
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Years of Contributions</label>
                  <input
                    type="number"
                                    min="0"
                                    max="50"
                                    value={getNestedAssumption(['cpp', 'person1', 'yearsOfContributions']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['cpp', 'person1', 'yearsOfContributions'], val);
                                      // Auto-calculate benefit if we have enough data
                                      if (val && getNestedAssumption(['cpp', 'person1', 'averageContributions'])) {
                                        const benefit = calculateCPPBenefit({
                                          yearsOfContributions: val,
                                          averageContributions: getNestedAssumption(['cpp', 'person1', 'averageContributions']),
                                          startAge: getNestedAssumption(['cpp', 'person1', 'startAge']),
                                        });
                                        handleNestedAssumptionChange(['cpp', 'person1', 'expectedBenefit'], benefit);
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Average Contribution Level (0-1)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={getNestedAssumption(['cpp', 'person1', 'averageContributions']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['cpp', 'person1', 'averageContributions'], val);
                                      // Auto-calculate benefit
                                      if (val && getNestedAssumption(['cpp', 'person1', 'yearsOfContributions'])) {
                                        const benefit = calculateCPPBenefit({
                                          yearsOfContributions: getNestedAssumption(['cpp', 'person1', 'yearsOfContributions']),
                                          averageContributions: val,
                                          startAge: getNestedAssumption(['cpp', 'person1', 'startAge']),
                                        });
                                        handleNestedAssumptionChange(['cpp', 'person1', 'expectedBenefit'], benefit);
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">1.0 = maximum YMPE contributions</p>
              </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Start Age (60-70)</label>
                                  <input
                                    type="number"
                                    min="60"
                                    max="70"
                                    value={getNestedAssumption(['cpp', 'person1', 'startAge']) || 65}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : 65;
                                      handleNestedAssumptionChange(['cpp', 'person1', 'startAge'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Expected Monthly Benefit</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={getNestedAssumption(['cpp', 'person1', 'expectedBenefit']) || ''}
                                      onChange={(e) => {
                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                        handleNestedAssumptionChange(['cpp', 'person1', 'expectedBenefit'], val);
                                      }}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                      placeholder="Auto-calculated"
                                    />
                                    <button
                                      onClick={() => {
                                        const benefit = calculateCPPBenefit({
                                          yearsOfContributions: getNestedAssumption(['cpp', 'person1', 'yearsOfContributions']),
                                          averageContributions: getNestedAssumption(['cpp', 'person1', 'averageContributions']),
                                          startAge: getNestedAssumption(['cpp', 'person1', 'startAge']),
                                        });
                                        handleNestedAssumptionChange(['cpp', 'person1', 'expectedBenefit'], benefit);
                                      }}
                                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                                    >
                                      Calculate
                                    </button>
                                  </div>
                                </div>
                              </div>
                            }
                            person2Content={
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Years of Contributions</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={getNestedAssumption(['cpp', 'person2', 'yearsOfContributions']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['cpp', 'person2', 'yearsOfContributions'], val);
                                      if (val && getNestedAssumption(['cpp', 'person2', 'averageContributions'])) {
                                        const benefit = calculateCPPBenefit({
                                          yearsOfContributions: val,
                                          averageContributions: getNestedAssumption(['cpp', 'person2', 'averageContributions']),
                                          startAge: getNestedAssumption(['cpp', 'person2', 'startAge']),
                                        });
                                        handleNestedAssumptionChange(['cpp', 'person2', 'expectedBenefit'], benefit);
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Average Contribution Level (0-1)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={getNestedAssumption(['cpp', 'person2', 'averageContributions']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['cpp', 'person2', 'averageContributions'], val);
                                      if (val && getNestedAssumption(['cpp', 'person2', 'yearsOfContributions'])) {
                                        const benefit = calculateCPPBenefit({
                                          yearsOfContributions: getNestedAssumption(['cpp', 'person2', 'yearsOfContributions']),
                                          averageContributions: val,
                                          startAge: getNestedAssumption(['cpp', 'person2', 'startAge']),
                                        });
                                        handleNestedAssumptionChange(['cpp', 'person2', 'expectedBenefit'], benefit);
                                      }
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Start Age (60-70)</label>
                                  <input
                                    type="number"
                                    min="60"
                                    max="70"
                                    value={getNestedAssumption(['cpp', 'person2', 'startAge']) || 65}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : 65;
                                      handleNestedAssumptionChange(['cpp', 'person2', 'startAge'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Expected Monthly Benefit</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={getNestedAssumption(['cpp', 'person2', 'expectedBenefit']) || ''}
                                      onChange={(e) => {
                                        const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                        handleNestedAssumptionChange(['cpp', 'person2', 'expectedBenefit'], val);
                                      }}
                                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                      placeholder="Auto-calculated"
                                    />
                                    <button
                                      onClick={() => {
                                        const benefit = calculateCPPBenefit({
                                          yearsOfContributions: getNestedAssumption(['cpp', 'person2', 'yearsOfContributions']),
                                          averageContributions: getNestedAssumption(['cpp', 'person2', 'averageContributions']),
                                          startAge: getNestedAssumption(['cpp', 'person2', 'startAge']),
                                        });
                                        handleNestedAssumptionChange(['cpp', 'person2', 'expectedBenefit'], benefit);
                                      }}
                                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                                    >
                                      Calculate
                                    </button>
                                  </div>
                                </div>
                              </div>
                            }
                          />
                        </div>
                        <div>
                          <h4 className="text-md font-semibold text-gray-800 mb-3">OAS Benefits</h4>
                          <PersonInputGroup
                            person1Label={`${getPerson1Name()} OAS`}
                            person2Label={`${getPerson2Name()} OAS`}
                            showPerson2={true}
                            person1Content={
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Years in Canada</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={getNestedAssumption(['oas', 'person1', 'yearsInCanada']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['oas', 'person1', 'yearsInCanada'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Start Age (65-70)</label>
                                  <input
                                    type="number"
                                    min="65"
                                    max="70"
                                    value={getNestedAssumption(['oas', 'person1', 'startAge']) || 65}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : 65;
                                      handleNestedAssumptionChange(['oas', 'person1', 'startAge'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Expected Monthly Benefit</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={getNestedAssumption(['oas', 'person1', 'expectedBenefit']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['oas', 'person1', 'expectedBenefit'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="Auto-calculated"
                                  />
                                </div>
                              </div>
                            }
                            person2Content={
                              <div className="space-y-3">
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Years in Canada</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="50"
                                    value={getNestedAssumption(['oas', 'person2', 'yearsInCanada']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['oas', 'person2', 'yearsInCanada'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Start Age (65-70)</label>
                                  <input
                                    type="number"
                                    min="65"
                                    max="70"
                                    value={getNestedAssumption(['oas', 'person2', 'startAge']) || 65}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseInt(e.target.value) : 65;
                                      handleNestedAssumptionChange(['oas', 'person2', 'startAge'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600 mb-1">Expected Monthly Benefit</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={getNestedAssumption(['oas', 'person2', 'expectedBenefit']) || ''}
                                    onChange={(e) => {
                                      const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                      handleNestedAssumptionChange(['oas', 'person2', 'expectedBenefit'], val);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="Auto-calculated"
                                  />
                                </div>
                              </div>
                            }
                          />
                        </div>
                      </div>
                </ProjectionInputSection>

                {/* Account Contributions */}
                <ProjectionInputSection
                      id="account-contributions"
                      title="Account Contributions"
                      defaultExpanded={false}
                      helpText="RRSP, TFSA, and RESP contribution room tracking"
                    >
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-md font-semibold text-gray-800 mb-3">RRSP Contribution Rooms</h4>
                          <PersonInputGroup
                            person1Label={`${getPerson1Name()} RRSP Room`}
                            person2Label={`${getPerson2Name()} RRSP Room`}
                            showPerson2={true}
                            person1Content={
                              <ContributionRoomInput
                                label=""
                                value={getNestedAssumption(['contributionRooms', 'rrsp', 'person1'])}
                                onChange={(val) => handleNestedAssumptionChange(['contributionRooms', 'rrsp', 'person1'], val)}
                                currentBalance={accountBalances.rrsp.person1}
                                helpText="Enter your current RRSP contribution room"
                              />
                            }
                            person2Content={
                              <ContributionRoomInput
                                label=""
                                value={getNestedAssumption(['contributionRooms', 'rrsp', 'person2'])}
                                onChange={(val) => handleNestedAssumptionChange(['contributionRooms', 'rrsp', 'person2'], val)}
                                currentBalance={accountBalances.rrsp.person2}
                                helpText="Enter your current RRSP contribution room"
                              />
                            }
                          />
                        </div>
                        <div>
                          <h4 className="text-md font-semibold text-gray-800 mb-3">TFSA Contribution Rooms</h4>
                          <PersonInputGroup
                            person1Label={`${getPerson1Name()} TFSA Room`}
                            person2Label={`${getPerson2Name()} TFSA Room`}
                            showPerson2={true}
                            person1Content={
                              <ContributionRoomInput
                                label=""
                                value={getNestedAssumption(['contributionRooms', 'tfsa', 'person1'])}
                                onChange={(val) => handleNestedAssumptionChange(['contributionRooms', 'tfsa', 'person1'], val)}
                                currentBalance={accountBalances.tfsa.person1}
                                helpText="Enter your current TFSA contribution room"
                              />
                            }
                            person2Content={
                              <ContributionRoomInput
                                label=""
                                value={getNestedAssumption(['contributionRooms', 'tfsa', 'person2'])}
                                onChange={(val) => handleNestedAssumptionChange(['contributionRooms', 'tfsa', 'person2'], val)}
                                currentBalance={accountBalances.tfsa.person2}
                                helpText="Enter your current TFSA contribution room"
                              />
                            }
                          />
                        </div>
                        {hasRESPAccounts && (
                          <div>
                            <h4 className="text-md font-semibold text-gray-800 mb-3">RESP Contribution Room</h4>
                            <ContributionRoomInput
                              label="Family RESP Contribution Room"
                              value={getNestedAssumption(['contributionRooms', 'resp', 'total'])}
                              onChange={(val) => handleNestedAssumptionChange(['contributionRooms', 'resp', 'total'], val)}
                              currentBalance={accountBalances.resp}
                              helpText="Total RESP contribution room (lifetime limit: $50,000 per beneficiary)"
                              maxContribution={50000}
                            />
                            <div className="mt-3">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={getNestedAssumption(['contributionRooms', 'resp', 'cesgEligible']) || false}
                                  onChange={(e) => handleNestedAssumptionChange(['contributionRooms', 'resp', 'cesgEligible'], e.target.checked)}
                                  className="rounded border-gray-300"
                                />
                                <span className="text-sm text-gray-700">CESG Eligible (Canada Education Savings Grant)</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                </ProjectionInputSection>

                {/* Retirement Planning */}
                <ProjectionInputSection
                      id="retirement-planning"
                      title="Retirement Planning"
                      defaultExpanded={false}
                      helpText="Comprehensive retirement planning including withdrawal strategies and healthcare costs"
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Target Retirement Age ({getPerson1Name()})
                            </label>
                            <input
                              type="number"
                              min="50"
                              max="75"
                              value={currentScenario.assumptions.retirement?.targetRetirementAge || currentScenario.assumptions.targetRetirementAge || 65}
                              onChange={(e) => {
                                const age = e.target.value ? parseInt(e.target.value) : undefined;
                                if (age) {
                                  handleNestedAssumptionChange(['retirement', 'targetRetirementAge'], age);
                                  handleAssumptionChange('targetRetirementAge', age);
                                }
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Target Retirement Age ({getPerson2Name()})
                            </label>
                            <input
                              type="number"
                              min="50"
                              max="75"
                              value={currentScenario.assumptions.retirement?.targetRetirementAge2 || ''}
                              onChange={(e) => {
                                const age = e.target.value ? parseInt(e.target.value) : undefined;
                                handleNestedAssumptionChange(['retirement', 'targetRetirementAge2'], age);
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Retirement Expense Ratio: {((currentScenario.assumptions.retirement?.retirementExpenseRatio || currentScenario.assumptions.retirementExpenseRatio || 0.70) * 100).toFixed(0)}%
                            </label>
                            <input
                              type="range"
                              min="0.60"
                              max="1.00"
                              step="0.01"
                              value={currentScenario.assumptions.retirement?.retirementExpenseRatio || currentScenario.assumptions.retirementExpenseRatio || 0.70}
                              onChange={(e) => {
                                const ratio = parseFloat(e.target.value);
                                handleNestedAssumptionChange(['retirement', 'retirementExpenseRatio'], ratio);
                                handleAssumptionChange('retirementExpenseRatio', ratio);
                              }}
                              className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">Percentage of current expenses needed in retirement</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Withdrawal Rate: {((currentScenario.assumptions.retirement?.withdrawalRate || currentScenario.assumptions.withdrawalRate || 0.04) * 100).toFixed(1)}%
                            </label>
                            <input
                              type="range"
                              min="0.02"
                              max="0.06"
                              step="0.001"
                              value={currentScenario.assumptions.retirement?.withdrawalRate || currentScenario.assumptions.withdrawalRate || 0.04}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value);
                                handleNestedAssumptionChange(['retirement', 'withdrawalRate'], rate);
                                handleAssumptionChange('withdrawalRate', rate);
                              }}
                              className="w-full"
                            />
                            <p className="text-xs text-gray-500 mt-1">4% rule is standard</p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Withdrawal Strategy
                          </label>
                          <select
                            value={currentScenario.assumptions.retirement?.withdrawalStrategy || 'tax_optimized'}
                            onChange={(e) => handleNestedAssumptionChange(['retirement', 'withdrawalStrategy'], e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="rrsp_first">RRSP First</option>
                            <option value="tfsa_first">TFSA First</option>
                            <option value="balanced">Balanced</option>
                            <option value="tax_optimized">Tax-Optimized (Smart Sequencing)</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Order of account withdrawals in retirement</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Annual Healthcare Costs ($)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={currentScenario.assumptions.retirement?.healthcareCosts || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                handleNestedAssumptionChange(['retirement', 'healthcareCosts'], val);
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 5000"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Annual Long-Term Care Costs ($)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={currentScenario.assumptions.retirement?.longTermCareCosts || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                handleNestedAssumptionChange(['retirement', 'longTermCareCosts'], val);
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={currentScenario.assumptions.retirement?.oasClawbackPlanning || false}
                              onChange={(e) => handleNestedAssumptionChange(['retirement', 'oasClawbackPlanning'], e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Plan withdrawals to minimize OAS clawback</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={currentScenario.assumptions.retirement?.taxOptimizedSequence || false}
                              onChange={(e) => handleNestedAssumptionChange(['retirement', 'taxOptimizedSequence'], e.target.checked)}
                              className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Optimize withdrawal order for taxes</span>
                          </label>
                        </div>
                      </div>
                </ProjectionInputSection>

                {/* RESP Planning */}
                {hasRESPAccounts && (
                  <ProjectionInputSection
                        id="resp-planning"
                        title="RESP Planning"
                        defaultExpanded={false}
                        helpText="Registered Education Savings Plan contribution and withdrawal planning"
                      >
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Child's Current Age
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="18"
                                value={currentScenario.assumptions.resp?.beneficiaryAge || ''}
                                onChange={(e) => {
                                  const age = e.target.value ? parseInt(e.target.value) : undefined;
                                  handleNestedAssumptionChange(['resp', 'beneficiaryAge'], age);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Annual RESP Contribution ($)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={currentScenario.assumptions.resp?.annualContribution || ''}
                                onChange={(e) => {
                                  const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                  handleNestedAssumptionChange(['resp', 'annualContribution'], val);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                CESG Matching Rate: {((currentScenario.assumptions.resp?.cesgMatch || 0.20) * 100).toFixed(0)}%
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="0.40"
                                step="0.01"
                                value={currentScenario.assumptions.resp?.cesgMatch || 0.20}
                                onChange={(e) => handleNestedAssumptionChange(['resp', 'cesgMatch'], parseFloat(e.target.value))}
                                className="w-full"
                              />
                              <p className="text-xs text-gray-500 mt-1">Typically 20% (CESG matches 20% of first $2,500)</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Expected Education Start Year
                              </label>
                              <input
                                type="number"
                                min={new Date().getFullYear()}
                                max={new Date().getFullYear() + 20}
                                value={currentScenario.assumptions.resp?.expectedEducationStart || ''}
                                onChange={(e) => {
                                  const year = e.target.value ? parseInt(e.target.value) : undefined;
                                  handleNestedAssumptionChange(['resp', 'expectedEducationStart'], year);
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Annual Education Costs ($)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={currentScenario.assumptions.resp?.educationCosts || ''}
                              onChange={(e) => {
                                const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                handleNestedAssumptionChange(['resp', 'educationCosts'], val);
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 15000"
                            />
                          </div>
                        </div>
                  </ProjectionInputSection>
                )}

                {/* Tax Strategy */}
                <ProjectionInputSection
                      id="tax-strategy"
                      title="Tax Strategy"
                      defaultExpanded={false}
                      helpText="Tax assumptions and calculations for projections"
                    >
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Province (for tax calculations)
                            </label>
                            <select
                              value={currentScenario.assumptions.province || household?.province || ''}
                              onChange={(e) => handleAssumptionChange('province', e.target.value || undefined)}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Use household province</option>
                              {getAllProvinces().map(province => (
                                <option key={province} value={province}>
                                  {getProvinceName(province)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Annual Taxable Income ($)
                            </label>
                            <input
                              type="number"
                              value={currentScenario.assumptions.taxableIncome || ''}
                              onChange={(e) => handleAssumptionChange('taxableIncome', e.target.value ? parseFloat(e.target.value) : undefined)}
                              placeholder="Auto-calculated from income"
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Used to calculate marginal tax rate
                              {autoCalculatedTaxableIncome > 0 && (
                                <span className="block mt-1 text-gray-600 font-mono">
                                  Auto-calculated: ${autoCalculatedTaxableIncome.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  <button
                                    onClick={() => handleAssumptionChange('taxableIncome', autoCalculatedTaxableIncome)}
                                    className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline"
                                  >
                                    Use this
                                  </button>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Marginal Tax Rate: {((currentScenario.assumptions.marginalTaxRate ?? 0) * 100).toFixed(1)}%
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="0.50"
                            step="0.01"
                            value={currentScenario.assumptions.marginalTaxRate ?? 0.30}
                            onChange={(e) => handleAssumptionChange('marginalTaxRate', parseFloat(e.target.value))}
                            className="w-full"
                          />
                          <p className="text-xs text-gray-500 mt-1">Auto-calculated if province & income set</p>
                        </div>
                      </div>
                </ProjectionInputSection>

                {/* Holding/Account Overrides (Reversed Hierarchy) */}
                <ProjectionInputSection
                      id="holding-overrides"
                      title="Holding/Account Overrides"
                      defaultExpanded={false}
                      helpText="Configure investment rates for specific holdings across all accounts"
                    >
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Holding
                    </label>
                    <select
                      value={selectedHoldingTicker || ''}
                      onChange={(e) => {
                        setSelectedHoldingTicker(e.target.value || null);
                        setFetchedRates(null);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a holding...</option>
                      {allHoldings.map(ticker => (
                        <option key={ticker} value={ticker}>
                          {ticker}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Configure rates once for this holding across all accounts
                    </p>
                  </div>

                  {selectedHoldingTicker && accountsWithSelectedHolding.length > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Accounts containing {selectedHoldingTicker}:
                        </label>
                        <div className="bg-white p-3 rounded-lg border border-gray-300">
                          <ul className="space-y-1">
                            {accountsWithSelectedHolding.map(acc => {
                              const holding = acc.holdings?.find(h => h.ticker === selectedHoldingTicker);
                              return (
                                <li key={acc.id} className="text-sm text-gray-700">
                                  • {acc.name} ({acc.type}) - {holding?.shares.toLocaleString('en-CA', { maximumFractionDigits: 4 })} shares
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4 border-t border-blue-300">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Growth Rate: {((selectedHoldingInstance?.holding?.growthRate ?? currentScenario.assumptions.investmentGrowthRate ?? currentScenario.assumptions.investmentReturnRate * 0.7) * 100).toFixed(2)}%
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              max="0.15"
                              value={selectedHoldingInstance?.holding?.growthRate ?? ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseFloat(e.target.value) : undefined;
                                if (selectedHoldingTicker) {
                                  updateHoldingRatesForAllAccounts(selectedHoldingTicker, { growthRate: value });
                                }
                              }}
                              placeholder="Auto from scenario"
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                    onClick={() => handleFetchHistoricalRates(true)}
                              disabled={fetchingRates}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                                    title="Fetch fresh data (bypasses cache to use improved bond ETF distribution calculation)"
                            >
                              {fetchingRates ? 'Fetching...' : 'Fetch Historical'}
                            </button>
                          </div>
                          {fetchedRates && (
                                  <div className="mt-1">
                                    <p className={`text-xs font-mono ${
                                      fetchedRates.dataQuality === 'reliable' ? 'text-gray-600' :
                                      fetchedRates.dataQuality === 'limited' ? 'text-yellow-600' :
                                      'text-red-600'
                                    }`}>
                                      Fetched: {((fetchedRates.growthRate ?? 0) * 100).toFixed(2)}% growth, {((fetchedRates.dividendYield ?? 0) * 100).toFixed(2)}% yield
                                      {fetchedRates.monthsOfData ? ` (${fetchedRates.monthsOfData} month${fetchedRates.monthsOfData !== 1 ? 's' : ''}, ${fetchedRates.yearsOfData?.toFixed(1)} years)` : ` (${fetchedRates.yearsOfData} years)`}
                                      {fetchedRates.dataQuality === 'limited' && ' ⚠️ Limited data'}
                                      {fetchedRates.dataQuality === 'insufficient' && ' ❌ Insufficient data'}
                                    </p>
                                    {fetchedRates.warning && (
                                      <div className="text-xs mt-1">
                                        <p className={`p-2 rounded border ${
                                          fetchedRates.dataQuality === 'limited' 
                                            ? 'text-yellow-700 bg-yellow-50 border-yellow-200' 
                                            : 'text-red-700 bg-red-50 border-red-200'
                                        }`}>
                                          ⚠️ {fetchedRates.warning}
                                        </p>
                                        {fetchedRates.dataQuality === 'insufficient' && (
                                          <button
                                            onClick={() => {
                                              if (selectedHoldingTicker && fetchedRates.growthRate !== undefined && fetchedRates.dividendYield !== undefined) {
                                                updateHoldingRatesForAllAccounts(selectedHoldingTicker, {
                                                  growthRate: fetchedRates.growthRate,
                                                  dividendYield: fetchedRates.dividendYield,
                                                });
                                                alert('Rates applied manually. Note: These rates are based on insufficient data and may not be reliable for projections.');
                                              }
                                            }}
                                            className="mt-2 px-3 py-1 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
                                          >
                                            Apply Anyway (Not Recommended)
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dividend Yield: {((selectedHoldingInstance?.holding?.dividendYield ?? currentScenario.assumptions.investmentDividendYield ?? currentScenario.assumptions.investmentReturnRate * 0.3) * 100).toFixed(2)}%
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max="0.15"
                            value={selectedHoldingInstance?.holding?.dividendYield ?? ''}
                            onChange={(e) => {
                              const value = e.target.value ? parseFloat(e.target.value) : undefined;
                              if (selectedHoldingTicker) {
                                updateHoldingRatesForAllAccounts(selectedHoldingTicker, { dividendYield: value });
                              }
                            }}
                            placeholder="Auto from scenario"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Dividend Type
                          </label>
                          <select
                            value={selectedHoldingInstance?.holding?.dividendType || 'canadian_eligible'}
                            onChange={(e) => {
                              if (selectedHoldingTicker) {
                                updateHoldingRatesForAllAccounts(selectedHoldingTicker, { 
                                  dividendType: e.target.value as Holding['dividendType'] 
                                });
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="canadian_eligible">Canadian Eligible</option>
                            <option value="canadian_non_eligible">Canadian Non-Eligible</option>
                            <option value="foreign">Foreign</option>
                            <option value="none">None</option>
                          </select>
                        </div>
                        <p className="text-xs text-gray-500 italic">
                          Note: Changes apply to all accounts containing this holding
                        </p>
                      </div>
                    </>
                  )}
                </div>
                </ProjectionInputSection>
              </div>
            </div>
          )}

          {/* Year-by-Year Breakdown */}
          {projectionResult && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Year-by-Year Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Year</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Starting NW</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ending NW</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Change</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Income</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expenses</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Savings</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Investment Growth</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {projectionResult.yearlyData.map((year) => (
                      <tr key={year.year} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{year.year}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${year.startingNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          ${year.endingNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                          year.netWorthChange >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {year.netWorthChange >= 0 ? '+' : ''}${year.netWorthChange.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${year.totalIncome.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${year.totalExpenses.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          ${year.totalSavings.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-semibold">
                          ${year.investmentGrowth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

