import type { AppData } from '../types/models';

const STORAGE_KEY = 'grouse-app-data';

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
    console.log('[storage] clearData: data cleared successfully');
  } catch (error) {
    console.error('[storage] clearData: error clearing data', error);
    throw new Error('Failed to clear data from localStorage');
  }
};

