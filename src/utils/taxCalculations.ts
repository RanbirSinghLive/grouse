// Tax calculation utilities for projections
// Handles tax treatment of investment returns in different account types

import type { Account, Holding, ProjectionAssumptions } from '../types/models';
import type { Province } from './canadianTaxRates';
import {
  calculateMarginalTaxRate,
  calculateCapitalGainsTax,
  calculateEligibleDividendTax,
  calculateForeignDividendTax,
  CAPITAL_GAINS_INCLUSION_RATE,
} from './canadianTaxRates';

export type InvestmentReturn = {
  growth: number; // Capital appreciation
  dividends: number; // Dividend income
  total: number; // Total return (growth + dividends)
};

export type TaxableInvestmentReturn = {
  afterTaxGrowth: number; // Growth after tax (if applicable)
  afterTaxDividends: number; // Dividends after tax (if applicable)
  totalAfterTax: number; // Total after-tax return
  taxPaid: number; // Total tax paid on investment returns
};

// Get effective investment return rates for a holding
// Priority: holding-specific > account-specific > scenario defaults
export function getHoldingReturnRates(
  holding: Holding,
  account: Account,
  assumptions: ProjectionAssumptions
): { growthRate: number; dividendYield: number; dividendType: Holding['dividendType'] } {
  // Check for scenario override first, then account defaults, then scenario defaults
  // This allows scenario-specific overrides without modifying base account data
  const accountOverride = assumptions.accountOverrides?.[account.id];
  const growthRate =
    accountOverride?.investmentGrowthRate ??
    account.investmentGrowthRate ??
    assumptions.investmentGrowthRate ??
    (assumptions.investmentReturnRate * 0.7); // Default: 70% growth, 30% dividends

  const dividendYield =
    accountOverride?.investmentDividendYield ??
    account.investmentDividendYield ??
    assumptions.investmentDividendYield ??
    (assumptions.investmentReturnRate * 0.3); // Default: 30% dividends

  const dividendType =
    holding.dividendType ?? 'canadian_eligible'; // Keep dividend type from holding (this is metadata, not a rate override)

  return { growthRate, dividendYield, dividendType };
}

// Calculate investment return for a period (monthly)
export function calculateInvestmentReturn(
  balance: number,
  growthRate: number,
  dividendYield: number
): InvestmentReturn {
  // Ensure rates are in decimal format (0.06 = 6%), not percentage format (6 = 6%)
  // If rate is > 1, assume it's a percentage and convert to decimal
  // But be careful: rates between 0.01 and 1.0 are valid decimals (1% to 100%)
  // Only convert if rate is clearly a percentage (> 1.0 or < -1.0)
  const normalizedGrowthRate = (Math.abs(growthRate) > 1.0 && Math.abs(growthRate) <= 100) ? growthRate / 100 : growthRate;
  const normalizedDividendYield = (Math.abs(dividendYield) > 1.0 && Math.abs(dividendYield) <= 100) ? dividendYield / 100 : dividendYield;
  
  const monthlyGrowthRate = normalizedGrowthRate / 12;
  const monthlyDividendYield = normalizedDividendYield / 12;

  const growth = balance * monthlyGrowthRate;
  const dividends = balance * monthlyDividendYield;
  const total = growth + dividends;

  // Log if rates seem unusual (warn if > 50% annual or < -50% annual)
  if (Math.abs(normalizedGrowthRate) > 0.5 || Math.abs(normalizedDividendYield) > 0.5) {
    console.warn(`[taxCalculations] Unusual rates detected: growthRate=${(normalizedGrowthRate * 100).toFixed(2)}%, dividendYield=${(normalizedDividendYield * 100).toFixed(2)}% (original: growthRate=${growthRate}, dividendYield=${dividendYield})`);
  }

  return { growth, dividends, total };
}

// Calculate investment return for a period (annual - for annual compounding)
export function calculateInvestmentReturnAnnual(
  balance: number,
  growthRate: number,
  dividendYield: number
): InvestmentReturn {
  // Ensure rates are in decimal format (0.06 = 6%), not percentage format (6 = 6%)
  const normalizedGrowthRate = (Math.abs(growthRate) > 1.0 && Math.abs(growthRate) <= 100) ? growthRate / 100 : growthRate;
  const normalizedDividendYield = (Math.abs(dividendYield) > 1.0 && Math.abs(dividendYield) <= 100) ? dividendYield / 100 : dividendYield;
  
  // Use full annual rates (not divided by 12)
  const growth = balance * normalizedGrowthRate;
  const dividends = balance * normalizedDividendYield;
  const total = growth + dividends;

  // Log if rates seem unusual
  if (Math.abs(normalizedGrowthRate) > 0.5 || Math.abs(normalizedDividendYield) > 0.5) {
    console.warn(`[taxCalculations] Unusual rates detected: growthRate=${(normalizedGrowthRate * 100).toFixed(2)}%, dividendYield=${(normalizedDividendYield * 100).toFixed(2)}%`);
  }

  return { growth, dividends, total };
}

// Calculate after-tax return for non-registered accounts
export function calculateAfterTaxReturn(
  returnData: InvestmentReturn,
  account: Account,
  assumptions: ProjectionAssumptions,
  taxableIncome: number // Current taxable income before investment returns
): TaxableInvestmentReturn {
  // Registered accounts (TFSA, RRSP, RESP, DCPP) are tax-sheltered
  if (account.type !== 'non_registered') {
    return {
      afterTaxGrowth: returnData.growth,
      afterTaxDividends: returnData.dividends,
      totalAfterTax: returnData.total,
      taxPaid: 0,
    };
  }

  // Non-registered accounts are taxable
  const province = assumptions.province ?? 'ON'; // Default to Ontario
  let taxPaid = 0;

  // Tax on capital gains (50% inclusion rate)
  const capitalGainsTax = calculateCapitalGainsTax(
    returnData.growth,
    taxableIncome,
    province
  );
  taxPaid += capitalGainsTax;
  const afterTaxGrowth = returnData.growth - capitalGainsTax;

  // Tax on dividends (depends on type)
  // For accounts with multiple holdings, use weighted average or first holding's type
  let afterTaxDividends = returnData.dividends;
  let dividendType: 'canadian_eligible' | 'canadian_non_eligible' | 'foreign' | 'none' = 'canadian_eligible';
  
  if (account.holdings && account.holdings.length > 0) {
    // Use first holding's dividend type (or could be weighted average)
    dividendType = account.holdings[0].dividendType ?? 'canadian_eligible';
  }

  if (dividendType === 'canadian_eligible') {
    const dividendTax = calculateEligibleDividendTax(
      returnData.dividends,
      taxableIncome,
      province
    );
    taxPaid += dividendTax;
    afterTaxDividends = returnData.dividends - dividendTax;
  } else if (dividendType === 'foreign') {
    const dividendTax = calculateForeignDividendTax(
      returnData.dividends,
      taxableIncome,
      province
    );
    taxPaid += dividendTax;
    afterTaxDividends = returnData.dividends - dividendTax;
  } else if (dividendType === 'canadian_non_eligible') {
    // Non-eligible dividends: gross-up 1.15, different credit
    // Simplified: treat similar to foreign for now
    const dividendTax = calculateForeignDividendTax(
      returnData.dividends,
      taxableIncome,
      province
    ) * 0.9; // Slightly lower than foreign
    taxPaid += dividendTax;
    afterTaxDividends = returnData.dividends - dividendTax;
  }
  // 'none' means no dividends, so no tax

  return {
    afterTaxGrowth,
    afterTaxDividends,
    totalAfterTax: afterTaxGrowth + afterTaxDividends,
    taxPaid,
  };
}

// Get marginal tax rate for projections
export function getMarginalTaxRate(
  assumptions: ProjectionAssumptions,
  taxableIncome: number
): number {
  if (assumptions.marginalTaxRate !== undefined) {
    return assumptions.marginalTaxRate;
  }

  const province = assumptions.province ?? 'ON';
  return calculateMarginalTaxRate(taxableIncome, province);
}

// Calculate RRSP deduction benefit
export function calculateRRSPBenefit(
  contribution: number,
  assumptions: ProjectionAssumptions,
  taxableIncome: number
): number {
  const marginalRate = getMarginalTaxRate(assumptions, taxableIncome);
  
  if (assumptions.rrspDeductionBenefit !== undefined) {
    return contribution * assumptions.rrspDeductionBenefit;
  }

  // Calculate based on marginal tax rate
  return contribution * marginalRate;
}

// Calculate effective return rate for an account type
// Accounts are tax-sheltered, so returns are not taxed
// But RRSP withdrawals are taxed, RESP has grants, etc.
export function getAccountEffectiveReturnRate(
  accountType: Account['type'],
  grossReturn: number,
  assumptions: ProjectionAssumptions
): number {
  switch (accountType) {
    case 'tfsa':
      // TFSA: tax-free growth and withdrawals
      return grossReturn;

    case 'rrsp':
      // RRSP: tax-free growth, but withdrawals are taxed
      // For projections, we assume withdrawals at retirement tax rate
      // This is simplified - actual depends on withdrawal timing
      const withdrawalTaxRate = assumptions.marginalTaxRate ?? 0.25; // Assume lower rate in retirement
      return grossReturn * (1 - withdrawalTaxRate * 0.5); // Rough estimate

    case 'resp':
      // RESP: tax-free growth, but withdrawals are taxed (grant portion is taxed)
      // Simplified for projections
      return grossReturn * 0.95; // Rough estimate

    case 'dcpp':
      // DCPP: similar to RRSP
      const dcppWithdrawalRate = assumptions.marginalTaxRate ?? 0.25;
      return grossReturn * (1 - dcppWithdrawalRate * 0.5);

    case 'non_registered':
      // Non-registered: taxed annually
      // This is handled in calculateAfterTaxReturn
      return grossReturn; // Will be adjusted by tax calculations

    default:
      return grossReturn;
  }
}

