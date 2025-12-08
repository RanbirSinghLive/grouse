import { useState, useEffect, useMemo } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { exportData, importData, clearData } from '../utils/storage';
import { getAllProvinces, getProvinceName, type Province } from '../utils/canadianTaxRates';
import { calcMonthlyExpensesFromTransactions } from '../utils/calculations';

export const Settings = () => {
  const { household, setHousehold, reset, cashflows, transactions, patterns, renameCategory } = useHouseholdStore();
  const [householdName, setHouseholdName] = useState(household?.name || '');
  const [householdProvince, setHouseholdProvince] = useState<Province | ''>(household?.province || '');
  const [financialIndependenceYears, setFinancialIndependenceYears] = useState(household?.financialIndependenceYears || 25);
  const [newOwner, setNewOwner] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryEditValue, setCategoryEditValue] = useState<string>('');
  
  // Owners management (replaces person profiles)
  const [owners, setOwners] = useState<string[]>(household?.owners || ['Ranbir', 'Joint', 'Household']);

  // Get all unique categories from transactions, patterns, and cashflows
  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    cashflows.forEach(cf => {
      if (cf.category) categories.add(cf.category);
    });
    transactions.forEach(tx => {
      if (tx.category) categories.add(tx.category);
    });
    patterns.forEach(p => {
      if (p.category) categories.add(p.category);
    });
    return Array.from(categories).sort();
  }, [cashflows, transactions, patterns]);

  // Update household name and province when household changes
  useEffect(() => {
    setHouseholdName(household?.name || '');
    setHouseholdProvince(household?.province || '');
    setFinancialIndependenceYears(household?.financialIndependenceYears || 25);
    // Initialize owners from household, or default to Ranbir
    if (household?.owners && household.owners.length > 0) {
      setOwners(household.owners);
    } else {
      // Migration: if personProfiles exist (legacy data), convert to owners
      if ((household as any)?.personProfiles) {
        const personProfiles = (household as any).personProfiles;
        const migratedOwners: string[] = [];
        if (personProfiles.person1?.nickname?.trim()) {
          migratedOwners.push(personProfiles.person1.nickname.trim());
        } else {
          migratedOwners.push('Ranbir');
        }
        if (personProfiles.person2?.nickname?.trim()) {
          migratedOwners.push(personProfiles.person2.nickname.trim());
        }
        migratedOwners.push('Joint', 'Household');
        setOwners(migratedOwners);
        // Remove personProfiles
        const { personProfiles: _, ...householdWithoutProfiles } = household as any;
        setHousehold({ ...householdWithoutProfiles, owners: migratedOwners });
      } else {
        setOwners(['Ranbir', 'Joint', 'Household']);
      }
    }
  }, [household, setHousehold]);
  
  const handleSaveOwners = () => {
    if (!household) return;
    // Filter out empty names and ensure Joint/Household are included
    const validOwners = owners.filter(o => o.trim() && o.trim() !== 'Joint' && o.trim() !== 'Household');
    validOwners.push('Joint', 'Household');
    
    setHousehold({
      ...household,
      owners: validOwners,
    });
    console.log('[Settings] Owners saved:', validOwners);
    alert('Owners saved!');
  };

  const handleAddOwner = () => {
    setOwners([...owners, '']);
  };

  const handleRemoveOwner = (index: number) => {
    const ownerName = owners[index];
    if (ownerName === 'Joint' || ownerName === 'Household') {
      alert('Cannot remove Joint or Household options');
      return;
    }
    if (window.confirm(`Are you sure you want to remove "${ownerName}"?`)) {
      setOwners(owners.filter((_, i) => i !== index));
    }
  };

  const handleUpdateOwner = (index: number, value: string) => {
    const newOwners = [...owners];
    newOwners[index] = value;
    setOwners(newOwners);
  };

  const handleStartEditCategory = (category: string) => {
    setEditingCategory(category);
    setCategoryEditValue(category);
  };

  const handleSaveCategory = (oldName: string) => {
    const newName = categoryEditValue.trim();
    if (!newName || newName === oldName) {
      setEditingCategory(null);
      return;
    }
    
    // Check if new name already exists
    if (allCategories.includes(newName)) {
      alert(`Category "${newName}" already exists!`);
      return;
    }

    console.log('[Settings] Renaming category:', oldName, '->', newName);
    renameCategory(oldName, newName);
    setEditingCategory(null);
    setCategoryEditValue('');
  };

  const handleCancelEditCategory = () => {
    setEditingCategory(null);
    setCategoryEditValue('');
  };

  const handleSaveHousehold = () => {
    if (!household) return;
    console.log('[Settings] Saving household:', householdName, 'province:', householdProvince, 'FI years:', financialIndependenceYears);
    setHousehold({
      ...household,
      name: householdName,
      province: householdProvince || undefined,
      financialIndependenceYears: financialIndependenceYears || undefined,
    });
    alert('Household information saved!');
  };

  const handleAddOwner = () => {
    if (!newOwner.trim() || !household) return;
    const owners = household.owners || [];
    if (owners.includes(newOwner.trim())) {
      alert('Owner already exists!');
      return;
    }
    console.log('[Settings] Adding owner:', newOwner);
    setHousehold({
      ...household,
      owners: [...owners, newOwner.trim()],
    });
    setNewOwner('');
  };

  const handleRemoveOwner = (owner: string) => {
    if (!household) return;
    const owners = household.owners || [];
    console.log('[Settings] Removing owner:', owner);
    setHousehold({
      ...household,
      owners: owners.filter(o => o !== owner),
    });
  };

  const handleExport = () => {
    console.log('[Settings] Exporting data');
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grouse-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importFile) return;
    console.log('[Settings] Importing data');
    try {
      const text = await importFile.text();
      importData(text);
      // Import will be handled by resetting the store
      if (window.confirm('This will replace all current data. Are you sure?')) {
        reset();
        // Note: In a real app, you'd want to properly import the data into the store
        // For now, we'll just show an alert
        alert('Import functionality needs to be connected to the store. Data loaded but not applied.');
      }
    } catch (error) {
      console.error('[Settings] Import error:', error);
      alert('Error importing data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset all data? This cannot be undone!')) {
      console.log('[Settings] Resetting all data');
      clearData();
      reset();
      alert('All data has been reset.');
    }
  };

  console.log('[Settings] Rendering');

  // Calculate financial independence target if we have expense data
  const monthlyExpenses = useMemo(() => {
    return calcMonthlyExpensesFromTransactions(transactions);
  }, [transactions]);
  
  const annualExpenses = monthlyExpenses * 12;
  const fiTarget = annualExpenses > 0 ? annualExpenses * financialIndependenceYears : 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      {/* Household Info */}
      <div className="bg-gradient-to-br from-white to-blue-50 p-8 rounded-2xl shadow-lg border-2 border-blue-200 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-2xl">🏠</span>
          Household Information
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Household Name
            </label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Province/Territory (for tax calculations)
            </label>
            <select
              value={householdProvince}
              onChange={(e) => setHouseholdProvince(e.target.value as Province | '')}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="">Select province...</option>
              {getAllProvinces().map(province => (
                <option key={province} value={province}>
                  {getProvinceName(province)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Used for accurate tax calculations in projections
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Financial Independence Target (Years of Expenses)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={financialIndependenceYears}
              onChange={(e) => setFinancialIndependenceYears(parseInt(e.target.value) || 25)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
            <p className="mt-1 text-xs text-gray-500">
              Net worth target = annual expenses × this number (e.g., 25x = 25 years of expenses)
            </p>
            {fiTarget > 0 && (
              <p className="mt-2 text-sm font-medium text-blue-700">
                Target: ${fiTarget.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} 
                ({financialIndependenceYears} years × ${annualExpenses.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/year)
              </p>
            )}
          </div>
          <button
            onClick={handleSaveHousehold}
            className="mt-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            💾 Save Household Info
          </button>
        </div>
      </div>

      {/* Owners Management */}
      <div id="person-profiles" className="bg-gradient-to-br from-white to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-purple-200 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-2xl">👥</span>
          Owners
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Manage the people in your household. These names will be used as account owners throughout the app. "Joint" and "Household" are always available.
        </p>
        <div className="space-y-3">
          {owners.map((owner, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={owner}
                onChange={(e) => handleUpdateOwner(index, e.target.value)}
                placeholder="Owner name"
                disabled={owner === 'Joint' || owner === 'Household'}
                className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  owner === 'Joint' || owner === 'Household' ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {(owner !== 'Joint' && owner !== 'Household') && (
                <button
                  onClick={() => handleRemoveOwner(index)}
                  className="px-4 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            onClick={handleAddOwner}
            className="w-full px-6 py-3 bg-purple-100 text-purple-700 rounded-lg font-semibold hover:bg-purple-200 transition-colors"
          >
            ➕ Add Owner
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={handleSaveOwners}
            className="px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 transition-all"
          >
            💾 Save Owners
          </button>
        </div>
      </div>

      {/* Category Management */}
      <div className="bg-gradient-to-br from-white to-orange-50 p-8 rounded-2xl shadow-lg border-2 border-orange-200 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-2xl">🏷️</span>
          Category Management
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Edit category names. Changes will be applied to all transactions, patterns, and cashflows using that category.
        </p>
        {allCategories.length === 0 ? (
          <p className="text-gray-500 italic">No categories found. Categories will appear here once you start tagging transactions or creating cashflows.</p>
        ) : (
          <div className="space-y-2">
            {allCategories.map((category) => {
              const isEditing = editingCategory === category;
              // Count usage
              const transactionCount = transactions.filter(tx => tx.category === category).length;
              const patternCount = patterns.filter(p => p.category === category).length;
              const cashflowCount = cashflows.filter(cf => cf.category === category).length;
              const totalCount = transactionCount + patternCount + cashflowCount;

              return (
                <div
                  key={category}
                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 hover:border-orange-300 transition-colors"
                >
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={categoryEditValue}
                        onChange={(e) => setCategoryEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveCategory(category);
                          } else if (e.key === 'Escape') {
                            handleCancelEditCategory();
                          }
                        }}
                        className="flex-1 px-3 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                        autoFocus
                      />
                      <div className="flex gap-2 ml-2">
                        <button
                          onClick={() => handleSaveCategory(category)}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                        >
                          ✓ Save
                        </button>
                        <button
                          onClick={handleCancelEditCategory}
                          className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-sm font-semibold hover:bg-gray-600 transition-colors"
                        >
                          ✕ Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{category}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({totalCount} {totalCount === 1 ? 'entry' : 'entries'}: {transactionCount} transaction{transactionCount !== 1 ? 's' : ''}, {patternCount} pattern{patternCount !== 1 ? 's' : ''}, {cashflowCount} cashflow{cashflowCount !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <button
                        onClick={() => handleStartEditCategory(category)}
                        className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Owners Management */}
      <div className="bg-gradient-to-br from-white to-purple-50 p-8 rounded-2xl shadow-lg border-2 border-purple-200 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-2xl">👥</span>
          Owners
        </h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddOwner()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter owner name (e.g., Person 1, Person 2, Joint)"
            />
            <button
              onClick={handleAddOwner}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-purple-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              ➕ Add Owner
            </button>
          </div>
          {household?.owners && household.owners.length > 0 && (
            <div className="space-y-2">
              {household.owners.map((owner) => (
                <div key={owner} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span>{owner}</span>
                  <button
                    onClick={() => handleRemoveOwner(owner)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Export/Import */}
      <div className="bg-gradient-to-br from-white to-emerald-50 p-8 rounded-2xl shadow-lg border-2 border-emerald-200 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-2xl">💾</span>
          Data Management
        </h2>
        <div className="space-y-4">
          <div>
            <button
              onClick={handleExport}
              className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              📥 Export Data (JSON)
            </button>
          </div>
          <div>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="mb-2"
            />
            <button
              onClick={handleImport}
              disabled={!importFile}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none"
            >
              📤 Import Data (JSON)
            </button>
          </div>
        </div>
      </div>

      {/* Reset */}
      <div className="bg-gradient-to-br from-red-50 to-red-100 p-8 rounded-2xl shadow-lg border-2 border-red-300">
        <h2 className="text-xl font-bold mb-6 text-red-700 flex items-center gap-2">
          <span className="text-2xl">⚠️</span>
          Danger Zone
        </h2>
        <button
          onClick={handleReset}
          className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
        >
          ⚠️ Reset All Data
        </button>
      </div>
    </div>
  );
};

