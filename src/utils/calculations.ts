import type { Account, Cashflow } from '../types/models';

// Normalize any frequency to monthly amount
export const normalizeMonthly = (amount: number, frequency: Cashflow['frequency']): number => {
  console.log('[calculations] normalizeMonthly:', amount, frequency);
  switch (frequency) {
    case 'monthly':
      return amount;
    case 'biweekly':
      return amount * (52 / 12 / 2); // ~2.167
    case 'weekly':
      return amount * (52 / 12); // ~4.333
    case 'annual':
      return amount / 12;
    default:
      return amount;
  }
};

// Calculate net worth from accounts
export const calcNetWorth = (accounts: Account[]): number => {
  console.log('[calculations] calcNetWorth: processing', accounts.length, 'accounts');
  const assets = accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0);
  const liabilities = accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);
  const netWorth = assets - liabilities;
  console.log('[calculations] calcNetWorth: assets=', assets, 'liabilities=', liabilities, 'netWorth=', netWorth);
  return netWorth;
};

// Calculate total monthly income
export const calcMonthlyIncome = (flows: Cashflow[]): number => {
  console.log('[calculations] calcMonthlyIncome: processing', flows.length, 'cashflows');
  const income = flows
    .filter(f => f.type === 'income')
    .reduce((sum, f) => sum + normalizeMonthly(f.amount, f.frequency), 0);
  console.log('[calculations] calcMonthlyIncome: result =', income);
  return income;
};

// Calculate total monthly expenses
export const calcMonthlyExpenses = (flows: Cashflow[]): number => {
  console.log('[calculations] calcMonthlyExpenses: processing', flows.length, 'cashflows');
  const expenses = flows
    .filter(f => f.type === 'expense')
    .reduce((sum, f) => sum + normalizeMonthly(f.amount, f.frequency), 0);
  console.log('[calculations] calcMonthlyExpenses: result =', expenses);
  return expenses;
};

// Calculate monthly cashflow
export const calcMonthlyCashflow = (flows: Cashflow[]): number => {
  const income = calcMonthlyIncome(flows);
  const expenses = calcMonthlyExpenses(flows);
  const cashflow = income - expenses;
  console.log('[calculations] calcMonthlyCashflow: income=', income, 'expenses=', expenses, 'cashflow=', cashflow);
  return cashflow;
};

// Calculate savings rate
export const calcSavingsRate = (flows: Cashflow[]): number => {
  const income = calcMonthlyIncome(flows);
  if (income === 0) {
    console.log('[calculations] calcSavingsRate: income is 0, returning 0');
    return 0;
  }
  const cashflow = calcMonthlyCashflow(flows);
  const savingsRate = (cashflow / income) * 100;
  console.log('[calculations] calcSavingsRate: income=', income, 'cashflow=', cashflow, 'savingsRate=', savingsRate);
  return savingsRate;
};

// Group accounts by category for Asset Mix chart
export type AssetCategory = 'Cash & Cash-like' | 'Registered Investments' | 'Non-Registered Investments' | 'Real Estate' | 'Other Assets';

export const getAccountCategory = (account: Account): AssetCategory => {
  if (account.kind === 'liability') {
    return 'Other Assets'; // Liabilities shown separately
  }

  switch (account.type) {
    case 'cash':
    case 'chequing':
      return 'Cash & Cash-like';
    case 'tfsa':
    case 'rrsp':
    case 'dcpp':
    case 'resp':
      return 'Registered Investments';
    case 'non_registered':
      return 'Non-Registered Investments';
    case 'primary_home':
    case 'rental_property':
      return 'Real Estate';
    default:
      return 'Other Assets';
  }
};

export const groupAccountsByCategory = (accounts: Account[]): Record<AssetCategory, number> => {
  console.log('[calculations] groupAccountsByCategory: processing', accounts.length, 'accounts');
  const grouped: Record<AssetCategory, number> = {
    'Cash & Cash-like': 0,
    'Registered Investments': 0,
    'Non-Registered Investments': 0,
    'Real Estate': 0,
    'Other Assets': 0,
  };

  accounts
    .filter(a => a.kind === 'asset')
    .forEach(account => {
      const category = getAccountCategory(account);
      grouped[category] += account.balance;
    });

  console.log('[calculations] groupAccountsByCategory: result', grouped);
  return grouped;
};

// Helper to format account types for display
export const formatAccountType = (type: Account['type']): string => {
  // Handle acronyms that should be all caps
  const acronyms: Record<string, string> = {
    'tfsa': 'TFSA',
    'rrsp': 'RRSP',
    'dcpp': 'DCPP',
    'resp': 'RESP',
  };

  if (acronyms[type]) {
    return acronyms[type];
  }

  // For other types, replace underscores and capitalize each word
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Calculate total assets
export const calcTotalAssets = (accounts: Account[]): number => {
  return accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0);
};

// Calculate total liabilities
export const calcTotalLiabilities = (accounts: Account[]): number => {
  return accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);
};

// Calculate liquid assets (cash + chequing)
export const calcLiquidAssets = (accounts: Account[]): number => {
  return accounts
    .filter(a => a.kind === 'asset' && (a.type === 'cash' || a.type === 'chequing'))
    .reduce((sum, a) => sum + a.balance, 0);
};

// Calculate emergency fund months (liquid assets / monthly expenses)
export const calcEmergencyFundMonths = (accounts: Account[], cashflows: Cashflow[]): number => {
  const liquidAssets = calcLiquidAssets(accounts);
  const monthlyExpenses = calcMonthlyExpenses(cashflows);
  if (monthlyExpenses === 0) return 0;
  return liquidAssets / monthlyExpenses;
};

// Calculate debt-to-income ratio (monthly debt payments / monthly income)
export const calcDebtToIncomeRatio = (accounts: Account[], cashflows: Cashflow[]): number => {
  const monthlyIncome = calcMonthlyIncome(cashflows);
  if (monthlyIncome === 0) return 0;
  
  // Sum monthly payments from mortgages and loans
  const monthlyDebtPayments = accounts
    .filter(a => a.kind === 'liability' && a.monthlyPayment)
    .reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);
  
  return (monthlyDebtPayments / monthlyIncome) * 100;
};

// Calculate debt-to-asset ratio
export const calcDebtToAssetRatio = (accounts: Account[]): number => {
  const totalAssets = calcTotalAssets(accounts);
  if (totalAssets === 0) return 0;
  const totalLiabilities = calcTotalLiabilities(accounts);
  return (totalLiabilities / totalAssets) * 100;
};

// Calculate real estate equity (primary_home + rental_property vs mortgages)
export const calcMortgageEquity = (accounts: Account[]): { equity: number; percentage: number; totalValue: number; totalMortgages: number } | null => {
  // Sum all real estate assets (primary_home + rental_property)
  const realEstateValue = accounts
    .filter(a => a.kind === 'asset' && (a.type === 'primary_home' || a.type === 'rental_property'))
    .reduce((sum, a) => sum + a.balance, 0);
  
  // Sum all mortgage liabilities
  const totalMortgages = accounts
    .filter(a => a.kind === 'liability' && a.type === 'mortgage')
    .reduce((sum, a) => sum + a.balance, 0);
  
  if (realEstateValue === 0 && totalMortgages === 0) return null;
  
  const equity = realEstateValue - totalMortgages;
  const percentage = realEstateValue > 0 ? (equity / realEstateValue) * 100 : 0;
  
  return { equity, percentage, totalValue: realEstateValue, totalMortgages };
};

