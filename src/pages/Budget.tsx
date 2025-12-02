import { useState, useEffect } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { CashflowForm } from '../components/CashflowForm';
import { BudgetChart } from '../components/BudgetChart';
import { CSVUpload } from '../components/CSVUpload';
import { TransactionReview } from '../components/TransactionReview';
import { normalizeMonthly } from '../utils/calculations';
import { findDuplicates } from '../utils/duplicateDetector';
import { learnFromClassification } from '../utils/patternLearner';
import type { Transaction } from '../types/models';

export const Budget = () => {
  const {
    cashflows,
    household,
    patterns,
    transactions: existingTransactions,
    deleteCashflow,
    deleteTransaction,
    setEditingCashflow,
    addTransactions,
    updateTransaction,
    addCashflow,
    addPattern,
    updatePattern,
  } = useHouseholdStore();
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [importedTransactions, setImportedTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [viewMode, setViewMode] = useState<'recurring' | 'transactions'>('recurring');

  // Set default month to current month when switching to transactions view
  useEffect(() => {
    if (viewMode === 'transactions' && !selectedMonth) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${year}-${month}`);
    }
  }, [viewMode, selectedMonth]);
  const [filters, setFilters] = useState({
    name: '',
    type: '',
    category: '',
    frequency: '',
    owner: '',
  });

  const owners = household?.owners || [];
  
  // Get unique values for filter dropdowns
  const uniqueCategories = [...new Set(cashflows.map(cf => cf.category).filter(Boolean))].sort();
  const uniqueFrequencies = [...new Set(cashflows.map(cf => cf.frequency))].sort();
  
  // Filter transactions by selected month and other filters
  const filteredTransactions = viewMode === 'transactions' && selectedMonth
    ? existingTransactions.filter(tx => {
        console.log('[Budget] Filtering transaction:', tx.description, 'date:', tx.date, 'selectedMonth:', selectedMonth);
        // Filter by month
        if (!tx.date) {
          console.warn('[Budget] Transaction missing date:', tx);
          return false;
        }
        const txMonth = tx.date.substring(0, 7); // YYYY-MM
        if (txMonth !== selectedMonth) return false;
        
        // Apply other filters
        if (filters.name && !tx.description.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.type && tx.type !== filters.type) return false;
        if (filters.category && tx.category !== filters.category) return false;
        if (filters.owner && tx.owner !== filters.owner) return false;
        if (filterOwner && tx.owner && tx.owner !== filterOwner) return false;
        
        // Only show income/expense transactions
        return tx.type === 'income' || tx.type === 'expense';
      })
    : [];
  
  console.log('[Budget] View mode:', viewMode, 'Selected month:', selectedMonth, 'Filtered transactions:', filteredTransactions.length, 'Total transactions:', existingTransactions.length);
  
  // Apply all filters to cashflows
  const filteredCashflows = cashflows.filter(cf => {
    // Owner filter (from existing filter)
    if (filterOwner && cf.owner && cf.owner !== filterOwner) {
      return false;
    }
    
    // Name filter
    if (filters.name && !cf.name.toLowerCase().includes(filters.name.toLowerCase())) {
      return false;
    }
    
    // Type filter
    if (filters.type && cf.type !== filters.type) {
      return false;
    }
    
    // Category filter
    if (filters.category && cf.category !== filters.category) {
      return false;
    }
    
    // Frequency filter
    if (filters.frequency && cf.frequency !== filters.frequency) {
      return false;
    }
    
    // Owner filter (from filters state)
    if (filters.owner && cf.owner !== filters.owner) {
      return false;
    }
    
    return true;
  });
  
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const clearFilters = () => {
    setFilters({
      name: '',
      type: '',
      category: '',
      frequency: '',
      owner: '',
    });
    setFilterOwner('');
  };
  
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || filterOwner !== '';

  const handleTransactionsParsed = (transactions: Transaction[]) => {
    console.log('[Budget] Transactions parsed:', transactions.length);
    console.log('[Budget] Existing transactions in store:', existingTransactions.length);
    
    // Check for duplicates against existing transactions (not against the same batch)
    const { duplicates } = findDuplicates(transactions, existingTransactions, cashflows);
    
    if (duplicates.length > 0) {
      console.log('[Budget] Found', duplicates.length, 'duplicates');
      // Mark duplicates as transfer to skip import (but preserve income/expense type if it was set)
      const duplicateFingerprints = new Set(duplicates.map(d => d.fingerprint));
      transactions.forEach(tx => {
        if (duplicateFingerprints.has(tx.fingerprint)) {
          console.log('[Budget] Marking duplicate as transfer:', tx.description, tx.fingerprint);
          tx.type = 'transfer'; // Mark as transfer to skip
        }
      });
    }
    
    // Log transaction types for debugging
    const typeCounts = transactions.reduce((acc, tx) => {
      acc[tx.type] = (acc[tx.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('[Budget] Transaction type counts:', typeCounts);
    
    setImportedTransactions(transactions);
  };

  const handleTransactionUpdate = (id: string, updates: Partial<Transaction>) => {
    console.log('[Budget] Updating transaction:', id, updates);
    updateTransaction(id, updates);
    setImportedTransactions(prev =>
      prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx)
    );
  };

  const handleTransactionDelete = (id: string) => {
    console.log('[Budget] Deleting transaction:', id);
    setImportedTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  // Get existing categories from cashflows for autocomplete
  const existingCategories = [...new Set(cashflows.map(cf => cf.category).filter(Boolean))];

  const handleImport = (transactionsToImport: Transaction[]) => {
    console.log('[Budget] Importing', transactionsToImport.length, 'transactions');
    
    if (!household) {
      alert('No household set. Please set up your household in Settings first.');
      return;
    }

    // Save transactions for duplicate detection
    addTransactions(transactionsToImport);

    // Learn patterns from classifications
    let currentPatterns = patterns;
    transactionsToImport.forEach(tx => {
      if (tx.type !== 'unclassified' && tx.category) {
        const newPatterns = learnFromClassification(
          tx,
          {
            type: tx.type,
            category: tx.category,
            owner: tx.owner,
          },
          currentPatterns,
          household.id
        );
        
        // Update patterns list and add new ones
        newPatterns.forEach(pattern => {
          const existingIndex = currentPatterns.findIndex(p => p.id === pattern.id);
          if (existingIndex >= 0) {
            // Update existing pattern
            updatePattern(pattern.id, pattern);
            currentPatterns = currentPatterns.map(p => p.id === pattern.id ? pattern : p);
          } else {
            // Add new pattern
            addPattern(pattern);
            currentPatterns = [...currentPatterns, pattern];
          }
        });
      }
    });

    // Convert transactions to cashflows
    transactionsToImport.forEach(tx => {
      if (tx.type === 'income' || tx.type === 'expense') {
        addCashflow({
          name: tx.description,
          type: tx.type,
          category: tx.category || 'Uncategorized',
          amount: tx.amount,
          frequency: 'monthly', // CSV imports are typically monthly
          owner: tx.owner,
        });
      }
    });

    // Reset import state
    setImportedTransactions([]);
    
    alert(`Successfully imported ${transactionsToImport.length} transactions!`);
  };

  const handleCancelImport = () => {
    setImportedTransactions([]);
  };

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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Budget</h1>
      </div>

      {/* CSV Import Section - Always visible */}
      {importedTransactions.length === 0 ? (
        household && (
          <div className="mb-8">
            <CSVUpload
              onTransactionsParsed={handleTransactionsParsed}
              householdId={household.id}
            />
          </div>
        )
      ) : (
          <div className="mb-8">
            <TransactionReview
              transactions={importedTransactions}
              patterns={patterns}
              existingCategories={existingCategories}
              onTransactionUpdate={handleTransactionUpdate}
              onTransactionDelete={handleTransactionDelete}
              onImport={handleImport}
              onCancel={handleCancelImport}
            />
          </div>
      )}

      {/* Quick Owner Filter */}
      {owners.length > 0 && (
        <div className="mb-6 flex gap-2 flex-wrap items-center">
          <span className="text-sm font-medium text-gray-700">Quick Filter:</span>
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
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 bg-gray-500 text-white rounded-xl text-sm font-semibold hover:bg-gray-600 transition-all"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      <CashflowForm />

      {/* View Mode Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">View:</span>
        <button
          onClick={() => setViewMode('recurring')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'recurring'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Recurring Budget
        </button>
        <button
          onClick={() => setViewMode('transactions')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'transactions'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Month-by-Month
        </button>
        {viewMode === 'transactions' && (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        )}
      </div>

      <div className="mb-6">
        <BudgetChart 
          cashflows={viewMode === 'recurring' ? filteredCashflows : []} 
          transactions={viewMode === 'transactions' ? existingTransactions : []}
          selectedMonth={viewMode === 'transactions' ? selectedMonth : undefined}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <div className="flex flex-col gap-1">
                  <span>Name</span>
                  <input
                    type="text"
                    value={filters.name}
                    onChange={(e) => handleFilterChange('name', e.target.value)}
                    placeholder="Filter..."
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <div className="flex flex-col gap-1">
                  <span>Type</span>
                  <select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">All</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <div className="flex flex-col gap-1">
                  <span>Category</span>
                  <select
                    value={filters.category}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="">All</option>
                    {uniqueCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
              {viewMode === 'recurring' ? (
                <>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex flex-col gap-1">
                      <span>Frequency</span>
                      <select
                        value={filters.frequency}
                        onChange={(e) => handleFilterChange('frequency', e.target.value)}
                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">All</option>
                        {uniqueFrequencies.map(freq => (
                          <option key={freq} value={freq}>{freq.charAt(0).toUpperCase() + freq.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Monthly</th>
                </>
              ) : (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
              )}
              {owners.length > 0 && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <div className="flex flex-col gap-1">
                    <span>Owner</span>
                    <select
                      value={filters.owner}
                      onChange={(e) => handleFilterChange('owner', e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">All</option>
                      {owners.map(owner => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                  </div>
                </th>
              )}
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {viewMode === 'recurring' ? (
              // Show cashflows in recurring view
              filteredCashflows.map((cashflow) => {
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{cashflow.owner || 'All / Household'}</td>
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
              })
            ) : (
              // Show transactions in month-by-month view
              filteredTransactions.map((tx) => {
                let dateDisplay = 'N/A';
                if (tx.date) {
                  try {
                    const date = new Date(tx.date);
                    if (!isNaN(date.getTime())) {
                      dateDisplay = date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
                    } else {
                      console.warn('[Budget] Invalid date for transaction:', tx.id, tx.date);
                      dateDisplay = tx.date; // Show raw date if can't parse
                    }
                  } catch (e) {
                    console.error('[Budget] Error parsing date:', tx.date, e);
                    dateDisplay = tx.date || 'N/A';
                  }
                } else {
                  console.warn('[Budget] Transaction missing date:', tx.id, tx.description);
                }
                
                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{tx.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{tx.category || 'Uncategorized'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      ${tx.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {dateDisplay}
                    </td>
                    {owners.length > 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{tx.owner || 'All / Household'}</td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            updateTransaction(tx.id, { 
                              type: tx.type === 'income' ? 'expense' : 'income' 
                            });
                          }}
                          className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-200 transition-all text-xs"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this transaction?')) {
                              deleteTransaction(tx.id);
                            }
                          }}
                          className="px-4 py-1.5 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-all text-xs"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {viewMode === 'recurring' && filteredCashflows.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No cashflows found. Add your first income or expense above.</p>
          </div>
        )}
        {viewMode === 'transactions' && filteredTransactions.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">
              {selectedMonth ? `No transactions found for ${selectedMonth}.` : 'Select a month to view transactions.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

