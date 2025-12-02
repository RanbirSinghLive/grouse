import { useState } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { CashflowForm } from '../components/CashflowForm';
import { BudgetChart } from '../components/BudgetChart';
import { normalizeMonthly } from '../utils/calculations';

export const Budget = () => {
  const { cashflows, household, deleteCashflow, setEditingCashflow } = useHouseholdStore();
  const [filterOwner, setFilterOwner] = useState<string>('');

  const owners = household?.owners || [];
  const filteredCashflows = filterOwner
    ? cashflows.filter(cf => !cf.owner || cf.owner === filterOwner)
    : cashflows;

  const handleEdit = (id: string) => {
    console.log('[Budget] Editing cashflow:', id);
    setEditingCashflow(id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this cashflow?')) {
      console.log('[Budget] Deleting cashflow:', id);
      deleteCashflow(id);
    }
  };

  console.log('[Budget] Rendering with', cashflows.length, 'cashflows');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Budget</h1>

      {/* Owner Filter */}
      {owners.length > 0 && (
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterOwner('')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              filterOwner === ''
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-emerald-50 hover:border-emerald-400'
            }`}
          >
            All
          </button>
          {owners.map((owner) => (
            <button
              key={owner}
              onClick={() => setFilterOwner(owner)}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                filterOwner === owner
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-emerald-50 hover:border-emerald-400'
              }`}
            >
              {owner}
            </button>
          ))}
        </div>
      )}

      <CashflowForm />

      <div className="mb-6">
        <BudgetChart cashflows={filteredCashflows} />
      </div>

      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Frequency</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Monthly</th>
              {owners.length > 0 && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Owner</th>
              )}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredCashflows.map((cashflow) => {
              const monthlyAmount = normalizeMonthly(cashflow.amount, cashflow.frequency);
              return (
                <tr
                  key={cashflow.id}
                  className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                  onClick={() => handleEdit(cashflow.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{cashflow.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      cashflow.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {cashflow.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cashflow.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    ${cashflow.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{cashflow.frequency}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ${monthlyAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {owners.length > 0 && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cashflow.owner || '-'}</td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(cashflow.id);
                        }}
                        className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-200 transition-all"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(cashflow.id);
                        }}
                        className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredCashflows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No cashflows found. Add your first income or expense above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

