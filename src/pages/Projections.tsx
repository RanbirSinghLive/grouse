import { useState, useMemo, useEffect } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';
import { calcNetWorth, formatAccountType } from '../utils/calculations';
import { NetWorthProjectionChart } from '../components/NetWorthProjectionChart';
import { loadProjectionInputs, saveProjectionInputs, loadRetirementYears, saveRetirementYears, loadOwnerAges, saveOwnerAges, loadProjectionSettings, saveProjectionSettings, loadIncomes, saveIncomes, loadExpenses, saveExpenses, type ProjectionInputs, type RetirementYears, type OwnerAges, type Incomes, type Income, type Expenses, type Expense } from '../utils/storage';
import type { Account } from '../types/models';

export const Projections = () => {
  const {
    household,
    accounts,
  } = useHouseholdStore();

  // Panel visibility state
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  
  // End of plan year
  const currentYear = new Date().getFullYear();
  const [endOfPlanYear, setEndOfPlanYear] = useState(() => {
    const saved = loadProjectionSettings();
    return saved?.endOfPlanYear || currentYear + 30;
  });
  
  // Inflation rate (as decimal, e.g., 0.02 for 2%)
  const [inflationRate, setInflationRate] = useState(() => {
    const saved = loadProjectionSettings();
    return saved?.inflationRate || 0.02;
  });

  // Incomes state
  const [incomes, setIncomes] = useState<Incomes>(() => {
    const saved = loadIncomes();
    return saved || {};
  });

  // Expenses state
  const [expenses, setExpenses] = useState<Expenses>(() => {
    const saved = loadExpenses();
    return saved || {};
  });

  // Retirement years by owner
  const [retirementYears, setRetirementYears] = useState<RetirementYears>(() => {
    const saved = loadRetirementYears();
    return saved || {};
  });

  // Owner ages (current age)
  const [ownerAges, setOwnerAges] = useState<OwnerAges>(() => {
    const saved = loadOwnerAges();
    return saved || {};
  });

  // Save projection settings (end of plan year and inflation rate) to localStorage
  // Use setTimeout to debounce and prevent blocking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        saveProjectionSettings({
          endOfPlanYear,
          inflationRate,
        });
      } catch (error) {
        console.error('[Projections] Error saving projection settings:', error);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [endOfPlanYear, inflationRate]);

  // Save incomes to localStorage whenever they change
  // Use setTimeout to debounce and prevent blocking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        saveIncomes(incomes);
      } catch (error) {
        console.error('[Projections] Error saving incomes:', error);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [incomes]);

  // Save expenses to localStorage whenever they change
  // Use setTimeout to debounce and prevent blocking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        saveExpenses(expenses);
      } catch (error) {
        console.error('[Projections] Error saving expenses:', error);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [expenses]);

  // Save retirement years to localStorage whenever they change
  // Use setTimeout to debounce and prevent blocking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        saveRetirementYears(retirementYears);
      } catch (error) {
        console.error('[Projections] Error saving retirement years:', error);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [retirementYears]);

  // Save owner ages to localStorage whenever they change
  // Use setTimeout to debounce and prevent blocking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        saveOwnerAges(ownerAges);
      } catch (error) {
        console.error('[Projections] Error saving owner ages:', error);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [ownerAges]);

  // Calculate age for an owner in a given year
  const getAgeInYear = (owner: string, year: number): number | null => {
    const currentAge = ownerAges[owner];
    if (currentAge === undefined) return null;
    return currentAge + (year - currentYear);
  };

  // Expanded accounts state
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  
  // Expanded incomes and expenses state
  const [expandedIncomes, setExpandedIncomes] = useState<Set<string>>(new Set());
  const [expandedExpenses, setExpandedExpenses] = useState<Set<string>>(new Set());
  
  // Collapsible sections state
  const [accountsSectionExpanded, setAccountsSectionExpanded] = useState(true);
  const [incomesSectionExpanded, setIncomesSectionExpanded] = useState(true);
  const [expensesSectionExpanded, setExpensesSectionExpanded] = useState(true);

  // Projection model: account-specific inputs
  const [projectionInputs, setProjectionInputs] = useState<ProjectionInputs>(() => {
    // Load from localStorage on initial mount
    const saved = loadProjectionInputs();
    return saved || {};
  });

  // Save projection inputs to localStorage whenever they change
  // Use setTimeout to debounce and prevent blocking
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        saveProjectionInputs(projectionInputs);
      } catch (error) {
        console.error('[Projections] Error saving projection inputs:', error);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [projectionInputs]);

  // Calculate current net worth (must be before early return)
  const currentNetWorth = useMemo(() => {
    try {
      return calcNetWorth(accounts || []);
    } catch (error) {
      console.error('[Projections] Error calculating net worth:', error);
      return 0;
    }
  }, [accounts]);

  // Group accounts by owner (must be before early return)
  const accountsByOwner = useMemo(() => {
    try {
      const grouped: { [owner: string]: Account[] } = {};
      (accounts || []).forEach(account => {
        const owner = account.owner || 'All / Joint';
        if (!grouped[owner]) {
          grouped[owner] = [];
        }
        grouped[owner].push(account);
      });
      return grouped;
    } catch (error) {
      console.error('[Projections] Error grouping accounts:', error);
      return {};
    }
  }, [accounts]);

  // Get all unique owners from accounts (must be before early return)
  const allOwners = useMemo(() => {
    try {
      const owners = new Set<string>();
      (accounts || []).forEach(account => {
        if (account.owner) {
          owners.add(account.owner);
        }
      });
      return Array.from(owners).sort();
    } catch (error) {
      console.error('[Projections] Error getting owners:', error);
      return [];
    }
  }, [accounts]);

  // Get retirement year for an owner (returns actual year or null)
  const getRetirementYearForOwner = (owner: string): number | null => {
    try {
      return retirementYears[owner] || null;
    } catch (error) {
      console.error('[Projections] Error getting retirement year:', error);
      return null;
    }
  };

  // Get contribute until year for an account (resolves 'retirement' to actual year)
  const getContributeUntilYear = (account: Account): number | null => {
    try {
      const inputs = projectionInputs[account.id];
      if (!inputs || inputs.contributeUntilYear === undefined) {
        return null; // Contribute forever
      }
      if (inputs.contributeUntilYear === 'retirement') {
        const owner = account.owner || 'All / Joint';
        return getRetirementYearForOwner(owner);
      }
      return inputs.contributeUntilYear as number;
    } catch (error) {
      console.error('[Projections] Error getting contribute until year:', error);
      return null;
    }
  };

  // Generate list of years for contribute-until dropdown (per account)
  const getContributeUntilYearOptions = (account: Account) => {
    const years: Array<{ value: number | 'retirement'; label: string }> = [];
    const owner = account.owner || 'All / Joint';
    const retirementYear = getRetirementYearForOwner(owner);
    
    // Add "Retirement" option at the top if owner has retirement year set
    if (retirementYear) {
      const retirementAge = getAgeInYear(owner, retirementYear);
      const retirementLabel = retirementAge !== null 
        ? `Retirement (${retirementYear} - ${retirementAge})`
        : `Retirement (${retirementYear})`;
      years.push({ value: 'retirement', label: retirementLabel });
    }
    
    // Add all years in projection range with age
    for (let year = currentYear; year <= endOfPlanYear; year++) {
      const age = getAgeInYear(owner, year);
      const label = age !== null ? `${year} - ${age}` : year.toString();
      years.push({ value: year, label });
    }
    
    return years;
  };

  // Generate list of years for income start/end date dropdowns (per owner)
  const getYearOptions = (owner: string, includeNow: boolean = false, includeRetirement: boolean = true) => {
    const options: Array<{ value: number | 'now' | 'retirement'; label: string }> = [];
    
    // Add "NOW" option if requested (for start dates)
    if (includeNow) {
      const currentAge = getAgeInYear(owner, currentYear);
      const nowLabel = currentAge !== null 
        ? `NOW (${currentYear} - ${currentAge})`
        : `NOW (${currentYear})`;
      options.push({ value: 'now', label: nowLabel });
    }
    
    // Add "Retirement" option if requested and owner has retirement year set
    if (includeRetirement) {
      const retirementYear = getRetirementYearForOwner(owner);
      if (retirementYear) {
        const retirementAge = getAgeInYear(owner, retirementYear);
        const retirementLabel = retirementAge !== null 
          ? `Retirement (${retirementYear} - ${retirementAge})`
          : `Retirement (${retirementYear})`;
        options.push({ value: 'retirement', label: retirementLabel });
      }
    }
    
    // Add all years in projection range with age
    for (let year = currentYear; year <= endOfPlanYear; year++) {
      const age = getAgeInYear(owner, year);
      const label = age !== null ? `${year} - ${age}` : year.toString();
      options.push({ value: year, label });
    }
    
    return options;
  };

  // Income management functions
  const addIncome = () => {
    const newId = `income-${Date.now()}`;
    const defaultOwner = allOwners.length > 0 ? allOwners[0] : 'All / Joint';
    setIncomes(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        name: 'New Income',
        annualAmount: 0,
        owner: defaultOwner,
        startDate: 'now',
      },
    }));
  };

  const updateIncome = (incomeId: string, field: keyof Income, value: any) => {
    setIncomes(prev => ({
      ...prev,
      [incomeId]: {
        ...prev[incomeId],
        [field]: value,
      },
    }));
  };

  const deleteIncome = (incomeId: string) => {
    setIncomes(prev => {
      const { [incomeId]: _, ...rest } = prev;
      return rest;
    });
  };

  // Expense management functions
  const addExpense = () => {
    const newId = `expense-${Date.now()}`;
    const defaultOwner = allOwners.length > 0 ? allOwners[0] : 'All / Joint';
    setExpenses(prev => ({
      ...prev,
      [newId]: {
        id: newId,
        name: 'New Expense',
        annualAmount: 0,
        owner: defaultOwner,
        startDate: 'now',
      },
    }));
  };

  const updateExpense = (expenseId: string, field: keyof Expense, value: any) => {
    setExpenses(prev => ({
      ...prev,
      [expenseId]: {
        ...prev[expenseId],
        [field]: value,
      },
    }));
  };

  const deleteExpense = (expenseId: string) => {
    setExpenses(prev => {
      const { [expenseId]: _, ...rest } = prev;
      return rest;
    });
  };

  // Toggle account expansion
  const toggleAccountExpansion = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Toggle income expansion
  const toggleIncomeExpansion = (incomeId: string) => {
    setExpandedIncomes(prev => {
      const next = new Set(prev);
      if (next.has(incomeId)) {
        next.delete(incomeId);
      } else {
        next.add(incomeId);
      }
      return next;
    });
  };

  // Toggle expense expansion
  const toggleExpenseExpansion = (expenseId: string) => {
    setExpandedExpenses(prev => {
      const next = new Set(prev);
      if (next.has(expenseId)) {
        next.delete(expenseId);
      } else {
        next.add(expenseId);
      }
      return next;
    });
  };

  // Update projection input for an account
  const updateProjectionInput = (accountId: string, field: string, value: number | string | undefined) => {
    setProjectionInputs(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        [field]: value,
      },
    }));
  };

  // Helper to resolve income start/end dates to actual years
  const resolveIncomeStartYear = (income: Income): number | null => {
    if (!income.startDate) return null;
    if (income.startDate === 'now') return currentYear;
    if (income.startDate === 'retirement') {
      return getRetirementYearForOwner(income.owner) || null;
    }
    return income.startDate as number;
  };

  const resolveIncomeEndYear = (income: Income): number | null => {
    if (!income.endDate) return null;
    if (income.endDate === 'retirement') {
      return getRetirementYearForOwner(income.owner) || null;
    }
    return income.endDate as number;
  };

  // Helper to resolve expense start/end dates to actual years
  const resolveExpenseStartYear = (expense: Expense): number | null => {
    if (!expense.startDate) return null;
    if (expense.startDate === 'now') return currentYear;
    if (expense.startDate === 'retirement') {
      return getRetirementYearForOwner(expense.owner) || null;
    }
    return expense.startDate as number;
  };

  const resolveExpenseEndYear = (expense: Expense): number | null => {
    if (!expense.endDate) return null;
    if (expense.endDate === 'retirement') {
      return getRetirementYearForOwner(expense.owner) || null;
    }
    return expense.endDate as number;
  };

  // Canadian mortgage calculation helpers
  // Canadian mortgages compound semi-annually
  const calculateCanadianMortgageEffectiveRate = (annualRate: number): number => {
    // Effective annual rate with semi-annual compounding: (1 + r/2)^2 - 1
    return Math.pow(1 + annualRate / 2, 2) - 1;
  };

  const calculateMortgagePeriodicRate = (
    annualRate: number,
    paymentsPerYear: number
  ): number => {
    const effectiveAnnual = calculateCanadianMortgageEffectiveRate(annualRate);
    // Convert effective annual rate to periodic rate
    return Math.pow(1 + effectiveAnnual, 1 / paymentsPerYear) - 1;
  };


  // Create chart data using projection model (must be before early return)
  const { chartData, accountBalancesByYear } = useMemo(() => {
    try {
      const data = [];
      
      // Start with current account balances (create a copy to modify)
      const accountBalances: { [accountId: string]: number } = {};
      (accounts || []).forEach(account => {
        // For mortgages, use mortgagePrincipal from inputs if available, otherwise use account balance
        if (account.kind === 'liability' && account.type === 'mortgage') {
          const inputs = projectionInputs[account.id];
          accountBalances[account.id] = inputs?.mortgagePrincipal !== undefined 
            ? inputs.mortgagePrincipal 
            : account.balance;
        } else {
          accountBalances[account.id] = account.balance;
        }
      });
    
    // Track account balances and flows by year for the table
    const accountBalancesByYear: Array<{
      year: number;
      accounts: { [accountId: string]: { balance: number; inflows: Array<{ source: string; amount: number }>; outflows: Array<{ source: string; amount: number }> } };
    }> = [];
    
    // Initialize current year account balances
    const currentYearAccountData: { [accountId: string]: { balance: number; inflows: Array<{ source: string; amount: number }>; outflows: Array<{ source: string; amount: number }> } } = {};
    (accounts || []).forEach(account => {
      currentYearAccountData[account.id] = {
        balance: account.balance,
        inflows: [],
        outflows: []
      };
    });
    accountBalancesByYear.push({
      year: currentYear,
      accounts: currentYearAccountData
    });
    
    // Always include current year (year 0)
    data.push({
      year: currentYear.toString(),
      netWorth: currentNetWorth,
      retirementOwner: undefined,
    });
    
    // Project forward year by year
    // Limit to reasonable range to prevent blocking (max 100 years)
    const maxProjectionYears = Math.min(endOfPlanYear, currentYear + 100);
    for (let year = currentYear + 1; year <= maxProjectionYears; year++) {
      const yearsIntoProjection = year - currentYear;
      
      // Initialize account flows for this year
      const yearAccountFlows: { [accountId: string]: { balance: number; inflows: Array<{ source: string; amount: number }>; outflows: Array<{ source: string; amount: number }> } } = {};
      (accounts || []).forEach(account => {
        yearAccountFlows[account.id] = {
          balance: accountBalances[account.id] || account.balance,
          inflows: [],
          outflows: []
        };
      });
      
      // Apply projection model calculations for each account
      (accounts || []).forEach(account => {
        const inputs = projectionInputs[account.id];
        let balance = accountBalances[account.id];
        
        // Process asset accounts with inputs
        if (account.kind === 'asset' && inputs) {
          // Check if contributions should continue this year
          const contributeUntilYear = getContributeUntilYear(account);
          const shouldContribute = contributeUntilYear === null || year <= contributeUntilYear;
          
          // Step 1: Add annual contribution (if specified and not past contribute-until year)
          if (shouldContribute && inputs.annualContribution !== undefined && inputs.annualContribution > 0) {
            balance += inputs.annualContribution;
            yearAccountFlows[account.id].inflows.push({
              source: 'Contribution',
              amount: inputs.annualContribution
            });
          }
          
          // Step 2: Apply investment growth to the total (beginning balance + contributions)
          if (inputs.annualInvestmentGrowth !== undefined && inputs.annualInvestmentGrowth > 0) {
            const growthAmount = balance * inputs.annualInvestmentGrowth;
            balance = balance * (1 + inputs.annualInvestmentGrowth);
            if (growthAmount > 0) {
              yearAccountFlows[account.id].inflows.push({
                source: `Investment Growth (${(inputs.annualInvestmentGrowth * 100).toFixed(1)}%)`,
                amount: growthAmount
              });
            }
          }
        }
        
        // Update the balance for next iteration
        accountBalances[account.id] = balance;
      });

      // Apply income contributions to accounts (add to cash/chequing accounts)
      let totalIncomeThisYear = 0;
      Object.values(incomes || {}).forEach(income => {
        const startYear = resolveIncomeStartYear(income);
        const endYear = resolveIncomeEndYear(income);
        
        // Check if income is active this year
        const isActive = startYear !== null && 
                        year >= startYear && 
                        (endYear === null || year <= endYear);
        
        if (isActive && income.annualAmount > 0) {
          // Apply growth rate if specified
          const yearsSinceStart = startYear ? year - startYear : 0;
          let incomeAmount = income.annualAmount;
          if (income.growthRate && income.growthRate > 0) {
            incomeAmount = income.annualAmount * Math.pow(1 + income.growthRate, yearsSinceStart);
          }
          totalIncomeThisYear += incomeAmount;
        }
      });
      
      // Add income to a cash account (prefer chequing, then cash, or first asset account)
      if (totalIncomeThisYear > 0) {
        const cashAccount = (accounts || []).find(a => 
          a.kind === 'asset' && (a.type === 'chequing' || a.type === 'cash')
        ) || (accounts || []).find(a => a.kind === 'asset');
        
        if (cashAccount) {
          const cashBefore = accountBalances[cashAccount.id] || cashAccount.balance;
          accountBalances[cashAccount.id] = cashBefore + totalIncomeThisYear;
          
          // Track income inflows
          yearAccountFlows[cashAccount.id].inflows.push({
            source: 'Income',
            amount: totalIncomeThisYear
          });
        }
      }

      // Apply expense withdrawals from accounts (subtract from cash/chequing accounts)
      let totalExpensesThisYear = 0;
      Object.values(expenses || {}).forEach((expense: Expense) => {
        const startYear = resolveExpenseStartYear(expense);
        const endYear = resolveExpenseEndYear(expense);
        
        // Check if expense is active this year
        const isActive = startYear !== null && 
                        year >= startYear && 
                        (endYear === null || year <= endYear);
        
        if (isActive && expense.annualAmount > 0) {
          // Apply growth rate if specified
          const yearsSinceStart = startYear ? year - startYear : 0;
          let expenseAmount = expense.annualAmount;
          if (expense.growthRate && expense.growthRate > 0) {
            expenseAmount = expense.annualAmount * Math.pow(1 + expense.growthRate, yearsSinceStart);
          }
          totalExpensesThisYear += expenseAmount;
        }
      });
      
      // Subtract expenses from cash accounts (prefer chequing, then cash, or first asset account)
      if (totalExpensesThisYear > 0) {
        const cashAccount = (accounts || []).find(a => 
          a.kind === 'asset' && (a.type === 'chequing' || a.type === 'cash')
        ) || (accounts || []).find(a => a.kind === 'asset');
        
        if (cashAccount) {
          accountBalances[cashAccount.id] = Math.max(0, (accountBalances[cashAccount.id] || cashAccount.balance) - totalExpensesThisYear);
          
          // Track expense outflows
          yearAccountFlows[cashAccount.id].outflows.push({
            source: 'Expenses',
            amount: totalExpensesThisYear
          });
        }
      }

      // Track mortgage payoffs for milestones
      const mortgagePayoffsThisYear: Array<{ accountId: string; accountName: string }> = [];
      
      // Process mortgage payments (deduct from cash and reduce mortgage balance)
      (accounts || []).forEach(account => {
        if (account.kind === 'liability' && account.type === 'mortgage') {
          const inputs = projectionInputs[account.id];
          
          // Normalize interest rate - inputs are stored as decimal (0.0404), account.interestRate might be percentage (4.04) or decimal
          let interestRate = 0;
          if (inputs?.mortgageInterestRate !== undefined) {
            interestRate = inputs.mortgageInterestRate; // Already a decimal
          } else if (account.interestRate !== undefined && account.interestRate !== null) {
            // account.interestRate might be stored as percentage (4.04) or decimal (0.0404)
            interestRate = account.interestRate > 1 ? account.interestRate / 100 : account.interestRate;
          }
          
          const paymentAmount = inputs?.mortgagePaymentAmount !== undefined 
            ? inputs.mortgagePaymentAmount 
            : (account.monthlyPayment !== undefined && account.monthlyPayment !== null ? account.monthlyPayment : undefined);
          const paymentFrequency = inputs?.mortgagePaymentFrequency || 'monthly';
          
          // Log if payment amount is missing
          if (year === currentYear + 1 && paymentAmount === undefined) {
            console.warn(`[Projections] ⚠️ Mortgage ${account.name} has no payment amount!`, {
              hasInputs: !!inputs,
              mortgagePaymentAmount: inputs?.mortgagePaymentAmount,
              accountMonthlyPayment: account.monthlyPayment,
              accountId: account.id
            });
          }
          
          // Get balance at START of this year (before processing payments)
          const balanceAtStartOfYear = accountBalances[account.id] !== undefined 
            ? accountBalances[account.id] 
            : (inputs?.mortgagePrincipal !== undefined ? inputs.mortgagePrincipal : account.balance);
          const wasMortgageActive = balanceAtStartOfYear > 0.01; // Use small threshold to account for rounding
          
          // Check condition components
          const hasBalance = balanceAtStartOfYear > 0.01;
          const hasInterestRate = interestRate > 0;
          const hasPaymentAmount = paymentAmount && paymentAmount > 0;
          const canProcess = hasBalance && hasInterestRate && hasPaymentAmount;
          
          // Only process if mortgage has balance AND has required inputs
          // Use balanceAtStartOfYear (not principal) to check if mortgage is still active
          if (canProcess) {
            // Calculate payments per year and payment per period based on frequency
            let paymentsPerYear: number;
            let paymentPerPeriod: number;
            
            if (paymentFrequency === 'weekly') {
              paymentsPerYear = 52;
              paymentPerPeriod = paymentAmount / 4.33; // Weekly payment (monthly / 4.33)
            } else if (paymentFrequency === 'accelerated_biweekly') {
              paymentsPerYear = 26;
              paymentPerPeriod = paymentAmount / 2; // Biweekly payment (monthly / 2)
            } else {
              paymentsPerYear = 12;
              paymentPerPeriod = paymentAmount; // Monthly payment
            }
            
            // Calculate periodic interest rate (Canadian mortgage: semi-annual compounding)
            const periodicRate = calculateMortgagePeriodicRate(interestRate, paymentsPerYear);
            
            // Process payments for the year
            // Use balance at start of year for calculations
            let remainingPrincipal = balanceAtStartOfYear;
            let totalPrincipalPaid = 0;
            let actualPaymentsMade = 0;
            let totalInterestPaid = 0;
            
            for (let payment = 0; payment < paymentsPerYear && remainingPrincipal > 0.01; payment++) {
              // Calculate interest for this payment period
              const interestPayment = remainingPrincipal * periodicRate;
              totalInterestPaid += interestPayment;
              
              // Principal payment is the difference
              const principalPayment = Math.min(paymentPerPeriod - interestPayment, remainingPrincipal);
              
              // Reduce principal
              remainingPrincipal = Math.max(0, remainingPrincipal - principalPayment);
              totalPrincipalPaid += principalPayment;
              actualPaymentsMade++;
            }
            
            // Round to zero if very small (accounting for floating point errors)
            if (remainingPrincipal < 0.01) {
              remainingPrincipal = 0;
            }
            
            // Update mortgage balance
            accountBalances[account.id] = remainingPrincipal;
            
            // Calculate ACTUAL payments made this year (not the full year if paid off early)
            const actualTotalPaymentsThisYear = actualPaymentsMade * paymentPerPeriod;
            
            // Check if mortgage was paid off this year (had balance at start, now paid off)
            if (wasMortgageActive && remainingPrincipal <= 0.01) {
              mortgagePayoffsThisYear.push({
                accountId: account.id,
                accountName: account.name
              });
            }
            
            // Deduct ACTUAL mortgage payments made from cash account (not full year if paid off early)
            const cashAccount = (accounts || []).find(a => 
              a.kind === 'asset' && (a.type === 'chequing' || a.type === 'cash')
            ) || (accounts || []).find(a => a.kind === 'asset');
            
            if (cashAccount) {
              const cashBefore = accountBalances[cashAccount.id] || cashAccount.balance;
              const cashAfter = cashBefore - actualTotalPaymentsThisYear;
              accountBalances[cashAccount.id] = Math.max(0, cashAfter);
              
              // Track mortgage payment outflows
              yearAccountFlows[cashAccount.id].outflows.push({
                source: `Mortgage Payment (${account.name})`,
                amount: actualTotalPaymentsThisYear
              });
              
              // Track mortgage principal reduction as inflow (reduces liability)
              if (totalPrincipalPaid > 0) {
                yearAccountFlows[account.id].outflows.push({
                  source: 'Principal Payment',
                  amount: totalPrincipalPaid
                });
              }
              
              if (cashAfter < 0) {
                console.warn(`[Projections] ⚠️ Cash account ${cashAccount.name} went negative after mortgage payment! Cash before: $${cashBefore.toLocaleString('en-CA')}, Payment: $${actualTotalPaymentsThisYear.toLocaleString('en-CA')}, Cash after (capped at 0): $${accountBalances[cashAccount.id].toLocaleString('en-CA')}`);
                console.warn(`[Projections] This means expenses + mortgage payments exceed income + existing cash, which will reduce net worth.`);
              }
            } else {
              console.warn(`[Projections] No cash account found to deduct mortgage payment for ${account.name}`);
            }
          } else {
            // Mortgage is either paid off or missing required inputs
            // Only log warnings for missing inputs (not for paid-off mortgages)
            if (!hasBalance) {
              // Mortgage already paid off - silently skip
            } else {
              // Missing required inputs - log warning only for first year
              if (year === currentYear + 1) {
                const reasons: string[] = [];
                if (!hasInterestRate) reasons.push(`missing or invalid interest rate (${interestRate})`);
                if (!hasPaymentAmount) reasons.push(`missing or invalid payment amount (${paymentAmount})`);
                if (reasons.length > 0) {
                  console.warn(`[Projections] ⚠️ Mortgage ${account.name} missing required inputs: ${reasons.join(', ')}`);
                }
              }
            }
            
            // Ensure balance is tracked (stays at 0 if paid off, or stays at current if missing inputs)
            if (accountBalances[account.id] === undefined) {
              accountBalances[account.id] = balanceAtStartOfYear;
            } else if (balanceAtStartOfYear <= 0.01) {
              // Ensure paid-off mortgage stays at 0
              accountBalances[account.id] = 0;
            }
          }
        }
      });
      
      // Calculate projected net worth from updated balances
      const projectedAssets = (accounts || [])
        .filter(a => a.kind === 'asset')
        .reduce((sum, a) => {
          const balance = accountBalances[a.id] !== undefined ? accountBalances[a.id] : a.balance;
          return sum + balance;
        }, 0);
      
      const projectedLiabilities = (accounts || [])
        .filter(a => a.kind === 'liability')
        .reduce((sum, a) => {
          const balance = accountBalances[a.id] !== undefined ? accountBalances[a.id] : a.balance;
          return sum + balance;
        }, 0);
      
      // Track previous year's net worth for comparison (to detect dips)
      const previousYearData = data[data.length - 1];
      const previousNominalNetWorth = previousYearData 
        ? (previousYearData.netWorth * Math.pow(1 + inflationRate, yearsIntoProjection - 1))
        : currentNetWorth;
      
      const nominalNetWorth = projectedAssets - projectedLiabilities;
      
      // Log net worth breakdown for first few years and around mortgage payoffs
      if (year <= currentYear + 3 || mortgagePayoffsThisYear.length > 0 || (year >= currentYear + 20 && year <= currentYear + 25)) {
        const cashAccounts = (accounts || [])
          .filter(a => a.kind === 'asset' && (a.type === 'chequing' || a.type === 'cash'))
          .map(a => ({ name: a.name, balance: accountBalances[a.id] || a.balance }));
        
        const netWorthChange = nominalNetWorth - previousNominalNetWorth;
        const netWorthChangePercent = previousNominalNetWorth > 0 
          ? (netWorthChange / previousNominalNetWorth) * 100 
          : 0;
        
        console.log(`[Projections] Year ${year} net worth breakdown:`, {
          assets: projectedAssets,
          liabilities: projectedLiabilities,
          netWorth: nominalNetWorth,
          previousNetWorth: previousNominalNetWorth,
          netWorthChange,
          netWorthChangePercent: netWorthChangePercent.toFixed(2) + '%',
          cashAccounts,
          mortgagePayoffs: mortgagePayoffsThisYear.length > 0 ? mortgagePayoffsThisYear.map(m => m.accountName) : null,
          inflationAdjustment: Math.pow(1 + inflationRate, yearsIntoProjection),
          realNetWorth: nominalNetWorth / Math.pow(1 + inflationRate, yearsIntoProjection),
          ...(netWorthChange < -10000 ? { 
            WARNING: 'Large net worth decrease detected!',
            possibleCauses: [
              'Large expenses relative to income',
              'Mortgage payments reducing cash significantly',
              'Investment losses',
              'Cash account going negative'
            ]
          } : {})
        });
      }
      
      // Apply inflation adjustment: convert nominal to real (today's purchasing power)
      // Formula: real = nominal / (1 + inflation)^years
      const inflationAdjustment = Math.pow(1 + inflationRate, yearsIntoProjection);
      const realNetWorth = nominalNetWorth / inflationAdjustment;
      
      // Check if this year has a retirement milestone
      const retirementMilestone = Object.entries(retirementYears).find(([_, retYear]) => retYear === year);
      
      // Check if this year has mortgage payoffs
      const mortgageFreeAccounts = mortgagePayoffsThisYear.length > 0 
        ? mortgagePayoffsThisYear.map(m => m.accountName).join(', ')
        : undefined;
      
      // Update final balances for all accounts this year
      (accounts || []).forEach(account => {
        yearAccountFlows[account.id].balance = accountBalances[account.id] !== undefined 
          ? accountBalances[account.id] 
          : account.balance;
      });
      
      // Store account flows for this year
      accountBalancesByYear.push({
        year,
        accounts: yearAccountFlows
      });
      
      data.push({
        year: year.toString(),
        netWorth: realNetWorth,
        retirementOwner: retirementMilestone ? retirementMilestone[0] : undefined,
        mortgageFreeAccounts: mortgageFreeAccounts,
      });
    }
    
      return { chartData: data, accountBalancesByYear };
    } catch (error) {
      console.error('[Projections] Error calculating chart data:', error);
      // Return minimal data to prevent blank screen
      return {
        chartData: [{
          year: currentYear.toString(),
          netWorth: currentNetWorth,
          retirementOwner: undefined,
          mortgageFreeAccounts: undefined,
        }],
        accountBalancesByYear: [{
          year: currentYear,
          accounts: {}
        }]
      };
    }
  }, [currentYear, endOfPlanYear, currentNetWorth, accounts, projectionInputs, inflationRate, retirementYears, incomes, expenses]);

  // Collect retirement milestones for chart (must be before early return)
  const retirementMilestones = useMemo(() => {
    try {
      const milestones: Array<{ year: number; owner: string; netWorth: number }> = [];
      Object.entries(retirementYears || {}).forEach(([owner, year]) => {
        const yearData = chartData.find(d => d.year === year.toString());
        if (yearData) {
          milestones.push({
            year,
            owner,
            netWorth: yearData.netWorth,
          });
        }
      });
      return milestones;
    } catch (error) {
      console.error('[Projections] Error calculating retirement milestones:', error);
      return [];
    }
  }, [retirementYears, chartData]);

  // Collect mortgage-free milestones for chart (must be before early return)
  const mortgageMilestones = useMemo(() => {
    try {
      const milestones: Array<{ year: number; accountName: string; netWorth: number }> = [];
      let dataPointsWithMortgages = 0;
      
      chartData.forEach((dataPoint) => {
        if (dataPoint.mortgageFreeAccounts) {
          dataPointsWithMortgages++;
          const year = parseInt(dataPoint.year);
          if (!isNaN(year)) {
            // Split multiple mortgages if there are any
            const accountNames = dataPoint.mortgageFreeAccounts.split(', ');
            accountNames.forEach((accountName) => {
              milestones.push({
                year,
                accountName: accountName.trim(),
                netWorth: dataPoint.netWorth,
              });
            });
          }
        }
      });
      
      return milestones;
    } catch (error) {
      console.error('[Projections] Error calculating mortgage milestones:', error);
      return [];
    }
  }, [chartData]);

  // Early return if no household (must be after ALL hooks)
  if (!household) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-lg border-2 border-gray-200">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Projections</h1>
        <p className="text-gray-600">Please set up your household in Settings first.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4 pt-4">
        <h1 className="text-3xl font-bold text-gray-900">Projections</h1>
      </div>

      {/* Three Panel Layout */}
      <div className="flex-1 flex overflow-hidden gap-2 px-2 pb-2 relative">
        {/* Left Panel - Settings */}
        <div className={`bg-blue-50 rounded-lg shadow-lg border-2 border-blue-200 flex flex-col transition-all duration-300 ease-in-out relative ${
          leftPanelVisible ? 'w-80 min-w-80' : 'w-12 min-w-12'
        }`}>
          {/* Toggle Button - Always visible in top-left corner */}
          <button
            onClick={() => setLeftPanelVisible(!leftPanelVisible)}
            className="absolute top-3 left-3 p-2.5 bg-blue-100 hover:bg-blue-200 text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all z-20 border border-blue-300"
            title={leftPanelVisible ? "Hide Settings Panel" : "Show Settings Panel"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {/* Rounded rectangle outline */}
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" fill="none" />
              {/* Vertical divider line (left side) */}
              <line x1="8" y1="4" x2="8" y2="20" stroke="currentColor" strokeWidth={1.5} />
              {/* Three horizontal lines on left (menu icon) */}
              <line x1="5" y1="7" x2="7" y2="7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="5" y1="10" x2="7" y2="10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="5" y1="13" x2="7" y2="13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
          </button>
          
          {leftPanelVisible && (
            <div className="flex-1 overflow-y-auto p-4 pt-14">
              {/* End of Plan Year */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Plan Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End of Plan Year
                    </label>
                    <input
                      type="number"
                      min={currentYear}
                      max={currentYear + 100}
                      value={endOfPlanYear}
                      onChange={(e) => {
                        const year = parseInt(e.target.value);
                        if (!isNaN(year) && year >= currentYear) {
                          setEndOfPlanYear(year);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Plan spans {endOfPlanYear - currentYear} years ({currentYear} - {endOfPlanYear})
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Inflation Rate: {(inflationRate * 100).toFixed(1)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={inflationRate * 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0 && value <= 10) {
                          setInflationRate(value / 100);
                        }
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(inflationRate * 100) / 10 * 100}%, #e5e7eb ${(inflationRate * 100) / 10 * 100}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0%</span>
                      <span>10%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Adjusts projection to show real purchasing power
                    </p>
                  </div>
                </div>
              </div>


              {/* Retirement Planning */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm mb-4">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Retirement Planning</h2>
                <div className="space-y-4">
                  {allOwners.length === 0 ? (
                    <p className="text-xs text-gray-500">No owners found. Add accounts to see retirement inputs.</p>
                  ) : (
                    allOwners.map((owner) => {
                      const currentAge = ownerAges[owner];
                      const retirementYear = retirementYears[owner];
                      const retirementAge = retirementYear ? getAgeInYear(owner, retirementYear) : null;
                      
                      return (
                        <div key={owner} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                          <h3 className="text-sm font-semibold text-gray-800 mb-3">{owner}</h3>
                          <div className="space-y-3">
                            {/* Age Input */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Current Age
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="120"
                                value={currentAge || ''}
                                onChange={(e) => {
                                  const age = e.target.value === '' ? undefined : parseInt(e.target.value);
                                  setOwnerAges(prev => {
                                    if (age === undefined) {
                                      const { [owner]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [owner]: age };
                                  });
                                }}
                                placeholder="Enter current age"
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {currentAge !== undefined && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Born in approximately {currentYear - currentAge}
                                </p>
                              )}
                            </div>
                            
                            {/* Retirement Year Input */}
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Retirement Year
                              </label>
                              <select
                                value={retirementYear || ''}
                                onChange={(e) => {
                                  const year = e.target.value === '' ? undefined : parseInt(e.target.value);
                                  setRetirementYears(prev => {
                                    if (year === undefined) {
                                      const { [owner]: _, ...rest } = prev;
                                      return rest;
                                    }
                                    return { ...prev, [owner]: year };
                                  });
                                }}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">Select retirement year</option>
                                {(() => {
                                  const options: Array<{ value: number; label: string }> = [];
                                  for (let year = currentYear; year <= endOfPlanYear; year++) {
                                    const age = getAgeInYear(owner, year);
                                    const label = age !== null ? `${year} - ${age}` : year.toString();
                                    options.push({ value: year, label });
                                  }
                                  return options.map(option => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ));
                                })()}
                              </select>
                              {retirementYear && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {retirementAge !== null 
                                    ? `Retires in ${retirementYear} at age ${retirementAge} (${retirementYear - currentYear} years from now)`
                                    : `Retires in ${retirementYear} (${retirementYear - currentYear} years from now)`
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Projection Model Summary */}
              <div className="bg-white rounded-lg p-4 border-2 border-blue-200 shadow-sm">
                <h2 className="text-lg font-bold text-gray-900 mb-3">Projection Model</h2>
                <div className="space-y-2 text-xs">
                  <div className="text-gray-600">
                    Accounts with inputs: {Object.keys(projectionInputs).length}
                  </div>
                  {Object.keys(projectionInputs).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(projectionInputs).map(([accountId, inputs]) => {
                        const account = accounts.find(a => a.id === accountId);
                        if (!account) return null;
                        return (
                          <div key={accountId} className="text-gray-500 border-l-2 border-blue-300 pl-2">
                            <div className="font-medium text-gray-700">{account.name}:</div>
                            {inputs.annualContribution !== undefined && (
                              <div>• Contribution: ${inputs.annualContribution.toLocaleString('en-CA')}/year</div>
                            )}
                            {inputs.annualInvestmentGrowth !== undefined && (
                              <div>• Growth: {(inputs.annualInvestmentGrowth * 100).toFixed(1)}%/year</div>
                            )}
                            {inputs.contributeUntilYear !== undefined && (
                              <div>• Contribute until: {
                                (() => {
                                  const owner = account.owner || 'All / Joint';
                                  if (inputs.contributeUntilYear === 'retirement') {
                                    const retYear = getRetirementYearForOwner(owner);
                                    if (!retYear) return 'Retirement (not set)';
                                    const retAge = getAgeInYear(owner, retYear);
                                    return retAge !== null 
                                      ? `Retirement (${retYear} - ${retAge})`
                                      : `Retirement (${retYear})`;
                                  }
                                  const year = inputs.contributeUntilYear as number;
                                  const age = getAgeInYear(owner, year);
                                  return age !== null ? `${year} - ${age}` : year.toString();
                                })()
                              }</div>
                            )}
                            {/* Mortgage-specific fields */}
                            {account.type === 'mortgage' && (
                              <>
                                {inputs.mortgagePrincipal !== undefined && (
                                  <div>• Principal: ${inputs.mortgagePrincipal.toLocaleString('en-CA')}</div>
                                )}
                                {inputs.mortgageInterestRate !== undefined && (
                                  <div>• Interest Rate: {(inputs.mortgageInterestRate * 100).toFixed(2)}%/year</div>
                                )}
                                {inputs.mortgagePaymentAmount !== undefined && (
                                  <div>• Payment: ${inputs.mortgagePaymentAmount.toLocaleString('en-CA')}/{inputs.mortgagePaymentFrequency === 'weekly' ? 'week' : inputs.mortgagePaymentFrequency === 'accelerated_biweekly' ? 'biweek' : 'month'}</div>
                                )}
                                {inputs.mortgagePaymentFrequency && (
                                  <div>• Frequency: {inputs.mortgagePaymentFrequency === 'weekly' ? 'Weekly (52/year)' : inputs.mortgagePaymentFrequency === 'accelerated_biweekly' ? 'Accelerated Biweekly (26/year)' : 'Monthly (12/year)'}</div>
                                )}
                                {(inputs.mortgageAmortizationYears !== undefined || inputs.mortgageAmortizationMonths !== undefined) && (
                                  <div>• Amortization: {
                                    [
                                      inputs.mortgageAmortizationYears ? `${inputs.mortgageAmortizationYears} years` : '',
                                      inputs.mortgageAmortizationMonths ? `${inputs.mortgageAmortizationMonths} months` : ''
                                    ].filter(Boolean).join(' ') || 'Not set'
                                  }</div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* Incomes Summary */}
                  {incomes && Object.keys(incomes).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-gray-600 mb-1">
                        Incomes: {Object.keys(incomes).length}
                      </div>
                      <div className="space-y-1">
                        {Object.values(incomes).map((income) => {
                          if (!income || !income.id) return null;
                          const startYear = resolveIncomeStartYear(income);
                          const endYear = resolveIncomeEndYear(income);
                          const startYearStr = startYear ? startYear.toString() : 'Not set';
                          const endYearStr = endYear ? endYear.toString() : 'Forever';
                          const growthStr = income.growthRate ? ` (${(income.growthRate * 100).toFixed(1)}% growth)` : '';
                          
                          return (
                            <div key={income.id} className="text-gray-500 border-l-2 border-green-300 pl-2">
                              <div className="font-medium text-gray-700">{income.name}:</div>
                              <div>• Amount: ${income.annualAmount.toLocaleString('en-CA')}/year{growthStr}</div>
                              <div>• Period: {startYearStr} - {endYearStr}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Expenses Summary */}
                  {expenses && Object.keys(expenses).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-gray-600 mb-1">
                        Expenses: {Object.keys(expenses).length}
                      </div>
                      <div className="space-y-1">
                        {Object.values(expenses).map((expense) => {
                          if (!expense || !expense.id) return null;
                          const startYear = resolveExpenseStartYear(expense);
                          const endYear = resolveExpenseEndYear(expense);
                          const startYearStr = startYear ? startYear.toString() : 'Not set';
                          const endYearStr = endYear ? endYear.toString() : 'Forever';
                          const growthStr = expense.growthRate ? ` (${(expense.growthRate * 100).toFixed(1)}% growth)` : '';
                          
                          return (
                            <div key={expense.id} className="text-gray-500 border-l-2 border-red-300 pl-2">
                              <div className="font-medium text-gray-700">{expense.name}:</div>
                              <div>• Amount: ${expense.annualAmount.toLocaleString('en-CA')}/year{growthStr}</div>
                              <div>• Period: {startYearStr} - {endYearStr}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
                        </div>
          )}
                          </div>

        {/* Center Panel - Chart */}
        <div className="flex-1 bg-white rounded-lg shadow-lg border-2 border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 min-h-0">
            <NetWorthProjectionChart 
              chartData={chartData}
              currentNetWorth={currentNetWorth}
              retirementMilestones={retirementMilestones}
              mortgageMilestones={mortgageMilestones}
            />
          </div>
          
          {/* Current Status - Below Chart */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Status</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Current Net Worth</div>
                <div className="text-2xl font-bold text-gray-900">
                  ${currentNetWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Final Net Worth</div>
                <div className="text-2xl font-bold text-gray-900">
                  {chartData.length > 0 ? (
                    `$${chartData[chartData.length - 1].netWorth.toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                  ) : (
                    '$0'
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Account Balances Table */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Account Balances by Year</h2>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-gray-100 z-10">
                  <tr>
                    <th className="border border-gray-300 px-2 py-1 text-left font-semibold bg-gray-100 sticky left-0 z-20">Year</th>
                    {(accounts || []).map(account => (
                      <th key={account.id} className="border border-gray-300 px-2 py-1 text-left font-semibold bg-gray-100 min-w-24">
                        {account.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accountBalancesByYear.map((yearData) => {
                    const year = yearData.year;
                    return (
                      <tr key={year} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-2 py-1 font-medium bg-gray-50 sticky left-0 z-10">
                          {year}
                        </td>
                        {(accounts || []).map(account => {
                          const accountData = yearData.accounts[account.id];
                          const balance = accountData?.balance ?? account.balance;
                          const inflows = accountData?.inflows ?? [];
                          const outflows = accountData?.outflows ?? [];
                          const isAsset = account.kind === 'asset';
                          const isLiability = account.kind === 'liability';
                          
                          return (
                            <td
                              key={account.id}
                              className={`border border-gray-300 px-2 py-1 text-right relative group cursor-help ${
                                isAsset ? 'text-green-700' : isLiability ? 'text-red-700' : 'text-gray-700'
                              }`}
                            >
                              <span>
                                {isLiability ? '-' : ''}${Math.abs(balance).toLocaleString('en-CA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                              
                              {/* Hover Tooltip */}
                              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-80 bg-white border-2 border-gray-300 rounded-lg shadow-xl p-3 z-50 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                <div className="font-semibold text-gray-900 mb-2">{account.name} - {year}</div>
                                <div className="text-xs">
                                  <div className="mb-2">
                                    <div className="font-medium text-gray-700 mb-1">Ending Balance:</div>
                                    <div className={isAsset ? 'text-green-700' : 'text-red-700'}>
                                      {isLiability ? '-' : ''}${Math.abs(balance).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                  
                                  {inflows.length > 0 && (
                                    <div className="mb-2">
                                      <div className="font-medium text-green-700 mb-1">Inflows:</div>
                                      {inflows.map((flow, idx) => (
                                        <div key={idx} className="text-green-600 pl-2">
                                          + ${flow.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {flow.source}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {outflows.length > 0 && (
                                    <div>
                                      <div className="font-medium text-red-700 mb-1">Outflows:</div>
                                      {outflows.map((flow, idx) => (
                                        <div key={idx} className="text-red-600 pl-2">
                                          - ${flow.amount.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - {flow.source}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  
                                  {inflows.length === 0 && outflows.length === 0 && (
                                    <div className="text-gray-500 italic">No transactions this year</div>
                                  )}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Panel - Placeholder (empty for now) */}
        <div className={`bg-green-50 rounded-lg shadow-lg border-2 border-green-200 flex flex-col transition-all duration-300 ease-in-out relative ${
          rightPanelVisible ? 'w-80 min-w-80' : 'w-12 min-w-12'
        }`}>
          {/* Toggle Button - Always visible in top-right corner */}
                                          <button
            onClick={() => setRightPanelVisible(!rightPanelVisible)}
            className="absolute top-3 right-3 p-2.5 bg-green-100 hover:bg-green-200 text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all z-20 border border-green-300"
            title={rightPanelVisible ? "Hide Inputs Panel" : "Show Inputs Panel"}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              {/* Rounded rectangle outline */}
              <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" fill="none" />
              {/* Vertical divider line (right side) */}
              <line x1="16" y1="4" x2="16" y2="20" stroke="currentColor" strokeWidth={1.5} />
              {/* Three horizontal lines on right (menu icon) */}
              <line x1="17" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="17" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              <line x1="17" y1="13" x2="19" y2="13" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
                                          </button>
          
          {rightPanelVisible && (
            <div className="flex-1 overflow-y-auto p-4 pt-14">
              <div className="space-y-4">
                {/* Accounts Section */}
                <div className="bg-white rounded-lg border-2 border-green-200 shadow-sm">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setAccountsSectionExpanded(!accountsSectionExpanded)}
                  >
                    <h2 className="text-xl font-bold text-gray-900">Accounts</h2>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform ${accountsSectionExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  
                  {accountsSectionExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      {Object.keys(accountsByOwner).length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">No accounts configured yet.</p>
                        </div>
                      ) : (
                        Object.entries(accountsByOwner).map(([owner, ownerAccounts]) => (
                          <div key={owner} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">
                              {owner}
                            </h3>
                            <div className="space-y-3">
                        {ownerAccounts.map((account) => {
                          const isExpanded = expandedAccounts.has(account.id);
                          const accountInputs = projectionInputs[account.id] || {};
                          
                          return (
                            <div key={account.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              {/* Account Header - Clickable to expand */}
                              <div 
                                className="flex items-start justify-between cursor-pointer"
                                onClick={() => toggleAccountExpansion(account.id)}
                              >
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-gray-900">{account.name}</div>
                                  <div className="text-xs text-gray-500">{formatAccountType(account.type)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className={`text-sm font-semibold ${
                                      account.kind === 'asset' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {account.kind === 'asset' ? '+' : '-'}${Math.abs(account.balance).toLocaleString('en-CA', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}
                                    </div>
                                  </div>
                                  <svg 
                                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                                  {/* Placeholder for all accounts */}
                                  <div className="text-xs text-gray-500 italic">
                                    Custom modifiers for {formatAccountType(account.type)} accounts
                                  </div>

                                  {/* RRSP-specific inputs */}
                                  {account.type === 'rrsp' && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Contribution ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          value={accountInputs.annualContribution || ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            updateProjectionInput(account.id, 'annualContribution', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Annual dollar amount contributed to this RRSP
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Investment Growth (%)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.1"
                                          value={accountInputs.annualInvestmentGrowth !== undefined ? accountInputs.annualInvestmentGrowth * 100 : ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                            updateProjectionInput(account.id, 'annualInvestmentGrowth', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Expected annual return (e.g., 6 for 6%)
                                        </p>
                                        {accountInputs.annualInvestmentGrowth !== undefined && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                            Current: {(accountInputs.annualInvestmentGrowth * 100).toFixed(1)}% annually
                                          </p>
                                        )}
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Contribute Until
                                        </label>
                                        <select
                                          value={accountInputs.contributeUntilYear !== undefined ? accountInputs.contributeUntilYear : ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              updateProjectionInput(account.id, 'contributeUntilYear', undefined);
                                            } else if (value === 'retirement') {
                                              updateProjectionInput(account.id, 'contributeUntilYear', 'retirement');
                                            } else {
                                              updateProjectionInput(account.id, 'contributeUntilYear', parseInt(value));
                                            }
                                          }}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="">Forever (no end)</option>
                                          {getContributeUntilYearOptions(account).map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Stop contributing after this year
                                        </p>
                                        {accountInputs.contributeUntilYear !== undefined && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                            {(() => {
                                              const owner = account.owner || 'All / Joint';
                                              if (accountInputs.contributeUntilYear === 'retirement') {
                                                const retYear = getRetirementYearForOwner(owner);
                                                if (!retYear) return 'Will stop at retirement (not set)';
                                                const retAge = getAgeInYear(owner, retYear);
                                                return retAge !== null
                                                  ? `Will stop at retirement (${retYear} - ${retAge})`
                                                  : `Will stop at retirement (${retYear})`;
                                              }
                                              const year = accountInputs.contributeUntilYear as number;
                                              const age = getAgeInYear(owner, year);
                                              return age !== null
                                                ? `Will stop contributing in ${year} (age ${age})`
                                                : `Will stop contributing in ${year}`;
                                            })()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* TFSA-specific inputs */}
                                  {account.type === 'tfsa' && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Contribution ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="100"
                                          value={accountInputs.annualContribution || ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            updateProjectionInput(account.id, 'annualContribution', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Annual dollar amount contributed to this TFSA
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Annual Investment Growth (%)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.1"
                                          value={accountInputs.annualInvestmentGrowth !== undefined ? accountInputs.annualInvestmentGrowth * 100 : ''}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                            updateProjectionInput(account.id, 'annualInvestmentGrowth', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Expected annual return (e.g., 6 for 6%)
                                        </p>
                                        {accountInputs.annualInvestmentGrowth !== undefined && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                            Current: {(accountInputs.annualInvestmentGrowth * 100).toFixed(1)}% annually
                                          </p>
                                        )}
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Contribute Until
                                        </label>
                                        <select
                                          value={accountInputs.contributeUntilYear !== undefined ? accountInputs.contributeUntilYear : ''}
                                          onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                              updateProjectionInput(account.id, 'contributeUntilYear', undefined);
                                            } else if (value === 'retirement') {
                                              updateProjectionInput(account.id, 'contributeUntilYear', 'retirement');
                                            } else {
                                              updateProjectionInput(account.id, 'contributeUntilYear', parseInt(value));
                                            }
                                          }}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="">Forever (no end)</option>
                                          {getContributeUntilYearOptions(account).map((option) => (
                                            <option key={option.value} value={option.value}>
                                              {option.label}
                                            </option>
                                          ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Stop contributing after this year
                                        </p>
                                        {accountInputs.contributeUntilYear !== undefined && (
                                          <p className="text-xs text-blue-600 mt-1 font-medium">
                                            {(() => {
                                              const owner = account.owner || 'All / Joint';
                                              if (accountInputs.contributeUntilYear === 'retirement') {
                                                const retYear = getRetirementYearForOwner(owner);
                                                if (!retYear) return 'Will stop at retirement (not set)';
                                                const retAge = getAgeInYear(owner, retYear);
                                                return retAge !== null
                                                  ? `Will stop at retirement (${retYear} - ${retAge})`
                                                  : `Will stop at retirement (${retYear})`;
                                              }
                                              const year = accountInputs.contributeUntilYear as number;
                                              const age = getAgeInYear(owner, year);
                                              return age !== null
                                                ? `Will stop contributing in ${year} (age ${age})`
                                                : `Will stop contributing in ${year}`;
                                            })()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Mortgage-specific inputs */}
                                  {account.type === 'mortgage' && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Principal ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="1000"
                                          value={accountInputs.mortgagePrincipal !== undefined ? accountInputs.mortgagePrincipal : account.balance}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            updateProjectionInput(account.id, 'mortgagePrincipal', value);
                                          }}
                                          placeholder={account.balance.toString()}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Current mortgage principal balance
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Interest Rate (%)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="20"
                                          step="0.01"
                                          value={(() => {
                                            if (accountInputs.mortgageInterestRate !== undefined) {
                                              return accountInputs.mortgageInterestRate * 100;
                                            }
                                            if (account.interestRate !== undefined && account.interestRate !== null) {
                                              // account.interestRate might be stored as percentage (4.04) or decimal (0.0404)
                                              // If > 1, it's a percentage, show as-is; if <= 1, it's a decimal, convert to percentage
                                              return account.interestRate > 1 ? account.interestRate : account.interestRate * 100;
                                            }
                                            return '';
                                          })()}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                            updateProjectionInput(account.id, 'mortgageInterestRate', value);
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Annual interest rate (Canadian: compounds semi-annually)
                                        </p>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Amortization (Years)
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max="50"
                                            step="1"
                                            value={accountInputs.mortgageAmortizationYears || ''}
                                            onChange={(e) => {
                                              const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                              updateProjectionInput(account.id, 'mortgageAmortizationYears', value);
                                            }}
                                            placeholder="25"
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Amortization (Months)
                                          </label>
                                          <input
                                            type="number"
                                            min="0"
                                            max="11"
                                            step="1"
                                            value={accountInputs.mortgageAmortizationMonths || ''}
                                            onChange={(e) => {
                                              const value = e.target.value === '' ? undefined : parseInt(e.target.value);
                                              updateProjectionInput(account.id, 'mortgageAmortizationMonths', value);
                                            }}
                                            placeholder="0"
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Payment Amount ($)
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          step="10"
                                          value={accountInputs.mortgagePaymentAmount !== undefined ? accountInputs.mortgagePaymentAmount : (account.monthlyPayment !== undefined && account.monthlyPayment !== null ? account.monthlyPayment : '')}
                                          onChange={(e) => {
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            if (value !== undefined && !isNaN(value)) {
                                              updateProjectionInput(account.id, 'mortgagePaymentAmount', value);
                                            }
                                          }}
                                          onBlur={(e) => {
                                            // Ensure value is saved even if user just clicks away
                                            const value = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                            if (value !== undefined && !isNaN(value) && value > 0) {
                                              updateProjectionInput(account.id, 'mortgagePaymentAmount', value);
                                            }
                                          }}
                                          placeholder="0"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          Payment amount (will be adjusted based on frequency)
                                        </p>
                                      </div>

                                      <div>
                                        <label className="block text-xs font-medium text-gray-700 mb-1">
                                          Payment Frequency
                                        </label>
                                        <select
                                          value={accountInputs.mortgagePaymentFrequency || 'monthly'}
                                          onChange={(e) => {
                                            updateProjectionInput(account.id, 'mortgagePaymentFrequency', e.target.value);
                                          }}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="monthly">Monthly</option>
                                          <option value="weekly">Weekly</option>
                                          <option value="accelerated_biweekly">Accelerated Biweekly</option>
                                        </select>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          {accountInputs.mortgagePaymentFrequency === 'weekly' 
                                            ? '52 payments per year (monthly payment ÷ 4.33)'
                                            : accountInputs.mortgagePaymentFrequency === 'accelerated_biweekly'
                                            ? '26 payments per year (monthly payment ÷ 2, effectively 13 monthly payments/year)'
                                            : '12 payments per year'
                                          }
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                            })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Incomes Section */}
                <div className="bg-white rounded-lg border-2 border-green-200 shadow-sm">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setIncomesSectionExpanded(!incomesSectionExpanded)}
                  >
                    <h2 className="text-xl font-bold text-gray-900">Incomes</h2>
                    <svg 
                      className={`w-5 h-5 text-gray-500 transition-transform ${incomesSectionExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  
                  {incomesSectionExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      {/* Add Income Button */}
                      <button
                        onClick={addIncome}
                        className="w-full px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 font-medium rounded-lg border border-green-300 transition-colors"
                      >
                        + Add Income
                      </button>

                      {/* Income List */}
                      {!incomes || Object.keys(incomes).length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">No incomes configured yet. Click "Add Income" to create one.</p>
                        </div>
                      ) : (
                        Object.values(incomes).map((income) => {
                          if (!income || !income.id) return null;
                          
                          try {
                            const owner = income.owner || (allOwners.length > 0 ? allOwners[0] : 'All / Joint');
                            const startDateOptions = getYearOptions(owner, true, true);
                            const endDateOptions = getYearOptions(owner, false, true);
                            
                            // Resolve start date to actual year
                            const resolveStartYear = (startDate: number | 'now' | 'retirement' | undefined): number | null => {
                              if (!startDate) return null;
                              if (startDate === 'now') return currentYear;
                              if (startDate === 'retirement') {
                                return getRetirementYearForOwner(owner) || null;
                              }
                              return startDate;
                            };

                            // Resolve end date to actual year
                            const resolveEndYear = (endDate: number | 'retirement' | undefined): number | null => {
                              if (!endDate) return null;
                              if (endDate === 'retirement') {
                                return getRetirementYearForOwner(owner) || null;
                              }
                              return endDate;
                            };

                            const startYear = resolveStartYear(income.startDate);
                            const endYear = resolveEndYear(income.endDate);
                          
                          const isExpanded = expandedIncomes.has(income.id);
                          
                          return (
                            <div key={income.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                              {/* Income Header - Clickable to expand */}
                              <div 
                                className="flex items-center justify-between cursor-pointer"
                                onClick={() => toggleIncomeExpansion(income.id)}
                              >
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={income.name}
                                    onChange={(e) => updateIncome(income.id, 'name', e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Income name"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-gray-500">
                                    ${(income.annualAmount || 0).toLocaleString('en-CA')}/year
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteIncome(income.id);
                                    }}
                                    className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                    title="Delete income"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  <svg 
                                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Expanded Content */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                              {/* Annual Amount */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Annual Amount ($)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="100"
                                  value={income.annualAmount || ''}
                                  onChange={(e) => updateIncome(income.id, 'annualAmount', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>

                              {/* Owner */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Owner
                                </label>
                                <select
                                  value={income.owner || (allOwners.length > 0 ? allOwners[0] : 'All / Joint')}
                                  onChange={(e) => updateIncome(income.id, 'owner', e.target.value)}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  {allOwners.length > 0 ? allOwners.map((owner) => (
                                    <option key={owner} value={owner}>
                                      {owner}
                                    </option>
                                  )) : (
                                    <option value="All / Joint">All / Joint</option>
                                  )}
                                </select>
                              </div>

                              {/* Growth Rate */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Growth Rate (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={income.growthRate !== undefined ? income.growthRate * 100 : ''}
                                  onChange={(e) => {
                                    const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                    updateIncome(income.id, 'growthRate', value);
                                  }}
                                  placeholder="0"
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Annual salary/income growth rate (e.g., 3 for 3%)
                                </p>
                              </div>

                              {/* Start Date */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Start Date
                                </label>
                                <select
                                  value={income.startDate !== undefined ? income.startDate : 'now'}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === 'now') {
                                      updateIncome(income.id, 'startDate', 'now');
                                    } else if (value === 'retirement') {
                                      updateIncome(income.id, 'startDate', 'retirement');
                                    } else {
                                      updateIncome(income.id, 'startDate', parseInt(value));
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  {startDateOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                {startYear !== null && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Starts in {startYear} {getAgeInYear(owner, startYear) !== null ? `(age ${getAgeInYear(owner, startYear)})` : ''}
                                  </p>
                                )}
                              </div>

                              {/* End Date */}
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  End Date
                                </label>
                                <select
                                  value={income.endDate !== undefined ? income.endDate : ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                      updateIncome(income.id, 'endDate', undefined);
                                    } else if (value === 'retirement') {
                                      updateIncome(income.id, 'endDate', 'retirement');
                                    } else {
                                      updateIncome(income.id, 'endDate', parseInt(value));
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">Forever (no end)</option>
                                  {endDateOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                {endYear !== null && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Ends in {endYear} {getAgeInYear(owner, endYear) !== null ? `(age ${getAgeInYear(owner, endYear)})` : ''}
                                  </p>
                                )}
                              </div>
                                </div>
                              )}
                            </div>
                          );
                          } catch (error) {
                            console.error('[Projections] Error rendering income:', error, income);
                            return null;
                          }
                        }).filter(Boolean)
                      )}
                    </div>
                  )}
                </div>

                {/* Expenses Section */}
                <div className="bg-white rounded-lg border-2 border-green-200 shadow-sm">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => setExpensesSectionExpanded(!expensesSectionExpanded)}
                  >
                    <h2 className="text-xl font-bold text-gray-900">Expenses</h2>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${expensesSectionExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {expensesSectionExpanded && (
                    <div className="px-4 pb-4 space-y-4">
                      {/* Add Expense Button */}
                      <button
                        onClick={addExpense}
                        className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 font-medium rounded-lg border border-red-300 transition-colors"
                      >
                        + Add Expense
                      </button>

                      {/* Expense List */}
                      {!expenses || Object.keys(expenses).length === 0 ? (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">No expenses configured yet. Click "Add Expense" to create one.</p>
                        </div>
                      ) : (
                        Object.values(expenses).map((expense: Expense) => {
                          if (!expense || !expense.id) return null;

                          try {
                            const owner = expense.owner || (allOwners.length > 0 ? allOwners[0] : 'All / Joint');
                            const startDateOptions = getYearOptions(owner, true, true);
                            const endDateOptions = getYearOptions(owner, false, true);

                            // Resolve start date to actual year
                            const resolveStartYear = (startDate: number | 'now' | 'retirement' | undefined): number | null => {
                              if (!startDate) return null;
                              if (startDate === 'now') return currentYear;
                              if (startDate === 'retirement') {
                                return getRetirementYearForOwner(owner) || null;
                              }
                              return startDate;
                            };

                            // Resolve end date to actual year
                            const resolveEndYear = (endDate: number | 'retirement' | undefined): number | null => {
                              if (!endDate) return null;
                              if (endDate === 'retirement') {
                                return getRetirementYearForOwner(owner) || null;
                              }
                              return endDate;
                            };

                            const startYear = resolveStartYear(expense.startDate);
                            const endYear = resolveEndYear(expense.endDate);

                            const isExpanded = expandedExpenses.has(expense.id);
                            
                            return (
                              <div key={expense.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                {/* Expense Header - Clickable to expand */}
                                <div 
                                  className="flex items-center justify-between cursor-pointer"
                                  onClick={() => toggleExpenseExpansion(expense.id)}
                                >
                                  <div className="flex-1">
                                    <input
                                      type="text"
                                      value={expense.name}
                                      onChange={(e) => updateExpense(expense.id, 'name', e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full px-2 py-1 text-sm font-medium text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Expense name"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-xs text-gray-500">
                                      ${(expense.annualAmount || 0).toLocaleString('en-CA')}/year
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteExpense(expense.id);
                                      }}
                                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                      title="Delete expense"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                    <svg 
                                      className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                      fill="none" 
                                      stroke="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>

                                {/* Expanded Content */}
                                {isExpanded && (
                                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                                {/* Annual Amount */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Annual Amount ($)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    value={expense.annualAmount || ''}
                                    onChange={(e) => updateExpense(expense.id, 'annualAmount', parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                </div>

                                {/* Owner */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Owner
                                  </label>
                                  <select
                                    value={expense.owner || (allOwners.length > 0 ? allOwners[0] : 'All / Joint')}
                                    onChange={(e) => updateExpense(expense.id, 'owner', e.target.value)}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {allOwners.length > 0 ? allOwners.map((owner) => (
                                      <option key={owner} value={owner}>
                                        {owner}
                                      </option>
                                    )) : (
                                      <option value="All / Joint">All / Joint</option>
                                    )}
                                  </select>
                                </div>

                                {/* Growth Rate */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Growth Rate (%)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={expense.growthRate !== undefined ? expense.growthRate * 100 : ''}
                                    onChange={(e) => {
                                      const value = e.target.value === '' ? undefined : parseFloat(e.target.value) / 100;
                                      updateExpense(expense.id, 'growthRate', value);
                                    }}
                                    placeholder="0"
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Annual expense growth rate (e.g., 3 for 3%)
                                  </p>
                                </div>

                                {/* Start Date */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Start Date
                                  </label>
                                  <select
                                    value={expense.startDate !== undefined ? expense.startDate : 'now'}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === 'now') {
                                        updateExpense(expense.id, 'startDate', 'now');
                                      } else if (value === 'retirement') {
                                        updateExpense(expense.id, 'startDate', 'retirement');
                                      } else {
                                        updateExpense(expense.id, 'startDate', parseInt(value));
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    {startDateOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  {startYear !== null && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Starts in {startYear} {getAgeInYear(owner, startYear) !== null ? `(age ${getAgeInYear(owner, startYear)})` : ''}
                                    </p>
                                  )}
                                </div>

                                {/* End Date */}
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    End Date
                                  </label>
                                  <select
                                    value={expense.endDate !== undefined ? expense.endDate : ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (value === '') {
                                        updateExpense(expense.id, 'endDate', undefined);
                                      } else if (value === 'retirement') {
                                        updateExpense(expense.id, 'endDate', 'retirement');
                                      } else {
                                        updateExpense(expense.id, 'endDate', parseInt(value));
                                      }
                                    }}
                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  >
                                    <option value="">Forever (no end)</option>
                                    {endDateOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                  {endYear !== null && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      Ends in {endYear} {getAgeInYear(owner, endYear) !== null ? `(age ${getAgeInYear(owner, endYear)})` : ''}
                                    </p>
                                  )}
                                </div>
                                </div>
                              )}
                            </div>
                            );
                          } catch (error) {
                            console.error('[Projections] Error rendering expense:', error, expense);
                            return null;
                          }
                        }).filter(Boolean)
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
