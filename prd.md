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
- **Net Worth:** Assets − Liabilities  
- **Monthly Cashflow:** Income − Expenses  
- **Savings Rate:** Surplus ÷ Income  

### C. Charts and Visualizations

| Chart | Description | Library |
|-------|-------------|---------|
| **Asset Mix Breakdown** | Pie/Donut showing % by category (grouped: Cash & Cash-like, Registered Investments, Non-Registered Investments, Real Estate, Other Assets) | `Recharts` |
| **Monthly Budget Flow** | Bar chart comparing incomes vs expenses by category | `Recharts` |
| **Cashflow Gauge** | Donut gauge with savings rate ring, showing +/- $X/month in center, color-coded (emerald for surplus, red/orange for deficit) | `Recharts` |

Each chart auto-updates when the data store changes.

**Note:** Net Worth Timeline omitted in v0.1 (no historical tracking).

### D. Data Persistence
- Use **LocalStorage** for persistence.
- Support export/import of data as single `.json` file (full replace on import with warning).

### E. UX & Navigation

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

## 11. 🧪 Testing & Validation

- Snapshot tests for calculations.
- Chart rendering smoke tests.
- LocalStorage persistence verification.
- Manual UX test flow:
  1. Add one income + one expense + one asset + one liability.
  2. Reload browser → values persist.
  3. Dashboard and charts reflect updated totals.
