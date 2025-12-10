# 🧭 Product Requirements Document (PRD)

**Product Name:** Grouse  
**Version:** 0.2.2 (Updated: January 2025)  
**Owner:** Ranbir Singh  
**Date:** November 2025 (Last Updated: January 2025)  

---

## 1. 🎯 Product Vision

**Grouse** is a Canada-focused personal finance and forecasting web app.  
It helps households understand their **net worth, cashflow, and trade-offs** between investing and debt repayment — while staying simple, privacy-first, and transparent.

Users can input assets, liabilities, incomes, and expenses; view interactive charts; and later expand into full-fledged long-term projections.

---

## 2. 💡 Goals and Success Criteria

| Goal | KPI / Success Metric |
|------|----------------------|
| Build one unified data model | All modules (net worth, budget, projections) read/write from same schema |
| Deliver clean data entry UX | Add/edit/delete assets, liabilities, incomes, and expenses |
| Enable instant visual insights | Dynamic charts for net worth and budget |
| Stay privacy-first | All data stored locally in browser; no account required |
| Foundation for expansion | Ready to plug in tax and forecast logic later |

---

## 3. 🧱 Core Features (v0.1)

### A. Data Entry (CRUD)
Users can add and manage:
- **Assets** (cash, investments, property)
- **Liabilities** (mortgage, loans, credit cards)
- **Transactions** (imported via CSV or manually entered)
  - Supports income, expense, transfer, and unclassified types
  - Automatic categorization via pattern learning
  - Duplicate detection
- **Cashflows** (legacy - optional recurring budget items)

Each entry supports:
- `name`, `type`, `amount`, `frequency`, `account linkage`, and optional metadata.
- Transactions include: `date`, `description`, `amount`, `category`, `owner`, `type`.

### B. Calculations
- **Net Worth:** Assets − Liabilities  
- **Monthly Cashflow:** Average Income − Average Expenses (from transactions)  
- **Savings Rate:** Surplus ÷ Income  
- **Category Averages:** Average monthly spending by category (calculated from all transaction data)
- **Trend Analysis:** Percentage change over time (comparing first half vs second half of data period)
- **Emergency Fund Coverage:** Liquid assets ÷ Average monthly expenses
- **Debt-to-Income Ratio:** Monthly debt payments ÷ Average monthly income
- **Debt-to-Asset Ratio:** Total liabilities ÷ Total assets  

### C. Charts and Visualizations

| Chart | Description | Library |
|-------|-------------|---------|
| **Asset Mix Breakdown** | Pie/Donut showing % by category (grouped: Cash & Cash-like, Registered Investments, Non-Registered Investments, Real Estate, Other Assets) | `Recharts` |
| **Average Monthly Budget Flow** | Bar chart showing average monthly income/expense by category with trend indicators (📈 up, 📉 down, ➡️ stable) | `Recharts` |
| **Monthly Budget Flow** | Bar chart showing specific month's income/expense totals by category | `Recharts` |
| **Cashflow Gauge** | Donut gauge with savings rate ring, showing +/- $X/month in center, color-coded (emerald for surplus, red/orange for deficit) | `Recharts` |

**Budget Calculation Methodology:**
- Averages are calculated from actual transaction data
- Each category's average = Total spending in category ÷ Total months with any transaction data
- This provides realistic monthly budget expectations even for irregular expenses
- Trend analysis compares first half vs second half of available data period

Each chart auto-updates when the data store changes.

**Note:** Net Worth Timeline omitted in v0.1 (no historical tracking).

### D. Data Persistence
- Use **LocalStorage** for persistence.
- Support export/import of data as single `.json` file (full replace on import with warning).

### E. UX & Navigation

**Routes:**
- `/` → Dashboard (key totals + charts)
- `/accounts` → Accounts (Assets & Liabilities CRUD)
- `/budget` → Budget (Transaction analysis, category averages, month-by-month view)
- `/projections` → Projections - Financial forecasting and scenario planning (FULLY IMPLEMENTED)
- `/settings` → Settings (household info, export/import, reset)

**Form UX:**
- Single form at top of page + table/list below
- Create mode: empty form
- Edit mode: clicking row loads item into same form
- Validation: basic hard validation on submit, soft hints on blur
- Default values: sensible defaults (e.g., kind="asset", frequency="monthly", currency="CAD")  

---

## 4. ⚙️ Data Model

### Household
```ts
type Household = {
  id: string;
  name: string;
  province?: string; // Optional, non-functional in v0.1
};
```

### Accounts (assets/liabilities)
```ts
type Account = {
  id: string;
  householdId: string;
  name: string;
  kind: 'asset' | 'liability';
  type: 'cash' | 'chequing' | 'tfsa' | 'rrsp' | 'non_registered' |
        'primary_home' | 'rental_property' | 'mortgage' | 'loan' | 'credit_card';
  balance: number;
  currency: 'CAD' | 'USD'; // CAD-only experience in v0.1, but field kept in model
  interestRate?: number;
  updatedAt: string;
};
```

### Transactions (primary data source for budget)
```ts
type Transaction = {
  id: string;
  householdId: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // Always positive
  isDebit: boolean; // True for expense, false for income/credit
  rawData: Record<string, string>; // Original CSV row data
  type: 'income' | 'expense' | 'transfer' | 'unclassified'; // User-classified type
  category?: string;
  owner?: string;
  fingerprint: string; // For duplicate detection
  importedAt: string; // When it was imported
  sourceFile?: string; // Original CSV file name
};
```

### Cashflows (legacy - optional recurring budget items)
```ts
type Cashflow = {
  id: string;
  householdId: string;
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'biweekly' | 'weekly' | 'annual';
  sourceAccountId?: string; // Optional, mostly ignored in v0.1 logic
  targetAccountId?: string; // Optional, mostly ignored in v0.1 logic
  startDate?: string;
  endDate?: string;
};
```

---

## 5. 🧮 Calculations (Core Functions)

### Transaction-Based Calculations (Primary)
```ts
// Calculate average monthly amount by category and type from transactions
const calculateCategoryAverages = (transactions: Transaction[]): CategoryAverage[] => {
  // Groups transactions by category and type
  // Calculates monthly totals for each month with data
  // Averages = Total spending ÷ Total months with ANY transaction data
  // Includes trend analysis (first half vs second half comparison)
};

// Calculate monthly totals for a specific month
const calculateMonthlyTotals = (transactions: Transaction[], month: string): Record<string, { amount: number; type: 'income' | 'expense' }> => {
  // Filters transactions by month and groups by category
  // Sums all transactions in each category for that month
};

// Calculate average monthly income from transactions
const calcMonthlyIncomeFromTransactions = (transactions: Transaction[]): number => {
  const averages = calculateCategoryAverages(transactions);
  return averages.filter(avg => avg.type === 'income')
                 .reduce((sum, avg) => sum + avg.averageAmount, 0);
};

// Calculate average monthly expenses from transactions
const calcMonthlyExpensesFromTransactions = (transactions: Transaction[]): number => {
  const averages = calculateCategoryAverages(transactions);
  return averages.filter(avg => avg.type === 'expense')
                 .reduce((sum, avg) => sum + avg.averageAmount, 0);
};

// Calculate average monthly cashflow from transactions
const calcMonthlyCashflowFromTransactions = (transactions: Transaction[]): number =>
  calcMonthlyIncomeFromTransactions(transactions) - calcMonthlyExpensesFromTransactions(transactions);

// Calculate savings rate from transactions
const calcSavingsRateFromTransactions = (transactions: Transaction[]): number => {
  const income = calcMonthlyIncomeFromTransactions(transactions);
  if (income === 0) return 0;
  return (calcMonthlyCashflowFromTransactions(transactions) / income) * 100;
};
```

### Legacy Cashflow Calculations (Optional)
```ts
// Normalize any frequency to monthly amount
const normalizeMonthly = (amount: number, frequency: Cashflow['frequency']): number => {
  switch (frequency) {
    case 'monthly': return amount;
    case 'biweekly': return amount * (52 / 12 / 2); // ~2.167
    case 'weekly': return amount * (52 / 12); // ~4.333
    case 'annual': return amount / 12;
    default: return amount;
  }
};
```

### Account-Based Calculations
```ts
// Calculate net worth from accounts
const calcNetWorth = (accounts: Account[]): number =>
  accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0) -
  accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);
```

---

## 6. 🧩 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite |
| Routing | React Router |
| Charts | Recharts |
| Styling | TailwindCSS (custom, desktop-first, no dark mode) |
| State | Zustand |
| Storage | LocalStorage |
| Export/Import | Single JSON file (full replace) |

---

## 7. 📈 Projections Tab (IMPLEMENTED)

The Projections tab is **fully implemented** and enables users to forecast their financial future with comprehensive modeling capabilities.

### 7.1 Core Features (Implemented)

**Net Worth Projection:**
- Forecast net worth over 1-100 years based on current assets, liabilities, income, and expenses
- Interactive line chart showing net worth trajectory with milestone markers
- Year-by-year breakdown table showing account balances, inflows, outflows, and tax
- Hover tooltips on table cells showing detailed account flows
- Retirement milestone markers on chart
- Mortgage payoff milestone markers on chart

**Three-Panel Layout:**
- **Left Panel:** Settings and configuration (collapsible containers)
  - Plan Settings: End of plan year, inflation rate
  - Retirement Planning: Owner ages, retirement years
  - Projection Model Summary: Overview of all configured inputs
  - Tax Strategy: Current year tax projections (Quebec/Canada)
- **Center Panel:** Net worth projection chart and year-by-year account balances table
- **Right Panel:** Account-specific inputs (collapsible containers)
  - Accounts grouped by owner
  - Individual account configuration forms

**Account-Specific Inputs:**
- **RRSP:** Annual contribution, investment growth rate, contribute-until year
- **TFSA:** Annual contribution, investment growth rate, contribute-until year
- **DCPP:** Annual employee contribution, employer match percentage, investment growth rate, contribute-until year
- **RESP:** Annual contribution, contribution room tracking ($50,000 lifetime max), CESG grant (20% match, $500/year, $7,200 lifetime), Quebec QESI grant (10% match, $250/year, $3,600 lifetime), handoff year, child birth year
- **Non-Registered:** Annual contribution, capital gains rate, dividend yield (eligible/non-eligible/foreign), interest rate, contribute-until year
- **Mortgages:** Principal, interest rate, payment amount, payment frequency (monthly/weekly/accelerated biweekly), amortization period

**Income and Expense Management:**
- Add/edit/delete income sources with:
  - Annual amount, growth rate, start year, end year, owner attribution
- Add/edit/delete expense sources with:
  - Annual amount, growth rate, start year, end year, owner attribution
- All persisted to localStorage

**Tax Calculations (Quebec/Canada):**
- Comprehensive tax modeling with owner attribution
- Tracks multiple income types:
  - Employment income (reduced by RRSP/DCPP contributions)
  - Rental income
  - RRSP withdrawals
  - Capital gains (50% inclusion rate, only on withdrawals from non-registered accounts)
  - Eligible dividends (with gross-up and tax credits)
  - Non-eligible dividends
  - Foreign dividends
  - Interest income
- Tax deductions:
  - RRSP contributions reduce taxable employment income
  - DCPP employee contributions reduce taxable employment income
- Tax column in year-by-year table showing total household tax
- Hover tooltips showing tax breakdown by owner and income source
- Tax Strategy panel showing current year projections with effective marginal and average rates

**Cash Flow Modeling:**
- Contributions to investment accounts (RRSP, TFSA, RESP, DCPP, non-registered) are deducted from cash accounts
- Income is added to cash accounts
- Expenses are deducted from cash accounts
- Proper order: Income → Contributions → Expenses

**Retirement Planning:**
- Set current age for each owner
- Set retirement year for each owner
- Retirement milestones displayed on chart
- Age calculations for projection years

### 7.2 Technical Implementation

**Data Models:**
- `ProjectionInputs`: Account-specific configuration (contributions, growth rates, etc.)
- `Incomes`: Income sources with growth rates and time periods
- `Expenses`: Expense sources with growth rates and time periods
- `RetirementYears`: Retirement year by owner
- `OwnerAges`: Current age by owner

**Calculation Engine:**
- Year-by-year projection loop (1-100 years)
- Account balance calculations with:
  - Contributions (with room limits for RESP)
  - Investment growth (capital gains, dividends, interest)
  - Employer matches (DCPP)
  - Government grants (RESP CESG and QESI)
  - Mortgage payments (Canadian mortgage calculations with semi-annual compounding)
  - Withdrawal detection for tax purposes
- Tax calculations using `canadianTaxRates.ts` with Quebec-specific rates
- Owner attribution for proper tax burden allocation

**Storage:**
- All projection inputs, incomes, expenses, retirement years, and owner ages persisted to localStorage
- Auto-save with debouncing to prevent blocking

**UI Components:**
- `NetWorthProjectionChart`: Interactive line chart with milestone markers
- Collapsible containers for better organization
- Responsive three-panel layout with toggle buttons
- Hover tooltips for detailed information

### 7.3 Future Enhancements

| Future Feature | Description |
|----------------|-------------|
| **Mortgage vs Invest Comparison** | Side-by-side analysis of paying down mortgage vs investing surplus |
| **Monte Carlo Simulations** | Probabilistic projections with confidence intervals |
| **Multi-scenario Management** | Save multiple financial plans and compare outcomes |
| **CPP/OAS Estimates** | Government benefit projections |
| **Cloud Sync** | Optional Supabase/Firebase backend |

See [PROJECTION_TAB_DESIGN.md](./PROJECTION_TAB_DESIGN.md) for detailed technical specifications and design documentation.

---

## 8. ✅ Acceptance Criteria

**Core Features:**
- ✅ Users can create/edit/delete assets, liabilities, incomes, expenses.
- ✅ Dashboard shows computed totals for net worth, cashflow, and savings rate.
- ✅ Charts update dynamically on data changes.
- ✅ All data persists across sessions locally.
- ✅ JSON export/import works reliably.

**Projections Tab:**
- ✅ Users can configure account-specific projection inputs (contributions, growth rates, etc.).
- ✅ Net worth projection chart displays trajectory over 1-100 years.
- ✅ Year-by-year account balances table shows detailed flows with hover tooltips.
- ✅ Tax calculations properly attribute income by owner and apply RRSP/DCPP deductions.
- ✅ RESP grants (CESG and Quebec QESI) are automatically calculated.
- ✅ Mortgage payments calculated using Canadian mortgage formulas.
- ✅ Contributions are properly deducted from cash accounts.
- ✅ Retirement milestones and mortgage payoff milestones displayed on chart.
- ✅ All projection settings persist to localStorage.

---

## 9. 🧭 Roadmap

| Milestone | Deliverable | Status |
|-----------|-------------|--------|
| v0.1 MVP | CRUD + charts + persistence | ✅ Complete |
| v0.2 | Projections tab with net worth forecasting | ✅ Complete |
| v0.2.1 | Tax modeling and account-specific inputs | ✅ Complete |
| v0.2.2 | RESP, DCPP, and non-registered account support | ✅ Complete |
| v0.3 | Mortgage vs Invest comparison tool | 🔄 Planned |
| v0.4 | Monte Carlo simulations | 🔄 Planned |
| v0.5 | Multi-scenario management | 🔄 Planned |

---

## 10. 🧩 Folder Structure

```
/src
  /components
    AccountForm.tsx
    CashflowForm.tsx
    AssetMixChart.tsx
    BudgetChart.tsx
    CashflowGauge.tsx
  /store
    useHouseholdStore.ts
  /pages
    Dashboard.tsx
    Accounts.tsx
    Budget.tsx
    Settings.tsx
  /utils
    calculations.ts
    storage.ts
  /types
    models.ts
  App.tsx
  main.tsx
```

## 12. 🎨 Asset Mix Grouping

For Asset Mix Breakdown chart, group accounts into 5 categories:

1. **Cash & Cash-like**: `cash`, `chequing`
2. **Registered Investments**: `tfsa`, `rrsp` (future: `fhsa`, `resp`, `lira`)
3. **Non-Registered Investments**: `non_registered`
4. **Real Estate**: `primary_home`, `rental_property`
5. **Other Assets**: Any other types (e.g., vehicle, business)

---

## 13. 🧪 Testing & Validation

- Snapshot tests for calculations.
- Chart rendering smoke tests.
- LocalStorage persistence verification.
- Manual UX test flow:
  1. Import CSV transactions or add manually.
  2. Verify category averages calculate correctly.
  3. Check trend indicators show up/down/stable correctly.
  4. Add one asset + one liability.
  5. Reload browser → values persist.
  6. Dashboard and charts reflect updated totals.

## 14. 📊 Suggested Additional Data Visualizations

### High Priority
1. **Spending Over Time (Line Chart)**
   - Monthly spending trends for selected categories
   - Compare multiple categories on same chart
   - Show income vs expenses over time
   - Helps identify seasonal patterns

2. **Category Breakdown (Treemap or Sunburst)**
   - Visual hierarchy of spending categories
   - Size = amount, color = trend direction
   - Interactive drill-down into subcategories
   - Better for understanding spending distribution

3. **Monthly Comparison (Grouped Bar Chart)**
   - Side-by-side comparison of multiple months
   - Compare current month vs previous months
   - Year-over-year comparison
   - Useful for tracking progress

4. **Spending Heatmap (Calendar View)**
   - Daily spending intensity visualization
   - Color intensity = spending amount
   - Identify high-spending days/weeks
   - Pattern recognition for budgeting

### Medium Priority
5. **Income vs Expenses Timeline (Area Chart)**
   - Stacked area showing income (green) and expenses (red)
   - Net cashflow as difference between areas
   - Visual representation of savings/deficit periods
   - Time range selector (3/6/12 months, all time)

6. **Top Categories Comparison (Horizontal Bar Chart)**
   - Top 10 income and expense categories
   - Percentage of total for each
   - Quick reference for biggest budget items
   - Sortable by amount or percentage

7. **Spending Velocity (Scatter Plot)**
   - X-axis: Days into month, Y-axis: Cumulative spending
   - Multiple lines for different months
   - Identify spending patterns (front-loaded vs back-loaded)
   - Budget burn rate visualization

8. **Category Trends (Multi-Line Chart)**
   - Multiple categories on same chart
   - Show trend lines for selected categories
   - Compare growth/decline rates
   - Useful for tracking specific budget goals

### Lower Priority (Future Enhancements)
9. **Forecast Projection (Line Chart with Projection)**
   - Historical data + projected future spending
   - Based on trends and averages
   - Confidence intervals
   - "If current trends continue..." visualization

10. **Budget Variance Analysis (Bar Chart)**
    - Planned vs actual spending
    - Variance percentage for each category
    - Color-coded (green = under budget, red = over budget)
    - Requires budget targets feature

11. **Spending Distribution (Histogram)**
    - Distribution of transaction amounts
    - Identify typical transaction size
    - Outlier detection
    - Useful for understanding spending behavior

12. **Category Correlation Matrix (Heatmap)**
    - Show relationships between spending categories
    - When one category increases, which others change?
    - Data-driven insights for budget optimization
    - Advanced analytics feature

13. **Geographic Spending (Map Visualization)**
    - If location data available from transactions
    - Show spending by location
    - Identify high-spending areas
    - Useful for travel/commute analysis

14. **Recurring vs One-Time (Pie Chart)**
    - Breakdown of recurring expenses vs one-time purchases
    - Helps identify areas for cost reduction
    - Understanding fixed vs variable costs

15. **Savings Goal Progress (Gauge/Progress Bar)**
    - Multiple savings goals with progress tracking
    - Visual progress indicators
    - Time to goal estimates
    - Motivational visualization
