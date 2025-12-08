import { useState, useEffect, useMemo } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import type { Transaction } from '../types/models';

export const DataCutoffNote = () => {
  const { transactions, budgetNote, setBudgetNote } = useHouseholdStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(budgetNote);

  // Update editValue when budgetNote changes externally
  useEffect(() => {
    setEditValue(budgetNote);
  }, [budgetNote]);

  // Calculate data cut-off dates
  const dataCutoff = useMemo(() => {
    if (transactions.length === 0) {
      return null;
    }

    const dates = transactions
      .map(tx => tx.date)
      .filter((date): date is string => Boolean(date))
      .sort();

    if (dates.length === 0) {
      return null;
    }

    const earliest = dates[0];
    const latest = dates[dates.length - 1];

    return {
      earliest,
      latest,
      count: transactions.length,
    };
  }, [transactions]);

  const handleSave = () => {
    setBudgetNote(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(budgetNote);
    setIsEditing(false);
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-6 mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Data Cut-off Note</h3>
            {dataCutoff && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {dataCutoff.count} transactions • {formatDate(dataCutoff.earliest)} - {formatDate(dataCutoff.latest)}
              </span>
            )}
          </div>
          
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Add a note about the current data cut-off..."
                className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {budgetNote ? (
                <p className="text-gray-700 whitespace-pre-wrap">{budgetNote}</p>
              ) : (
                <p className="text-gray-400 italic">No note added. Click edit to add a note about the current data cut-off.</p>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {budgetNote ? 'Edit' : 'Add note'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};




