import { useState } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { HoldingForm } from './HoldingForm';
import type { Account, Holding } from '../types/models';

interface HoldingsListProps {
  account: Account;
}

export const HoldingsList = ({ account }: HoldingsListProps) => {
  const { deleteHolding, recalculateAccountBalance, refreshHoldingPrices } = useHouseholdStore();
  const [editingHoldingId, setEditingHoldingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{ current: number; total: number; ticker: string } | null>(null);

  const holdings = account.holdings || [];

  const handleDelete = (holdingId: string) => {
    if (window.confirm('Are you sure you want to delete this holding?')) {
      console.log('[HoldingsList] Deleting holding:', holdingId);
      deleteHolding(account.id, holdingId);
    }
  };

  const handleEdit = (holdingId: string) => {
    console.log('[HoldingsList] Editing holding:', holdingId);
    setEditingHoldingId(holdingId);
    setShowAddForm(false);
  };

  const handleAddNew = () => {
    console.log('[HoldingsList] Adding new holding');
    setEditingHoldingId(null);
    setShowAddForm(true);
  };

  const handleFormSuccess = () => {
    console.log('[HoldingsList] Form submitted successfully');
    setEditingHoldingId(null);
    setShowAddForm(false);
    // Recalculate balance after adding/editing
    recalculateAccountBalance(account.id);
  };

  const handleFormCancel = () => {
    console.log('[HoldingsList] Form cancelled');
    setEditingHoldingId(null);
    setShowAddForm(false);
  };

  const handleRefreshPrices = async () => {
    console.log('[HoldingsList] Refreshing prices');
    setIsRefreshing(true);
    setRefreshProgress(null);

    try {
      await refreshHoldingPrices(
        account.id,
        (current, total, ticker) => {
          setRefreshProgress({ current, total, ticker });
        }
      );
      setRefreshProgress(null);
      alert('Prices updated successfully!');
    } catch (error) {
      console.error('[HoldingsList] Error refreshing prices:', error);
      alert('Error updating prices: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const calculateTotalValue = (holding: Holding): number => {
    return holding.shares * holding.currentPrice;
  };

  const totalAccountValue = holdings.reduce((sum, h) => sum + calculateTotalValue(h), 0);

  console.log('[HoldingsList] Rendering for account:', account.name, 'holdings:', holdings.length);

  if (!account.useHoldings) {
    return null; // Don't show holdings if account doesn't use holdings
  }

  const tickersToFetchCount = holdings.filter(h => h.ticker !== 'CASH').length;
  const estimatedTime = tickersToFetchCount > 0 ? (tickersToFetchCount - 1) * 12 + 2 : 0; // ~1-2s for first, 12s for subsequent

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Holdings ({account.name})</h3>
        <div className="flex gap-2">
          {holdings.length > 0 && (
                    <button
                      onClick={handleRefreshPrices}
                      className={`px-6 py-2.5 text-sm rounded-xl font-semibold flex items-center gap-2 shadow-lg transition-all ${
                        isRefreshing 
                          ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 hover:shadow-xl transform hover:scale-105'
                      }`}
                      disabled={isRefreshing}
                    >
              {isRefreshing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {refreshProgress ? `Fetching ${refreshProgress.ticker} (${refreshProgress.current}/${refreshProgress.total})...` : 'Updating...'}
                  {refreshProgress && refreshProgress.total > 1 && (
                    <span className="ml-2 text-xs">
                      ~{estimatedTime - (refreshProgress.current - 1) * 12}s remaining
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="text-lg">🔄</span> Refresh Prices
                </>
              )}
            </button>
          )}
                  <button
                    onClick={handleAddNew}
                    className="px-6 py-2.5 text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
                  >
                    ➕ Add Holding
                  </button>
        </div>
      </div>

      {showAddForm && (
        <HoldingForm
          accountId={account.id}
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
        />
      )}

      {editingHoldingId && (
        <HoldingForm
          accountId={account.id}
          holdingId={editingHoldingId}
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
        />
      )}

      {holdings.length === 0 ? (
        <p className="text-gray-500">No holdings added yet. Add your first holding above.</p>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticker</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Update</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {holdings.map((holding) => {
                  const totalValue = calculateTotalValue(holding);
                  const lastUpdateDate = holding.lastPriceUpdate ? new Date(holding.lastPriceUpdate).toLocaleString() : '-';

                  return (
                    <tr key={holding.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">{holding.ticker}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{holding.shares.toLocaleString('en-CA', { maximumFractionDigits: 4 })}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        ${holding.currentPrice.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        ${totalValue.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{lastUpdateDate}</td>
                      <td className="px-4 py-2 text-sm">
                        <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEdit(holding.id)}
                                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-200 transition-all text-xs"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    onClick={() => handleDelete(holding.id)}
                                    className="px-3 py-1 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all text-xs"
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
          </div>
          <div className="mt-4 text-right text-lg font-bold">
            Total Holdings Value: ${totalAccountValue.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </>
      )}
    </div>
  );
};

