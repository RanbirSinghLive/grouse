# 🎯 Projection Tab - Design Document

## Overview
The Projection tab enables users to forecast their financial future based on current assets, liabilities, income, and expenses. It helps answer key questions like:
- "When can I retire?"
- "Should I pay down my mortgage or invest?"
- "What will my net worth be in 10 years?"
- "Can I afford a major purchase?"

---

## 1. Core Features

### A. Projection Types

#### 1.1 Net Worth Projection (Primary)
- **Purpose:** Forecast net worth over time (1-30 years)
- **Inputs:**
  - Current assets and liabilities (from Accounts)
  - Average monthly income/expenses (from transaction history)
  - Growth assumptions (investment returns, inflation, salary increases)
  - Major life events (one-time expenses, income changes)
- **Output:**
  - Line chart showing net worth trajectory
  - Year-by-year breakdown table
  - Key milestones (debt-free date, target net worth dates)

#### 1.2 Mortgage vs Invest Comparison
- **Purpose:** Compare paying down mortgage vs investing surplus
- **Inputs:**
  - Mortgage details (balance, interest rate, remaining term)
  - Available surplus (monthly cashflow)
  - Investment return assumptions
  - Tax considerations (RRSP deduction benefits)
- **Output:**
  - Side-by-side comparison chart
  - Net worth difference over time
  - Break-even analysis
  - Recommendation with reasoning

#### 1.3 Retirement Projection
- **Purpose:** Estimate retirement readiness
- **Inputs:**
  - Current age and target retirement age
  - Current retirement savings (RRSP, TFSA, DCPP)
  - Expected retirement expenses (based on current spending)
  - CPP/OAS estimates (simplified)
  - Withdrawal strategy (4% rule, etc.)
- **Output:**
  - Retirement savings trajectory
  - Projected retirement income
  - Shortfall/surplus analysis
  - Required savings rate

#### 1.4 Major Purchase Affordability
- **Purpose:** Determine if a major purchase is affordable
- **Inputs:**
  - Purchase amount (e.g., car, home, vacation)
  - Down payment available
  - Financing terms (if applicable)
  - Impact on monthly cashflow
- **Output:**
  - Cashflow impact over time
  - Net worth impact
  - Affordability score
  - Recommendations

---

## 2. Data Model Extensions

### Projection Scenario
```ts
type ProjectionScenario = {
  id: string;
  householdId: string;
  name: string; // e.g., "Base Case", "Aggressive Investing", "Early Retirement"
  type: 'net_worth' | 'mortgage_vs_invest' | 'retirement' | 'major_purchase';
  createdAt: string;
  updatedAt: string;
  
  // Base assumptions
  assumptions: {
    // Investment returns
    investmentReturnRate: number; // e.g., 0.06 (6% annual)
    inflationRate: number; // e.g., 0.02 (2% annual)
    salaryGrowthRate: number; // e.g., 0.03 (3% annual)
    
    // Tax assumptions (simplified)
    marginalTaxRate: number; // e.g., 0.30 (30%)
    rrspDeductionBenefit: number; // Tax savings from RRSP contributions
    
    // Retirement
    targetRetirementAge?: number;
    retirementExpenseRatio?: number; // e.g., 0.70 (70% of current expenses)
    withdrawalRate?: number; // e.g., 0.04 (4% rule)
    
    // Mortgage vs Invest
    mortgageInterestRate?: number;
    mortgageTermRemaining?: number; // months
    investmentReturnRate?: number;
  };
  
  // Projection-specific config
  config: {
    projectionYears: number; // 1-30 years
    startDate: string; // YYYY-MM-DD
    monthlySteps: boolean; // Monthly vs annual granularity
    
    // For mortgage vs invest
    monthlySurplus?: number;
    prepaymentAmount?: number;
    
    // For major purchase
    purchaseAmount?: number;
    downPayment?: number;
    financingRate?: number;
    financingTerm?: number; // months
  };
  
  // Life events (one-time changes)
  lifeEvents?: LifeEvent[];
};

type LifeEvent = {
  id: string;
  year: number; // Year into projection (0 = current year)
  month?: number; // Optional month (1-12)
  type: 'income_change' | 'expense_change' | 'one_time_expense' | 'one_time_income' | 'account_change';
  description: string;
  amount: number; // Positive for income, negative for expense
  recurring?: boolean; // If true, applies monthly going forward
  accountId?: string; // If account balance changes
};
```

### Projection Result
```ts
type ProjectionResult = {
  scenarioId: string;
  calculatedAt: string;
  
  // Time series data
  monthlyData: ProjectionMonth[];
  yearlyData: ProjectionYear[];
  
  // Summary metrics
  summary: {
    startingNetWorth: number;
    endingNetWorth: number;
    totalGrowth: number;
    averageAnnualGrowth: number;
    peakNetWorth: number;
    peakNetWorthYear: number;
    debtFreeDate?: string; // If applicable
    retirementReadyDate?: string; // If applicable
  };
  
  // For mortgage vs invest
  comparison?: {
    mortgagePayoffDate: string;
    investPayoffDate: string;
    netWorthDifference: number;
    recommendation: 'mortgage' | 'invest' | 'hybrid';
    reasoning: string;
  };
};

type ProjectionMonth = {
  year: number;
  month: number; // 1-12
  date: string; // YYYY-MM-DD
  
  // Assets
  totalAssets: number;
  cashAssets: number;
  investmentAssets: number;
  realEstateAssets: number;
  
  // Liabilities
  totalLiabilities: number;
  mortgageBalance: number;
  otherDebt: number;
  
  // Net worth
  netWorth: number;
  netWorthChange: number; // Change from previous month
  
  // Cashflow
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  
  // Investment growth
  investmentGrowth: number;
  investmentContributions: number;
  
  // Debt payments
  debtPayments: number;
  principalPaydown: number;
  interestPaid: number;
};

type ProjectionYear = {
  year: number;
  // Aggregated yearly data
  startingNetWorth: number;
  endingNetWorth: number;
  netWorthChange: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  averageSavingsRate: number;
  investmentGrowth: number;
  debtPaydown: number;
};
```

---

## 3. Calculation Engine

### 3.1 Net Worth Projection Algorithm

```ts
function projectNetWorth(
  accounts: Account[],
  transactions: Transaction[],
  scenario: ProjectionScenario
): ProjectionResult {
  // 1. Calculate starting state
  const startingNetWorth = calcNetWorth(accounts);
  const avgMonthlyIncome = calcMonthlyIncomeFromTransactions(transactions);
  const avgMonthlyExpenses = calcMonthlyExpensesFromTransactions(transactions);
  const monthlySavings = avgMonthlyIncome - avgMonthlyExpenses;
  
  // 2. Initialize projection state
  let currentAssets = accounts.filter(a => a.kind === 'asset');
  let currentLiabilities = accounts.filter(a => a.kind === 'liability');
  let monthlyData: ProjectionMonth[] = [];
  
  // 3. Project month by month
  for (let month = 0; month < scenario.config.projectionYears * 12; month++) {
    const date = addMonths(scenario.config.startDate, month);
    const year = getYear(date);
    const monthNum = getMonth(date) + 1;
    
    // Apply inflation to expenses
    const inflatedExpenses = avgMonthlyExpenses * Math.pow(1 + scenario.assumptions.inflationRate, month / 12);
    
    // Apply salary growth to income
    const grownIncome = avgMonthlyIncome * Math.pow(1 + scenario.assumptions.salaryGrowthRate, month / 12);
    
    // Calculate savings
    const savings = grownIncome - inflatedExpenses;
    
    // Apply investment growth to investment accounts
    const investmentAccounts = currentAssets.filter(a => 
      ['tfsa', 'rrsp', 'non_registered'].includes(a.type)
    );
    const investmentBalance = investmentAccounts.reduce((sum, a) => sum + a.balance, 0);
    const monthlyInvestmentReturn = scenario.assumptions.investmentReturnRate / 12;
    const investmentGrowth = investmentBalance * monthlyInvestmentReturn;
    
    // Add new contributions to investments
    const investmentContributions = savings * 0.7; // Assume 70% of savings goes to investments
    investmentAccounts.forEach(acc => {
      acc.balance += (investmentContributions / investmentAccounts.length) + (acc.balance * monthlyInvestmentReturn);
    });
    
    // Apply debt paydown
    const mortgageAccounts = currentLiabilities.filter(a => a.type === 'mortgage');
    mortgageAccounts.forEach(mortgage => {
      const monthlyPayment = mortgage.monthlyPayment || 0;
      const monthlyRate = (mortgage.interestRate || 0) / 12 / 100;
      const interest = mortgage.balance * monthlyRate;
      const principal = monthlyPayment - interest;
      mortgage.balance = Math.max(0, mortgage.balance - principal);
    });
    
    // Apply life events
    scenario.lifeEvents?.forEach(event => {
      if (event.year === year && (!event.month || event.month === monthNum)) {
        // Apply event
        if (event.type === 'one_time_expense') {
          // Reduce cash assets
          const cashAccount = currentAssets.find(a => a.type === 'cash' || a.type === 'chequing');
          if (cashAccount) {
            cashAccount.balance = Math.max(0, cashAccount.balance - Math.abs(event.amount));
          }
        }
        // ... handle other event types
      }
    });
    
    // Calculate current net worth
    const totalAssets = currentAssets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = currentLiabilities.reduce((sum, a) => sum + a.balance, 0);
    const netWorth = totalAssets - totalLiabilities;
    
    // Store monthly data
    monthlyData.push({
      year,
      month: monthNum,
      date: formatDate(date),
      totalAssets,
      cashAssets: currentAssets.filter(a => ['cash', 'chequing'].includes(a.type)).reduce((sum, a) => sum + a.balance, 0),
      investmentAssets: investmentBalance,
      realEstateAssets: currentAssets.filter(a => ['primary_home', 'rental_property'].includes(a.type)).reduce((sum, a) => sum + a.balance, 0),
      totalLiabilities,
      mortgageBalance: mortgageAccounts.reduce((sum, a) => sum + a.balance, 0),
      otherDebt: currentLiabilities.filter(a => a.type !== 'mortgage').reduce((sum, a) => sum + a.balance, 0),
      netWorth,
      netWorthChange: month === 0 ? 0 : netWorth - monthlyData[month - 1].netWorth,
      income: grownIncome,
      expenses: inflatedExpenses,
      savings,
      savingsRate: grownIncome > 0 ? (savings / grownIncome) * 100 : 0,
      investmentGrowth,
      investmentContributions,
      debtPayments: mortgageAccounts.reduce((sum, a) => sum + (a.monthlyPayment || 0), 0),
      principalPaydown: mortgageAccounts.reduce((sum, a) => {
        const monthlyRate = (a.interestRate || 0) / 12 / 100;
        const interest = a.balance * monthlyRate;
        return sum + ((a.monthlyPayment || 0) - interest);
      }, 0),
      interestPaid: mortgageAccounts.reduce((sum, a) => {
        const monthlyRate = (a.interestRate || 0) / 12 / 100;
        return sum + (a.balance * monthlyRate);
      }, 0),
    });
  }
  
  // 4. Aggregate yearly data
  const yearlyData = aggregateYearly(monthlyData);
  
  // 5. Calculate summary
  const summary = calculateSummary(monthlyData, yearlyData);
  
  return {
    scenarioId: scenario.id,
    calculatedAt: new Date().toISOString(),
    monthlyData,
    yearlyData,
    summary,
  };
}
```

### 3.2 Mortgage vs Invest Comparison

```ts
function compareMortgageVsInvest(
  mortgage: Account,
  monthlySurplus: number,
  assumptions: ProjectionScenario['assumptions']
): ProjectionResult['comparison'] {
  // Scenario 1: Pay down mortgage
  const mortgagePayoffDate = calculatePayoffDate(mortgage, monthlySurplus);
  const mortgageScenario = projectWithPrepayment(mortgage, monthlySurplus, assumptions);
  
  // Scenario 2: Invest surplus
  const investScenario = projectWithInvesting(monthlySurplus, assumptions);
  
  // Compare net worth at mortgage payoff date
  const netWorthDifference = investScenario.netWorth - mortgageScenario.netWorth;
  
  // Generate recommendation
  let recommendation: 'mortgage' | 'invest' | 'hybrid';
  let reasoning: string;
  
  if (netWorthDifference > 0 && netWorthDifference > mortgage.balance * 0.1) {
    recommendation = 'invest';
    reasoning = `Investing provides ${formatCurrency(netWorthDifference)} more net worth at mortgage payoff. Investment returns (${(assumptions.investmentReturnRate * 100).toFixed(1)}%) exceed mortgage rate (${(mortgage.interestRate || 0).toFixed(1)}%).`;
  } else if (netWorthDifference < 0 && Math.abs(netWorthDifference) > mortgage.balance * 0.1) {
    recommendation = 'mortgage';
    reasoning = `Paying down mortgage provides ${formatCurrency(Math.abs(netWorthDifference))} more net worth. Mortgage rate (${(mortgage.interestRate || 0).toFixed(1)}%) exceeds expected investment returns (${(assumptions.investmentReturnRate * 100).toFixed(1)}%).`;
  } else {
    recommendation = 'hybrid';
    reasoning = `Both strategies are similar. Consider splitting surplus: pay down mortgage for guaranteed return, invest remainder for growth potential.`;
  }
  
  return {
    mortgagePayoffDate: formatDate(mortgagePayoffDate),
    investPayoffDate: formatDate(mortgagePayoffDate), // Same timeline
    netWorthDifference,
    recommendation,
    reasoning,
  };
}
```

---

## 4. UI/UX Design

### 4.1 Tab Structure

**Route:** `/projections`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Projections                                    [New]    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  [Scenario Selector Dropdown]  [Compare Scenarios]       │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Net Worth Projection                              │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │  [Line Chart: Net Worth Over Time]          │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                   │  │
│  │  Key Metrics:                                     │  │
│  │  • Starting: $500,000                             │  │
│  │  • 10-Year: $1,200,000                            │  │
│  │  • Debt-Free: 2030                                │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Assumptions                                       │  │
│  │  • Investment Return: 6%    [Edit]                │  │
│  │  • Inflation: 2%             [Edit]                │  │
│  │  • Salary Growth: 3%         [Edit]                │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Year-by-Year Breakdown                           │  │
│  │  [Table with columns: Year, Net Worth, Income,    │  │
│  │   Expenses, Savings, Investment Growth]            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Scenario Management

- **Create New Scenario:** Button opens modal with scenario type selector
- **Edit Scenario:** Click scenario name to edit assumptions
- **Duplicate Scenario:** Create variations (e.g., "Optimistic", "Pessimistic")
- **Delete Scenario:** Remove unused scenarios
- **Compare Scenarios:** Side-by-side chart comparison (2-3 scenarios)

### 4.3 Key Visualizations

1. **Net Worth Trajectory (Line Chart)**
   - X-axis: Time (years)
   - Y-axis: Net Worth ($)
   - Multiple lines for different scenarios
   - Interactive tooltips with detailed breakdown
   - Milestone markers (debt-free, retirement, etc.)

2. **Asset/Liability Breakdown (Stacked Area Chart)**
   - Shows how assets and liabilities change over time
   - Color-coded by account type
   - Helps visualize debt paydown and asset growth

3. **Cashflow Projection (Bar Chart)**
   - Monthly income vs expenses over time
   - Shows savings rate trend
   - Highlights periods of surplus/deficit

4. **Mortgage vs Invest Comparison (Dual Line Chart)**
   - Two lines: "Pay Mortgage" vs "Invest"
   - Shows net worth difference over time
   - Clear recommendation callout

5. **Retirement Readiness (Gauge Chart)**
   - Shows progress toward retirement goal
   - "On track" / "Behind" / "Ahead" indicators
   - Required savings rate display

### 4.4 Input Forms

**Assumptions Form:**
- Investment return rate (slider: 0-15%)
- Inflation rate (slider: 0-5%)
- Salary growth rate (slider: 0-10%)
- Tax rate (dropdown: based on province/income)
- Projection years (dropdown: 1, 5, 10, 15, 20, 25, 30)

**Life Events Form:**
- Add button opens modal
- Fields: Year, Month, Type, Description, Amount
- Recurring checkbox
- Preview impact on projection

---

## 5. Implementation Phases

### Phase 1: Basic Net Worth Projection (v0.2)
- Simple deterministic projection
- Fixed assumptions (no user input yet)
- Basic line chart
- Year-by-year table
- **Timeline:** 2-3 weeks

### Phase 2: User Configurable Assumptions (v0.2.1)
- Assumptions form
- Save/load scenarios
- Multiple scenarios
- **Timeline:** 1-2 weeks

### Phase 3: Mortgage vs Invest Tool (v0.2.2)
- Comparison calculation
- Dual-line chart
- Recommendation engine
- **Timeline:** 2 weeks

### Phase 4: Life Events (v0.2.3)
- Life events form
- Impact visualization
- Event timeline
- **Timeline:** 1-2 weeks

### Phase 5: Retirement Projection (v0.3)
- Retirement-specific calculations
- CPP/OAS estimates (simplified)
- Withdrawal strategy
- **Timeline:** 2-3 weeks

### Phase 6: Monte Carlo Simulation (v0.4)
- Probabilistic projections
- Confidence intervals
- Best/worst case scenarios
- **Timeline:** 3-4 weeks

---

## 6. Technical Considerations

### Performance
- Calculations run client-side (no backend needed)
- Use Web Workers for heavy calculations
- Cache projection results
- Debounce assumption changes

### Accuracy
- Monthly granularity for first 5 years, annual after
- Compound interest calculations
- Tax simplifications (acknowledge limitations)
- Inflation adjustments

### Canadian-Specific Features
- RRSP deduction benefits
- TFSA contribution room tracking
- CPP/OAS estimates (simplified)
- Provincial tax rates
- Registered account growth (tax-free)

### Data Dependencies
- Requires accounts (assets/liabilities)
- Requires transaction history (for income/expense averages)
- Can work with minimal data (uses defaults)

---

## 7. User Stories

1. **As a user**, I want to see my net worth in 10 years, so I can plan for major life events.

2. **As a user**, I want to compare paying down my mortgage vs investing, so I can make the best financial decision.

3. **As a user**, I want to see if I'm on track for retirement, so I know if I need to save more.

4. **As a user**, I want to model a major purchase (car, house), so I can see the financial impact.

5. **As a user**, I want to create multiple scenarios (optimistic, pessimistic), so I can understand different outcomes.

6. **As a user**, I want to add life events (job change, kids, etc.), so I can see how they affect my projections.

---

## 8. Success Metrics

- Users create at least 1 projection scenario
- Users compare at least 2 scenarios
- Users use mortgage vs invest tool
- Projection accuracy feedback (future)
- Time spent on projection tab

---

## 9. Future Enhancements

- Monte Carlo simulations
- Tax optimization suggestions
- Goal-based projections (save for house, retirement, etc.)
- Integration with external data (stock market returns, inflation data)
- Export projections as PDF
- Share scenarios with financial advisor
- Mobile-optimized view




