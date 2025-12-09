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
    // DCPP-specific fields
    dcppEmployerMatchPercentage?: number; // Employer match percentage as decimal (e.g., 0.50 for 50% match)
    // RESP-specific fields
    respContributionRoomUsed?: number; // Amount of contribution room already used (default: 2500)
    respHandoffYear?: number; // Year to hand off RESP to child (account goes to 0)
    respChildBirthYear?: number; // Child's birth year (for calculating age in handoff year)
    // Mortgage-specific fields
    mortgagePrincipal?: number;
    mortgageInterestRate?: number; // Annual rate as decimal (e.g., 0.05 for 5%)
    mortgageAmortizationYears?: number;
    mortgageAmortizationMonths?: number;
    mortgagePaymentAmount?: number;
    mortgagePaymentFrequency?: 'monthly' | 'weekly' | 'accelerated_biweekly';
    [key: string]: any;
  };
};

export type RetirementYears = {
  [ownerName: string]: number; // Retirement year for each owner
};

export type OwnerAges = {
  [ownerName: string]: number; // Current age for each owner
};

const RETIREMENT_YEARS_STORAGE_KEY = 'grouse-retirement-years';
const OWNER_AGES_STORAGE_KEY = 'grouse-owner-ages';

export const saveRetirementYears = (retirementYears: RetirementYears): void => {
  try {
    localStorage.setItem(RETIREMENT_YEARS_STORAGE_KEY, JSON.stringify(retirementYears));
  } catch (error) {
    console.error('[storage] saveRetirementYears: error saving retirement years', error);
    // Don't throw - just log the error to prevent blocking
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

export const saveOwnerAges = (ownerAges: OwnerAges): void => {
  try {
    localStorage.setItem(OWNER_AGES_STORAGE_KEY, JSON.stringify(ownerAges));
  } catch (error) {
    console.error('[storage] saveOwnerAges: error saving owner ages', error);
    // Don't throw - just log the error to prevent blocking
  }
};

export const loadOwnerAges = (): OwnerAges | null => {
  try {
    const stored = localStorage.getItem(OWNER_AGES_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as OwnerAges;
  } catch (error) {
    console.error('[storage] loadOwnerAges: error loading owner ages', error);
    return null;
  }
};

// Projection settings storage functions
const PROJECTION_SETTINGS_STORAGE_KEY = 'grouse-projection-settings';

export type ProjectionSettings = {
  endOfPlanYear?: number;
  inflationRate?: number; // Stored as decimal (e.g., 0.02 for 2%)
};

export const saveProjectionSettings = (settings: ProjectionSettings): void => {
  try {
    localStorage.setItem(PROJECTION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('[storage] saveProjectionSettings: error saving projection settings', error);
    // Don't throw - just log the error to prevent blocking
  }
};

export const loadProjectionSettings = (): ProjectionSettings | null => {
  try {
    const stored = localStorage.getItem(PROJECTION_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as ProjectionSettings;
  } catch (error) {
    console.error('[storage] loadProjectionSettings: error loading projection settings', error);
    return null;
  }
};

// Income storage functions
const INCOMES_STORAGE_KEY = 'grouse-projection-incomes';

export type Income = {
  id: string;
  name: string;
  annualAmount: number;
  owner: string;
  growthRate?: number; // Annual growth rate as decimal (e.g., 0.03 for 3%)
  startDate?: number | 'now' | 'retirement'; // Year to start, 'now', or 'retirement'
  endDate?: number | 'retirement'; // Year to end, or 'retirement'
};

export type Incomes = {
  [incomeId: string]: Income;
};

export const saveIncomes = (incomes: Incomes): void => {
  try {
    localStorage.setItem(INCOMES_STORAGE_KEY, JSON.stringify(incomes));
  } catch (error) {
    console.error('[storage] saveIncomes: error saving incomes', error);
    // Don't throw - just log the error to prevent blocking
  }
};

export const loadIncomes = (): Incomes | null => {
  try {
    const stored = localStorage.getItem(INCOMES_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as Incomes;
  } catch (error) {
    console.error('[storage] loadIncomes: error loading incomes', error);
    return null;
  }
};

// Expense storage functions
const EXPENSES_STORAGE_KEY = 'grouse-projection-expenses';

export type Expense = {
  id: string;
  name: string;
  annualAmount: number;
  owner: string;
  growthRate?: number; // Annual growth rate as decimal (e.g., 0.03 for 3%)
  startDate?: number | 'now' | 'retirement'; // Year to start, 'now', or 'retirement'
  endDate?: number | 'retirement'; // Year to end, or 'retirement'
};

export type Expenses = {
  [expenseId: string]: Expense;
};

export const saveExpenses = (expenses: Expenses): void => {
  try {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
  } catch (error) {
    console.error('[storage] saveExpenses: error saving expenses', error);
    // Don't throw - just log the error to prevent blocking
  }
};

export const loadExpenses = (): Expenses | null => {
  try {
    const stored = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    return JSON.parse(stored) as Expenses;
  } catch (error) {
    console.error('[storage] loadExpenses: error loading expenses', error);
    return null;
  }
};

export const saveProjectionInputs = (inputs: ProjectionInputs): void => {
  try {
    localStorage.setItem(PROJECTION_INPUTS_STORAGE_KEY, JSON.stringify(inputs));
  } catch (error) {
    console.error('[storage] saveProjectionInputs: error saving projection inputs', error);
    // Don't throw - just log the error to prevent blocking
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

