import type { AppData, ImportData } from '../types/models';

const STORAGE_KEY = 'grouse-app-data';
const IMPORT_STORAGE_KEY = 'grouse-import-data';

export const saveData = (data: AppData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[storage] saveData: error saving data', error);
    throw new Error('Failed to save data to localStorage');
  }
};

export const loadData = (): AppData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const data = JSON.parse(stored) as AppData;
    return data;
  } catch (error) {
    console.error('[storage] loadData: error loading data', error);
    return null;
  }
};

export const exportData = (): string => {
  const data = loadData();
  if (!data) {
    return JSON.stringify({ household: null, accounts: [], cashflows: [] }, null, 2);
  }
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): AppData => {
  try {
    const data = JSON.parse(jsonString) as AppData;
    return data;
  } catch (error) {
    console.error('[storage] importData: error parsing JSON', error);
    throw new Error('Invalid JSON format');
  }
};

export const clearData = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMPORT_STORAGE_KEY);
  } catch (error) {
    console.error('[storage] clearData: error clearing data', error);
    throw new Error('Failed to clear data from localStorage');
  }
};

// Import data storage functions
export const saveImportData = (data: ImportData): void => {
  try {
    localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[storage] saveImportData: error saving import data', error);
    throw new Error('Failed to save import data to localStorage');
  }
};

export const loadImportData = (): ImportData | null => {
  try {
    const stored = localStorage.getItem(IMPORT_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const data = JSON.parse(stored) as ImportData;
    return data;
  } catch (error) {
    console.error('[storage] loadImportData: error loading import data', error);
    return null;
  }
};

// Budget note storage functions
const BUDGET_NOTE_STORAGE_KEY = 'grouse-budget-note';

export const saveBudgetNote = (note: string): void => {
  try {
    localStorage.setItem(BUDGET_NOTE_STORAGE_KEY, JSON.stringify(note));
  } catch (error) {
    console.error('[storage] saveBudgetNote: error saving budget note', error);
    throw new Error('Failed to save budget note to localStorage');
  }
};

export const loadBudgetNote = (): string | null => {
  try {
    const stored = localStorage.getItem(BUDGET_NOTE_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as string;
  } catch (error) {
    console.error('[storage] loadBudgetNote: error loading budget note', error);
    return null;
  }
};

// Projection inputs storage functions
const PROJECTION_INPUTS_STORAGE_KEY = 'grouse-projection-inputs';

export type ProjectionInputs = {
  [accountId: string]: {
    annualContribution?: number;
    annualInvestmentGrowth?: number;
    contributeUntilYear?: number | 'retirement'; // Year to stop contributions, or 'retirement'
    [key: string]: any;
  };
};

export type RetirementYears = {
  [ownerName: string]: number; // Retirement year for each owner
};

const RETIREMENT_YEARS_STORAGE_KEY = 'grouse-retirement-years';

export const saveRetirementYears = (retirementYears: RetirementYears): void => {
  try {
    localStorage.setItem(RETIREMENT_YEARS_STORAGE_KEY, JSON.stringify(retirementYears));
  } catch (error) {
    console.error('[storage] saveRetirementYears: error saving retirement years', error);
    throw new Error('Failed to save retirement years to localStorage');
  }
};

export const loadRetirementYears = (): RetirementYears | null => {
  try {
    const stored = localStorage.getItem(RETIREMENT_YEARS_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as RetirementYears;
  } catch (error) {
    console.error('[storage] loadRetirementYears: error loading retirement years', error);
    return null;
  }
};

export const saveProjectionInputs = (inputs: ProjectionInputs): void => {
  try {
    localStorage.setItem(PROJECTION_INPUTS_STORAGE_KEY, JSON.stringify(inputs));
  } catch (error) {
    console.error('[storage] saveProjectionInputs: error saving projection inputs', error);
    throw new Error('Failed to save projection inputs to localStorage');
  }
};

export const loadProjectionInputs = (): ProjectionInputs | null => {
  try {
    const stored = localStorage.getItem(PROJECTION_INPUTS_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as ProjectionInputs;
  } catch (error) {
    console.error('[storage] loadProjectionInputs: error loading projection inputs', error);
    return null;
  }
};

