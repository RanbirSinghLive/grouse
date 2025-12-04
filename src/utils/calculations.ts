import type { Account, Cashflow, Transaction } from '../types/models';

// Normalize any frequency to monthly amount
export const normalizeMonthly = (amount: number, frequency: Cashflow['frequency']): number => {
  switch (frequency) {
    case 'monthly': return amount;
    case 'biweekly': return amount * (52 / 12 / 2); // ~2.167
    case 'weekly': return amount * (52 / 12); // ~4.333
    case 'annual': return amount / 12;
    default: return amount;
  }
};

// Calculate net worth from accounts
export const calcNetWorth = (accounts: Account[]): number => {
  return accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0) -
         accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);
};

// Calculate total monthly income
export const calcMonthlyIncome = (flows: Cashflow[]): number => {
  return flows.filter(f => f.type === 'income')
       .reduce((sum, f) => sum + normalizeMonthly(f.amount, f.frequency), 0);
};

// Calculate total monthly expenses
export const calcMonthlyExpenses = (flows: Cashflow[]): number => {
  return flows.filter(f => f.type === 'expense')
       .reduce((sum, f) => sum + normalizeMonthly(f.amount, f.frequency), 0);
};

// Calculate monthly cashflow
export const calcMonthlyCashflow = (flows: Cashflow[]): number => {
  return calcMonthlyIncome(flows) - calcMonthlyExpenses(flows);
};

// Calculate savings rate
export const calcSavingsRate = (flows: Cashflow[]): number => {
  const income = calcMonthlyIncome(flows);
  if (income === 0) return 0;
  return (calcMonthlyCashflow(flows) / income) * 100;
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
  console.log(`[calculations] groupAccountsByCategory: processing ${accounts.length} accounts`);
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

  console.log(`[calculations] groupAccountsByCategory: result`, grouped);
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

// Calculate emergency fund coverage in months
export const calcEmergencyFundCoverage = (accounts: Account[], cashflows: Cashflow[]): number => {
  const liquidAssets = calcLiquidAssets(accounts);
  const monthlyExpenses = calcMonthlyExpenses(cashflows);
  if (monthlyExpenses <= 0) return Infinity; // Avoid division by zero or negative expenses
  return liquidAssets / monthlyExpenses;
};

// Alias for Dashboard compatibility
export const calcEmergencyFundMonths = calcEmergencyFundCoverage;

// Calculate debt-to-income ratio (monthly debt payments / monthly income)
export const calcDebtToIncomeRatio = (accounts: Account[], cashflows: Cashflow[]): number => {
  const monthlyIncome = calcMonthlyIncome(cashflows);
  if (monthlyIncome === 0) return 0;

  // Sum monthly payments from mortgages and loans
  const monthlyDebtPayments = accounts
    .filter(a => a.kind === 'liability' && (a.type === 'mortgage' || a.type === 'loan') && a.monthlyPayment)
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

// Calculate real estate equity (primary home + rental properties vs all mortgages)
export const calcRealEstateEquity = (accounts: Account[]): { equity: number; percentage: number; totalValue: number } | null => {
  const realEstateAssets = accounts.filter(a => a.kind === 'asset' && (a.type === 'primary_home' || a.type === 'rental_property'));
  const totalRealEstateValue = realEstateAssets.reduce((sum, a) => sum + a.balance, 0);

  const mortgages = accounts.filter(a => a.type === 'mortgage' && a.kind === 'liability');
  const totalMortgageBalance = mortgages.reduce((sum, a) => sum + a.balance, 0);

  if (totalRealEstateValue === 0 && totalMortgageBalance === 0) return null;

  const equity = totalRealEstateValue - totalMortgageBalance;
  const percentage = totalRealEstateValue > 0 ? (equity / totalRealEstateValue) * 100 : 0;

  return { equity, percentage, totalValue: totalRealEstateValue };
};

// Alias for Dashboard compatibility
export const calcMortgageEquity = calcRealEstateEquity;

// ============================================================================
// Transaction-based Budget Calculations (Averages & Trends)
// ============================================================================

export type CategoryAverage = {
  category: string;
  type: 'income' | 'expense';
  averageAmount: number;
  transactionCount: number;
  monthsWithData: number;
  trendPercentage: number; // Percentage change over time
  trendDirection: 'up' | 'down' | 'stable';
};

// Get all unique months from transactions
export const getAvailableMonths = (transactions: Transaction[]): string[] => {
  const months = new Set<string>();
  transactions.forEach(tx => {
    if (tx.date) {
      const month = tx.date.substring(0, 7); // YYYY-MM
      months.add(month);
    }
  });
  return Array.from(months).sort();
};

// Calculate monthly totals by category and type
export const calculateMonthlyTotals = (
  transactions: Transaction[],
  month: string
): Record<string, { amount: number; type: 'income' | 'expense' }> => {
  const totals: Record<string, { amount: number; type: 'income' | 'expense' }> = {};
  
  const monthStart = `${month}-01`;
  const [year, monthNum] = month.split('-');
  const nextMonth = monthNum === '12' 
    ? `${parseInt(year) + 1}-01` 
    : `${year}-${String(parseInt(monthNum) + 1).padStart(2, '0')}-01`;
  
  transactions
    .filter(tx => {
      if (!tx.date || !tx.category) return false;
      const txDate = tx.date;
      return txDate >= monthStart && 
             txDate < nextMonth && 
             (tx.type === 'income' || tx.type === 'expense');
    })
    .forEach(tx => {
      const category = tx.category!;
      const txType = tx.type as 'income' | 'expense';
      
      if (!totals[category]) {
        totals[category] = { amount: tx.amount, type: txType };
      } else {
        totals[category].amount += tx.amount;
      }
    });
  
  return totals;
};

// Calculate average monthly amount by category and type
export const calculateCategoryAverages = (
  transactions: Transaction[]
): CategoryAverage[] => {
  console.log('[calculations] calculateCategoryAverages: processing', transactions.length, 'transactions');
  
  const availableMonths = getAvailableMonths(transactions);
  console.log('[calculations] Available months:', availableMonths);
  
  if (availableMonths.length === 0) {
    console.log('[calculations] No months with data found');
    return [];
  }
  
  // Group transactions by category and type
  const categoryMap = new Map<string, { 
    type: 'income' | 'expense';
    monthlyTotals: number[];
    transactionCount: number;
  }>();
  
  // Calculate totals for each month
  availableMonths.forEach(month => {
    const monthlyTotals = calculateMonthlyTotals(transactions, month);
    
    Object.entries(monthlyTotals).forEach(([category, { amount, type }]) => {
      const key = `${category}|${type}`;
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          type,
          monthlyTotals: [],
          transactionCount: 0,
        });
      }
      const entry = categoryMap.get(key)!;
      entry.monthlyTotals.push(amount);
    });
  });
  
  // Count transactions per category
  transactions
    .filter(tx => tx.category && (tx.type === 'income' || tx.type === 'expense'))
    .forEach(tx => {
      const key = `${tx.category}|${tx.type}`;
      const entry = categoryMap.get(key);
      if (entry) {
        entry.transactionCount += 1;
      }
    });
  
  // Calculate averages and trends
  // Use total months with ANY data as denominator for more realistic budgeting
  const totalMonthsWithData = availableMonths.length;
  console.log('[calculations] Total months with any transaction data:', totalMonthsWithData);
  
  const averages: CategoryAverage[] = [];
  
  categoryMap.forEach((data, key) => {
    const [category, typeStr] = key.split('|');
    const type = typeStr as 'income' | 'expense';
    
    const monthlyTotals = data.monthlyTotals;
    const monthsWithData = monthlyTotals.length;
    
    if (monthsWithData === 0) return;
    
    // Calculate average - divide by total months with ANY data, not just months with this category
    // This gives a more realistic monthly budget expectation
    const total = monthlyTotals.reduce((sum, val) => sum + val, 0);
    const averageAmount = totalMonthsWithData > 0 ? total / totalMonthsWithData : 0;
    
    // Calculate trend (compare first half vs second half of available months)
    let trendPercentage = 0;
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    
    if (monthsWithData >= 2) {
      const midPoint = Math.floor(monthsWithData / 2);
      const firstHalf = monthlyTotals.slice(0, midPoint);
      const secondHalf = monthlyTotals.slice(midPoint);
      
      const firstHalfAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
      
      if (firstHalfAvg > 0) {
        trendPercentage = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
        
        // Determine direction with a threshold (5% change to be considered significant)
        if (Math.abs(trendPercentage) < 5) {
          trendDirection = 'stable';
        } else if (trendPercentage > 0) {
          trendDirection = 'up';
        } else {
          trendDirection = 'down';
        }
      }
    }
    
    averages.push({
      category,
      type,
      averageAmount,
      transactionCount: data.transactionCount,
      monthsWithData,
      trendPercentage,
      trendDirection,
    });
  });
  
  console.log('[calculations] calculateCategoryAverages: result', averages);
  return averages.sort((a, b) => {
    // Sort by type (income first), then by average amount (descending)
    if (a.type !== b.type) {
      return a.type === 'income' ? -1 : 1;
    }
    return b.averageAmount - a.averageAmount;
  });
};

// Calculate trend percentage between two periods
export const calculateTrendPercentage = (
  currentPeriod: number,
  previousPeriod: number
): number => {
  if (previousPeriod === 0) {
    return currentPeriod > 0 ? 100 : 0;
  }
  return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
};

// ============================================================================
// Transaction-based Cash Flow Calculations (for Dashboard)
// ============================================================================

// Calculate average monthly income from transactions
export const calcMonthlyIncomeFromTransactions = (transactions: Transaction[]): number => {
  console.log('[calculations] calcMonthlyIncomeFromTransactions: processing', transactions.length, 'transactions');
  const averages = calculateCategoryAverages(transactions);
  const incomeTotal = averages
    .filter(avg => avg.type === 'income')
    .reduce((sum, avg) => sum + avg.averageAmount, 0);
  console.log('[calculations] calcMonthlyIncomeFromTransactions: result', incomeTotal);
  return incomeTotal;
};

// Calculate average monthly expenses from transactions
export const calcMonthlyExpensesFromTransactions = (transactions: Transaction[]): number => {
  console.log('[calculations] calcMonthlyExpensesFromTransactions: processing', transactions.length, 'transactions');
  const averages = calculateCategoryAverages(transactions);
  const expensesTotal = averages
    .filter(avg => avg.type === 'expense')
    .reduce((sum, avg) => sum + avg.averageAmount, 0);
  console.log('[calculations] calcMonthlyExpensesFromTransactions: result', expensesTotal);
  return expensesTotal;
};

// Calculate average monthly cashflow from transactions
export const calcMonthlyCashflowFromTransactions = (transactions: Transaction[]): number => {
  console.log('[calculations] calcMonthlyCashflowFromTransactions: processing', transactions.length, 'transactions');
  const income = calcMonthlyIncomeFromTransactions(transactions);
  const expenses = calcMonthlyExpensesFromTransactions(transactions);
  const cashflow = income - expenses;
  console.log('[calculations] calcMonthlyCashflowFromTransactions: result', cashflow);
  return cashflow;
};

// Calculate savings rate from transactions
export const calcSavingsRateFromTransactions = (transactions: Transaction[]): number => {
  console.log('[calculations] calcSavingsRateFromTransactions: processing', transactions.length, 'transactions');
  const income = calcMonthlyIncomeFromTransactions(transactions);
  if (income === 0) {
    console.log('[calculations] calcSavingsRateFromTransactions: no income, returning 0');
    return 0;
  }
  const cashflow = calcMonthlyCashflowFromTransactions(transactions);
  const savingsRate = (cashflow / income) * 100;
  console.log('[calculations] calcSavingsRateFromTransactions: result', savingsRate);
  return savingsRate;
};

// Calculate emergency fund coverage in months (using transactions)
export const calcEmergencyFundCoverageFromTransactions = (
  accounts: Account[],
  transactions: Transaction[]
): number => {
  console.log('[calculations] calcEmergencyFundCoverageFromTransactions: processing');
  const liquidAssets = calcLiquidAssets(accounts);
  const monthlyExpenses = calcMonthlyExpensesFromTransactions(transactions);
  if (monthlyExpenses <= 0) {
    console.log('[calculations] calcEmergencyFundCoverageFromTransactions: no expenses, returning Infinity');
    return Infinity;
  }
  const coverage = liquidAssets / monthlyExpenses;
  console.log('[calculations] calcEmergencyFundCoverageFromTransactions: result', coverage);
  return coverage;
};

// Alias for Dashboard compatibility
export const calcEmergencyFundMonthsFromTransactions = calcEmergencyFundCoverageFromTransactions;

// Calculate debt-to-income ratio (using transactions)
export const calcDebtToIncomeRatioFromTransactions = (
  accounts: Account[],
  transactions: Transaction[]
): number => {
  console.log('[calculations] calcDebtToIncomeRatioFromTransactions: processing');
  const monthlyIncome = calcMonthlyIncomeFromTransactions(transactions);
  if (monthlyIncome === 0) {
    console.log('[calculations] calcDebtToIncomeRatioFromTransactions: no income, returning 0');
    return 0;
  }

  // Sum monthly payments from mortgages and loans
  const monthlyDebtPayments = accounts
    .filter(a => a.kind === 'liability' && (a.type === 'mortgage' || a.type === 'loan') && a.monthlyPayment)
    .reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);

  const ratio = (monthlyDebtPayments / monthlyIncome) * 100;
  console.log('[calculations] calcDebtToIncomeRatioFromTransactions: result', ratio);
  return ratio;
};

