import { useState } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { AccountForm } from '../components/AccountForm';
import { formatAccountType } from '../utils/calculations';

export const Accounts = () => {
  const { accounts, household, deleteAccount, setEditingAccount } = useHouseholdStore();
  const [filterOwner, setFilterOwner] = useState<string>('');

  const owners = household?.owners || [];
  const filteredAccounts = filterOwner
    ? accounts.filter(a => !a.owner || a.owner === filterOwner)
    : accounts;

  const handleEdit = (id: string) => {
    console.log('[Accounts] Editing account:', id);
    setEditingAccount(id);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      console.log('[Accounts] Deleting account:', id);
      deleteAccount(id);
    }
  };

  console.log('[Accounts] Rendering with', accounts.length, 'accounts');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Accounts</h1>

      {/* Owner Filter */}
      {owners.length > 0 && (
        <div className="mb-6 flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterOwner('')}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              filterOwner === ''
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-blue-50 hover:border-blue-400'
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
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-blue-50 hover:border-blue-400'
              }`}
            >
              {owner}
            </button>
          ))}
        </div>
      )}

      <AccountForm />

      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden mt-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Kind</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Balance</th>
              {owners.length > 0 && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Owner</th>
              )}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {filteredAccounts.map((account) => (
              <tr
                key={account.id}
                className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                onClick={() => handleEdit(account.id)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{account.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatAccountType(account.type)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    account.kind === 'asset' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {account.kind}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                  ${account.balance.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                {owners.length > 0 && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{account.owner || '-'}</td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(account.id);
                      }}
                      className="px-4 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition-all"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(account.id);
                      }}
                      className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredAccounts.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No accounts found. Add your first account above.</p>
          </div>
        )}
      </div>
    </div>
  );
};

