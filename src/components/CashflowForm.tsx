import { useState, useEffect, useRef } from 'react';
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
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number>(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Get all unique categories from existing cashflows
  const allCategories = [...new Set(cashflows.map(cf => cf.category).filter(Boolean))].sort();

  useEffect(() => {
    if (editingCashflow) {
      setFormData({
        name: editingCashflow.name,
        type: editingCashflow.type,
        category: editingCashflow.category,
        amount: editingCashflow.amount,
        frequency: editingCashflow.frequency,
        owner: editingCashflow.owner || '',
      });
      setErrors({});
      
      // Scroll form into view when editing
      if (formRef.current) {
        setTimeout(() => {
          formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    } else {
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
  }, [editingCashflow, editingCashflowId]);

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
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
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
    <div ref={formRef} className="bg-gradient-to-br from-white to-emerald-50 p-8 rounded-2xl shadow-lg border-2 border-emerald-200 mb-6">
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
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <input
              ref={categoryInputRef}
              type="text"
              value={formData.category}
              onChange={(e) => {
                const value = e.target.value;
                setFormData({ ...formData, category: value });
                setSelectedSuggestionIndex(-1);
                
                // Filter suggestions
                if (value.trim()) {
                  const filtered = allCategories.filter(cat =>
                    cat.toLowerCase().includes(value.toLowerCase())
                  );
                  setCategorySuggestions(filtered.slice(0, 5));
                  setShowSuggestions(filtered.length > 0);
                } else {
                  setCategorySuggestions([]);
                  setShowSuggestions(false);
                }
              }}
              onFocus={() => {
                if (formData.category.trim()) {
                  const filtered = allCategories.filter(cat =>
                    cat.toLowerCase().includes(formData.category.toLowerCase())
                  );
                  setCategorySuggestions(filtered.slice(0, 5));
                  setShowSuggestions(filtered.length > 0);
                }
              }}
              onBlur={() => {
                // Delay to allow click on suggestion
                setTimeout(() => {
                  setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                }, 200);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  if (categorySuggestions.length > 0) {
                    const nextIndex = selectedSuggestionIndex < categorySuggestions.length - 1 
                      ? selectedSuggestionIndex + 1 
                      : 0;
                    setSelectedSuggestionIndex(nextIndex);
                    setFormData({ ...formData, category: categorySuggestions[nextIndex] });
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  if (categorySuggestions.length > 0) {
                    const prevIndex = selectedSuggestionIndex > 0 
                      ? selectedSuggestionIndex - 1 
                      : categorySuggestions.length - 1;
                    setSelectedSuggestionIndex(prevIndex);
                    setFormData({ ...formData, category: categorySuggestions[prevIndex] });
                  }
                } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0 && selectedSuggestionIndex < categorySuggestions.length) {
                  e.preventDefault();
                  setFormData({ ...formData, category: categorySuggestions[selectedSuggestionIndex] });
                  setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                } else if (e.key === 'Escape') {
                  setShowSuggestions(false);
                  setSelectedSuggestionIndex(-1);
                } else {
                  setSelectedSuggestionIndex(-1);
                }
              }}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.category ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="e.g., Salary, Housing"
            />
            {/* Autocomplete suggestions */}
            {showSuggestions && categorySuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {categorySuggestions.map((suggestion, index) => {
                  const isSelected = selectedSuggestionIndex === index;
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setFormData({ ...formData, category: suggestion });
                        setShowSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      className={`w-full text-left px-4 py-2.5 text-sm focus:outline-none ${
                        isSelected
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-blue-50 text-gray-900'
                      }`}
                    >
                      {suggestion}
                    </button>
                  );
                })}
              </div>
            )}
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
                <option value="">All / Joint</option>
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

