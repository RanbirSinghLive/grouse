// Core data models for Grouse personal finance app

export type Household = {
  id: string;
  name: string;
  province?: string; // Optional, non-functional in v0.1
  owners?: string[]; // List of owners/people (e.g., ["Person 1", "Person 2", "Joint"])
};

export type Holding = {
  id: string;
  accountId: string;
  ticker: string; // e.g., "VTI", "XEQT.TO", "CASH"
  shares: number; // Number of shares owned
  currentPrice: number; // Current price per share (manual entry or API-fetched)
  currency: 'CAD' | 'USD';
  lastPriceUpdate?: string; // ISO timestamp of last price update
};

export type Account = {
  id: string;
  householdId: string;
  name: string;
  kind: 'asset' | 'liability';
  type: 'cash' | 'chequing' | 'tfsa' | 'rrsp' | 'dcpp' | 'resp' | 'non_registered' |
        'primary_home' | 'rental_property' | 'mortgage' | 'loan' | 'credit_card';
  balance: number; // Manual balance OR calculated from holdings if useHoldings=true
  currency: 'CAD' | 'USD'; // CAD-only experience in v0.1, but field kept in model
  interestRate?: number;
  owner?: string; // Owner of the account (e.g., "Person 1", "Person 2", "Joint", "Household")
  useHoldings?: boolean; // If true, calculate balance from holdings; if false, use manual balance
  holdings?: Holding[]; // Holdings for investment accounts (TFSA, RRSP, DCPP, RESP, non_registered)
  // Mortgage-specific fields for projections
  monthlyPayment?: number; // Monthly payment amount
  termRemainingMonths?: number; // Remaining term in months
  updatedAt: string;
};

export type Cashflow = {
  id: string;
  householdId: string;
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'biweekly' | 'weekly' | 'annual';
  owner?: string; // Owner of the income/expense (e.g., "Person 1", "Person 2", "Joint", "Household")
  sourceAccountId?: string; // Optional, mostly ignored in v0.1 logic
  targetAccountId?: string; // Optional, mostly ignored in v0.1 logic
  startDate?: string;
  endDate?: string;
};

export type Transaction = {
  id: string;
  householdId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Always positive
  isDebit: boolean; // True for expense, false for income/credit
  rawData: Record<string, string>; // Original CSV row data
  type: 'income' | 'expense' | 'transfer' | 'unclassified'; // User-classified type
  category?: string;
  owner?: string;
  fingerprint: string; // For duplicate detection
  importedAt: string; // When it was imported
  sourceFile?: string; // Original CSV file name
};

export type TransactionPattern = {
  id: string;
  householdId: string;
  descriptionKeywords: string[]; // Keywords extracted from transaction description
  type: 'income' | 'expense' | 'transfer';
  category: string;
  owner?: string;
  confidence: number; // 0-100, how confident the pattern is
  matchCount: number; // How many times this pattern has been successfully applied
  lastUsed: string; // ISO date of last use
  userConfirmed?: boolean; // True if user explicitly confirmed this pattern
  userRejected?: boolean; // True if user explicitly rejected this pattern
  amountRange?: { // Optional amount range for pattern matching
    min?: number;
    max?: number;
  };
  isDebit?: boolean; // For pattern matching against transaction isDebit flag
};

export type ImportSession = {
  id: string;
  householdId: string;
  fileName: string;
  importedAt: string;
  transactions: Transaction[]; // All transactions from this import
  status: 'pending' | 'completed' | 'cancelled';
};

export type AppData = {
  household: Household | null;
  accounts: Account[];
  cashflows: Cashflow[];
};

export type ImportData = {
  transactions: Transaction[];
  patterns: TransactionPattern[];
  importHistory?: ImportSession[];
};

// Helper to check if account type supports holdings
export const isInvestmentAccount = (accountType: Account['type']): boolean => {
  return ['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered'].includes(accountType);
};

// Helper to check if account is a mortgage
export const isMortgage = (accountType: Account['type']): boolean => {
  return accountType === 'mortgage';
};

