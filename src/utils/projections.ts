/**
 * PROJECTION CALCULATION ENGINE
 * 
 * This file contains the projection calculation logic. As you build it up step by step,
 * maintain transparency by:
 * 
 * 1. Clear function names that describe what they calculate
 * 2. JSDoc comments explaining inputs, outputs, and assumptions
 * 3. Intermediate result types for complex calculations
 * 4. Step-by-step breakdowns in calculation functions
 * 5. Optional: Calculation trace/debug mode
 */

import type { Account } from '../types/models';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Represents a single year in the projection
 */
export type ProjectionYear = {
  year: number;
  netWorth: number;
  // Add more fields as you build out the model
  // e.g., income, expenses, contributions, returns, etc.
};

/**
 * Complete projection result
 */
export type ProjectionResult = {
  years: ProjectionYear[];
  summary: {
    startingNetWorth: number;
    endingNetWorth: number;
    totalGrowth: number;
  };
  // Optional: calculation trace for debugging
  calculationTrace?: CalculationStep[];
};

/**
 * Individual calculation step for transparency/debugging
 */
export type CalculationStep = {
  step: string; // e.g., "Calculate income", "Apply investment returns"
  year: number;
  inputs: Record<string, any>; // What went into this calculation
  outputs: Record<string, any>; // What came out
  formula?: string; // Optional: mathematical formula used
};

// ============================================================================
// CONFIGURATION
// ============================================================================

export type ProjectionConfig = {
  startYear: number;
  endYear: number;
  // Add configuration options as needed
  // e.g., investmentReturnRate, inflationRate, etc.
};

// ============================================================================
// MAIN CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate net worth projection over time
 * 
 * @param accounts - Current account balances
 * @param config - Projection configuration
 * @param enableTrace - If true, includes detailed calculation trace
 * @returns Projection result with yearly data
 * 
 * CALCULATION STEPS (build these incrementally):
 * 1. Start with current net worth
 * 2. For each year:
 *    - Calculate income
 *    - Calculate expenses
 *    - Calculate savings (income - expenses)
 *    - Apply investment returns
 *    - Update account balances
 *    - Calculate new net worth
 */
export function calculateProjection(
  accounts: Account[],
  config: ProjectionConfig,
  enableTrace: boolean = false
): ProjectionResult {
  const trace: CalculationStep[] = [];
  
  // STEP 1: Calculate starting net worth
  const startingNetWorth = calculateStartingNetWorth(accounts);
  
  if (enableTrace) {
    trace.push({
      step: 'Calculate starting net worth',
      year: config.startYear,
      inputs: { accounts: accounts.length },
      outputs: { startingNetWorth },
      formula: 'sum(asset balances) - sum(liability balances)'
    });
  }
  
  // STEP 2: Project year by year
  const years: ProjectionYear[] = [];
  let currentNetWorth = startingNetWorth;
  
  for (let year = config.startYear; year <= config.endYear; year++) {
    // Build this incrementally - start simple, add complexity
    const yearResult = calculateYear(
      year,
      accounts,
      currentNetWorth,
      enableTrace ? trace : undefined
    );
    
    years.push(yearResult);
    currentNetWorth = yearResult.netWorth;
  }
  
  return {
    years,
    summary: {
    startingNetWorth,
      endingNetWorth: currentNetWorth,
      totalGrowth: currentNetWorth - startingNetWorth,
    },
    ...(enableTrace && { calculationTrace: trace })
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate starting net worth from accounts
 * 
 * Formula: Sum of all asset balances - Sum of all liability balances
 */
function calculateStartingNetWorth(accounts: Account[]): number {
  const assets = accounts
    .filter(a => a.kind === 'asset')
    .reduce((sum, a) => sum + a.balance, 0);
  
  const liabilities = accounts
    .filter(a => a.kind === 'liability')
    .reduce((sum, a) => sum + a.balance, 0);
  
  return assets - liabilities;
}

/**
 * Calculate projection for a single year
 * 
 * Build this incrementally:
 * - Start: Just return current net worth (no changes)
 * - Add: Income and expenses
 * - Add: Investment returns
 * - Add: Contributions
 * - etc.
 */
function calculateYear(
  year: number,
  accounts: Account[],
  previousNetWorth: number,
  trace?: CalculationStep[]
): ProjectionYear {
  // TODO: Build this step by step
  // For now, just return the previous net worth (straight line)
  
  return {
    year,
    netWorth: previousNetWorth,
  };
}

// ============================================================================
// FUTURE CALCULATION FUNCTIONS (add as you build)
// ============================================================================

/**
 * Calculate annual income for a given year
 * 
 * TODO: Implement when adding income calculations
 */
// function calculateAnnualIncome(year: number, ...): number {
//   // Implementation
// }

/**
 * Calculate annual expenses for a given year
 * 
 * TODO: Implement when adding expense calculations
 */
// function calculateAnnualExpenses(year: number, ...): number {
//   // Implementation
// }

/**
 * Calculate investment returns for accounts
 * 
 * TODO: Implement when adding investment growth
 */
// function calculateInvestmentReturns(accounts: Account[], ...): number {
//   // Implementation
// }

