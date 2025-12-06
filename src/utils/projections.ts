// Projection calculation engine for v0.2
// Handles net worth projections and retirement planning

import type {
  Account,
  Transaction,
  ProjectionScenario,
  ProjectionResult,
  ProjectionMonth,
  ProjectionYear,
  ProjectionSummary,
  MortgageVsInvestComparison,
} from '../types/models';
import { calcNetWorth, calcMonthlyIncomeFromTransactions, calcMonthlyExpensesFromTransactions } from './calculations';
import {
  getHoldingReturnRates,
  calculateInvestmentReturn,
  calculateAfterTaxReturn,
  getMarginalTaxRate,
} from './taxCalculations';
import { calculateCPPBenefit, calculateOASBenefit } from './governmentBenefits';

// Helper: Add months to a date
function addMonths(dateStr: string, months: number): Date {
  const date = new Date(dateStr);
  date.setMonth(date.getMonth() + months);
  return date;
}

// Helper: Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper: Get year from date
function getYear(date: Date): number {
  return date.getFullYear();
}

// Helper: Get month from date (1-12)
function getMonth(date: Date): number {
  return date.getMonth() + 1;
}

// Calculate net worth projection
export function projectNetWorth(
  accounts: Account[],
  transactions: Transaction[],
  scenario: ProjectionScenario
): ProjectionResult {
  console.log('[projections] Starting net worth projection for scenario:', scenario.name);
  
  // 1. Calculate starting state
  const startingNetWorth = calcNetWorth(accounts);
  const avgMonthlyIncome = calcMonthlyIncomeFromTransactions(transactions);
  const avgMonthlyExpenses = calcMonthlyExpensesFromTransactions(transactions);
  const monthlySavings = avgMonthlyIncome - avgMonthlyExpenses;
  
  console.log('[projections] Starting net worth:', startingNetWorth);
  console.log('[projections] Monthly income:', avgMonthlyIncome, 'expenses:', avgMonthlyExpenses, 'savings:', monthlySavings);
  
  // 2. Initialize projection state (clone accounts to avoid mutating originals)
  let currentAssets = accounts
    .filter(a => a.kind === 'asset')
    .map(a => ({ ...a, balance: a.balance }));
  let currentLiabilities = accounts
    .filter(a => a.kind === 'liability')
    .map(a => ({ ...a, balance: a.balance }));
  
  const monthlyData: ProjectionMonth[] = [];
  const totalMonths = scenario.config.projectionYears * 12;
  
  // Get initial investment accounts for logging (before loop)
  const initialInvestmentAccounts = currentAssets.filter(a => 
    ['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered'].includes(a.type)
  );
  const initialInvestmentBalance = initialInvestmentAccounts.reduce((sum, a) => sum + a.balance, 0);
  
  console.log('[projections] Projection years:', scenario.config.projectionYears, 'total months:', totalMonths);
  console.log('[projections] Investment accounts:', initialInvestmentAccounts.length, 'total balance:', initialInvestmentBalance);
  
  // 3. Project month by month
  for (let month = 0; month < totalMonths; month++) {
    const date = addMonths(scenario.config.startDate, month);
    const year = getYear(date);
    const monthNum = getMonth(date);
    const dateStr = formatDate(date);
    
    // Get investment accounts and balance for this month (needed for retirement calculations)
    const investmentAccounts = currentAssets.filter(a => 
      ['tfsa', 'rrsp', 'dcpp', 'resp', 'non_registered'].includes(a.type)
    );
    const investmentBalance = investmentAccounts.reduce((sum, a) => sum + a.balance, 0);
    
    // Apply inflation to expenses
    const yearsElapsed = month / 12;
    let inflatedExpenses = avgMonthlyExpenses * Math.pow(1 + scenario.assumptions.inflationRate, yearsElapsed);
    
    // Determine if we're in retirement
    const targetRetirementAge = scenario.assumptions.retirement?.targetRetirementAge || scenario.assumptions.targetRetirementAge;
    const startDate = new Date(scenario.config.startDate);
    const currentDate = addMonths(scenario.config.startDate, month);
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentAge = (currentYear - startYear) + ((currentMonth - startMonth) / 12);
    const isRetired = targetRetirementAge && currentAge >= targetRetirementAge;
    
    // Calculate base income
    let grownIncome = 0;
    if (isRetired) {
      // In retirement: use retirement expense ratio for expenses, and add government benefits
      const retirementExpenseRatio = scenario.assumptions.retirement?.retirementExpenseRatio || scenario.assumptions.retirementExpenseRatio || 0.70;
      inflatedExpenses = avgMonthlyExpenses * retirementExpenseRatio * Math.pow(1 + scenario.assumptions.inflationRate, yearsElapsed);
      
      // Add CPP benefits
      let cppIncome = 0;
      if (scenario.assumptions.cpp?.person1?.expectedBenefit) {
        cppIncome += scenario.assumptions.cpp.person1.expectedBenefit;
      }
      if (scenario.assumptions.cpp?.person2?.expectedBenefit) {
        cppIncome += scenario.assumptions.cpp.person2.expectedBenefit;
      }
      
      // Add OAS benefits (with clawback consideration)
      let oasIncome = 0;
      const currentAnnualIncome = grownIncome * 12; // Will be updated below
      if (scenario.assumptions.oas?.person1?.expectedBenefit) {
        const oas1 = calculateOASBenefit(
          scenario.assumptions.oas.person1,
          currentAnnualIncome
        );
        oasIncome += oas1;
      }
      if (scenario.assumptions.oas?.person2?.expectedBenefit) {
        const oas2 = calculateOASBenefit(
          scenario.assumptions.oas.person2,
          currentAnnualIncome
        );
        oasIncome += oas2;
      }
      
      // Calculate withdrawal from investments
      const withdrawalRate = scenario.assumptions.retirement?.withdrawalRate || scenario.assumptions.withdrawalRate || 0.04;
      const annualWithdrawalRate = withdrawalRate / 12; // Monthly
      const investmentWithdrawal = investmentBalance * annualWithdrawalRate;
      
      // Apply withdrawal strategy
      let withdrawalIncome = 0;
      const withdrawalStrategy = scenario.assumptions.retirement?.withdrawalStrategy || 'tax_optimized';
      
      if (withdrawalStrategy === 'rrsp_first') {
        // Withdraw from RRSP first
        const rrspAccounts = investmentAccounts.filter(a => a.type === 'rrsp' || a.type === 'dcpp');
        const rrspBalance = rrspAccounts.reduce((sum, a) => sum + a.balance, 0);
        if (rrspBalance > 0) {
          withdrawalIncome = Math.min(investmentWithdrawal, rrspBalance * annualWithdrawalRate);
        } else {
          // Fall back to TFSA
          const tfsaAccounts = investmentAccounts.filter(a => a.type === 'tfsa');
          const tfsaBalance = tfsaAccounts.reduce((sum, a) => sum + a.balance, 0);
          withdrawalIncome = Math.min(investmentWithdrawal, tfsaBalance * annualWithdrawalRate);
        }
      } else if (withdrawalStrategy === 'tfsa_first') {
        // Withdraw from TFSA first
        const tfsaAccounts = investmentAccounts.filter(a => a.type === 'tfsa');
        const tfsaBalance = tfsaAccounts.reduce((sum, a) => sum + a.balance, 0);
        if (tfsaBalance > 0) {
          withdrawalIncome = Math.min(investmentWithdrawal, tfsaBalance * annualWithdrawalRate);
        } else {
          // Fall back to RRSP
          const rrspAccounts = investmentAccounts.filter(a => a.type === 'rrsp' || a.type === 'dcpp');
          const rrspBalance = rrspAccounts.reduce((sum, a) => sum + a.balance, 0);
          withdrawalIncome = Math.min(investmentWithdrawal, rrspBalance * annualWithdrawalRate);
        }
      } else if (withdrawalStrategy === 'balanced') {
        // Withdraw proportionally
        withdrawalIncome = investmentWithdrawal;
      } else {
        // Tax-optimized: balance between RRSP and TFSA to minimize taxes
        withdrawalIncome = investmentWithdrawal;
      }
      
      grownIncome = cppIncome + oasIncome + withdrawalIncome;
      
      // Add healthcare and long-term care costs if specified
      if (scenario.assumptions.retirement?.healthcareCosts) {
        inflatedExpenses += scenario.assumptions.retirement.healthcareCosts / 12;
      }
      if (scenario.assumptions.retirement?.longTermCareCosts) {
        inflatedExpenses += scenario.assumptions.retirement.longTermCareCosts / 12;
      }
    } else {
      // Not retired: use salary growth
      grownIncome = avgMonthlyIncome * Math.pow(1 + scenario.assumptions.salaryGrowthRate, yearsElapsed);
    }
    
    // Calculate savings
    let savings = grownIncome - inflatedExpenses;
    
    // Apply life events
    scenario.lifeEvents?.forEach(event => {
      const eventYear = Math.floor(event.year);
      const eventMonth = event.month || 1;
      const currentYear = year;
      const currentMonth = monthNum;
      
      // Check if this is the event month
      if (eventYear === currentYear && eventMonth === currentMonth) {
        if (event.type === 'income_change' || event.type === 'one_time_income') {
          savings += event.amount;
        } else if (event.type === 'expense_change' || event.type === 'one_time_expense') {
          savings -= Math.abs(event.amount);
        }
        
        // If recurring, apply going forward
        if (event.recurring && month > 0) {
          // Already applied above, will continue in future months
        }
      } else if (event.recurring && eventYear <= currentYear && (eventYear < currentYear || eventMonth <= currentMonth)) {
        // Apply recurring events
        if (event.type === 'income_change') {
          savings += event.amount;
        } else if (event.type === 'expense_change') {
          savings -= Math.abs(event.amount);
        }
      }
    });
    
    // Apply investment growth to investment accounts (tax-aware)
    // Note: investmentAccounts and investmentBalance are already calculated above
    
    // Calculate taxable income for tax calculations (simplified: use grown income)
    const taxableIncome = grownIncome * 12; // Annual taxable income
    
    // Add new contributions to investments (assume 70% of savings goes to investments)
    const investmentAllocation = 0.7; // 70% to investments, 30% to cash
    const investmentContributions = savings * investmentAllocation;
    
    let totalInvestmentGrowth = 0;
    let totalInvestmentDividends = 0;
    let totalTaxPaid = 0;
    
    // Process each investment account separately to apply per-account/holding rates and taxes
    if (investmentAccounts.length > 0) {
      // First pass: calculate returns and update balances
      investmentAccounts.forEach(acc => {
        // Get return rates for this account (check holdings if available)
        let accountGrowthRate: number;
        let accountDividendYield: number;
        let accountDividendType: 'canadian_eligible' | 'canadian_non_eligible' | 'foreign' | 'none' = 'canadian_eligible';
        
        if (acc.holdings && acc.holdings.length > 0) {
          // If account has holdings, calculate weighted average rates
          let totalHoldingValue = 0;
          let weightedGrowth = 0;
          let weightedDividend = 0;
          
          acc.holdings.forEach(holding => {
            const holdingValue = holding.shares * holding.currentPrice;
            const rates = getHoldingReturnRates(holding, acc, scenario.assumptions);
            weightedGrowth += holdingValue * rates.growthRate;
            weightedDividend += holdingValue * rates.dividendYield;
            if (rates.dividendType) accountDividendType = rates.dividendType;
            totalHoldingValue += holdingValue;
          });
          
          accountGrowthRate = totalHoldingValue > 0 ? weightedGrowth / totalHoldingValue : 
            (scenario.assumptions.investmentGrowthRate ?? scenario.assumptions.investmentReturnRate * 0.7);
          accountDividendYield = totalHoldingValue > 0 ? weightedDividend / totalHoldingValue :
            (scenario.assumptions.investmentDividendYield ?? scenario.assumptions.investmentReturnRate * 0.3);
        } else {
          // Use account-specific rates or scenario defaults
          accountGrowthRate = acc.investmentGrowthRate ?? 
            scenario.assumptions.investmentGrowthRate ?? 
            (scenario.assumptions.investmentReturnRate * 0.7);
          accountDividendYield = acc.investmentDividendYield ?? 
            scenario.assumptions.investmentDividendYield ?? 
            (scenario.assumptions.investmentReturnRate * 0.3);
        }
        
        // Log rates for debugging (first month only)
        if (month === 0 && acc.name) {
          console.log(`[projections] Account ${acc.name}: balance=${acc.balance.toFixed(2)}, growthRate=${(accountGrowthRate * 100).toFixed(2)}%, dividendYield=${(accountDividendYield * 100).toFixed(2)}%`);
        }
        
        // Calculate investment return for this account (monthly)
        const returnData = calculateInvestmentReturn(acc.balance, accountGrowthRate, accountDividendYield);
        
        // Log first month returns for debugging
        if (month === 0 && acc.name) {
          console.log(`[projections] Account ${acc.name} return: growth=${returnData.growth.toFixed(2)}, dividends=${returnData.dividends.toFixed(2)}, total=${returnData.total.toFixed(2)}`);
        }
        
        // Calculate after-tax return (only applies to non-registered accounts)
        const afterTaxReturn = calculateAfterTaxReturn(
          returnData,
          acc,
          scenario.assumptions,
          taxableIncome
        );
        
        // Update account balance with after-tax return (compounding)
        const balanceBefore = acc.balance;
        acc.balance += afterTaxReturn.totalAfterTax;
        
        // Log first month balance changes for debugging
        if (month === 0 && acc.name) {
          console.log(`[projections] Account ${acc.name}: ${balanceBefore.toFixed(2)} -> ${acc.balance.toFixed(2)} (change: ${afterTaxReturn.totalAfterTax.toFixed(2)})`);
        }
        
        // Track totals
        totalInvestmentGrowth += afterTaxReturn.afterTaxGrowth;
        totalInvestmentDividends += afterTaxReturn.afterTaxDividends;
        totalTaxPaid += afterTaxReturn.taxPaid;
      });
      
      // Second pass: add contributions proportionally based on updated balances
      if (investmentContributions > 0) {
        const totalBalanceAfterReturns = investmentAccounts.reduce((sum, a) => sum + a.balance, 0);
        if (totalBalanceAfterReturns > 0) {
          investmentAccounts.forEach(acc => {
            const proportion = acc.balance / totalBalanceAfterReturns;
            const contribution = investmentContributions * proportion;
            acc.balance += contribution;
            
            // Log first month contributions for debugging
            if (month === 0 && acc.name) {
              console.log(`[projections] Account ${acc.name} contribution: ${contribution.toFixed(2)} (proportion: ${(proportion * 100).toFixed(2)}%)`);
            }
          });
        } else {
          // If all balances are zero, split contributions equally
          const contributionPerAccount = investmentContributions / investmentAccounts.length;
          investmentAccounts.forEach(acc => {
            acc.balance += contributionPerAccount;
          });
        }
      }
    }
    
    const investmentGrowth = totalInvestmentGrowth + totalInvestmentDividends; // Total after-tax growth
    
    // Handle RESP contributions and CESG grants
    if (scenario.assumptions.resp?.annualContribution && !isRetired) {
      const respAccounts = investmentAccounts.filter(a => a.type === 'resp');
      const monthlyRESPContribution = scenario.assumptions.resp.annualContribution / 12;
      const cesgMatch = scenario.assumptions.resp.cesgMatch || 0.20;
      const monthlyCESG = monthlyRESPContribution * cesgMatch; // CESG matches 20% of contributions
      
      if (respAccounts.length > 0 && monthlyRESPContribution > 0) {
        respAccounts.forEach(acc => {
          acc.balance += monthlyRESPContribution / respAccounts.length;
          acc.balance += monthlyCESG / respAccounts.length; // Add CESG grant
        });
        savings -= monthlyRESPContribution; // Deduct from available savings
      }
    }
    
    // Handle RESP withdrawals for education (if education start year reached)
    if (scenario.assumptions.resp?.expectedEducationStart && scenario.assumptions.resp?.educationCosts) {
      const educationStartYear = scenario.assumptions.resp.expectedEducationStart;
      if (year >= educationStartYear && year < educationStartYear + 4) { // Assume 4 years of education
        const respAccounts = investmentAccounts.filter(a => a.type === 'resp');
        const monthlyEducationCost = scenario.assumptions.resp.educationCosts / 12;
        const respBalance = respAccounts.reduce((sum, a) => sum + a.balance, 0);
        
        if (respBalance > 0) {
          const withdrawal = Math.min(monthlyEducationCost, respBalance);
          respAccounts.forEach(acc => {
            const proportion = acc.balance / respBalance;
            acc.balance -= withdrawal * proportion;
          });
          savings += withdrawal; // Add withdrawal to available savings
          inflatedExpenses -= monthlyEducationCost; // Education costs reduce expenses
        }
      }
    }
    
    // Apply retirement withdrawals if in retirement
    if (isRetired) {
      const withdrawalRate = scenario.assumptions.retirement?.withdrawalRate || scenario.assumptions.withdrawalRate || 0.04;
      const monthlyWithdrawalRate = withdrawalRate / 12; // Monthly
      const withdrawalStrategy = scenario.assumptions.retirement?.withdrawalStrategy || 'tax_optimized';
      const rrspAccounts = investmentAccounts.filter(a => a.type === 'rrsp' || a.type === 'dcpp');
      const tfsaAccounts = investmentAccounts.filter(a => a.type === 'tfsa');
      const rrspBalance = rrspAccounts.reduce((sum, a) => sum + a.balance, 0);
      const tfsaBalance = tfsaAccounts.reduce((sum, a) => sum + a.balance, 0);
      const totalBalance = rrspBalance + tfsaBalance;
      const investmentWithdrawal = totalBalance * monthlyWithdrawalRate;
      
      if (totalBalance > 0 && investmentWithdrawal > 0) {
        if (withdrawalStrategy === 'rrsp_first') {
          // Withdraw from RRSP first
          if (rrspBalance > 0) {
            const withdrawal = Math.min(investmentWithdrawal, rrspBalance * monthlyWithdrawalRate);
            rrspAccounts.forEach(acc => {
              const proportion = acc.balance / rrspBalance;
              acc.balance -= withdrawal * proportion;
            });
          } else if (tfsaBalance > 0) {
            const withdrawal = Math.min(investmentWithdrawal, tfsaBalance * monthlyWithdrawalRate);
            tfsaAccounts.forEach(acc => {
              const proportion = acc.balance / tfsaBalance;
              acc.balance -= withdrawal * proportion;
            });
          }
        } else if (withdrawalStrategy === 'tfsa_first') {
          // Withdraw from TFSA first
          if (tfsaBalance > 0) {
            const withdrawal = Math.min(investmentWithdrawal, tfsaBalance * monthlyWithdrawalRate);
            tfsaAccounts.forEach(acc => {
              const proportion = acc.balance / tfsaBalance;
              acc.balance -= withdrawal * proportion;
            });
          } else if (rrspBalance > 0) {
            const withdrawal = Math.min(investmentWithdrawal, rrspBalance * monthlyWithdrawalRate);
            rrspAccounts.forEach(acc => {
              const proportion = acc.balance / rrspBalance;
              acc.balance -= withdrawal * proportion;
            });
          }
        } else {
          // Balanced or tax-optimized: withdraw proportionally
          const withdrawal = investmentWithdrawal;
          if (rrspBalance > 0) {
            rrspAccounts.forEach(acc => {
              const proportion = acc.balance / totalBalance;
              acc.balance -= withdrawal * proportion;
            });
          }
          if (tfsaBalance > 0) {
            tfsaAccounts.forEach(acc => {
              const proportion = acc.balance / totalBalance;
              acc.balance -= withdrawal * proportion;
            });
          }
        }
      }
    }
    
    // Add remaining savings to cash accounts
    const cashContributions = savings * (1 - investmentAllocation);
    const cashAccounts = currentAssets.filter(a => ['cash', 'chequing'].includes(a.type));
    if (cashAccounts.length > 0 && cashContributions > 0) {
      cashAccounts.forEach(acc => {
        acc.balance += cashContributions / cashAccounts.length;
      });
    }
    
    // Apply debt paydown
    const mortgageAccounts = currentLiabilities.filter(a => a.type === 'mortgage');
    let totalDebtPayments = 0;
    let totalPrincipalPaydown = 0;
    let totalInterestPaid = 0;
    
    mortgageAccounts.forEach(mortgage => {
      const monthlyPayment = mortgage.monthlyPayment || 0;
      const monthlyRate = (mortgage.interestRate || 0) / 12 / 100;
      const interest = mortgage.balance * monthlyRate;
      const principal = Math.min(monthlyPayment - interest, mortgage.balance);
      
      mortgage.balance = Math.max(0, mortgage.balance - principal);
      totalDebtPayments += monthlyPayment;
      totalPrincipalPaydown += principal;
      totalInterestPaid += interest;
    });
    
    // Apply other debt paydown (loans, credit cards)
    const otherDebtAccounts = currentLiabilities.filter(a => a.type !== 'mortgage');
    otherDebtAccounts.forEach(debt => {
      const monthlyPayment = debt.monthlyPayment || 0;
      if (monthlyPayment > 0) {
        const monthlyRate = (debt.interestRate || 0) / 12 / 100;
        const interest = debt.balance * monthlyRate;
        const principal = Math.min(monthlyPayment - interest, debt.balance);
        debt.balance = Math.max(0, debt.balance - principal);
        totalDebtPayments += monthlyPayment;
        totalPrincipalPaydown += principal;
        totalInterestPaid += interest;
      }
    });
    
    // Calculate current net worth
    const totalAssets = currentAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = currentLiabilities.reduce((sum, a) => sum + a.balance, 0);
    const netWorth = totalAssets - totalLiabilities;
    
    // Calculate asset breakdown
    const cashAssets = currentAssets
      .filter(a => ['cash', 'chequing'].includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);
    const investmentAssets = investmentAccounts.reduce((sum, a) => sum + a.balance, 0);
    const realEstateAssets = currentAssets
      .filter(a => ['primary_home', 'rental_property'].includes(a.type))
      .reduce((sum, a) => sum + a.balance, 0);
    
    const mortgageBalance = mortgageAccounts.reduce((sum, a) => sum + a.balance, 0);
    const otherDebt = otherDebtAccounts.reduce((sum, a) => sum + a.balance, 0);
    
    // Store monthly data
    monthlyData.push({
      year,
      month: monthNum,
      date: dateStr,
      totalAssets,
      cashAssets,
      investmentAssets,
      realEstateAssets,
      totalLiabilities,
      mortgageBalance,
      otherDebt,
      netWorth,
      netWorthChange: month === 0 ? 0 : netWorth - monthlyData[month - 1].netWorth,
      income: grownIncome,
      expenses: inflatedExpenses,
      savings,
      savingsRate: grownIncome > 0 ? (savings / grownIncome) * 100 : 0,
      investmentGrowth,
      investmentContributions,
      investmentDividends: totalInvestmentDividends,
      investmentTaxPaid: totalTaxPaid,
      debtPayments: totalDebtPayments,
      principalPaydown: totalPrincipalPaydown,
      interestPaid: totalInterestPaid,
    });
  }
  
  // 4. Aggregate yearly data
  const yearlyData = aggregateYearly(monthlyData);
  console.log('[projections] Aggregated', yearlyData.length, 'years of data');
  
  // 5. Calculate summary
  const summary = calculateSummary(monthlyData, yearlyData, startingNetWorth);
  
  console.log('[projections] Projection complete. Ending net worth:', summary.endingNetWorth);
  
  return {
    scenarioId: scenario.id,
    calculatedAt: new Date().toISOString(),
    monthlyData,
    yearlyData,
    summary,
  };
}

// Aggregate monthly data into yearly data
function aggregateYearly(monthlyData: ProjectionMonth[]): ProjectionYear[] {
  const yearlyMap = new Map<number, ProjectionYear>();
  
  monthlyData.forEach(month => {
    if (!yearlyMap.has(month.year)) {
      yearlyMap.set(month.year, {
        year: month.year,
        startingNetWorth: month.netWorth,
        endingNetWorth: month.netWorth,
        netWorthChange: 0,
        totalIncome: 0,
        totalExpenses: 0,
        totalSavings: 0,
        averageSavingsRate: 0,
        investmentGrowth: 0,
        debtPaydown: 0,
      });
    }
    
    const yearData = yearlyMap.get(month.year)!;
    yearData.endingNetWorth = month.netWorth;
    yearData.totalIncome += month.income;
    yearData.totalExpenses += month.expenses;
    yearData.totalSavings += month.savings;
    yearData.investmentGrowth += month.investmentGrowth;
    yearData.debtPaydown += month.principalPaydown;
  });
  
  // Calculate net worth change and average savings rate
  yearlyMap.forEach((yearData, year) => {
    const yearMonths = monthlyData.filter(m => m.year === year);
    if (yearMonths.length > 0) {
      const firstMonth = yearMonths[0];
      yearData.startingNetWorth = firstMonth.netWorth;
      yearData.netWorthChange = yearData.endingNetWorth - yearData.startingNetWorth;
      
      const totalIncome = yearData.totalIncome;
      if (totalIncome > 0) {
        yearData.averageSavingsRate = (yearData.totalSavings / totalIncome) * 100;
      }
    }
  });
  
  return Array.from(yearlyMap.values()).sort((a, b) => a.year - b.year);
}

// Calculate summary metrics
function calculateSummary(
  monthlyData: ProjectionMonth[],
  _yearlyData: ProjectionYear[], // Used for type checking but calculated from monthlyData
  startingNetWorth: number
): ProjectionSummary {
  if (monthlyData.length === 0) {
    return {
      startingNetWorth,
      endingNetWorth: startingNetWorth,
      totalGrowth: 0,
      averageAnnualGrowth: 0,
      peakNetWorth: startingNetWorth,
      peakNetWorthYear: new Date().getFullYear(),
    };
  }
  
  const endingNetWorth = monthlyData[monthlyData.length - 1].netWorth;
  const totalGrowth = endingNetWorth - startingNetWorth;
  const years = monthlyData.length / 12;
  // Calculate Compound Annual Growth Rate (CAGR) - the correct way to measure average annual growth
  // CAGR = ((Ending / Starting) ^ (1/years) - 1) * 100
  const averageAnnualGrowth = years > 0 && startingNetWorth > 0 
    ? (Math.pow(endingNetWorth / startingNetWorth, 1 / years) - 1) * 100 
    : 0;
  
  // Find peak net worth
  let peakNetWorth = startingNetWorth;
  let peakNetWorthYear = new Date().getFullYear();
  monthlyData.forEach(month => {
    if (month.netWorth > peakNetWorth) {
      peakNetWorth = month.netWorth;
      peakNetWorthYear = month.year;
    }
  });
  
  // Find debt-free date
  let debtFreeDate: string | undefined;
  for (const month of monthlyData) {
    if (month.totalLiabilities <= 0.01) { // Within 1 cent
      debtFreeDate = month.date;
      break;
    }
  }
  
  return {
    startingNetWorth,
    endingNetWorth,
    totalGrowth,
    averageAnnualGrowth,
    peakNetWorth,
    peakNetWorthYear,
    debtFreeDate,
  };
}

// Compare mortgage payoff vs investing
export function compareMortgageVsInvest(
  mortgage: Account,
  monthlySurplus: number,
  assumptions: ProjectionScenario['assumptions']
): MortgageVsInvestComparison {
  console.log('[projections] Comparing mortgage vs invest for mortgage:', mortgage.name);
  
  if (!mortgage.monthlyPayment || !mortgage.interestRate) {
    throw new Error('Mortgage must have monthlyPayment and interestRate');
  }
  
  const mortgageRate = mortgage.interestRate / 100;
  const investmentRate = assumptions.investmentReturnRate;
  const monthlyMortgageRate = mortgageRate / 12;
  const monthlyInvestmentRate = investmentRate / 12;
  
  // Scenario 1: Pay down mortgage
  let mortgageBalance = mortgage.balance;
  let mortgageMonths = 0;
  const originalPayment = mortgage.monthlyPayment;
  const prepaymentAmount = monthlySurplus;
  
  while (mortgageBalance > 0.01 && mortgageMonths < 600) { // Max 50 years
    const interest = mortgageBalance * monthlyMortgageRate;
    const principal = originalPayment - interest;
    const prepayment = Math.min(prepaymentAmount, mortgageBalance - principal);
    mortgageBalance = Math.max(0, mortgageBalance - principal - prepayment);
    mortgageMonths++;
  }
  
  const mortgagePayoffDate = new Date();
  mortgagePayoffDate.setMonth(mortgagePayoffDate.getMonth() + mortgageMonths);
  
  // Scenario 2: Invest surplus
  let investmentBalance = 0;
  let investMonths = mortgageMonths; // Same timeline
  
  for (let month = 0; month < investMonths; month++) {
    investmentBalance = investmentBalance * (1 + monthlyInvestmentRate) + monthlySurplus;
  }
  
  // At mortgage payoff date, compare net worth
  // Mortgage scenario: mortgage is paid off, no investment
  // Invest scenario: mortgage still exists, but we have investments
  const remainingMortgageBalance = mortgage.balance;
  let remainingBalance = remainingMortgageBalance;
  for (let month = 0; month < investMonths; month++) {
    const interest = remainingBalance * monthlyMortgageRate;
    const principal = originalPayment - interest;
    remainingBalance = Math.max(0, remainingBalance - principal);
  }
  
  const mortgageScenarioNetWorth = -remainingBalance; // Negative because it's debt
  const investScenarioNetWorth = investmentBalance - remainingBalance;
  const netWorthDifference = investScenarioNetWorth - mortgageScenarioNetWorth;
  
  // Generate recommendation
  let recommendation: 'mortgage' | 'invest' | 'hybrid';
  let reasoning: string;
  
  const threshold = mortgage.balance * 0.1; // 10% of mortgage balance
  
  if (netWorthDifference > threshold) {
    recommendation = 'invest';
    reasoning = `Investing provides ${formatCurrency(netWorthDifference)} more net worth at mortgage payoff. Investment returns (${(investmentRate * 100).toFixed(1)}%) exceed mortgage rate (${(mortgageRate * 100).toFixed(1)}%).`;
  } else if (netWorthDifference < -threshold) {
    recommendation = 'mortgage';
    reasoning = `Paying down mortgage provides ${formatCurrency(Math.abs(netWorthDifference))} more net worth. Mortgage rate (${(mortgageRate * 100).toFixed(1)}%) exceeds expected investment returns (${(investmentRate * 100).toFixed(1)}%).`;
  } else {
    recommendation = 'hybrid';
    reasoning = `Both strategies are similar (difference: ${formatCurrency(Math.abs(netWorthDifference))}). Consider splitting surplus: pay down mortgage for guaranteed return, invest remainder for growth potential.`;
  }
  
  return {
    mortgagePayoffDate: formatDate(mortgagePayoffDate),
    investPayoffDate: formatDate(mortgagePayoffDate),
    netWorthDifference,
    recommendation,
    reasoning,
  };
}

// Helper: Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Create default scenario
export function createDefaultScenario(householdId: string, province?: string): ProjectionScenario {
  const now = new Date();
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    householdId,
    name: 'Base Case',
    type: 'net_worth',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    assumptions: {
      investmentReturnRate: 0.06, // 6% annual (total return)
      investmentGrowthRate: 0.042, // 4.2% annual (70% of total)
      investmentDividendYield: 0.018, // 1.8% annual (30% of total)
      inflationRate: 0.02, // 2% annual
      salaryGrowthRate: 0.03, // 3% annual
      province: province as any, // Use household province if available
      // marginalTaxRate and rrspDeductionBenefit will be calculated from province and income
    },
    config: {
      projectionYears: 10,
      startDate: formatDate(now),
      monthlySteps: true,
    },
    lifeEvents: [],
  };
}

