import { useState, useEffect, useMemo } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { BudgetChart } from '../components/BudgetChart';
import { SpendingOverTime } from '../components/SpendingOverTime';
import { CategoryBreakdown } from '../components/CategoryBreakdown';
import { MonthlyComparison } from '../components/MonthlyComparison';
import { CSVUpload } from '../components/CSVUpload';
import { TransactionReview } from '../components/TransactionReview';
import { calculateCategoryAverages, getAvailableMonths } from '../utils/calculations';
import { findDuplicates } from '../utils/duplicateDetector';
import { learnFromClassification } from '../utils/patternLearner';
import type { Transaction } from '../types/models';

export const Budget = () => {
  const {
    household,
    patterns,
    transactions: existingTransactions,
    deleteTransaction,
    addTransactions,
    updateTransaction,
    addPattern,
    updatePattern,
    renameCategory,
  } = useHouseholdStore();
  const [filterOwner, setFilterOwner] = useState<string>('');
  const [importedTransactions, setImportedTransactions] = useState<Transaction[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [viewMode, setViewMode] = useState<'averages' | 'month'>('averages');
  // Inline editing state
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState<string>('');
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingTransactionData, setEditingTransactionData] = useState<Partial<Transaction>>({});


  // Set default month to current month when switching to month view
  useEffect(() => {
    if (viewMode === 'month' && !selectedMonth) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setSelectedMonth(`${year}-${month}`);
    }
  }, [viewMode, selectedMonth]);

  const [filters, setFilters] = useState({
    type: '',
    category: '',
    owner: '',
  });

  const owners = household?.owners || [];
  
  // Get available months from transactions
  const availableMonths = useMemo(() => getAvailableMonths(existingTransactions), [existingTransactions]);
  
  // Calculate category averages from all transactions
  const categoryAverages = useMemo(() => {
    console.log('[Budget] Calculating category averages from', existingTransactions.length, 'transactions');
    return calculateCategoryAverages(existingTransactions);
  }, [existingTransactions]);
  
  // Get unique categories from averages
  const uniqueCategories = useMemo(() => {
    return [...new Set(categoryAverages.map(avg => avg.category).filter(Boolean))].sort();
  }, [categoryAverages]);
  
  // Filter category averages
  const filteredAverages = useMemo(() => {
    return categoryAverages.filter(avg => {
      if (filterOwner && avg.category && filterOwner !== '') {
        // Note: averages don't have owner info, so we'd need to filter transactions first
        // For now, we'll skip owner filtering on averages
      }
      
      if (filters.type && avg.type !== filters.type) {
        return false;
      }
      
      if (filters.category && avg.category !== filters.category) {
        return false;
      }
      
      return true;
    });
  }, [categoryAverages, filters, filterOwner]);
  
  // Filter transactions for month view
  const filteredTransactions = useMemo(() => {
    if (viewMode !== 'month' || !selectedMonth) return [];
    
    return existingTransactions.filter(tx => {
      if (!tx.date) return false;
      const txMonth = tx.date.substring(0, 7);
      if (txMonth !== selectedMonth) return false;
      
      if (filters.type && tx.type !== filters.type) return false;
      if (filters.category && tx.category !== filters.category) return false;
      if (filters.owner && tx.owner && tx.owner !== filters.owner) return false;
      if (filterOwner && tx.owner && tx.owner !== filterOwner) return false;
      
      return tx.type === 'income' || tx.type === 'expense';
    });
  }, [viewMode, selectedMonth, existingTransactions, filters, filterOwner]);
  
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      category: '',
      owner: '',
    });
    setFilterOwner('');
  };
  
  const hasActiveFilters = Object.values(filters).some(v => v !== '') || filterOwner !== '';

  const handleTransactionsParsed = (transactions: Transaction[]) => {
    // ACCUMULATE with existing imported transactions (in case this is called multiple times)
    // Only replace if state is empty (fresh upload)
    let transactionsToProcess: Transaction[];
    if (importedTransactions.length > 0) {
      // Accumulate - merge transactions, avoiding duplicates by fingerprint
      const existingFingerprints = new Set(importedTransactions.map(tx => tx.fingerprint));
      const newUniqueTransactions = transactions.filter(tx => !existingFingerprints.has(tx.fingerprint));
      transactionsToProcess = [...importedTransactions, ...newUniqueTransactions];
    } else {
      // Replace - this is a fresh upload, state is empty
      transactionsToProcess = transactions;
    }
    
    // Check for duplicates within the batch itself first
    const batchFingerprints = new Map<string, Transaction>();
    const duplicateIdsInBatch = new Set<string>();
    transactionsToProcess.forEach(tx => {
      const existing = batchFingerprints.get(tx.fingerprint);
      if (existing) {
        // Found duplicate within batch - keep the first one, mark subsequent ones as duplicate
        duplicateIdsInBatch.add(tx.id);
      } else {
        batchFingerprints.set(tx.fingerprint, tx);
      }
    });
    
    // Check for duplicates against existing transactions in store
    // Only check transactions that aren't already duplicates within the batch
    const nonBatchDuplicates = transactionsToProcess.filter(tx => !duplicateIdsInBatch.has(tx.id));
    const { duplicates } = findDuplicates(nonBatchDuplicates, existingTransactions, []);
    const duplicateFingerprintsFromStore = new Set(duplicates.map(d => d.fingerprint));
    
    if (duplicates.length > 0 || duplicateIdsInBatch.size > 0) {
      // Mark duplicates as transfer to skip import (but still show in review)
      transactionsToProcess.forEach(tx => {
        const isDuplicateInBatch = duplicateIdsInBatch.has(tx.id);
        const isDuplicateFromStore = duplicateFingerprintsFromStore.has(tx.fingerprint);
        
        if (isDuplicateInBatch || isDuplicateFromStore) {
          tx.type = 'transfer'; // Mark as transfer to skip
        }
      });
    }
    
    // Set all transactions (CSVUpload should combine all files, but we're handling accumulation just in case)
    // IMPORTANT: We're setting ALL transactions, including those marked as 'transfer'
    // The TransactionReview component will show them all, and the user can decide what to import
    setImportedTransactions([...transactionsToProcess]);
  };

  const handleTransactionUpdate = (id: string, updates: Partial<Transaction>) => {
    updateTransaction(id, updates);
    setImportedTransactions(prev =>
      prev.map(tx => tx.id === id ? { ...tx, ...updates } : tx)
    );
  };

  const handleTransactionDelete = (id: string) => {
    setImportedTransactions(prev => prev.filter(tx => tx.id !== id));
  };

  const handleImport = (transactionsToImport: Transaction[]) => {
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

    // Reset import state
    setImportedTransactions([]);
    
    alert(`Successfully imported ${transactionsToImport.length} transactions!`);
  };

  const handleCancelImport = () => {
    setImportedTransactions([]);
  };

  // Get existing categories from transactions for autocomplete
  const existingCategories = useMemo(() => {
    return [...new Set(existingTransactions.map(tx => tx.category).filter((cat): cat is string => Boolean(cat)))];
  }, [existingTransactions]);

  // Handle category rename in averages view
  const handleCategoryRename = (oldCategory: string, newCategory: string) => {
    if (!newCategory || newCategory.trim() === '' || newCategory === oldCategory) {
      setEditingCategory(null);
      return;
    }
    renameCategory(oldCategory, newCategory.trim());
    setEditingCategory(null);
  };

  // Handle transaction edit in month view
  const handleTransactionEdit = (tx: Transaction) => {
    setEditingTransactionId(tx.id);
    setEditingTransactionData({
      category: tx.category || '',
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
    });
  };

  const handleTransactionSave = (txId: string) => {
    updateTransaction(txId, editingTransactionData);
    setEditingTransactionId(null);
    setEditingTransactionData({});
  };

  const handleTransactionCancel = () => {
    setEditingTransactionId(null);
    setEditingTransactionData({});
  };


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

      {/* View Mode Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">View:</span>
        <button
          onClick={() => setViewMode('averages')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'averages'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Category Averages
        </button>
        <button
          onClick={() => setViewMode('month')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            viewMode === 'month'
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Month-by-Month
        </button>
        {viewMode === 'month' && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Month</option>
            {availableMonths.map(month => {
              const [year, monthNum] = month.split('-');
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                  'July', 'August', 'September', 'October', 'November', 'December'];
              const monthName = monthNames[parseInt(monthNum) - 1];
              return (
                <option key={month} value={month}>
                  {monthName} {year}
                </option>
              );
            })}
          </select>
        )}
      </div>

      <div className="mb-6">
        <BudgetChart 
          transactions={viewMode === 'averages' ? existingTransactions : filteredTransactions}
          selectedMonth={viewMode === 'month' ? selectedMonth : undefined}
        />
      </div>

      {/* Additional Visualizations */}
      {viewMode === 'averages' && existingTransactions.length > 0 && (
        <div className="space-y-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SpendingOverTime transactions={existingTransactions} />
            <CategoryBreakdown transactions={existingTransactions} />
          </div>
          <MonthlyComparison transactions={existingTransactions} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/50">
            <tr>
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
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Average Monthly Amount
              </th>
              {viewMode === 'averages' ? (
                <>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Months of Data
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Transaction Count
                  </th>
                </>
              ) : (
                <>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                </>
              )}
              {owners.length > 0 && viewMode === 'month' && (
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
              {viewMode === 'month' && (
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {viewMode === 'averages' ? (
              // Show category averages with trends
              filteredAverages.map((avg) => {
                const trendIcon = avg.trendDirection === 'up' ? '📈' : avg.trendDirection === 'down' ? '📉' : '➡️';
                const trendColor = avg.trendDirection === 'up' 
                  ? 'text-emerald-600' 
                  : avg.trendDirection === 'down' 
                  ? 'text-red-600' 
                  : 'text-gray-500';
                
                return (
                  <tr
                    key={`${avg.category}-${avg.type}`}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        avg.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {avg.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {editingCategory === `${avg.category}-${avg.type}` ? (
                        <input
                          type="text"
                          value={editingCategoryValue}
                          onChange={(e) => setEditingCategoryValue(e.target.value)}
                          onBlur={() => handleCategoryRename(avg.category, editingCategoryValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCategoryRename(avg.category, editingCategoryValue);
                            } else if (e.key === 'Escape') {
                              setEditingCategory(null);
                            }
                          }}
                          className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-blue-600"
                          onClick={() => {
                            setEditingCategory(`${avg.category}-${avg.type}`);
                            setEditingCategoryValue(avg.category);
                          }}
                        >
                          {avg.category}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${avg.averageAmount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`flex items-center gap-1 ${trendColor}`}>
                        <span>{trendIcon}</span>
                        <span className="font-semibold">
                          {avg.trendPercentage >= 0 ? '+' : ''}{avg.trendPercentage.toFixed(1)}%
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {avg.monthsWithData}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {avg.transactionCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          setEditingCategory(`${avg.category}-${avg.type}`);
                          setEditingCategoryValue(avg.category);
                        }}
                        className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg font-semibold hover:bg-blue-200 transition-all text-xs"
                        title="Edit Category"
                      >
                        ✏️ Edit
                      </button>
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
                      dateDisplay = tx.date;
                    }
                  } catch (e) {
                    console.error('[Budget] Error parsing date:', tx.date, e);
                    dateDisplay = tx.date || 'N/A';
                  }
                } else {
                  console.warn('[Budget] Transaction missing date:', tx.id, tx.description);
                }
                
                const isEditing = editingTransactionId === tx.id;
                
                return (
                  <tr
                    key={tx.id}
                    className="hover:bg-blue-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {isEditing ? (
                        <select
                          value={editingTransactionData.type || tx.type}
                          onChange={(e) => setEditingTransactionData({ ...editingTransactionData, type: e.target.value as Transaction['type'] })}
                          className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        >
                          <option value="income">income</option>
                          <option value="expense">expense</option>
                          <option value="transfer">transfer</option>
                          <option value="unclassified">unclassified</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {tx.type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTransactionData.category || ''}
                          onChange={(e) => setEditingTransactionData({ ...editingTransactionData, category: e.target.value })}
                          placeholder="Category"
                          className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs w-32"
                          list="category-list"
                        />
                      ) : (
                        tx.category || 'Uncategorized'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editingTransactionData.amount || tx.amount}
                          onChange={(e) => setEditingTransactionData({ ...editingTransactionData, amount: parseFloat(e.target.value) || 0 })}
                          className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs w-24"
                        />
                      ) : (
                        `$${tx.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingTransactionData.description || tx.description}
                          onChange={(e) => setEditingTransactionData({ ...editingTransactionData, description: e.target.value })}
                          className="px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs w-48"
                        />
                      ) : (
                        tx.description
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {dateDisplay}
                    </td>
                    {owners.length > 0 && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{tx.owner || 'All / Household'}</td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleTransactionSave(tx.id)}
                            className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-200 transition-all text-xs"
                          >
                            ✓ Save
                          </button>
                          <button
                            onClick={handleTransactionCancel}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-all text-xs"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleTransactionEdit(tx)}
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
                      )}
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
        </table>
        <datalist id="category-list">
          {existingCategories.map(cat => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
        {viewMode === 'averages' && filteredAverages.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">
              {existingTransactions.length === 0 
                ? 'No transaction data available. Import CSV files to see category averages.' 
                : 'No categories match the current filters.'}
            </p>
          </div>
        )}
        {viewMode === 'month' && filteredTransactions.length === 0 && (
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

