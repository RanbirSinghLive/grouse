// Government benefits calculations for Canadian retirement planning
// CPP/QPP and OAS benefit calculations

// CPP (Canada Pension Plan) / QPP (Quebec Pension Plan) calculations
// Based on Service Canada formulas and 2024 rates

const MAX_CPP_BENEFIT_2024 = 1306.57; // Maximum monthly CPP benefit at age 65 (2024)
const YMPE_2024 = 68500; // Year's Maximum Pensionable Earnings (2024)
const CPP_CONTRIBUTION_RATE = 0.0595; // 5.95% (employee + employer share, but we use employee portion)
const CPP_DROP_OUT_YEARS = 8; // Lowest 8 years of earnings are dropped from calculation
const CPP_STANDARD_AGE = 65; // Standard retirement age for CPP

// OAS (Old Age Security) calculations
const MAX_OAS_BENEFIT_2024 = 713.34; // Maximum monthly OAS benefit (2024)
const OAS_FULL_YEARS = 40; // Years in Canada required for full OAS
const OAS_STANDARD_AGE = 65; // Standard retirement age for OAS
const OAS_CLAWBACK_THRESHOLD_2024 = 86912; // Annual income threshold for OAS clawback (2024)
const OAS_CLAWBACK_RATE = 0.15; // 15% clawback rate

export type CPPInputs = {
  yearsOfContributions?: number;
  averageContributions?: number; // Average YMPE contribution percentage (0-1)
  expectedBenefit?: number; // Manual override
  startAge?: number; // When to start taking CPP (60-70)
};

export type OASInputs = {
  yearsInCanada?: number;
  expectedBenefit?: number; // Manual override
  startAge?: number; // When to start (65-70)
  clawbackThreshold?: number; // Income threshold for clawback
};

/**
 * Calculate expected CPP benefit based on contribution history
 * Simplified calculation based on Service Canada methodology
 */
export function calculateCPPBenefit(inputs: CPPInputs): number {
  console.log('[governmentBenefits] calculateCPPBenefit:', inputs);
  
  // If manual override provided, use it
  if (inputs.expectedBenefit !== undefined && inputs.expectedBenefit > 0) {
    return inputs.expectedBenefit;
  }
  
  // Need at least years of contributions and average contribution level
  if (!inputs.yearsOfContributions || !inputs.averageContributions) {
    console.warn('[governmentBenefits] Insufficient CPP data, returning 0');
    return 0;
  }
  
  const yearsOfContributions = inputs.yearsOfContributions;
  const averageContributionRate = Math.min(1, Math.max(0, inputs.averageContributions)); // Clamp 0-1
  
  // Simplified CPP calculation:
  // 1. Calculate average earnings (as % of YMPE)
  // 2. Apply general drop-out provision (lowest 8 years)
  // 3. Calculate base benefit
  // 4. Apply early/late retirement adjustment
  
  // Adjust for drop-out years (simplified: assume average years worked is 40)
  const adjustedYears = Math.max(0, yearsOfContributions - CPP_DROP_OUT_YEARS);
  const standardYears = 40 - CPP_DROP_OUT_YEARS; // Standard calculation period
  
  // Calculate average earnings ratio
  const earningsRatio = Math.min(1, (adjustedYears / standardYears) * averageContributionRate);
  
  // Base benefit at age 65
  let monthlyBenefit = MAX_CPP_BENEFIT_2024 * earningsRatio;
  
  // Apply early/late retirement adjustment
  const startAge = inputs.startAge ?? CPP_STANDARD_AGE;
  if (startAge < CPP_STANDARD_AGE) {
    // Early retirement: 0.6% reduction per month before 65
    const monthsEarly = (CPP_STANDARD_AGE - startAge) * 12;
    const reduction = monthsEarly * 0.006; // 0.6% per month
    monthlyBenefit = monthlyBenefit * (1 - reduction);
  } else if (startAge > CPP_STANDARD_AGE) {
    // Late retirement: 0.7% increase per month after 65 (up to age 70)
    const monthsLate = Math.min(60, (startAge - CPP_STANDARD_AGE) * 12); // Cap at 70
    const increase = monthsLate * 0.007; // 0.7% per month
    monthlyBenefit = monthlyBenefit * (1 + increase);
  }
  
  // Ensure benefit is within valid range
  monthlyBenefit = Math.max(0, Math.min(MAX_CPP_BENEFIT_2024 * 1.42, monthlyBenefit)); // Max is ~42% higher at 70
  
  console.log('[governmentBenefits] Calculated CPP benefit:', monthlyBenefit.toFixed(2));
  return Math.round(monthlyBenefit * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate expected OAS benefit with clawback considerations
 */
export function calculateOASBenefit(inputs: OASInputs, annualIncome: number = 0): number {
  console.log('[governmentBenefits] calculateOASBenefit:', inputs, 'annualIncome:', annualIncome);
  
  // If manual override provided, use it (but still apply clawback)
  let monthlyBenefit = inputs.expectedBenefit;
  
  if (monthlyBenefit === undefined || monthlyBenefit <= 0) {
    // Calculate based on years in Canada
    const yearsInCanada = inputs.yearsInCanada ?? OAS_FULL_YEARS;
    const yearsRatio = Math.min(1, yearsInCanada / OAS_FULL_YEARS);
    monthlyBenefit = MAX_OAS_BENEFIT_2024 * yearsRatio;
  }
  
  // Apply early/late retirement adjustment
  const startAge = inputs.startAge ?? OAS_STANDARD_AGE;
  if (startAge < OAS_STANDARD_AGE) {
    // Early retirement: 0.6% reduction per month before 65
    const monthsEarly = (OAS_STANDARD_AGE - startAge) * 12;
    const reduction = monthsEarly * 0.006;
    monthlyBenefit = monthlyBenefit * (1 - reduction);
  } else if (startAge > OAS_STANDARD_AGE) {
    // Late retirement: 0.6% increase per month after 65 (up to age 70)
    const monthsLate = Math.min(60, (startAge - OAS_STANDARD_AGE) * 12);
    const increase = monthsLate * 0.006;
    monthlyBenefit = monthlyBenefit * (1 + increase);
  }
  
  // Apply clawback if income exceeds threshold
  const clawbackThreshold = inputs.clawbackThreshold ?? OAS_CLAWBACK_THRESHOLD_2024;
  if (annualIncome > clawbackThreshold) {
    const excessIncome = annualIncome - clawbackThreshold;
    const annualClawback = excessIncome * OAS_CLAWBACK_RATE;
    const monthlyClawback = annualClawback / 12;
    monthlyBenefit = Math.max(0, monthlyBenefit - monthlyClawback);
  }
  
  // Ensure benefit is within valid range
  monthlyBenefit = Math.max(0, Math.min(MAX_OAS_BENEFIT_2024 * 1.36, monthlyBenefit)); // Max is ~36% higher at 70
  
  console.log('[governmentBenefits] Calculated OAS benefit:', monthlyBenefit.toFixed(2));
  return Math.round(monthlyBenefit * 100) / 100; // Round to 2 decimals
}

/**
 * Calculate OAS clawback amount based on income
 */
export function calculateOASClawback(
  annualIncome: number,
  clawbackThreshold?: number
): number {
  const threshold = clawbackThreshold ?? OAS_CLAWBACK_THRESHOLD_2024;
  
  if (annualIncome <= threshold) {
    return 0;
  }
  
  const excessIncome = annualIncome - threshold;
  const annualClawback = excessIncome * OAS_CLAWBACK_RATE;
  
  return Math.round(annualClawback * 100) / 100;
}

/**
 * Estimate CPP contribution from annual income
 * Returns the percentage of YMPE that the income represents
 */
export function estimateCPPContributionRate(annualIncome: number, year: number = new Date().getFullYear()): number {
  // Use current YMPE (would ideally be year-specific)
  const ympe = YMPE_2024; // In real implementation, lookup by year
  
  if (annualIncome <= 0) {
    return 0;
  }
  
  // CPP is only on income up to YMPE
  const contributableIncome = Math.min(annualIncome, ympe);
  const contributionRate = contributableIncome / ympe;
  
  return Math.min(1, Math.max(0, contributionRate));
}

/**
 * Get current year's CPP/QPP maximums (for reference)
 */
export function getCPPMaximums() {
  return {
    maxMonthlyBenefit: MAX_CPP_BENEFIT_2024,
    ympe: YMPE_2024,
    contributionRate: CPP_CONTRIBUTION_RATE,
  };
}

/**
 * Get current year's OAS maximums (for reference)
 */
export function getOASMaximums() {
  return {
    maxMonthlyBenefit: MAX_OAS_BENEFIT_2024,
    fullYearsRequired: OAS_FULL_YEARS,
    clawbackThreshold: OAS_CLAWBACK_THRESHOLD_2024,
    clawbackRate: OAS_CLAWBACK_RATE,
  };
}



