// Tax calculation utilities for projection model
// Handles Quebec/Canada tax calculations with owner attribution

import {
  calculateMarginalTaxRate,
  calculateAverageTaxRate,
  calculateCapitalGainsTax,
  calculateEligibleDividendTax,
  calculateForeignDividendTax,
  CAPITAL_GAINS_INCLUSION_RATE,
  type Province,
} from './canadianTaxRates';

export type TaxableIncomeSources = {
  employmentIncome: number;
  rentalIncome: number;
  rrspWithdrawals: number;
  capitalGains: number; // Realized gains from non-registered accounts
  eligibleDividends: number;
  nonEligibleDividends: number;
  foreignDividends: number;
  interestIncome: number;
};

export type TaxCalculationResult = {
  totalTax: number;
  effectiveMarginalRate: number;
  averageRate: number;
  breakdown: {
    employmentTax: number;
    rentalTax: number;
    rrspTax: number;
    capitalGainsTax: number;
    dividendTax: number;
    interestTax: number;
  };
  // Add owner attribution for tooltip
  incomeSources: TaxableIncomeSources;
  totalTaxableIncome: number;
};

/**
 * Calculate total taxable income from all sources
 */
export function calculateTotalTaxableIncome(sources: TaxableIncomeSources): number {
  return (
    sources.employmentIncome +
    sources.rentalIncome +
    sources.rrspWithdrawals +
    sources.capitalGains * CAPITAL_GAINS_INCLUSION_RATE + // Only 50% of capital gains is taxable
    sources.eligibleDividends * 1.38 + // Gross-up for eligible dividends (Quebec uses 1.15, but we'll use federal for calculation)
    sources.nonEligibleDividends * 1.15 + // Gross-up for non-eligible dividends
    sources.foreignDividends +
    sources.interestIncome
  );
}

/**
 * Calculate Quebec tax for a single owner based on their income sources
 */
export function calculateQuebecTax(
  incomeSources: TaxableIncomeSources,
  province: Province = 'QC'
): TaxCalculationResult {
  // Calculate tax on each income type separately
  let totalTax = 0;
  let cumulativeTaxableIncome = 0;

  // 1. Employment income (fully taxable)
  const employmentTax = calculateTaxOnOrdinaryIncome(
    incomeSources.employmentIncome,
    cumulativeTaxableIncome,
    province
  );
  totalTax += employmentTax;
  cumulativeTaxableIncome += incomeSources.employmentIncome;

  // 2. Rental income (fully taxable)
  const rentalTax = calculateTaxOnOrdinaryIncome(
    incomeSources.rentalIncome,
    cumulativeTaxableIncome,
    province
  );
  totalTax += rentalTax;
  cumulativeTaxableIncome += incomeSources.rentalIncome;

  // 3. RRSP withdrawals (fully taxable)
  const rrspTax = calculateTaxOnOrdinaryIncome(
    incomeSources.rrspWithdrawals,
    cumulativeTaxableIncome,
    province
  );
  totalTax += rrspTax;
  cumulativeTaxableIncome += incomeSources.rrspWithdrawals;

  // 4. Interest income (fully taxable)
  const interestTax = calculateTaxOnOrdinaryIncome(
    incomeSources.interestIncome,
    cumulativeTaxableIncome,
    province
  );
  totalTax += interestTax;
  cumulativeTaxableIncome += incomeSources.interestIncome;

  // 5. Capital gains (50% inclusion rate)
  const capitalGainsTax = calculateCapitalGainsTax(
    incomeSources.capitalGains,
    cumulativeTaxableIncome,
    province
  );
  totalTax += capitalGainsTax;
  cumulativeTaxableIncome += incomeSources.capitalGains * CAPITAL_GAINS_INCLUSION_RATE;

  // 6. Eligible dividends (with Quebec-specific treatment)
  const eligibleDividendTax = calculateEligibleDividendTax(
    incomeSources.eligibleDividends,
    cumulativeTaxableIncome,
    province
  );
  totalTax += eligibleDividendTax;
  // For Quebec, gross-up is 1.15, but we use the function which handles it
  cumulativeTaxableIncome += incomeSources.eligibleDividends * (province === 'QC' ? 1.15 : 1.38);

  // 7. Non-eligible dividends (treated similar to foreign for simplicity)
  const nonEligibleDividendTax = calculateForeignDividendTax(
    incomeSources.nonEligibleDividends,
    cumulativeTaxableIncome,
    province
  ) * 0.9; // Slightly lower than foreign
  totalTax += nonEligibleDividendTax;
  cumulativeTaxableIncome += incomeSources.nonEligibleDividends * 1.15;

  // 8. Foreign dividends (fully taxable, no credits)
  const foreignDividendTax = calculateForeignDividendTax(
    incomeSources.foreignDividends,
    cumulativeTaxableIncome,
    province
  );
  totalTax += foreignDividendTax;
  cumulativeTaxableIncome += incomeSources.foreignDividends;

  // Calculate effective rates
  const totalTaxableIncome = calculateTotalTaxableIncome(incomeSources);
  const effectiveMarginalRate = totalTaxableIncome > 0
    ? calculateMarginalTaxRate(totalTaxableIncome, province)
    : 0;
  const averageRate = totalTaxableIncome > 0
    ? totalTax / totalTaxableIncome
    : 0;

  return {
    totalTax,
    effectiveMarginalRate,
    averageRate,
    breakdown: {
      employmentTax,
      rentalTax,
      rrspTax,
      capitalGainsTax,
      dividendTax: eligibleDividendTax + nonEligibleDividendTax + foreignDividendTax,
      interestTax,
    },
    incomeSources,
    totalTaxableIncome,
  };
}

/**
 * Calculate tax on ordinary income (employment, rental, RRSP, interest)
 */
function calculateTaxOnOrdinaryIncome(
  income: number,
  existingTaxableIncome: number,
  province: Province
): number {
  if (income <= 0) return 0;

  // Calculate tax on the new income at the marginal rate
  const marginalRate = calculateMarginalTaxRate(existingTaxableIncome + income, province);
  return income * marginalRate;
}

/**
 * Calculate tax for multiple owners separately
 */
export function calculateTaxByOwner(
  incomeSourcesByOwner: Record<string, TaxableIncomeSources>,
  province: Province = 'QC'
): Record<string, TaxCalculationResult> {
  const results: Record<string, TaxCalculationResult> = {};

  for (const [owner, sources] of Object.entries(incomeSourcesByOwner)) {
    results[owner] = calculateQuebecTax(sources, province);
  }

  return results;
}

/**
 * Calculate effective marginal tax rate for a given taxable income
 */
export function calculateEffectiveMarginalRate(
  taxableIncome: number,
  province: Province = 'QC'
): number {
  return calculateMarginalTaxRate(taxableIncome, province);
}
