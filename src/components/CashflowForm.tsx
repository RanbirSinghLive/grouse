import { useState, useEffect } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import type { Cashflow } from '../types/models';

export const CashflowForm = () => {
  const {
    cashflows,
    household,
    editingCashflowId,
    addCashflow,
    updateCashflow,
    setEditingCashflow,
  } = useHouseholdStore();

  const editingCashflow = editingCashflowId
    ? cashflows.find((c) => c.id === editingCashflowId)
    : null;

  const [formData, setFormData] = useState({
    name: '',
    type: 'income' as 'income' | 'expense',
    category: '',
    amount: 0,
    frequency: 'monthly' as Cashflow['frequency'],
    owner: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingCashflow) {
      console.log('[CashflowForm] Loading cashflow for editing:', editingCashflow);
      setFormData({
        name: editingCashflow.name,
        type: editingCashflow.type,
        category: editingCashflow.category,
        amount: editingCashflow.amount,
        frequency: editingCashflow.frequency,
        owner: editingCashflow.owner || '',
      });
      setErrors({});
    } else {
      console.log('[CashflowForm] Resetting form for new cashflow');
      setFormData({
        name: '',
        type: 'income',
        category: '',
        amount: 0,
        frequency: 'monthly',
        owner: '',
      });
      setErrors({});
    }
  }, [editingCashflow]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter a name';
    }

    if (!formData.category.trim()) {
      newErrors.category = 'Please enter a category';
    }

    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be > 0';
    }

    setErrors(newErrors);
    console.log('[CashflowForm] Validation result:', Object.keys(newErrors).length === 0 ? 'valid' : 'invalid', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CashflowForm] Form submitted:', formData);

    if (!validate()) {
      console.log('[CashflowForm] Validation failed');
      return;
    }

    const cashflowData = {
      name: formData.name.trim(),
      type: formData.type,
      category: formData.category.trim(),
      amount: formData.amount,
      frequency: formData.frequency,
      owner: formData.owner || undefined,
    };

    if (editingCashflowId) {
      updateCashflow(editingCashflowId, cashflowData);
    } else {
      addCashflow(cashflowData);
    }

    // Reset form
    setFormData({
      name: '',
      type: 'income',
      category: '',
      amount: 0,
      frequency: 'monthly',
      owner: '',
    });
    setEditingCashflow(null);
  };

  const handleCancel = () => {
    console.log('[CashflowForm] Form cancelled');
    setFormData({
      name: '',
      type: 'income',
      category: '',
      amount: 0,
      frequency: 'monthly',
      owner: '',
    });
    setEditingCashflow(null);
  };

  return (
    <div className="bg-gradient-to-br from-white to-emerald-50 p-8 rounded-2xl shadow-lg border-2 border-emerald-200 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-3xl">{editingCashflowId ? '✏️' : '➕'}</span>
        {editingCashflowId ? 'Edit Cashflow' : 'Add Cashflow'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="e.g., Salary, Rent"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="e.g., Salary, Housing"
            />
            {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.amount === 0 ? '' : formData.amount} // Show empty for 0
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              onBlur={() => {
                if (formData.amount <= 0) {
                  setErrors({ ...errors, amount: 'Amount must be > 0' });
                }
              }}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.amount ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="0.00"
            />
            {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Frequency *
            </label>
            <select
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value as Cashflow['frequency'] })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="monthly">Monthly</option>
              <option value="biweekly">Biweekly</option>
              <option value="weekly">Weekly</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          {household?.owners && household.owners.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <select
                value={formData.owner}
                onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="">All / Household</option>
                {household.owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            {editingCashflowId ? '💾 Save Changes' : '➕ Add Cashflow'}
          </button>
          {editingCashflowId && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-8 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

