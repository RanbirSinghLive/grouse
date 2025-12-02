# Grouse

A Canada-focused personal finance and forecasting web app.

## Features

- **Net Worth Tracking**: Track assets and liabilities
- **Budget Management**: Manage incomes and expenses
- **Holdings Tracking**: Track individual stock/ETF holdings in investment accounts
- **Visualizations**: Interactive charts for asset mix and budget flow
- **Data Persistence**: All data stored locally in browser (LocalStorage)
- **Export/Import**: Backup and restore your data as JSON

## Tech Stack

- React + TypeScript + Vite
- Zustand for state management
- Recharts for visualizations
- TailwindCSS for styling
- React Router for navigation

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Usage

1. **Dashboard**: View your net worth, monthly cashflow, and savings rate
2. **Accounts**: Add and manage assets and liabilities
3. **Budget**: Add and manage incomes and expenses
4. **Settings**: Configure household info, export/import data, and manage owners

## Holdings Tracking

For investment accounts (TFSA, RRSP, DCPP, RESP, Non-Registered), you can:
- Track individual holdings (stocks/ETFs)
- Use Alpha Vantage API to automatically update prices
- Manually enter prices for unsupported tickers (e.g., mutual funds)

## Data Storage

All data is stored locally in your browser's LocalStorage. No account required, no data sent to servers.

## License

ISC

