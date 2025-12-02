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
- **Monthly Incomes** (salary, rental, dividends)
- **Monthly Expenses** (housing, childcare, groceries)

Each entry supports:
- `name`, `type`, `amount`, `frequency`, `account linkage`, and optional metadata.

### B. Calculations

**Core Metrics:**
- **Net Worth:** Assets − Liabilities  
- **Monthly Cashflow:** Income − Expenses  
- **Savings Rate:** Surplus ÷ Income  

**Personal Finance Best Practice Metrics:**
- **Emergency Fund Coverage:** Liquid assets (cash + chequing) ÷ Monthly expenses (in months)
- **Debt-to-Income Ratio:** Monthly debt payments ÷ Monthly income × 100
- **Debt-to-Asset Ratio:** Total liabilities ÷ Total assets × 100
- **Real Estate Equity:** (Primary home + Rental properties) − All mortgages (shows equity amount, percentage, and total value)  

### C. Charts and Visualizations

| Chart | Description | Library |
|-------|-------------|---------|
| **Asset Mix Breakdown** | Pie/Donut showing % by category (grouped: Cash & Cash-like, Registered Investments, Non-Registered Investments, Real Estate, Other Assets) | `Recharts` |
| **Monthly Budget Flow** | Bar chart comparing incomes vs expenses by category | `Recharts` |
| **Cashflow Gauge** | Donut gauge with savings rate ring, showing +/- $X/month in center, color-coded (emerald for surplus, red/orange for deficit) | `Recharts` |

Each chart auto-updates when the data store changes.

**Note:** Net Worth Timeline omitted in v0.1 (no historical tracking).

### D. Holdings Tracking (Investment Accounts)

Investment accounts (TFSA, RRSP, DCPP, RESP, non_registered) can optionally track individual holdings (stocks/ETFs):

- **Manual Entry (Phase 1):** Users can manually enter ticker, shares, and current price
- **API Price Updates (Phase 2):** Integration with Alpha Vantage API to fetch current prices
  - Free tier: 5 calls per minute, 500 calls per day
  - 5-minute cache to reduce API calls
  - Supports Canadian tickers (`.TO` suffix) and US tickers
  - Special handling for "CASH" holding type (price = 1.0)
  - Progress feedback during bulk price refresh
  - Error handling with fallback to existing prices if API fails
- **Balance Calculation:** If `useHoldings=true`, account balance is calculated as sum of (shares × currentPrice) for all holdings
- **Ticker Autocomplete:** Form remembers previously entered tickers for faster data entry

### E. Data Persistence
- Use **LocalStorage** for persistence.
- Support export/import of data as single `.json` file (full replace on import with warning).
- Price cache stored separately in LocalStorage with 5-minute expiration.

### F. Owner Management

Users can define multiple owners (e.g., "Person 1", "Person 2", "Joint") in Settings:
- **Household Owners:** List of people/entities that can be assigned to accounts and cashflows
- **Account Owner:** Optional field to filter and roll up accounts by owner
- **Cashflow Owner:** Optional field to filter and roll up incomes/expenses by owner
- **Display:** Empty owner field displays as "All / Household" instead of "-"
- **Filtering:** Accounts and Budget pages support owner filter buttons to view data by person

### G. UX & Navigation

**Routes:**
- `/` → Dashboard (key totals + charts)
- `/accounts` → Accounts (Assets & Liabilities CRUD)
- `/budget` → Budget (Incomes & Expenses CRUD + charts)
- `/settings` → Settings (household info, export/import, reset)

**Form UX:**
- Single form at top of page + table/list below
- Create mode: empty form
- Edit mode: clicking row loads item into same form
- Validation: basic hard validation on submit, soft hints on blur
- Default values: sensible defaults (e.g., kind="asset", frequency="monthly", currency="CAD")
- Number inputs: Show empty string when value is 0 to avoid "stray zeros"
- Account type formatting: Acronyms (TFSA, RRSP, DCPP, RESP) displayed in uppercase

**UI Design:**
- Colorful gradients and modern styling (blue, emerald, purple, red, teal color schemes)
- Boxed layouts with shadows, borders, and hover effects (scale and shadow transitions)
- Improved button styles with icons, gradients, and hover states
- Desktop-first design (no dark mode)
- Sticky navigation header with gradient background
- Metric cards with emoji icons and status indicators
- Form inputs with focus states and error styling
- Responsive grid layouts for dashboard metrics  

---

## 4. ⚙️ Data Model

### Household
```ts
type Household = {
  id: string;
  name: string;
  province?: string; // Optional, non-functional in v0.1
  owners?: string[]; // List of owners/people (e.g., ["Person 1", "Person 2", "Joint"])
};
```

### Holdings (stocks/ETFs within investment accounts)
```ts
type Holding = {
  id: string;
  accountId: string;
  ticker: string; // e.g., "VTI", "XEQT.TO", "CASH"
  shares: number; // Number of shares owned
  currentPrice: number; // Current price per share (manual entry or API-fetched)
  currency: 'CAD' | 'USD';
  lastPriceUpdate?: string; // ISO timestamp of last price update
};
```

### Accounts (assets/liabilities)
```ts
type Account = {
  id: string;
  householdId: string;
  name: string;
  kind: 'asset' | 'liability';
  type: 'cash' | 'chequing' | 'tfsa' | 'rrsp' | 'dcpp' | 'resp' | 'non_registered' |
        'primary_home' | 'rental_property' | 'mortgage' | 'loan' | 'credit_card';
  balance: number; // Manual balance OR calculated from holdings if useHoldings=true
  currency: 'CAD' | 'USD'; // CAD-only experience in v0.1, but field kept in model
  interestRate?: number;
  owner?: string; // Owner of the account (e.g., "Person 1", "Person 2", "Joint", "Household")
  useHoldings?: boolean; // If true, calculate balance from holdings; if false, use manual balance
  holdings?: Holding[]; // Holdings for investment accounts (TFSA, RRSP, DCPP, RESP, non_registered)
  // Mortgage-specific fields for projections
  monthlyPayment?: number; // Monthly payment amount
  termRemainingMonths?: number; // Remaining term in months
  updatedAt: string;
};
```

### Cashflows (incomes/expenses)
```ts
type Cashflow = {
  id: string;
  householdId: string;
  name: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  frequency: 'monthly' | 'biweekly' | 'weekly' | 'annual';
  owner?: string; // Owner of the income/expense (e.g., "Person 1", "Person 2", "Joint", "Household")
  sourceAccountId?: string; // Optional, mostly ignored in v0.1 logic
  targetAccountId?: string; // Optional, mostly ignored in v0.1 logic
  startDate?: string;
  endDate?: string;
};
```

---

## 5. 🧮 Calculations (Core Functions)

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

// Calculate net worth from accounts
const calcNetWorth = (accounts: Account[]): number =>
  accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0) -
  accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);

// Calculate total monthly income
const calcMonthlyIncome = (flows: Cashflow[]): number =>
  flows.filter(f => f.type === 'income')
       .reduce((sum, f) => sum + normalizeMonthly(f.amount, f.frequency), 0);

// Calculate total monthly expenses
const calcMonthlyExpenses = (flows: Cashflow[]): number =>
  flows.filter(f => f.type === 'expense')
       .reduce((sum, f) => sum + normalizeMonthly(f.amount, f.frequency), 0);

// Calculate monthly cashflow
const calcMonthlyCashflow = (flows: Cashflow[]): number =>
  calcMonthlyIncome(flows) - calcMonthlyExpenses(flows);

// Calculate savings rate
const calcSavingsRate = (flows: Cashflow[]): number => {
  const income = calcMonthlyIncome(flows);
  if (income === 0) return 0;
  return (calcMonthlyCashflow(flows) / income) * 100;
};

// Calculate total assets
const calcTotalAssets = (accounts: Account[]): number =>
  accounts.filter(a => a.kind === 'asset').reduce((sum, a) => sum + a.balance, 0);

// Calculate total liabilities
const calcTotalLiabilities = (accounts: Account[]): number =>
  accounts.filter(a => a.kind === 'liability').reduce((sum, a) => sum + a.balance, 0);

// Calculate liquid assets (cash + chequing)
const calcLiquidAssets = (accounts: Account[]): number =>
  accounts.filter(a => a.kind === 'asset' && (a.type === 'cash' || a.type === 'chequing'))
          .reduce((sum, a) => sum + a.balance, 0);

// Calculate emergency fund coverage in months
const calcEmergencyFundCoverage = (accounts: Account[], cashflows: Cashflow[]): number => {
  const liquidAssets = calcLiquidAssets(accounts);
  const monthlyExpenses = calcMonthlyExpenses(cashflows);
  if (monthlyExpenses <= 0) return Infinity;
  return liquidAssets / monthlyExpenses;
};

// Calculate debt-to-income ratio (monthly debt payments / monthly income)
const calcDebtToIncomeRatio = (accounts: Account[], cashflows: Cashflow[]): number => {
  const monthlyIncome = calcMonthlyIncome(cashflows);
  if (monthlyIncome === 0) return 0;
  const monthlyDebtPayments = accounts
    .filter(a => a.kind === 'liability' && (a.type === 'mortgage' || a.type === 'loan') && a.monthlyPayment)
    .reduce((sum, a) => sum + (a.monthlyPayment || 0), 0);
  return (monthlyDebtPayments / monthlyIncome) * 100;
};

// Calculate debt-to-asset ratio
const calcDebtToAssetRatio = (accounts: Account[]): number => {
  const totalAssets = calcTotalAssets(accounts);
  if (totalAssets === 0) return 0;
  const totalLiabilities = calcTotalLiabilities(accounts);
  return (totalLiabilities / totalAssets) * 100;
};

// Calculate real estate equity (primary home + rental properties vs all mortgages)
const calcRealEstateEquity = (accounts: Account[]): { equity: number; percentage: number; totalValue: number } | null => {
  const realEstateAssets = accounts.filter(a => a.kind === 'asset' && (a.type === 'primary_home' || a.type === 'rental_property'));
  const totalRealEstateValue = realEstateAssets.reduce((sum, a) => sum + a.balance, 0);
  const mortgages = accounts.filter(a => a.type === 'mortgage' && a.kind === 'liability');
  const totalMortgageBalance = mortgages.reduce((sum, a) => sum + a.balance, 0);
  if (totalRealEstateValue === 0 && totalMortgageBalance === 0) return null;
  const equity = totalRealEstateValue - totalMortgageBalance;
  const percentage = totalRealEstateValue > 0 ? (equity / totalRealEstateValue) * 100 : 0;
  return { equity, percentage, totalValue: totalRealEstateValue };
};

// Helper to format account types for display (TFSA, RRSP, DCPP, RESP in uppercase)
const formatAccountType = (type: Account['type']): string => {
  const acronyms: Record<string, string> = {
    'tfsa': 'TFSA',
    'rrsp': 'RRSP',
    'dcpp': 'DCPP',
    'resp': 'RESP',
  };
  if (acronyms[type]) return acronyms[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};
```

---

## 6. 🧩 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite |
| Routing | React Router |
| Charts | Recharts |
| Styling | TailwindCSS v4 (custom, desktop-first, no dark mode, colorful gradients) |
| State | Zustand |
| Storage | LocalStorage |
| Export/Import | Single JSON file (full replace) |
| Stock API | Alpha Vantage (free tier: 5 calls/min, 500 calls/day) |

---

## 7. 🗺️ Future Extensions

| Future Feature | Description |
|----------------|-------------|
| Projection Engine | Deterministic and Monte Carlo projections |
| Invest vs Prepay Tool | Compare mortgage prepayment vs investing |
| Tax Insights | Approximate CPP/OAS and RRSP deduction effects |
| Cloud Sync | Optional Supabase/Firebase backend |
| Multi-scenario Management | Save multiple financial plans |

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
    stockApi.ts
  /types
    models.ts
  App.tsx
  main.tsx
```

## 12. 🎨 Asset Mix Grouping

For Asset Mix Breakdown chart, group accounts into 5 categories:

1. **Cash & Cash-like**: `cash`, `chequing`
2. **Registered Investments**: `tfsa`, `rrsp`, `dcpp`, `resp` (future: `fhsa`, `lira`)
3. **Non-Registered Investments**: `non_registered`
4. **Real Estate**: `primary_home`, `rental_property`
5. **Other Assets**: Any other types (e.g., vehicle, business)

**Color Scheme:**
- Cash & Cash-like: Blue
- Registered Investments: Green
- Non-Registered Investments: Purple
- Real Estate: Orange
- Other Assets: Gray

---

## 11. 🧪 Testing & Validation

- Snapshot tests for calculations.
- Chart rendering smoke tests.
- LocalStorage persistence verification.
- API rate limiting and caching verification.
- Manual UX test flow:
  1. Add one income + one expense + one asset + one liability.
  2. Reload browser → values persist.
  3. Dashboard and charts reflect updated totals.
  4. Add investment account with holdings.
  5. Test price refresh API integration.
  6. Test owner filtering and roll-up.

## 13. 🔧 Implementation Details

### Holdings Tracking
- Investment accounts (TFSA, RRSP, DCPP, RESP, non_registered) can enable `useHoldings` flag
- When enabled, account balance is calculated from holdings: `sum(shares × currentPrice)`
- Holdings support manual price entry or API-fetched prices via Alpha Vantage
- Special "CASH" ticker type for cash holdings within investment accounts (price = 1.0)
- Ticker autocomplete remembers previously entered tickers

### API Integration (Alpha Vantage)
- **Rate Limiting:** 12-second delay between API calls (5 calls per minute)
- **Caching:** 5-minute cache duration to reduce API calls
- **Canadian Ticker Support:** Automatically tries `.TO` suffix for Canadian stocks
- **Error Handling:** Falls back to existing price if API fails, displays error message
- **Progress Feedback:** Shows current ticker and progress during bulk refresh
- **Retry Logic:** Attempts alternative ticker formats for Canadian class shares (e.g., BTCC.B)

### Mortgage Fields
- `monthlyPayment`: Monthly payment amount for debt-to-income calculations
- `termRemainingMonths`: Remaining term in months for future projection calculations
- Only displayed/editable when account type is "mortgage"

### Owner Management
- Owners defined in Settings → Household section
- Accounts and cashflows can be assigned to specific owners
- Filter buttons on Accounts and Budget pages to view by owner
- Empty owner displays as "All / Household" in UI
- Supports multi-person households (e.g., couples) with roll-up capabilities
