import { useState, useEffect } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { isInvestmentAccount } from '../types/models';
import { HoldingsList } from './HoldingsList';
import type { Account } from '../types/models';

export const AccountForm = () => {
  const {
    accounts,
    household,
    editingAccountId,
    addAccount,
    updateAccount,
    setEditingAccount,
  } = useHouseholdStore();

  const editingAccount = editingAccountId
    ? accounts.find((a) => a.id === editingAccountId)
    : null;

  const accountTypes: Account['type'][] = [
    'cash',
    'chequing',
    'tfsa',
    'rrsp',
    'dcpp',
    'resp',
    'non_registered',
    'primary_home',
    'rental_property',
    'mortgage',
    'loan',
    'credit_card',
  ];

  const [formData, setFormData] = useState({
    name: '',
    kind: 'asset' as 'asset' | 'liability',
    type: 'cash' as Account['type'],
    balance: 0,
    currency: 'CAD' as 'CAD' | 'USD',
    interestRate: 0,
    owner: '',
    useHoldings: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingAccount) {
      console.log('[AccountForm] Loading account for editing:', editingAccount);
      setFormData({
        name: editingAccount.name,
        kind: editingAccount.kind,
        type: editingAccount.type,
        balance: editingAccount.balance,
        currency: editingAccount.currency,
        interestRate: editingAccount.interestRate || 0,
        owner: editingAccount.owner || '',
        useHoldings: editingAccount.useHoldings || false,
      });
      setErrors({});
    } else {
      console.log('[AccountForm] Resetting form for new account');
      setFormData({
        name: '',
        kind: 'asset',
        type: 'cash',
        balance: 0,
        currency: 'CAD',
        interestRate: 0,
        owner: '',
        useHoldings: false,
      });
      setErrors({});
    }
  }, [editingAccount]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Please enter a name';
    }

    if (formData.balance < 0 && !formData.useHoldings) {
      newErrors.balance = 'Balance must be >= 0';
    }

    if (formData.interestRate < 0) {
      newErrors.interestRate = 'Interest rate must be >= 0';
    }

    setErrors(newErrors);
    console.log('[AccountForm] Validation result:', Object.keys(newErrors).length === 0 ? 'valid' : 'invalid', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[AccountForm] Form submitted:', formData);

    if (!validate()) {
      console.log('[AccountForm] Validation failed');
      return;
    }

    const accountData = {
      name: formData.name.trim(),
      kind: formData.kind,
      type: formData.type,
      balance: formData.balance,
      currency: formData.currency,
      interestRate: formData.interestRate > 0 ? formData.interestRate : undefined,
      owner: formData.owner || undefined,
      useHoldings: isInvestmentAccount(formData.type) ? formData.useHoldings : false,
    };

    if (editingAccountId) {
      updateAccount(editingAccountId, accountData);
    } else {
      addAccount(accountData);
    }

    // Reset form
    setFormData({
      name: '',
      kind: 'asset',
      type: 'cash',
      balance: 0,
      currency: 'CAD',
      interestRate: 0,
      owner: '',
      useHoldings: false,
    });
    setEditingAccount(null);
  };

  const handleCancel = () => {
    console.log('[AccountForm] Form cancelled');
    setFormData({
      name: '',
      kind: 'asset',
      type: 'cash',
      balance: 0,
      currency: 'CAD',
      interestRate: 0,
      owner: '',
      useHoldings: false,
    });
    setEditingAccount(null);
  };

  const canUseHoldings = isInvestmentAccount(formData.type);
  const showHoldings = editingAccount && editingAccount.useHoldings;

  return (
    <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-blue-200 mb-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-3xl">{editingAccountId ? '✏️' : '➕'}</span>
        {editingAccountId ? 'Edit Account' : 'Add Account'}
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
              placeholder="e.g., TD Chequing"
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type *
            </label>
            <select
              value={formData.type}
              onChange={(e) => {
                const newType = e.target.value as Account['type'];
                setFormData({
                  ...formData,
                  type: newType,
                  useHoldings: isInvestmentAccount(newType) ? formData.useHoldings : false,
                });
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kind *
            </label>
            <select
              value={formData.kind}
              onChange={(e) => setFormData({ ...formData, kind: e.target.value as 'asset' | 'liability' })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'CAD' | 'USD' })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </div>
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

        {canUseHoldings && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="useHoldings"
              checked={formData.useHoldings}
              onChange={(e) => setFormData({ ...formData, useHoldings: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="useHoldings" className="text-sm font-medium text-gray-700">
              Track individual holdings (stocks/ETFs)
            </label>
          </div>
        )}

        {!formData.useHoldings && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Balance *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.balance === 0 ? '' : formData.balance} // Show empty for 0
              onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
              onBlur={() => {
                if (formData.balance < 0) {
                  setErrors({ ...errors, balance: 'Balance must be >= 0' });
                }
              }}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.balance ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="0.00"
            />
            {errors.balance && <p className="text-red-500 text-sm mt-1">{errors.balance}</p>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interest Rate (%)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.interestRate === 0 ? '' : formData.interestRate} // Show empty for 0
            onChange={(e) => setFormData({ ...formData, interestRate: Number(e.target.value) })}
            onBlur={() => {
              if (formData.interestRate < 0) {
                setErrors({ ...errors, interestRate: 'Interest rate must be >= 0' });
              }
            }}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.interestRate ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
            placeholder="0.00"
          />
          {errors.interestRate && <p className="text-red-500 text-sm mt-1">{errors.interestRate}</p>}
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            {editingAccountId ? '💾 Save Changes' : '➕ Add Account'}
          </button>
          {editingAccountId && (
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

      {showHoldings && editingAccount && <HoldingsList account={editingAccount} />}
    </div>
  );
};

