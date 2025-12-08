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
  
  const availableMonths = getAvailableMonths(transactions);
  
  if (availableMonths.length === 0) {
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
// Chart Data Preparation Functions
// ============================================================================

// Prepare data for Spending Over Time line chart
export type MonthlySpendingData = {
  month: string;
  monthDisplay: string;
  income: number;
  expenses: number;
  netCashflow: number;
  [category: string]: string | number; // Dynamic category fields
};

export const prepareSpendingOverTimeData = (
  transactions: Transaction[],
  selectedCategories?: string[]
): MonthlySpendingData[] => {
  const availableMonths = getAvailableMonths(transactions);
  
  if (availableMonths.length === 0) return [];
  
  // Get all categories if none selected
  const allCategories = selectedCategories || 
    [...new Set(transactions.filter(tx => tx.category).map(tx => tx.category!))];
  
  const data: MonthlySpendingData[] = availableMonths.map(month => {
    const monthlyTotals = calculateMonthlyTotals(transactions, month);
    
    // Format month for display
    const [year, monthNum] = month.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthDisplay = `${monthNames[parseInt(monthNum) - 1]} ${year}`;
    
    let income = 0;
    let expenses = 0;
    const categoryData: Record<string, number> = {};
    
    // Calculate totals and category breakdowns
    Object.entries(monthlyTotals).forEach(([category, { amount, type }]) => {
      if (type === 'income') {
        income += amount;
      } else {
        expenses += amount;
      }
      
      // Add category data if selected
      if (allCategories.includes(category)) {
        categoryData[category] = (categoryData[category] || 0) + amount;
      }
    });
    
    const result: MonthlySpendingData = {
      month,
      monthDisplay,
      income,
      expenses,
      netCashflow: income - expenses,
      ...categoryData,
    };
    
    return result;
  });
  
  return data;
};

// Prepare data for Monthly Comparison grouped bar chart
export type MonthlyComparisonData = {
  category: string;
  type: 'income' | 'expense';
  [month: string]: string | number; // Dynamic month fields
};

export const prepareMonthlyComparisonData = (
  transactions: Transaction[],
  monthsToCompare: string[]
): MonthlyComparisonData[] => {
  
  if (monthsToCompare.length === 0) return [];
  
  // Get all categories from selected months
  const categorySet = new Set<string>();
  monthsToCompare.forEach(month => {
    const monthlyTotals = calculateMonthlyTotals(transactions, month);
    Object.keys(monthlyTotals).forEach(category => categorySet.add(category));
  });
  
  const categories = Array.from(categorySet);
  const data: MonthlyComparisonData[] = [];
  
  categories.forEach(category => {
    // Get type from first month that has this category
    let categoryType: 'income' | 'expense' = 'expense';
    for (const month of monthsToCompare) {
      const monthlyTotals = calculateMonthlyTotals(transactions, month);
      if (monthlyTotals[category]) {
        categoryType = monthlyTotals[category].type;
        break;
      }
    }
    
    const categoryData: MonthlyComparisonData = {
      category,
      type: categoryType,
    };
    
    // Add amount for each month (0 if no data)
    monthsToCompare.forEach(month => {
      const monthlyTotals = calculateMonthlyTotals(transactions, month);
      categoryData[month] = monthlyTotals[category]?.amount || 0;
    });
    
    data.push(categoryData);
  });
  
  // Sort by total amount across all months (descending)
  data.sort((a, b) => {
    const totalA = monthsToCompare.reduce((sum, month) => sum + (a[month] as number || 0), 0);
    const totalB = monthsToCompare.reduce((sum, month) => sum + (b[month] as number || 0), 0);
    return totalB - totalA;
  });
  
  return data;
};

// Prepare data for Category Breakdown treemap
export type CategoryBreakdownData = {
  name: string;
  value: number;
  type: 'income' | 'expense';
  fill: string;
};

export const prepareCategoryBreakdownData = (
  transactions: Transaction[]
): CategoryBreakdownData[] => {
  
  const averages = calculateCategoryAverages(transactions);
  
  // Color scheme: green for income, red shades for expenses
  const incomeColors = ['#10b981', '#059669', '#047857', '#065f46'];
  const expenseColors = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];
  
  const data: CategoryBreakdownData[] = averages.map((avg, index) => {
    const colorPalette = avg.type === 'income' ? incomeColors : expenseColors;
    const colorIndex = index % colorPalette.length;
    
    return {
      name: avg.category,
      value: avg.averageAmount,
      type: avg.type,
      fill: colorPalette[colorIndex],
    };
  });
  
  return data;
};

// ============================================================================
// Transaction-based Cash Flow Calculations (for Dashboard)
// ============================================================================

// Calculate average monthly income from transactions
export const calcMonthlyIncomeFromTransactions = (transactions: Transaction[]): number => {
  const averages = calculateCategoryAverages(transactions);
  const incomeTotal = averages
    .filter(avg => avg.type === 'income')
    .reduce((sum, avg) => sum + avg.averageAmount, 0);
  return incomeTotal;
};

// Calculate average monthly expenses from transactions
export const calcMonthlyExpensesFromTransactions = (transactions: Transaction[]): number => {
  const averages = calculateCategoryAverages(transactions);
  const expensesTotal = averages
    .filter(avg => avg.type === 'expense')
    .reduce((sum, avg) => sum + avg.averageAmount, 0);
  return expensesTotal;
};

// Calculate average monthly cashflow from transactions
export const calcMonthlyCashflowFromTransactions = (transactions: Transaction[]): number => {
  const income = calcMonthlyIncomeFromTransactions(transactions);
  const expenses = calcMonthlyExpensesFromTransactions(transactions);
  const cashflow = income - expenses;
  return cashflow;
};

// Calculate savings rate from transactions
export const calcSavingsRateFromTransactions = (transactions: Transaction[]): number => {
  const income = calcMonthlyIncomeFromTransactions(transactions);
  if (income === 0) {
    return 0;
  }
  const cashflow = calcMonthlyCashflowFromTransactions(transactions);
  const savingsRate = (cashflow / income) * 100;
  return savingsRate;
};

// Calculate emergency fund coverage in months (using transactions)
export const calcEmergencyFundCoverageFromTransactions = (
  accounts: Account[],
  transactions: Transaction[]
): number => {
  const liquidAssets = calcLiquidAssets(accounts);
  const monthlyExpenses = calcMonthlyExpensesFromTransactions(transactions);
  if (monthlyExpenses <= 0) {
    return Infinity;
  }
  const coverage = liquidAssets / monthlyExpenses;
  return coverage;
};

// Alias for Dashboard compatibility
export const calcEmergencyFundMonthsFromTransactions = calcEmergencyFundCoverageFromTransactions;

// Calculate debt-to-income ratio (using transactions)
export const calcDebtToIncomeRatioFromTransactions = (
  accounts: Account[],
  transactions: Transaction[]
): number => {
  const monthlyIncome = calcMonthlyIncomeFromTransactions(transactions);
  if (monthlyIncome === 0) {
    return 0;
  }

  // Sum monthly payments from mortgages and loans
  const monthlyDebtPayments = accounts
    .filter(a => a.kind === 'liability' && (a.type === 'mortgage' || a.type === 'loan') && a.monthlyPayment)
    .reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);

  const ratio = (monthlyDebtPayments / monthlyIncome) * 100;
  return ratio;
};

