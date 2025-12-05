// Canadian Federal and Provincial Tax Rates
// Rates are for 2024 tax year (most recent available)
// Source: CRA and provincial tax authorities

export type Province =
  | 'AB' // Alberta
  | 'BC' // British Columbia
  | 'MB' // Manitoba
  | 'NB' // New Brunswick
  | 'NL' // Newfoundland and Labrador
  | 'NS' // Nova Scotia
  | 'NT' // Northwest Territories
  | 'NU' // Nunavut
  | 'ON' // Ontario
  | 'PE' // Prince Edward Island
  | 'QC' // Quebec
  | 'SK' // Saskatchewan
  | 'YT'; // Yukon

export type TaxBracket = {
  min: number; // Minimum income for this bracket
  max?: number; // Maximum income (undefined for top bracket)
  rate: number; // Tax rate (0.15 = 15%)
};

export type TaxRates = {
  federal: TaxBracket[];
  provincial: Record<Province, TaxBracket[]>;
};

// Federal tax brackets (2024)
const federalBrackets: TaxBracket[] = [
  { min: 0, max: 55867, rate: 0.15 },
  { min: 55867, max: 111733, rate: 0.205 },
  { min: 111733, max: 173205, rate: 0.26 },
  { min: 173205, max: 246752, rate: 0.29 },
  { min: 246752, rate: 0.33 },
];

// Provincial tax brackets (2024)
const provincialBrackets: Record<Province, TaxBracket[]> = {
  AB: [
    { min: 0, max: 148506, rate: 0.10 },
    { min: 148506, max: 177922, rate: 0.12 },
    { min: 177922, max: 237230, rate: 0.13 },
    { min: 237230, max: 355845, rate: 0.14 },
    { min: 355845, rate: 0.15 },
  ],
  BC: [
    { min: 0, max: 47937, rate: 0.0506 },
    { min: 47937, max: 95875, rate: 0.077 },
    { min: 95875, max: 110076, rate: 0.105 },
    { min: 110076, max: 133664, rate: 0.1229 },
    { min: 133664, max: 181232, rate: 0.147 },
    { min: 181232, max: 252752, rate: 0.168 },
    { min: 252752, rate: 0.205 },
  ],
  MB: [
    { min: 0, max: 47000, rate: 0.108 },
    { min: 47000, max: 100000, rate: 0.1275 },
    { min: 100000, rate: 0.174 },
  ],
  NB: [
    { min: 0, max: 49958, rate: 0.094 },
    { min: 49958, max: 99916, rate: 0.14 },
    { min: 99916, max: 185064, rate: 0.16 },
    { min: 185064, rate: 0.195 },
  ],
  NL: [
    { min: 0, max: 43198, rate: 0.087 },
    { min: 43198, max: 86395, rate: 0.145 },
    { min: 86395, max: 154244, rate: 0.158 },
    { min: 154244, max: 215943, rate: 0.173 },
    { min: 215943, rate: 0.183 },
  ],
  NS: [
    { min: 0, max: 29590, rate: 0.0879 },
    { min: 29590, max: 59180, rate: 0.1495 },
    { min: 59180, max: 93000, rate: 0.1667 },
    { min: 93000, max: 150000, rate: 0.175 },
    { min: 150000, rate: 0.21 },
  ],
  NT: [
    { min: 0, max: 50877, rate: 0.059 },
    { min: 50877, max: 101754, rate: 0.086 },
    { min: 101754, max: 165429, rate: 0.122 },
    { min: 165429, rate: 0.1405 },
  ],
  NU: [
    { min: 0, max: 50877, rate: 0.04 },
    { min: 50877, max: 101754, rate: 0.07 },
    { min: 101754, max: 165429, rate: 0.09 },
    { min: 165429, rate: 0.115 },
  ],
  ON: [
    { min: 0, max: 51446, rate: 0.0505 },
    { min: 51446, max: 102894, rate: 0.0915 },
    { min: 102894, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, rate: 0.1316 },
  ],
  PE: [
    { min: 0, max: 32656, rate: 0.098 },
    { min: 32656, max: 65312, rate: 0.138 },
    { min: 65312, max: 105000, rate: 0.167 },
    { min: 105000, max: 140000, rate: 0.18 },
    { min: 140000, rate: 0.18 },
  ],
  QC: [
    { min: 0, max: 51780, rate: 0.14 },
    { min: 51780, max: 103545, rate: 0.19 },
    { min: 103545, max: 126000, rate: 0.24 },
    { min: 126000, rate: 0.2575 },
  ],
  SK: [
    { min: 0, max: 52057, rate: 0.105 },
    { min: 52057, max: 148734, rate: 0.125 },
    { min: 148734, rate: 0.145 },
  ],
  YT: [
    { min: 0, max: 55867, rate: 0.064 },
    { min: 55867, max: 111733, rate: 0.09 },
    { min: 111733, max: 173205, rate: 0.109 },
    { min: 173205, max: 500000, rate: 0.128 },
    { min: 500000, rate: 0.15 },
  ],
};

export const taxRates: TaxRates = {
  federal: federalBrackets,
  provincial: provincialBrackets,
};

// Calculate marginal tax rate for a given income
export function calculateMarginalTaxRate(income: number, province: Province): number {
  // Find federal bracket
  let federalRate = 0;
  for (const bracket of federalBrackets) {
    if (income >= bracket.min && (bracket.max === undefined || income <= bracket.max)) {
      federalRate = bracket.rate;
      break;
    }
  }

  // Find provincial bracket
  let provincialRate = 0;
  const provinceBrackets = provincialBrackets[province];
  for (const bracket of provinceBrackets) {
    if (income >= bracket.min && (bracket.max === undefined || income <= bracket.max)) {
      provincialRate = bracket.rate;
      break;
    }
  }

  return federalRate + provincialRate;
}

// Calculate average tax rate (total tax / income)
export function calculateAverageTaxRate(income: number, province: Province): number {
  let totalTax = 0;
  let remainingIncome = income;

  // Federal tax
  for (const bracket of federalBrackets) {
    if (remainingIncome <= 0) break;
    const taxableInBracket = bracket.max
      ? Math.min(remainingIncome, bracket.max - bracket.min)
      : remainingIncome;
    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }
  }

  // Provincial tax
  remainingIncome = income;
  const provinceBrackets = provincialBrackets[province];
  for (const bracket of provinceBrackets) {
    if (remainingIncome <= 0) break;
    const taxableInBracket = bracket.max
      ? Math.min(remainingIncome, bracket.max - bracket.min)
      : remainingIncome;
    if (taxableInBracket > 0) {
      totalTax += taxableInBracket * bracket.rate;
      remainingIncome -= taxableInBracket;
    }
  }

  return income > 0 ? totalTax / income : 0;
}

// Capital gains inclusion rate (50% in Canada)
export const CAPITAL_GAINS_INCLUSION_RATE = 0.5;

// Calculate tax on capital gains
export function calculateCapitalGainsTax(
  capitalGain: number,
  taxableIncome: number,
  province: Province
): number {
  const taxableGain = capitalGain * CAPITAL_GAINS_INCLUSION_RATE;
  const marginalRate = calculateMarginalTaxRate(taxableIncome + taxableGain, province);
  return taxableGain * marginalRate;
}

// Canadian eligible dividend tax credit rates (2024)
// Gross-up: 1.38 for eligible dividends
// Federal credit: 15.0198% of grossed-up amount
// Provincial credits vary by province
const eligibleDividendCredits: Record<Province, number> = {
  AB: 0.10,
  BC: 0.12,
  MB: 0.08,
  NB: 0.14,
  NL: 0.30,
  NS: 0.08,
  NT: 0.11,
  NU: 0.04,
  ON: 0.10,
  PE: 0.10,
  QC: 0.115, // Quebec has different calculation
  SK: 0.11,
  YT: 0.12,
};

// Foreign dividend tax treatment (no gross-up, no credit, taxed as regular income)
// But may be eligible for foreign tax credit

// Calculate tax on Canadian eligible dividends
export function calculateEligibleDividendTax(
  dividend: number,
  taxableIncome: number,
  province: Province
): number {
  // Gross-up: multiply by 1.38
  const grossedUpDividend = dividend * 1.38;
  
  // Calculate tax on grossed-up amount
  const marginalRate = calculateMarginalTaxRate(taxableIncome + grossedUpDividend, province);
  const taxOnGrossedUp = grossedUpDividend * marginalRate;
  
  // Apply federal credit (15.0198% of grossed-up amount)
  const federalCredit = grossedUpDividend * 0.150198;
  
  // Apply provincial credit
  const provincialCreditRate = eligibleDividendCredits[province];
  const provincialCredit = grossedUpDividend * provincialCreditRate;
  
  // Quebec has special calculation
  if (province === 'QC') {
    // Quebec uses different gross-up (1.15) and credit system
    const quebecGrossedUp = dividend * 1.15;
    const quebecTax = quebecGrossedUp * 0.2575; // Top rate
    const quebecCredit = quebecGrossedUp * 0.115;
    return Math.max(0, quebecTax - quebecCredit);
  }
  
  return Math.max(0, taxOnGrossedUp - federalCredit - provincialCredit);
}

// Calculate tax on foreign/international dividends (taxed as regular income)
export function calculateForeignDividendTax(
  dividend: number,
  taxableIncome: number,
  province: Province
): number {
  const marginalRate = calculateMarginalTaxRate(taxableIncome + dividend, province);
  return dividend * marginalRate;
  // Note: Foreign tax credit may apply but is complex to calculate without knowing source country
}

// Get province display name
export function getProvinceName(province: Province): string {
  const names: Record<Province, string> = {
    AB: 'Alberta',
    BC: 'British Columbia',
    MB: 'Manitoba',
    NB: 'New Brunswick',
    NL: 'Newfoundland and Labrador',
    NS: 'Nova Scotia',
    NT: 'Northwest Territories',
    NU: 'Nunavut',
    ON: 'Ontario',
    PE: 'Prince Edward Island',
    QC: 'Quebec',
    SK: 'Saskatchewan',
    YT: 'Yukon',
  };
  return names[province];
}

// Get all provinces as array
export function getAllProvinces(): Province[] {
  return Object.keys(provincialBrackets) as Province[];
}



