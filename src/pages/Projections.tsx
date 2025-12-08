import { useState, useMemo } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { projectNetWorth, createDefaultScenario } from '../utils/projections';
import type { ProjectionScenario, ProjectionResult } from '../types/models';
import { NetWorthProjectionChart } from '../components/NetWorthProjectionChart';
import { getAllProvinces, getProvinceName } from '../utils/canadianTaxRates';
import { calcMonthlyIncomeFromTransactions, calcMonthlyExpensesFromTransactions, formatAccountType } from '../utils/calculations';
import { ProjectionInputSection } from '../components/ProjectionInputSection';
import { PersonInputGroup } from '../components/PersonInputGroup';
import { ContributionRoomInput } from '../components/ContributionRoomInput';
import { calculateCPPBenefit } from '../utils/governmentBenefits';
import { GrowthDriversAnalysis } from '../components/GrowthDriversAnalysis';
import type { Account } from '../types/models';

export const Projections = () => {
  const {
    household,
    accounts,
    transactions,
    projectionScenarios,
    addProjectionScenario,
    updateProjectionScenario,
    deleteProjectionScenario,
    updateAccount,
  } = useHouseholdStore();

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  // Chart collapse state
  const [chartExpanded, setChartExpanded] = useState(true);
  // Panel visibility state
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  // Expanded accounts state for unified Accounts section
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

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

  // Check if RESP accounts exist
  const hasRESPAccounts = useMemo(() => {
    return accounts.some(acc => acc.type === 'resp');
  }, [accounts]);




  const handleCreateScenario = () => {
    if (!household) {
      alert('Please set up your household in Settings first.');
      return;
    }

    const defaultScenario = createDefaultScenario(household.id, household.province);
    addProjectionScenario(defaultScenario);
    setSelectedScenarioId(defaultScenario.id);
  };


  // Check if Person 2 exists
  const hasPerson2 = !!household?.personProfiles?.person2;

  // Helper functions to get display names (nickname if available, otherwise "Person 1"/"Person 2")
  const getPerson1Name = () => {
    return household?.personProfiles?.person1?.nickname?.trim() || 'Person 1';
  };

  const getPerson2Name = () => {
    return household?.personProfiles?.person2?.nickname?.trim() || 'Person 2';
  };
  
  // Helper to determine if account belongs to person 1 or person 2
  const getAccountOwnerPerson = (account: Account): 'person1' | 'person2' | 'joint' => {
    if (!account.owner) return 'person1';
    const owner = account.owner.toLowerCase();
    if (owner.includes('1') || owner === 'person 1') return 'person1';
    if (owner.includes('2') || owner === 'person 2') return 'person2';
    return 'joint';
  };
  
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
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <h1 className="text-3xl font-bold text-gray-900">Projections</h1>
        <button
          onClick={handleCreateScenario}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all hover:scale-105"
        >
          + New Scenario
        </button>
      </div>

      {projectionScenarios.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-white p-12 rounded-2xl shadow-lg border-2 border-gray-200 text-center">
            <p className="text-gray-600 mb-6">No projection scenarios yet. Create your first scenario to get started.</p>
            <button
              onClick={handleCreateScenario}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all"
            >
              Create Base Case Scenario
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Three Panel Layout */}
          <div className="flex-1 flex overflow-hidden gap-2 px-2 pb-2 relative">
            {/* Left Panel - Scenario Selection & General Settings */}
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

                  {/* Data Sources Indicator */}
                  {currentScenario && (
                    <div className="mb-6 bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                      <h2 className="text-lg font-bold text-gray-900 mb-3">📊 Data Sources</h2>
                      
                      {/* Accounts Used */}
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Accounts Used</h3>
                        <div className="space-y-1 text-xs">
                          {(() => {
                            const investmentAccounts = accounts.filter(a => 
                              a.kind === 'asset' && ['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered'].includes(a.type)
                            );
                            const realEstateAccounts = accounts.filter(a => 
                              a.kind === 'asset' && ['primary_home', 'rental_property'].includes(a.type)
                            );
                            const debtAccounts = accounts.filter(a => 
                              a.kind === 'liability' && ['mortgage', 'loan', 'credit_card'].includes(a.type)
                            );
                            const cashAccounts = accounts.filter(a => 
                              a.kind === 'asset' && ['cash', 'chequing'].includes(a.type)
                            );
                            
                            return (
                              <>
                                {investmentAccounts.length > 0 && (
                                  <div className="text-gray-600">
                                    💼 {investmentAccounts.length} investment account{investmentAccounts.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                                {realEstateAccounts.length > 0 && (
                                  <div className="text-gray-600">
                                    🏠 {realEstateAccounts.length} real estate account{realEstateAccounts.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                                {debtAccounts.length > 0 && (
                                  <div className="text-gray-600">
                                    💳 {debtAccounts.length} debt account{debtAccounts.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                                {cashAccounts.length > 0 && (
                                  <div className="text-gray-600">
                                    💵 {cashAccounts.length} cash account{cashAccounts.length !== 1 ? 's' : ''}
                                  </div>
                                )}
                                {accounts.length === 0 && (
                                  <div className="text-gray-500 italic">No accounts configured</div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            // Navigate to Accounts tab - this would need routing or tab switching
                            console.log('[Projections] Navigate to Accounts tab');
                            // For now, just log - would need App.tsx routing to implement
                          }}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          View/Edit in Accounts →
                        </button>
                      </div>
                      
                      {/* Income Source */}
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Income Source</h3>
                        {(() => {
                          const person1Income = getNestedAssumption(['income', 'person1', 'annualIncome']);
                          const person2Income = getNestedAssumption(['income', 'person2', 'annualIncome']);
                          const hasManualIncome = person1Income !== undefined || person2Income !== undefined;
                          
                          if (hasManualIncome) {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                    Manual Override
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {person1Income && `Person 1: $${(person1Income).toLocaleString('en-CA')}/year`}
                                  {person1Income && person2Income && ', '}
                                  {person2Income && `Person 2: $${(person2Income).toLocaleString('en-CA')}/year`}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Transaction avg: ${(autoCalculatedTaxableIncome).toLocaleString('en-CA')}/year
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                    Auto-calculated
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  From transactions: ${(autoCalculatedTaxableIncome).toLocaleString('en-CA')}/year
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Edit in Income & Employment section to override
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                      
                      {/* Expense Source */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Expense Source</h3>
                        {(() => {
                          const person1Expenses = getNestedAssumption(['income', 'person1', 'annualExpenses']);
                          const person2Expenses = getNestedAssumption(['income', 'person2', 'annualExpenses']);
                          const hasManualExpenses = person1Expenses !== undefined || person2Expenses !== undefined;
                          
                          if (hasManualExpenses) {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                    Manual Override
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  {person1Expenses && `Person 1: $${(person1Expenses).toLocaleString('en-CA')}/year`}
                                  {person1Expenses && person2Expenses && ', '}
                                  {person2Expenses && `Person 2: $${(person2Expenses).toLocaleString('en-CA')}/year`}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Transaction avg: ${(autoCalculatedMonthlyExpenses * 12).toLocaleString('en-CA')}/year (excl. mortgage)
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                    Auto-calculated
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600">
                                  From transactions: ${(autoCalculatedMonthlyExpenses * 12).toLocaleString('en-CA')}/year
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  (excluding mortgage payments)
                                </div>
                                <div className="text-xs text-gray-500">
                                  Edit in Income & Employment section to override
                                </div>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Scenario Selector */}
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Scenario</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Scenario</label>
                        <select
                          value={selectedScenarioId || ''}
                          onChange={(e) => setSelectedScenarioId(e.target.value || null)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {projectionScenarios.map(scenario => (
                            <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
                          ))}
                        </select>
                      </div>
                      {currentScenario && (
                        <>
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
                          <button
                            onClick={() => handleDeleteScenario(currentScenario.id)}
                            className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all"
                          >
                            🗑️ Delete Scenario
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* General Settings */}
                  {currentScenario && (
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">General Settings</h2>
                      <div className="space-y-4">
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
                          <p className="text-xs text-gray-500 mt-1">Or specify growth + dividends in Investments section</p>
                        </div>
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
                  )}

                  {/* Retirement Planning */}
                  {currentScenario && (
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Retirement Planning</h2>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
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
                          {hasPerson2 && (
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
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-4">
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
                        <div className="grid grid-cols-1 gap-4">
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
                    </div>
                  )}

                  {/* Tax Strategy */}
                  {currentScenario && (
                    <div className="mb-6">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">Tax Strategy</h2>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
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
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Center Panel - Chart */}
            <div className="flex-1 flex flex-col min-w-0 bg-white rounded-lg shadow-lg border-2 border-gray-200 overflow-hidden">
              {projectionResult && currentScenario ? (
                <div className="flex-1 overflow-y-auto p-6">
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 relative z-0">
                        <div className="bg-blue-50 p-4 rounded-lg relative z-0">
                          <p className="text-sm text-gray-600">Starting Net Worth</p>
                          <p className="text-xl font-bold text-blue-900">
                            ${projectionResult.summary.startingNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-lg relative z-0">
                          <p className="text-sm text-gray-600">Ending Net Worth</p>
                          <p className="text-xl font-bold text-emerald-900">
                            ${projectionResult.summary.endingNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg relative z-0">
                          <p className="text-sm text-gray-600">Total Growth</p>
                          <p className="text-xl font-bold text-purple-900">
                            ${projectionResult.summary.totalGrowth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-lg relative z-0">
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

                      {/* Growth Drivers Analysis */}
                      <div className="mt-6">
                        <GrowthDriversAnalysis 
                          result={projectionResult}
                          startingNetWorth={projectionResult.summary.startingNetWorth}
                          accounts={accounts}
                        />
                      </div>

                      {/* Annual Summary Table by Account */}
                      <div className="mt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Annual Summary by Account</h3>
                        <div className="overflow-x-auto border border-gray-300 rounded-lg">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase border-r border-gray-300 z-10 min-w-[120px]">
                                  Year
                                </th>
                                {(() => {
                                  console.log('[Projections] Building annual summary table headers by account');
                                  // Assets - sorted by type
                                  const assetAccounts = [...accounts.filter(a => a.kind === 'asset')].sort((a, b) => {
                                    const order = ['cash', 'chequing', 'tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered', 'primary_home', 'rental_property'];
                                    const aIdx = order.indexOf(a.type) === -1 ? 999 : order.indexOf(a.type);
                                    const bIdx = order.indexOf(b.type) === -1 ? 999 : order.indexOf(b.type);
                                    return aIdx - bIdx;
                                  });
                                  
                                  // Liabilities - sorted by type
                                  const liabilityAccounts = [...accounts.filter(a => a.kind === 'liability')].sort((a, b) => {
                                    const order = ['mortgage', 'loan', 'credit_card'];
                                    const aIdx = order.indexOf(a.type) === -1 ? 999 : order.indexOf(a.type);
                                    const bIdx = order.indexOf(b.type) === -1 ? 999 : order.indexOf(b.type);
                                    return aIdx - bIdx;
                                  });
                                  
                                  const allAccounts = [...assetAccounts, ...liabilityAccounts];
                                  
                                  return allAccounts.map((acc) => (
                                    <th key={acc.id} className={`px-4 py-3 text-left text-xs font-semibold uppercase border-r border-gray-200 whitespace-nowrap min-w-[140px] ${
                                      acc.kind === 'liability' ? 'text-red-700' : 'text-gray-700'
                                    }`}>
                                      {acc.name}
                                    </th>
                                  ));
                                })()}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {(() => {
                                console.log('[Projections] Building annual summary table rows by year');
                                const rows: React.ReactElement[] = [];
                                
                                // Calculate totals for proportional calculations
                                const totalStartingAssets = accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0);
                                const totalStartingLiabilities = accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);
                                
                                // Assets - sorted by type
                                const assetAccounts = [...accounts.filter(a => a.kind === 'asset')].sort((a, b) => {
                                  const order = ['cash', 'chequing', 'tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered', 'primary_home', 'rental_property'];
                                  const aIdx = order.indexOf(a.type) === -1 ? 999 : order.indexOf(a.type);
                                  const bIdx = order.indexOf(b.type) === -1 ? 999 : order.indexOf(b.type);
                                  return aIdx - bIdx;
                                });
                                
                                // Liabilities - sorted by type
                                const liabilityAccounts = [...accounts.filter(a => a.kind === 'liability')].sort((a, b) => {
                                  const order = ['mortgage', 'loan', 'credit_card'];
                                  const aIdx = order.indexOf(a.type) === -1 ? 999 : order.indexOf(a.type);
                                  const bIdx = order.indexOf(b.type) === -1 ? 999 : order.indexOf(b.type);
                                  return aIdx - bIdx;
                                });
                                
                                const allAccounts = [...assetAccounts, ...liabilityAccounts];
                                
                                // Starting row
                                rows.push(
                                  <tr key="starting" className="hover:bg-gray-50">
                                    <td className="sticky left-0 bg-white px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300 z-10">
                                      Starting
                                    </td>
                                    {allAccounts.map((acc) => {
                                      const startingBalance = acc.balance;
                                      return (
                                        <td key={acc.id} className={`px-4 py-3 text-sm border-r border-gray-200 whitespace-nowrap ${
                                          acc.kind === 'liability' ? 'text-red-600' : 'text-gray-600'
                                        }`}>
                                          ${startingBalance.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                                
                                // Year rows
                                projectionResult.yearlyData.forEach((year, yearIdx) => {
                                  rows.push(
                                    <tr key={year.year} className="hover:bg-gray-50">
                                      <td className="sticky left-0 bg-white px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-300 z-10">
                                        {year.year}
                                      </td>
                                      {allAccounts.map((acc) => {
                                        const startingBalance = acc.balance;
                                        const isInvestment = ['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered'].includes(acc.type);
                                        const isRealEstate = ['primary_home', 'rental_property'].includes(acc.type);
                                        let estimatedBalance = startingBalance;
                                        
                                        if (acc.kind === 'asset') {
                                          if (isInvestment) {
                                            // Investment accounts grow with returns
                                            const accountShare = totalStartingAssets > 0 ? startingBalance / totalStartingAssets : 0;
                                            // Accumulate growth from all previous years
                                            let cumulativeGrowth = 0;
                                            for (let i = 0; i <= yearIdx; i++) {
                                              cumulativeGrowth += (projectionResult.yearlyData[i]?.investmentGrowth || 0) * accountShare;
                                            }
                                            estimatedBalance = startingBalance + cumulativeGrowth;
                                          } else if (isRealEstate) {
                                            // Real estate grows with inflation
                                            const yearsElapsed = yearIdx + 1;
                                            const inflationRate = currentScenario?.assumptions.inflationRate || 0.02;
                                            estimatedBalance = startingBalance * Math.pow(1 + inflationRate, yearsElapsed);
                                          } else {
                                            // Cash accounts grow with contributions (savings)
                                            const yearsElapsed = yearIdx + 1;
                                            const yearSavings = year.totalSavings || 0;
                                            const accountShare = totalStartingAssets > 0 ? startingBalance / totalStartingAssets : 0;
                                            estimatedBalance = startingBalance + (yearSavings * accountShare * yearsElapsed);
                                          }
                                        } else {
                                          // Liabilities decrease over time
                                          // Calculate cumulative debt paydown
                                          let cumulativePaydown = 0;
                                          for (let i = 0; i <= yearIdx; i++) {
                                            cumulativePaydown += projectionResult.yearlyData[i]?.debtPaydown || 0;
                                          }
                                          
                                          // Estimate this account's share of paydown
                                          const accountShare = totalStartingLiabilities > 0 ? startingBalance / totalStartingLiabilities : 0;
                                          estimatedBalance = Math.max(0, startingBalance - (cumulativePaydown * accountShare));
                                        }
                                        
                                        return (
                                          <td key={acc.id} className={`px-4 py-3 text-sm border-r border-gray-200 whitespace-nowrap ${
                                            acc.kind === 'liability' ? 'text-red-600' : 'text-gray-600'
                                          }`}>
                                            ${Math.round(estimatedBalance).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  );
                                });
                                
                                return rows;
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-6">
                  <p className="text-gray-500">Select a scenario to view projections</p>
                </div>
              )}
            </div>


            {/* Right Panel - Input Sections */}
            <div className={`bg-blue-50 rounded-lg shadow-lg border-2 border-blue-200 flex flex-col transition-all duration-300 ease-in-out relative ${
              rightPanelVisible ? 'w-96 min-w-96' : 'w-12 min-w-12'
            }`}>
              {/* Toggle Button - Always visible in top-right corner */}
              <button
                onClick={() => setRightPanelVisible(!rightPanelVisible)}
                className="absolute top-3 right-3 p-2.5 bg-blue-100 hover:bg-blue-200 text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all z-20 border border-blue-300"
                title={rightPanelVisible ? "Hide Inputs Panel" : "Show Inputs Panel"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  {/* Rounded rectangle outline */}
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" fill="none" />
                  {/* Vertical divider line (right side - panel on right) */}
                  <line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" strokeWidth={1.5} />
                  {/* Three horizontal lines on right side (menu icon) */}
                  <line x1="17" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                  <line x1="17" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                  <line x1="17" y1="13" x2="19" y2="13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
                </svg>
              </button>
              
              {rightPanelVisible && (
                <div className="flex-1 overflow-y-auto p-4 pt-14">

                  {currentScenario && (
                    <div className="space-y-4">
                {/* Accounts - Unified Section */}
                <ProjectionInputSection
                  id="accounts"
                  title="Accounts"
                  defaultExpanded={true}
                  helpText="View and configure accounts for this projection scenario. New accounts from Accounts tab will appear here automatically."
                >
                  <div className="space-y-2">
                    {accounts.length === 0 ? (
                      <div className="text-sm text-gray-500 italic text-center py-4">
                        No accounts configured. Add accounts in the Accounts tab.
                      </div>
                    ) : (
                      accounts.map((account) => {
                        const isExpanded = expandedAccounts.has(account.id);
                        const accountOverride = getNestedAssumption(['accountOverrides', account.id]);
                        const hasOverride = !!accountOverride;
                        const accountOwner = getAccountOwnerPerson(account);
                        
                        return (
                          <div key={account.id} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                            {/* Account Header Row - Clickable */}
                            <div
                              className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => toggleAccountExpansion(account.id)}
                            >
                              <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                                <div className="font-semibold text-sm text-gray-900">{account.name}</div>
                                <div className="text-sm text-gray-600">{formatAccountType(account.type)}</div>
                                <div className="text-sm font-semibold text-gray-900">
                                  ${account.balance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {account.owner || 'All / Household'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {hasOverride && (
                                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                    Override
                                  </span>
                                )}
                                <svg
                                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
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
                              <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                                {/* Contribution Room Inputs for RRSP/TFSA */}
                                {(account.type === 'rrsp' || account.type === 'tfsa') && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">
                                      Contribution Room ({account.type.toUpperCase()})
                                    </label>
                                    {(() => {
                                      // For RRSP, calculate default as 2026 limit ($33,810) minus DCPP contribution
                                      const currentValue = getNestedAssumption(['contributionRooms', account.type, accountOwner]);
                                      const RRSP_2026_LIMIT = 33810;
                                      const dcppContribution = currentScenario?.assumptions.dcpp?.annualContribution || 0;
                                      const calculatedDefault = account.type === 'rrsp' ? Math.max(0, RRSP_2026_LIMIT - dcppContribution) : undefined;
                                      
                                      // Use calculated default if no value is set
                                      const displayValue = currentValue ?? calculatedDefault;
                                      
                                      // Build help text
                                      let helpText = `Enter ${account.type.toUpperCase()} contribution room for ${accountOwner === 'person1' ? getPerson1Name() : accountOwner === 'person2' ? getPerson2Name() : 'joint'}`;
                                      if (account.type === 'rrsp') {
                                        if (currentValue === undefined && calculatedDefault !== undefined) {
                                          helpText = `Default: $${calculatedDefault.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (2026 limit $${RRSP_2026_LIMIT.toLocaleString('en-CA')} - DCPP $${dcppContribution.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })})`;
                                        } else if (dcppContribution > 0) {
                                          helpText += `. 2026 limit: $${RRSP_2026_LIMIT.toLocaleString('en-CA')}, DCPP: $${dcppContribution.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                                        }
                                      }
                                      
                                      return (
                                        <ContributionRoomInput
                                          label=""
                                          value={displayValue}
                                          onChange={(val) => {
                                            // If user clears the field and it was using the default, set to undefined
                                            // Otherwise, save the value they entered
                                            if (val === undefined || val === null) {
                                              handleNestedAssumptionChange(['contributionRooms', account.type, accountOwner], undefined);
                                            } else {
                                              handleNestedAssumptionChange(['contributionRooms', account.type, accountOwner], val);
                                            }
                                          }}
                                          currentBalance={account.balance}
                                          helpText={helpText}
                                        />
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                {/* RESP Contribution Room */}
                                {account.type === 'resp' && (
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-2">
                                      RESP Contribution Room
                                    </label>
                                    <ContributionRoomInput
                                      label=""
                                      value={getNestedAssumption(['contributionRooms', 'resp', 'total'])}
                                      onChange={(val) => handleNestedAssumptionChange(['contributionRooms', 'resp', 'total'], val)}
                                      currentBalance={account.balance}
                                      helpText="Total RESP contribution room (lifetime limit: $50,000 per beneficiary)"
                                      maxContribution={50000}
                                    />
                                    <div className="mt-2">
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={getNestedAssumption(['contributionRooms', 'resp', 'cesgEligible']) || false}
                                          onChange={(e) => handleNestedAssumptionChange(['contributionRooms', 'resp', 'cesgEligible'], e.target.checked)}
                                          className="rounded border-gray-300"
                                        />
                                        <span className="text-xs text-gray-700">CESG Eligible (Canada Education Savings Grant)</span>
                                      </label>
                                    </div>
                                  </div>
                                )}
                                
                                {/* DCPP Employer Match and Annual Contribution */}
                                {account.type === 'dcpp' && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-800 mb-2">DCPP Contributions</h5>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Contribution ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          value={currentScenario?.assumptions.dcpp?.annualContribution || ''}
                                          onChange={(e) => {
                                            const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                            handleNestedAssumptionChange(['dcpp', 'annualContribution'], val);
                                          }}
                                          placeholder="Enter annual contribution amount"
                                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          Annual dollar amount you contribute to this DCPP account
                                        </p>
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Employer Match Percentage: {((account.employerMatchPercentage ?? 0) * 100).toFixed(0)}%
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="2"
                                          step="0.01"
                                          value={account.employerMatchPercentage ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                            // Update account directly (not scenario override - this is account property)
                                            updateAccount(account.id, {
                                              employerMatchPercentage: val,
                                            });
                                          }}
                                          placeholder="e.g., 0.50 for 50% match, 1.0 for 100% match"
                                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                          Company matches this percentage of your annual contributions (e.g., 50% = company adds $0.50 for every $1.00 you contribute)
                                        </p>
                                        {account.employerMatchPercentage && account.employerMatchPercentage > 0 && currentScenario?.assumptions.dcpp?.annualContribution && (
                                          <p className="text-xs text-blue-700 mt-1 font-medium">
                                            With ${currentScenario.assumptions.dcpp.annualContribution.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} annual contribution and {(account.employerMatchPercentage * 100).toFixed(0)}% match, company adds ${(currentScenario.assumptions.dcpp.annualContribution * account.employerMatchPercentage).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/year
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                
                                {/* Debt Account Overrides */}
                                {['mortgage', 'loan', 'credit_card'].includes(account.type) && (
                                  <div>
                                    <h5 className="text-xs font-semibold text-gray-800 mb-2">Scenario Overrides</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Monthly Payment: ${((accountOverride?.monthlyPayment ?? account.monthlyPayment ?? 0)).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          value={accountOverride?.monthlyPayment ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                            if (val !== undefined) {
                                              handleNestedAssumptionChange(['accountOverrides', account.id, 'monthlyPayment'], val);
                                            } else {
                                              const newOverrides = { ...(currentScenario?.assumptions.accountOverrides || {}) };
                                              if (newOverrides[account.id]) {
                                                delete newOverrides[account.id].monthlyPayment;
                                                if (Object.keys(newOverrides[account.id]).length === 0) {
                                                  delete newOverrides[account.id];
                                                }
                                              }
                                              handleAssumptionChange('accountOverrides', Object.keys(newOverrides).length > 0 ? newOverrides : undefined);
                                            }
                                          }}
                                          placeholder={`Default: ${account.monthlyPayment ? `$${account.monthlyPayment.toLocaleString('en-CA')}` : 'Not set'}`}
                                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Interest Rate: {((accountOverride?.interestRate ?? account.interestRate ?? 0)).toFixed(2)}%
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="20"
                                          step="0.01"
                                          value={accountOverride?.interestRate ?? ''}
                                          onChange={(e) => {
                                            const val = e.target.value ? parseFloat(e.target.value) : undefined;
                                            if (val !== undefined) {
                                              handleNestedAssumptionChange(['accountOverrides', account.id, 'interestRate'], val);
                                            } else {
                                              const newOverrides = { ...(currentScenario?.assumptions.accountOverrides || {}) };
                                              if (newOverrides[account.id]) {
                                                delete newOverrides[account.id].interestRate;
                                                if (Object.keys(newOverrides[account.id]).length === 0) {
                                                  delete newOverrides[account.id];
                                                }
                                              }
                                              handleAssumptionChange('accountOverrides', Object.keys(newOverrides).length > 0 ? newOverrides : undefined);
                                            }
                                          }}
                                          placeholder={`Default: ${account.interestRate ? `${account.interestRate.toFixed(2)}%` : 'Not set'}`}
                                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                    </div>
                                    {hasOverride && (
                                      <button
                                        onClick={() => {
                                          const newOverrides = { ...(currentScenario?.assumptions.accountOverrides || {}) };
                                          delete newOverrides[account.id];
                                          handleAssumptionChange('accountOverrides', Object.keys(newOverrides).length > 0 ? newOverrides : undefined);
                                        }}
                                        className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                                      >
                                        Reset to Account Default
                                      </button>
                                    )}
                                  </div>
                                )}
                                
                                {/* Info for other account types */}
                                {!['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered', 'mortgage', 'loan', 'credit_card'].includes(account.type) && (
                                  <div className="text-xs text-gray-500">
                                    {account.type === 'primary_home' || account.type === 'rental_property' ? 
                                      'Real estate accounts don\'t compound - balance stays constant' :
                                      'Cash accounts receive contributions from savings'}
                                  </div>
                                )}
                                
                                {/* Link to edit in Accounts tab */}
                                <div className="pt-2 border-t border-gray-200">
                                  <button
                                    onClick={() => {
                                      console.log('[Projections] Navigate to Accounts tab to edit:', account.id);
                                      // TODO: Implement navigation to Accounts tab
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                                  >
                                    Edit in Accounts tab →
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ProjectionInputSection>

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
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Annual Income (CAD)
                            </label>
                            {getNestedAssumption(['income', 'person1', 'annualIncome']) !== undefined && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                Manual Override
                              </span>
                            )}
                            {getNestedAssumption(['income', 'person1', 'annualIncome']) === undefined && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                Auto-calculated
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={getNestedAssumption(['income', 'person1', 'annualIncome']) || ''}
                            onChange={(e) => handleNestedAssumptionChange(['income', 'person1', 'annualIncome'], e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="Enter annual income to override"
                            className={`w-full px-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              getNestedAssumption(['income', 'person1', 'annualIncome']) !== undefined 
                                ? 'border-orange-300 bg-orange-50' 
                                : 'border-gray-300'
                            }`}
                          />
                          {/* Suggested value from transactions */}
                          <div className={`mt-2 px-3 py-2 rounded text-xs ${
                            getNestedAssumption(['income', 'person1', 'annualIncome']) !== undefined
                              ? 'bg-orange-50 border border-orange-200 text-orange-800'
                              : 'bg-blue-50 border border-blue-200 text-gray-600'
                          }`}>
                            <span className="font-medium">
                              {getNestedAssumption(['income', 'person1', 'annualIncome']) !== undefined ? '⚠️ ' : ''}
                              Suggested from transactions:
                            </span> ${autoCalculatedTaxableIncome.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year
                            {getNestedAssumption(['income', 'person1', 'annualIncome']) !== undefined && (
                              <div className="mt-1">
                                <button
                                  onClick={() => handleNestedAssumptionChange(['income', 'person1', 'annualIncome'], undefined)}
                                  className="text-orange-700 hover:text-orange-900 underline"
                                >
                                  Use transaction-based value instead
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Annual Expenses (CAD)
                            </label>
                            {getNestedAssumption(['income', 'person1', 'annualExpenses']) !== undefined && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-orange-100 text-orange-800">
                                Manual Override
                              </span>
                            )}
                            {getNestedAssumption(['income', 'person1', 'annualExpenses']) === undefined && (
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-800">
                                Auto-calculated
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={getNestedAssumption(['income', 'person1', 'annualExpenses']) || ''}
                            onChange={(e) => handleNestedAssumptionChange(['income', 'person1', 'annualExpenses'], e.target.value ? parseFloat(e.target.value) : undefined)}
                            placeholder="Enter annual expenses to override"
                            className={`w-full px-4 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              getNestedAssumption(['income', 'person1', 'annualExpenses']) !== undefined 
                                ? 'border-orange-300 bg-orange-50' 
                                : 'border-gray-300'
                            }`}
                          />
                          {/* Suggested value from transactions */}
                          <div className={`mt-2 px-3 py-2 rounded text-xs ${
                            getNestedAssumption(['income', 'person1', 'annualExpenses']) !== undefined
                              ? 'bg-orange-50 border border-orange-200 text-orange-800'
                              : 'bg-blue-50 border border-blue-200 text-gray-600'
                          }`}>
                            <span className="font-medium">
                              {getNestedAssumption(['income', 'person1', 'annualExpenses']) !== undefined ? '⚠️ ' : ''}
                              Suggested from transactions:
                            </span> ${(autoCalculatedMonthlyExpenses * 12).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year
                            <div className="text-gray-500 mt-0.5">(excluding mortgage payments)</div>
                            {getNestedAssumption(['income', 'person1', 'annualExpenses']) !== undefined && (
                              <div className="mt-1">
                                <button
                                  onClick={() => handleNestedAssumptionChange(['income', 'person1', 'annualExpenses'], undefined)}
                                  className="text-orange-700 hover:text-orange-900 underline"
                                >
                                  Use transaction-based value instead
                                </button>
                              </div>
                            )}
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

                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

