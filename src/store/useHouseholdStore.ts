import { create } from 'zustand';
import type { Household, Account, Cashflow, AppData, Holding, Transaction, TransactionPattern, ImportData } from '../types/models';
import { loadData, saveData, loadImportData, saveImportData, loadBudgetNote, saveBudgetNote } from '../utils/storage';
import { fetchPrices } from '../utils/stockApi';

interface HouseholdStore {
  // State
  household: Household | null;
  accounts: Account[];
  cashflows: Cashflow[];
  editingAccountId: string | null;
  editingCashflowId: string | null;
  // Import state
  transactions: Transaction[];
  patterns: TransactionPattern[];
  // Budget note
  budgetNote: string;

  // Actions
  initialize: () => void;
  setHousehold: (household: Household) => void;
  addAccount: (account: Omit<Account, 'id' | 'updatedAt' | 'householdId'>) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  setEditingAccount: (id: string | null) => void;
  addCashflow: (cashflow: Omit<Cashflow, 'id' | 'householdId'>) => void;
  updateCashflow: (id: string, updates: Partial<Cashflow>) => void;
  deleteCashflow: (id: string) => void;
  setEditingCashflow: (id: string | null) => void;
  // Holdings actions
  addHolding: (accountId: string, holding: Omit<Holding, 'id' | 'accountId'>) => void;
  updateHolding: (accountId: string, holdingId: string, updates: Partial<Holding>) => void;
  deleteHolding: (accountId: string, holdingId: string) => void;
  recalculateAccountBalance: (accountId: string) => void;
  refreshHoldingPrices: (accountId: string, onProgress?: (current: number, total: number, ticker: string) => void, bypassCache?: boolean) => Promise<void>;
  refreshAllHoldingPrices: (onProgress?: (current: number, total: number, ticker: string) => void, bypassCache?: boolean) => Promise<void>;
  // Import actions
  addTransactions: (transactions: Transaction[]) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addPattern: (pattern: TransactionPattern) => void;
  updatePattern: (id: string, updates: Partial<TransactionPattern>) => void;
  deletePattern: (id: string) => void;
  persistImportData: () => void;
  renameCategory: (oldName: string, newName: string) => void;
  // Budget note actions
  setBudgetNote: (note: string) => void;
  reset: () => void;
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const useHouseholdStore = create<HouseholdStore>((set, get) => {
  // Persist to localStorage helper
  const persist = () => {
    const state = get();
    const data: AppData = {
      household: state.household,
      accounts: state.accounts,
      cashflows: state.cashflows,
    };
    saveData(data);
  };

  // Persist import data
  const persistImportData = () => {
    const state = get();
    const importData: ImportData = {
      transactions: state.transactions,
      patterns: state.patterns,
      importHistory: [], // TODO: Implement import history
    };
    saveImportData(importData);
  };

  // Initialize from localStorage
  const initialize = () => {
    const data = loadData();
    const importData = loadImportData();
    const budgetNote = loadBudgetNote();
    
    if (data) {
      set({
        household: data.household,
        accounts: data.accounts || [],
        cashflows: data.cashflows || [],
        editingAccountId: null,
        editingCashflowId: null,
        transactions: importData?.transactions || [],
        patterns: importData?.patterns || [],
        budgetNote: budgetNote || '',
      });
    } else {
      // Create default household if none exists
      const defaultHousehold: Household = {
        id: generateId(),
        name: 'My Household',
      };
      set({
        household: defaultHousehold,
        accounts: [],
        cashflows: [],
        editingAccountId: null,
        editingCashflowId: null,
        transactions: importData?.transactions || [],
        patterns: importData?.patterns || [],
        budgetNote: budgetNote || '',
      });
      persist();
    }
  };

  return {
    // Initial state
    household: null,
    accounts: [],
    cashflows: [],
    editingAccountId: null,
    editingCashflowId: null,
    transactions: [],
    patterns: [],
    budgetNote: '',

    // Initialize
    initialize,

    // Household
    setHousehold: (household) => {
      set({ household });
      persist();
    },

    // Accounts
    addAccount: (accountData) => {
      const household = get().household;
      if (!household) {
        console.error('[store] addAccount: no household set');
        return;
      }
      const newAccount: Account = {
        ...accountData,
        id: generateId(),
        householdId: household.id,
        holdings: accountData.useHoldings ? [] : undefined, // Initialize holdings if useHoldings is true
        updatedAt: new Date().toISOString(),
      };
      set((state) => ({
        accounts: [...state.accounts, newAccount],
      }));
      persist();
    },

    updateAccount: (id, updates) => {
      set((state) => ({
        accounts: state.accounts.map((acc) =>
          acc.id === id
            ? {
                ...acc,
                ...updates,
                // If useHoldings is toggled off, clear holdings
                holdings: updates.useHoldings === false ? undefined : acc.holdings,
                updatedAt: new Date().toISOString(),
              }
            : acc
        ),
      }));
      persist();
    },

    deleteAccount: (id) => {
      set((state) => ({
        accounts: state.accounts.filter((acc) => acc.id !== id),
        editingAccountId: state.editingAccountId === id ? null : state.editingAccountId,
      }));
      persist();
    },

    setEditingAccount: (id) => {
      set({ editingAccountId: id });
    },

    // Cashflows
    addCashflow: (cashflowData) => {
      const household = get().household;
      if (!household) {
        console.error('[store] addCashflow: no household set');
        return;
      }
      const newCashflow: Cashflow = {
        ...cashflowData,
        id: generateId(),
        householdId: household.id,
      };
      set((state) => ({
        cashflows: [...state.cashflows, newCashflow],
      }));
      persist();
    },

    updateCashflow: (id, updates) => {
      set((state) => ({
        cashflows: state.cashflows.map((cf) =>
          cf.id === id ? { ...cf, ...updates } : cf
        ),
      }));
      persist();
    },

    deleteCashflow: (id) => {
      set((state) => ({
        cashflows: state.cashflows.filter((cf) => cf.id !== id),
        editingCashflowId: state.editingCashflowId === id ? null : state.editingCashflowId,
      }));
      persist();
    },

    setEditingCashflow: (id) => {
      set({ editingCashflowId: id });
    },

    // Holdings
    addHolding: (accountId, holdingData) => {
      set((state) => ({
        accounts: state.accounts.map((acc) => {
          if (acc.id === accountId) {
            const newHolding: Holding = {
              ...holdingData,
              id: generateId(),
              accountId,
              lastPriceUpdate: new Date().toISOString(),
            };
            return {
              ...acc,
              holdings: [...(acc.holdings || []), newHolding],
            };
          }
          return acc;
        }),
      }));
      get().recalculateAccountBalance(accountId);
      persist();
    },

    updateHolding: (accountId, holdingId, updates) => {
      set((state) => ({
        accounts: state.accounts.map((acc) => {
          if (acc.id === accountId && acc.holdings) {
            return {
              ...acc,
              holdings: acc.holdings.map((h) =>
                h.id === holdingId
                  ? { ...h, ...updates, lastPriceUpdate: new Date().toISOString() }
                  : h
              ),
            };
          }
          return acc;
        }),
      }));
      get().recalculateAccountBalance(accountId);
      persist();
    },

    deleteHolding: (accountId, holdingId) => {
      set((state) => ({
        accounts: state.accounts.map((acc) => {
          if (acc.id === accountId && acc.holdings) {
            return {
              ...acc,
              holdings: acc.holdings.filter((h) => h.id !== holdingId),
            };
          }
          return acc;
        }),
      }));
      get().recalculateAccountBalance(accountId);
      persist();
    },

    recalculateAccountBalance: (accountId) => {
      set((state) => ({
        accounts: state.accounts.map((acc) => {
          if (acc.id === accountId && acc.useHoldings && acc.holdings) {
            const balance = acc.holdings.reduce(
              (sum, h) => sum + h.shares * h.currentPrice,
              0
            );
            return {
              ...acc,
              balance,
              updatedAt: new Date().toISOString(),
            };
          }
          return acc;
        }),
      }));
      persist();
    },

    refreshHoldingPrices: async (accountId, onProgress, bypassCache = false) => {
      const state = get();
      const account = state.accounts.find(a => a.id === accountId);

      if (!account || !account.useHoldings || !account.holdings || account.holdings.length === 0) {
        return;
      }

      const tickers = account.holdings.map(h => h.ticker);

      try {
        const priceData = await fetchPrices(tickers, onProgress, bypassCache);

        const errors: string[] = []; // Collect errors here

        set((state) => ({
          accounts: state.accounts.map((acc) => {
            if (acc.id === accountId && acc.useHoldings && acc.holdings) {
              const updatedHoldings = acc.holdings.map((holding) => {
                const priceInfo = priceData.find(p => p.ticker === holding.ticker);
                if (priceInfo) {
                  if (priceInfo.error) {
                    console.warn(`[store] Error fetching price for ${holding.ticker}:`, priceInfo.error);
                    errors.push(`${holding.ticker}: ${priceInfo.error}`); // Add error to list
                    return holding; // Keep existing price if API error
                  }
                  return {
                    ...holding,
                    currentPrice: priceInfo.price,
                    lastPriceUpdate: priceInfo.lastUpdated,
                  };
                }
                return holding;
              });

              const balance = updatedHoldings.reduce(
                (sum, h) => sum + h.shares * h.currentPrice,
                0
              );

              return {
                ...acc,
                holdings: updatedHoldings,
                balance,
                updatedAt: new Date().toISOString(),
              };
            }
            return acc;
          }),
        }));
        persist();

        // Throw error if any tickers failed
        if (errors.length > 0) {
          const errorMessage = `Some prices failed: ${errors.join('; ')}`;
          console.warn('[store] Prices refreshed with errors:', errorMessage);
          throw new Error(errorMessage);
        }

      } catch (error) {
        console.error('[store] Error during price refresh:', error);
        throw error; // Re-throw to be caught by UI
      }
    },

    refreshAllHoldingPrices: async (onProgress, bypassCache = true) => {
      const state = get();
      
      // Collect all unique tickers from all accounts with holdings
      const tickerSet = new Set<string>();
      const accountsWithHoldings = state.accounts.filter(
        acc => acc.useHoldings && acc.holdings && acc.holdings.length > 0
      );

      if (accountsWithHoldings.length === 0) {
        return;
      }

      // Collect all unique tickers
      accountsWithHoldings.forEach(account => {
        account.holdings?.forEach(holding => {
          if (holding.ticker && holding.ticker !== 'CASH') {
            tickerSet.add(holding.ticker);
          }
        });
      });

      const uniqueTickers = Array.from(tickerSet);

      if (uniqueTickers.length === 0) {
        return;
      }

      try {
        const priceData = await fetchPrices(uniqueTickers, onProgress, bypassCache);

        const errors: string[] = [];

        // Update all accounts with the fetched prices
        set((state) => ({
          accounts: state.accounts.map((acc) => {
            if (acc.useHoldings && acc.holdings) {
              const updatedHoldings = acc.holdings.map((holding) => {
                const priceInfo = priceData.find(p => p.ticker === holding.ticker);
                if (priceInfo) {
                  if (priceInfo.error) {
                    console.warn(`[store] Error fetching price for ${holding.ticker}:`, priceInfo.error);
                    errors.push(`${holding.ticker}: ${priceInfo.error}`);
                    return holding; // Keep existing price if API error
                  }
                  const oldPrice = holding.currentPrice;
                  const newPrice = priceInfo.price;
                  if (oldPrice !== newPrice) {
                  } else {
                  }
                  return {
                    ...holding,
                    currentPrice: priceInfo.price,
                    lastPriceUpdate: priceInfo.lastUpdated,
                  };
                }
                return holding;
              });

              const balance = updatedHoldings.reduce(
                (sum, h) => sum + h.shares * h.currentPrice,
                0
              );


              return {
                ...acc,
                holdings: updatedHoldings,
                balance,
                updatedAt: new Date().toISOString(),
              };
            }
            return acc;
          }),
        }));
        
        // Log total net worth change
        const newState = get();
        const totalBalance = newState.accounts
          .filter(a => a.kind === 'asset' && a.useHoldings)
          .reduce((sum, a) => sum + a.balance, 0);
        
        persist();

        // Throw error if any tickers failed
        if (errors.length > 0) {
          const errorMessage = `Some prices failed: ${errors.join('; ')}`;
          console.warn('[store] Prices refreshed with errors:', errorMessage);
          throw new Error(errorMessage);
        }

      } catch (error) {
        console.error('[store] Error during global price refresh:', error);
        throw error; // Re-throw to be caught by UI
      }
    },

    // Import actions
    addTransactions: (transactions) => {
      set((state) => ({
        transactions: [...state.transactions, ...transactions],
      }));
      get().persistImportData();
    },

    updateTransaction: (id, updates) => {
      set((state) => ({
        transactions: state.transactions.map((tx) =>
          tx.id === id ? { ...tx, ...updates } : tx
        ),
      }));
      get().persistImportData();
    },

    deleteTransaction: (id) => {
      set((state) => ({
        transactions: state.transactions.filter((tx) => tx.id !== id),
      }));
      get().persistImportData();
    },

    addPattern: (pattern) => {
      set((state) => ({
        patterns: [...state.patterns, pattern],
      }));
      get().persistImportData();
    },

    updatePattern: (id, updates) => {
      set((state) => ({
        patterns: state.patterns.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      }));
      get().persistImportData();
    },

    deletePattern: (id) => {
      set((state) => ({
        patterns: state.patterns.filter((p) => p.id !== id),
      }));
      get().persistImportData();
    },

    persistImportData,

    // Rename category across all transactions, patterns, and cashflows
    renameCategory: (oldName, newName) => {
      const state = get();
      
      // Update transactions
      const updatedTransactions = state.transactions.map(tx =>
        tx.category === oldName ? { ...tx, category: newName } : tx
      );
      
      // Update patterns
      const updatedPatterns = state.patterns.map(p =>
        p.category === oldName ? { ...p, category: newName } : p
      );
      
      // Update cashflows
      const updatedCashflows = state.cashflows.map(cf =>
        cf.category === oldName ? { ...cf, category: newName } : cf
      );
      
      set({
        transactions: updatedTransactions,
        patterns: updatedPatterns,
        cashflows: updatedCashflows,
      });
      
      // Persist both app data and import data
      persist();
      persistImportData();
    },

    // Budget note actions
    setBudgetNote: (note) => {
      set({ budgetNote: note });
      saveBudgetNote(note);
    },

    // Reset
    reset: () => {
      const defaultHousehold: Household = {
        id: generateId(),
        name: 'My Household',
        financialIndependenceYears: 25,
      };
      set({
        household: defaultHousehold,
        accounts: [],
        cashflows: [],
        editingAccountId: null,
        editingCashflowId: null,
        transactions: [],
        patterns: [],
        budgetNote: '',
      });
      persist();
      persistImportData();
      saveBudgetNote('');
    },
  };
});

