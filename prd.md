# 🧭 Product Requirements Document (PRD)

**Product Name:** Grouse  
**Version:** 0.1 MVP  
**Owner:** Ranbir Singh  
**Date:** November 2025  

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
- `/projections` → Projections (v0.2+) - Financial forecasting and scenario planning
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

## 7. 🗺️ Future Extensions

| Future Feature | Description |
|----------------|-------------|
| **Projection Engine** | Deterministic and Monte Carlo projections - See [PROJECTION_TAB_DESIGN.md](./PROJECTION_TAB_DESIGN.md) for detailed design |
| **Invest vs Prepay Tool** | Compare mortgage prepayment vs investing with side-by-side analysis |
| **Tax Insights** | Approximate CPP/OAS and RRSP deduction effects |
| **Cloud Sync** | Optional Supabase/Firebase backend |
| **Multi-scenario Management** | Save multiple financial plans and compare outcomes |

### Projection Tab Overview (v0.2+)

The Projection tab enables users to forecast their financial future. Key features:

**Core Projection Types:**
1. **Net Worth Projection** - Forecast net worth over 1-30 years based on current assets, liabilities, income, and expenses
2. **Mortgage vs Invest Comparison** - Side-by-side analysis of paying down mortgage vs investing surplus
3. **Retirement Projection** - Estimate retirement readiness with CPP/OAS considerations
4. **Major Purchase Affordability** - Determine if a major purchase is financially feasible

**Key Capabilities:**
- Configurable assumptions (investment returns, inflation, salary growth)
- Life events modeling (one-time expenses, income changes)
- Multiple scenario comparison
- Year-by-year breakdown tables
- Interactive charts showing trajectories
- Canadian-specific features (RRSP deductions, TFSA growth, CPP/OAS)

**Implementation Phases:**
- **Phase 1 (v0.2):** Basic net worth projection with fixed assumptions
- **Phase 2 (v0.2.1):** User-configurable assumptions and scenario management
- **Phase 3 (v0.2.2):** Mortgage vs Invest comparison tool
- **Phase 4 (v0.2.3):** Life events modeling
- **Phase 5 (v0.3):** Retirement-specific projections
- **Phase 6 (v0.4):** Monte Carlo simulations with confidence intervals

See [PROJECTION_TAB_DESIGN.md](./PROJECTION_TAB_DESIGN.md) for complete technical specifications, data models, calculation algorithms, and UI/UX designs.

---

## 8. ✅ Acceptance Criteria

- Users can create/edit/delete assets, liabilities, incomes, expenses.
- Dashboard shows computed totals for net worth, cashflow, and savings rate.
- Charts update dynamically on data changes.
- All data persists across sessions locally.
- JSON export/import works reliably.

---

## 9. 🧭 Roadmap (v0.1 → v0.2)

| Milestone | Deliverable |
|-----------|-------------|
| v0.1 MVP | CRUD + charts + persistence |
| v0.2 | Scenario comparison + export/import polish |
| v0.3 | Forecast engine integration |

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
