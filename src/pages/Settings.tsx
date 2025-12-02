import { useState } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { exportData, importData, clearData } from '../utils/storage';

export const Settings = () => {
  const { household, setHousehold, reset } = useHouseholdStore();
  const [householdName, setHouseholdName] = useState(household?.name || '');
  const [newOwner, setNewOwner] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const handleSaveHousehold = () => {
    if (!household) return;
    console.log('[Settings] Saving household:', householdName);
    setHousehold({
      ...household,
      name: householdName,
    });
    alert('Household name saved!');
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
            <button
              onClick={handleSaveHousehold}
              className="mt-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              💾 Save Name
            </button>
          </div>
        </div>
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

