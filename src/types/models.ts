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
  currentPrice: number; // Current price per share (manual entry in Phase 1)
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
  holdings?: Holding[]; // Holdings for investment accounts
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

export type AppData = {
  household: Household | null;
  accounts: Account[];
  cashflows: Cashflow[];
};

// Helper to check if account type supports holdings
export const isInvestmentAccount = (accountType: Account['type']): boolean => {
  return ['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered'].includes(accountType);
};

