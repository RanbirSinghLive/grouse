import { useState, useRef, useEffect } from 'react';
import type { Transaction } from '../types/models';
import { findMatchingPatterns } from '../utils/patternMatcher';
import type { TransactionPattern } from '../types/models';
import { ConfirmDialog, useConfirmDelete } from '../utils/confirmDialog';

interface TransactionReviewProps {
  transactions: Transaction[];
  patterns: TransactionPattern[];
  existingCategories?: string[]; // Categories from existing cashflows
  onTransactionUpdate: (id: string, updates: Partial<Transaction>) => void;
  onTransactionDelete: (id: string) => void;
  onImport: (transactions: Transaction[]) => void;
  onCancel: () => void;
}

export const TransactionReview = ({
  transactions,
  patterns,
  existingCategories = [],
  onTransactionUpdate,
  onTransactionDelete,
  onImport,
  onCancel,
}: TransactionReviewProps) => {
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense' | 'transfer' | 'unclassified'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [categorySuggestions, setCategorySuggestions] = useState<Record<string, string[]>>({});
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<Record<string, number>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState<Record<string, boolean>>({});
  const categoryInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const blurTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  
  // Delete confirmation with "don't ask again" option
  const {
    confirmDelete,
    showDialog,
    deleteMessage,
    handleConfirm,
    handleCancel,
    handleDontAskAgain,
  } = useConfirmDelete('transaction');

  const filteredTransactions = filterType === 'all'
    ? transactions
    : transactions.filter(tx => tx.type === filterType);

  // Get all unique categories from transactions, existing cashflows, and learned patterns
  const allCategories = [
    ...new Set([
      ...existingCategories,
      ...transactions.map(tx => tx.category).filter((cat): cat is string => !!cat),
      ...patterns.map(p => p.category),
    ]),
  ].sort();

  // Auto-fill categories from pattern matches when transactions are first loaded
  useEffect(() => {
    const transactionsToAutoFill = transactions.filter(tx => !tx.category);
    if (transactionsToAutoFill.length === 0) return;

    transactionsToAutoFill.forEach(tx => {
      const matches = findMatchingPatterns(tx, patterns);
      const bestMatch = matches[0];
      // Auto-fill if high confidence match (>= 70%)
      if (bestMatch && bestMatch.confidence >= 70) {
        setCategoryInputs(prev => {
          // Only set if not already set
          if (prev[tx.id]) return prev;
          return { ...prev, [tx.id]: bestMatch.pattern.category };
        });
        // Only update if category is not already set
        if (!tx.category) {
          onTransactionUpdate(tx.id, { category: bestMatch.pattern.category });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions.length, patterns.length]); // Only re-run when transaction count or pattern count changes

  // Handle category input click - show all categories
  const handleCategoryClick = (txId: string) => {
    // Clear any pending blur timeout
    if (blurTimeoutRef.current[txId]) {
      clearTimeout(blurTimeoutRef.current[txId]);
      delete blurTimeoutRef.current[txId];
    }
    setEditingCategoryId(txId);
    setIsDropdownOpen(prev => ({ ...prev, [txId]: true }));
    // Show all categories when clicked
    setCategorySuggestions(prev => ({ ...prev, [txId]: allCategories }));
  };

  // Handle category input change with autocomplete
  const handleCategoryChange = (txId: string, value: string) => {
    setCategoryInputs(prev => ({ ...prev, [txId]: value }));
    
    // Reset selection index when typing
    setSelectedSuggestionIndex(prev => {
      const newState = { ...prev };
      delete newState[txId];
      return newState;
    });
    
    // Filter suggestions based on input
    if (value.trim()) {
      const filtered = allCategories.filter(cat =>
        cat.toLowerCase().includes(value.toLowerCase())
      );
      setCategorySuggestions(prev => ({ ...prev, [txId]: filtered }));
    } else {
      // If empty, show all categories
      setCategorySuggestions(prev => ({ ...prev, [txId]: allCategories }));
    }
  };

  // Handle category input blur (lock the category)
  const handleCategoryBlur = (txId: string) => {
    // Delay closing dropdown to allow clicks on suggestions
    blurTimeoutRef.current[txId] = setTimeout(() => {
      const value = categoryInputs[txId] || transactions.find(tx => tx.id === txId)?.category || '';
      if (value.trim()) {
        onTransactionUpdate(txId, { category: value.trim() });
      }
      setEditingCategoryId(null);
      setIsDropdownOpen(prev => {
        const newState = { ...prev };
        delete newState[txId];
        return newState;
      });
      setCategorySuggestions(prev => {
        const newSuggestions = { ...prev };
        delete newSuggestions[txId];
        return newSuggestions;
      });
      delete blurTimeoutRef.current[txId];
    }, 200);
  };

  // Handle keyboard navigation for category autocomplete
  const handleCategoryKeyDown = (txId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestions = categorySuggestions[txId] || [];
    const currentIndex = selectedSuggestionIndex[txId] ?? -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const nextIndex = currentIndex < suggestions.length - 1 ? currentIndex + 1 : 0;
        setSelectedSuggestionIndex(prev => ({ ...prev, [txId]: nextIndex }));
        // Update input value to show selected suggestion
        setCategoryInputs(prev => ({ ...prev, [txId]: suggestions[nextIndex] }));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : suggestions.length - 1;
        setSelectedSuggestionIndex(prev => ({ ...prev, [txId]: prevIndex }));
        // Update input value to show selected suggestion
        setCategoryInputs(prev => ({ ...prev, [txId]: suggestions[prevIndex] }));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If a suggestion is selected, use it; otherwise use current input value
      if (currentIndex >= 0 && currentIndex < suggestions.length) {
        selectSuggestion(txId, suggestions[currentIndex]);
      } else {
        const value = categoryInputs[txId] || transactions.find(tx => tx.id === txId)?.category || '';
        if (value.trim()) {
          onTransactionUpdate(txId, { category: value.trim() });
        }
        setEditingCategoryId(null);
        categoryInputRefs.current[txId]?.blur();
      }
    } else if (e.key === 'Escape') {
      setEditingCategoryId(null);
      setSelectedSuggestionIndex(prev => {
        const newState = { ...prev };
        delete newState[txId];
        return newState;
      });
      categoryInputRefs.current[txId]?.blur();
    } else {
      // Reset selection index when typing
      setSelectedSuggestionIndex(prev => {
        const newState = { ...prev };
        delete newState[txId];
        return newState;
      });
    }
  };

  // Select a suggestion
  const selectSuggestion = (txId: string, category: string) => {
    // Clear blur timeout
    if (blurTimeoutRef.current[txId]) {
      clearTimeout(blurTimeoutRef.current[txId]);
      delete blurTimeoutRef.current[txId];
    }
    setCategoryInputs(prev => ({ ...prev, [txId]: category }));
    onTransactionUpdate(txId, { category });
    setEditingCategoryId(null);
    setIsDropdownOpen(prev => {
      const newState = { ...prev };
      delete newState[txId];
      return newState;
    });
    setCategorySuggestions(prev => {
      const newSuggestions = { ...prev };
      delete newSuggestions[txId];
      return newSuggestions;
    });
    setSelectedSuggestionIndex(prev => {
      const newState = { ...prev };
      delete newState[txId];
      return newState;
    });
    categoryInputRefs.current[txId]?.blur();
  };

  // Initialize category inputs from transactions
  useEffect(() => {
    const initialInputs: Record<string, string> = {};
    transactions.forEach(tx => {
      if (tx.category) {
        initialInputs[tx.id] = tx.category;
      }
    });
    setCategoryInputs(initialInputs);
  }, [transactions]);

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTransactions.map(tx => tx.id)));
    }
  };

  const handleBulkUpdate = (updates: Partial<Transaction>) => {
    selectedIds.forEach(id => {
      onTransactionUpdate(id, updates);
    });
    setSelectedIds(new Set());
  };

  const handleImport = () => {
    // Only import non-transfer transactions
    const toImport = transactions.filter(tx => tx.type !== 'transfer' && tx.type !== 'unclassified');
    onImport(toImport);
  };

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'income': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'expense': return 'bg-red-100 text-red-800 border-red-300';
      case 'transfer': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const stats = {
    total: transactions.length,
    income: transactions.filter(tx => tx.type === 'income').length,
    expense: transactions.filter(tx => tx.type === 'expense').length,
    transfer: transactions.filter(tx => tx.type === 'transfer').length,
    unclassified: transactions.filter(tx => tx.type === 'unclassified').length,
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span className="text-3xl">📋</span>
          Review Transactions ({stats.total} found)
        </h2>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded-lg border-2 border-blue-200">
            <p className="text-xs text-blue-700 font-semibold uppercase">Total</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
          </div>
          <div className="bg-emerald-50 p-3 rounded-lg border-2 border-emerald-200">
            <p className="text-xs text-emerald-700 font-semibold uppercase">Income</p>
            <p className="text-2xl font-bold text-emerald-900">{stats.income}</p>
          </div>
          <div className="bg-red-50 p-3 rounded-lg border-2 border-red-200">
            <p className="text-xs text-red-700 font-semibold uppercase">Expense</p>
            <p className="text-2xl font-bold text-red-900">{stats.expense}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border-2 border-gray-200">
            <p className="text-xs text-gray-700 font-semibold uppercase">Transfer</p>
            <p className="text-2xl font-bold text-gray-900">{stats.transfer}</p>
          </div>
          <div className="bg-yellow-50 p-3 rounded-lg border-2 border-yellow-200">
            <p className="text-xs text-yellow-700 font-semibold uppercase">Unclassified</p>
            <p className="text-2xl font-bold text-yellow-900">{stats.unclassified}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-4">
          {(['all', 'income', 'expense', 'transfer', 'unclassified'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filterType === type
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg flex items-center justify-between">
            <p className="text-blue-900 font-semibold">
              {selectedIds.size} transaction{selectedIds.size !== 1 ? 's' : ''} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkUpdate({ type: 'income' })}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
              >
                Mark as Income
              </button>
              <button
                onClick={() => handleBulkUpdate({ type: 'expense' })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Mark as Expense
              </button>
              <button
                onClick={() => handleBulkUpdate({ type: 'transfer' })}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors"
              >
                Mark as Transfer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left p-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4"
                />
              </th>
              <th className="text-left p-3 text-sm font-semibold text-gray-700">Date</th>
              <th className="text-left p-3 text-sm font-semibold text-gray-700">Description</th>
              <th className="text-right p-3 text-sm font-semibold text-gray-700">Amount</th>
              <th className="text-left p-3 text-sm font-semibold text-gray-700">Type</th>
              <th className="text-left p-3 text-sm font-semibold text-gray-700">Category</th>
              <th className="text-left p-3 text-sm font-semibold text-gray-700">Actions</th>
              <th className="text-left p-3 text-sm font-semibold text-gray-700"></th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(tx => {
              const matches = findMatchingPatterns(tx, patterns);
              const bestMatch = matches[0];
              
              // If no category set but we have a high-confidence match, suggest it
              const suggestedCategory = !tx.category && bestMatch && bestMatch.confidence >= 70
                ? bestMatch.pattern.category
                : null;

              return (
                <tr
                  key={tx.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="p-3 text-sm text-gray-700">{formatDate(tx.date)}</td>
                  <td className="p-3 text-sm text-gray-900 font-medium">{tx.description}</td>
                  <td className="p-3 text-sm text-right font-semibold">
                    <span className={tx.isDebit ? 'text-red-900' : 'text-emerald-900'}>
                      {tx.isDebit ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </td>
                  <td className="p-3">
                    <select
                      value={tx.type}
                      onChange={(e) => onTransactionUpdate(tx.id, { type: e.target.value as Transaction['type'] })}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border-2 ${getTypeColor(tx.type)}`}
                    >
                      <option value="unclassified">Unclassified</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </td>
                  <td className="p-3 relative">
                    <div className="relative">
                      <input
                        ref={(el) => {
                          categoryInputRefs.current[tx.id] = el;
                        }}
                        type="text"
                        value={categoryInputs[tx.id] ?? tx.category ?? suggestedCategory ?? ''}
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        onClick={() => handleCategoryClick(tx.id)}
                        onFocus={() => handleCategoryClick(tx.id)}
                        onBlur={() => handleCategoryBlur(tx.id)}
                        onKeyDown={(e) => handleCategoryKeyDown(tx.id, e)}
                        placeholder={bestMatch && !suggestedCategory ? `Suggested: ${bestMatch.pattern.category}` : 'Category'}
                        className={`px-3 py-1 border rounded-lg text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                          suggestedCategory ? 'border-blue-400 bg-blue-50' : 'border-gray-300'
                        }`}
                      />
                      {/* Dropdown arrow indicator */}
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      {/* Autocomplete suggestions dropdown */}
                      {(isDropdownOpen[tx.id] || editingCategoryId === tx.id) && categorySuggestions[tx.id] && categorySuggestions[tx.id].length > 0 && (
                        <div 
                          className="absolute z-10 mt-1 w-48 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent blur when clicking dropdown
                          }}
                        >
                          {categorySuggestions[tx.id].map((suggestion, index) => {
                            const isSelected = selectedSuggestionIndex[tx.id] === index;
                            return (
                              <button
                                key={suggestion}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur
                                  selectSuggestion(tx.id, suggestion);
                                }}
                                onMouseEnter={() => setSelectedSuggestionIndex(prev => ({ ...prev, [tx.id]: index }))}
                                className={`w-full text-left px-3 py-2 text-sm focus:outline-none transition-colors ${
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
                    </div>
                    {categoryInputs[tx.id] && categoryInputs[tx.id] !== tx.category && (
                      <span className="text-xs text-gray-500 mt-1 block">Press Enter to save</span>
                    )}
                  </td>
                  <td className="p-3">
                    {bestMatch && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-600 font-medium">
                          {bestMatch.confidence}% match
                        </span>
                        {!tx.category && !suggestedCategory && (
                          <button
                            onClick={() => {
                              onTransactionUpdate(tx.id, {
                                category: bestMatch.pattern.category,
                                type: bestMatch.pattern.type,
                              });
                            }}
                            className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded hover:bg-blue-600 transition-colors"
                            title={`Accept suggestion: ${bestMatch.pattern.category} (${bestMatch.pattern.type})`}
                          >
                            ✓ Accept
                          </button>
                        )}
                        {suggestedCategory && (
                          <span className="text-xs text-emerald-600 font-medium">
                            ✓ Auto-filled
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => confirmDelete(() => onTransactionDelete(tx.id), 'Are you sure you want to delete this transaction?')}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-all"
                      title="Delete transaction"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="mt-6 flex gap-4 justify-end">
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transition-all"
        >
          Import Transactions ({transactions.filter(tx => tx.type !== 'transfer' && tx.type !== 'unclassified').length})
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDialog}
        title="Delete Transaction"
        message={deleteMessage}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onDontAskAgain={handleDontAskAgain}
      />
    </div>
  );
};

