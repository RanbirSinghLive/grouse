import { useState, useMemo } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { projectNetWorth, compareMortgageVsInvest, createDefaultScenario } from '../utils/projections';
import type { ProjectionScenario, ProjectionResult } from '../types/models';
import { NetWorthProjectionChart } from '../components/NetWorthProjectionChart';
import { MortgageVsInvestComparison } from '../components/MortgageVsInvestComparison';

export const Projections = () => {
  const {
    household,
    accounts,
    transactions,
    projectionScenarios,
    addProjectionScenario,
    updateProjectionScenario,
    deleteProjectionScenario,
  } = useHouseholdStore();

  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [editingScenario, setEditingScenario] = useState<ProjectionScenario | null>(null);

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
  const mortgageAccount = useMemo(() => {
    return accounts.find(a => a.type === 'mortgage' && a.kind === 'liability') || null;
  }, [accounts]);

  // Calculate monthly surplus for mortgage vs invest
  const monthlySurplus = useMemo(() => {
    if (!projectionResult) return 0;
    // Use average savings from projection
    const avgSavings = projectionResult.monthlyData.length > 0
      ? projectionResult.monthlyData.reduce((sum, m) => sum + m.savings, 0) / projectionResult.monthlyData.length
      : 0;
    return Math.max(0, avgSavings);
  }, [projectionResult]);

  // Mortgage vs Invest comparison
  const mortgageComparison = useMemo(() => {
    if (!mortgageAccount || !currentScenario || monthlySurplus <= 0) {
      return null;
    }
    try {
      return compareMortgageVsInvest(mortgageAccount, monthlySurplus, currentScenario.assumptions);
    } catch (error) {
      console.error('[Projections] Error calculating mortgage comparison:', error);
      return null;
    }
  }, [mortgageAccount, currentScenario, monthlySurplus]);

  const handleCreateScenario = () => {
    if (!household) {
      alert('Please set up your household in Settings first.');
      return;
    }

    const defaultScenario = createDefaultScenario(household.id);
    addProjectionScenario(defaultScenario);
    setSelectedScenarioId(defaultScenario.id);
    setEditingScenario(defaultScenario);
  };

  const handleEditScenario = (scenario: ProjectionScenario) => {
    setEditingScenario(scenario);
  };

  const handleSaveScenario = () => {
    if (!editingScenario) return;

    if (editingScenario.id && projectionScenarios.find(s => s.id === editingScenario.id)) {
      // Update existing
      updateProjectionScenario(editingScenario.id, editingScenario);
    } else {
      // Create new
      if (!household) {
        alert('Please set up your household in Settings first.');
        return;
      }
      const newScenario = {
        ...editingScenario,
        householdId: household.id,
      };
      addProjectionScenario(newScenario);
      setSelectedScenarioId(newScenario.id);
    }
    setEditingScenario(null);
  };

  const handleDeleteScenario = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scenario?')) {
      deleteProjectionScenario(id);
      if (selectedScenarioId === id) {
        setSelectedScenarioId(null);
      }
    }
  };

  const handleAssumptionChange = (key: keyof ProjectionScenario['assumptions'], value: number) => {
    if (!editingScenario) return;
    setEditingScenario({
      ...editingScenario,
      assumptions: {
        ...editingScenario.assumptions,
        [key]: value,
      },
    });
  };

  const handleConfigChange = (key: keyof ProjectionScenario['config'], value: number | string | boolean) => {
    if (!editingScenario) return;
    
    // Validate projectionYears
    if (key === 'projectionYears' && typeof value === 'number') {
      if (value < 1) value = 1;
      if (value > 60) value = 60;
    }
    
    setEditingScenario({
      ...editingScenario,
      config: {
        ...editingScenario.config,
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
                <>
                  <button
                    onClick={() => handleEditScenario(currentScenario)}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition-all"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDeleteScenario(currentScenario.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all"
                  >
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Edit Scenario Modal */}
          {editingScenario && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Scenario: {editingScenario.name}</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scenario Name</label>
                  <input
                    type="text"
                    value={editingScenario.name}
                    onChange={(e) => setEditingScenario({ ...editingScenario, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Projection Years</label>
                  <select
                    value={editingScenario.config.projectionYears}
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

              <h3 className="text-lg font-bold text-gray-900 mb-4">Assumptions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Investment Return Rate: {(editingScenario.assumptions.investmentReturnRate * 100).toFixed(1)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.15"
                    step="0.001"
                    value={editingScenario.assumptions.investmentReturnRate}
                    onChange={(e) => handleAssumptionChange('investmentReturnRate', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Inflation Rate: {(editingScenario.assumptions.inflationRate * 100).toFixed(1)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.05"
                    step="0.001"
                    value={editingScenario.assumptions.inflationRate}
                    onChange={(e) => handleAssumptionChange('inflationRate', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Growth Rate: {(editingScenario.assumptions.salaryGrowthRate * 100).toFixed(1)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.10"
                    step="0.001"
                    value={editingScenario.assumptions.salaryGrowthRate}
                    onChange={(e) => handleAssumptionChange('salaryGrowthRate', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Marginal Tax Rate: {(editingScenario.assumptions.marginalTaxRate * 100).toFixed(1)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.50"
                    step="0.01"
                    value={editingScenario.assumptions.marginalTaxRate}
                    onChange={(e) => handleAssumptionChange('marginalTaxRate', parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSaveScenario}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-all"
                >
                  Save Scenario
                </button>
                <button
                  onClick={() => setEditingScenario(null)}
                  className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg font-semibold hover:bg-gray-400 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Projection Chart */}
          {projectionResult && (
            <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-200 mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Net Worth Projection</h2>
              <NetWorthProjectionChart result={projectionResult} />
              
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
            </div>
          )}

          {/* Mortgage vs Invest Comparison */}
          {mortgageAccount && mortgageComparison && (
            <MortgageVsInvestComparison
              mortgage={mortgageAccount}
              comparison={mortgageComparison}
              monthlySurplus={monthlySurplus}
            />
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

