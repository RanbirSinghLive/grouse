import type { AppData, ImportData, ProjectionScenario } from '../types/models';

const STORAGE_KEY = 'grouse-app-data';
const IMPORT_STORAGE_KEY = 'grouse-import-data';
const PROJECTION_STORAGE_KEY = 'grouse-projection-data';

export const saveData = (data: AppData): void => {
  console.log('[storage] saveData: saving data to localStorage');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    console.log('[storage] saveData: data saved successfully');
  } catch (error) {
    console.error('[storage] saveData: error saving data', error);
    throw new Error('Failed to save data to localStorage');
  }
};

export const loadData = (): AppData | null => {
  console.log('[storage] loadData: loading data from localStorage');
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('[storage] loadData: no data found in localStorage');
      return null;
    }
    const data = JSON.parse(stored) as AppData;
    console.log('[storage] loadData: data loaded successfully', data);
    return data;
  } catch (error) {
    console.error('[storage] loadData: error loading data', error);
    return null;
  }
};

export const exportData = (): string => {
  console.log('[storage] exportData: exporting data');
  const data = loadData();
  if (!data) {
    console.log('[storage] exportData: no data to export');
    return JSON.stringify({ household: null, accounts: [], cashflows: [] }, null, 2);
  }
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): AppData => {
  console.log('[storage] importData: importing data');
  try {
    const data = JSON.parse(jsonString) as AppData;
    console.log('[storage] importData: data parsed successfully', data);
    return data;
  } catch (error) {
    console.error('[storage] importData: error parsing JSON', error);
    throw new Error('Invalid JSON format');
  }
};

export const clearData = (): void => {
  console.log('[storage] clearData: clearing all data from localStorage');
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMPORT_STORAGE_KEY);
    console.log('[storage] clearData: data cleared successfully');
  } catch (error) {
    console.error('[storage] clearData: error clearing data', error);
    throw new Error('Failed to clear data from localStorage');
  }
};

// Import data storage functions
export const saveImportData = (data: ImportData): void => {
  console.log('[storage] saveImportData: saving import data to localStorage');
  try {
    localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(data));
    console.log('[storage] saveImportData: import data saved successfully');
  } catch (error) {
    console.error('[storage] saveImportData: error saving import data', error);
    throw new Error('Failed to save import data to localStorage');
  }
};

export const loadImportData = (): ImportData | null => {
  console.log('[storage] loadImportData: loading import data from localStorage');
  try {
    const stored = localStorage.getItem(IMPORT_STORAGE_KEY);
    if (!stored) {
      console.log('[storage] loadImportData: no import data found in localStorage');
      return null;
    }
    const data = JSON.parse(stored) as ImportData;
    console.log('[storage] loadImportData: import data loaded successfully', data);
    return data;
  } catch (error) {
    console.error('[storage] loadImportData: error loading import data', error);
    return null;
  }
};

// Projection data storage functions
export const saveProjectionData = (scenarios: ProjectionScenario[]): void => {
  console.log('[storage] saveProjectionData: saving projection data to localStorage');
  try {
    localStorage.setItem(PROJECTION_STORAGE_KEY, JSON.stringify(scenarios));
    console.log('[storage] saveProjectionData: projection data saved successfully');
  } catch (error) {
    console.error('[storage] saveProjectionData: error saving projection data', error);
    throw new Error('Failed to save projection data to localStorage');
  }
};

export const loadProjectionData = (): ProjectionScenario[] | null => {
  console.log('[storage] loadProjectionData: loading projection data from localStorage');
  try {
    const stored = localStorage.getItem(PROJECTION_STORAGE_KEY);
    if (!stored) {
      console.log('[storage] loadProjectionData: no projection data found in localStorage');
      return null;
    }
    const data = JSON.parse(stored) as ProjectionScenario[];
    console.log('[storage] loadProjectionData: projection data loaded successfully', data);
    return data;
  } catch (error) {
    console.error('[storage] loadProjectionData: error loading projection data', error);
    return null;
  }
};

