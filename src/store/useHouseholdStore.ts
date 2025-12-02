import { create } from 'zustand';
import type { Household, Account, Cashflow, AppData, Holding } from '../types/models';
import { loadData, saveData } from '../utils/storage';
import { fetchPrices } from '../utils/stockApi';

interface HouseholdStore {
  // State
  household: Household | null;
  accounts: Account[];
  cashflows: Cashflow[];
  editingAccountId: string | null;
  editingCashflowId: string | null;

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
  refreshHoldingPrices: (accountId: string, onProgress?: (current: number, total: number, ticker: string) => void) => Promise<void>;
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
    console.log('[store] persist: data saved to storage');
  };

  // Initialize from localStorage
  const initialize = () => {
    console.log('[store] initialize: loading data from storage');
    const data = loadData();
    if (data) {
      set({
        household: data.household,
        accounts: data.accounts || [],
        cashflows: data.cashflows || [],
        editingAccountId: null,
        editingCashflowId: null,
      });
      console.log('[store] initialize: data loaded', data);
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
      });
      console.log('[store] initialize: created default household');
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

    // Initialize
    initialize,

    // Household
    setHousehold: (household) => {
      console.log('[store] setHousehold:', household);
      set({ household });
      persist();
    },

    // Accounts
    addAccount: (accountData) => {
      console.log('[store] addAccount:', accountData);
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
      console.log('[store] updateAccount:', id, updates);
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
      console.log('[store] deleteAccount:', id);
      set((state) => ({
        accounts: state.accounts.filter((acc) => acc.id !== id),
        editingAccountId: state.editingAccountId === id ? null : state.editingAccountId,
      }));
      persist();
    },

    setEditingAccount: (id) => {
      console.log('[store] setEditingAccount:', id);
      set({ editingAccountId: id });
    },

    // Cashflows
    addCashflow: (cashflowData) => {
      console.log('[store] addCashflow:', cashflowData);
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
      console.log('[store] updateCashflow:', id, updates);
      set((state) => ({
        cashflows: state.cashflows.map((cf) =>
          cf.id === id ? { ...cf, ...updates } : cf
        ),
      }));
      persist();
    },

    deleteCashflow: (id) => {
      console.log('[store] deleteCashflow:', id);
      set((state) => ({
        cashflows: state.cashflows.filter((cf) => cf.id !== id),
        editingCashflowId: state.editingCashflowId === id ? null : state.editingCashflowId,
      }));
      persist();
    },

    setEditingCashflow: (id) => {
      console.log('[store] setEditingCashflow:', id);
      set({ editingCashflowId: id });
    },

    // Holdings
    addHolding: (accountId, holdingData) => {
      console.log('[store] addHolding:', accountId, holdingData);
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
      console.log('[store] updateHolding:', accountId, holdingId, updates);
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
      console.log('[store] deleteHolding:', accountId, holdingId);
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
      console.log('[store] recalculateAccountBalance:', accountId);
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

    refreshHoldingPrices: async (accountId, onProgress) => {
      console.log('[store] refreshHoldingPrices:', accountId);
      const state = get();
      const account = state.accounts.find(a => a.id === accountId);

      if (!account || !account.useHoldings || !account.holdings || account.holdings.length === 0) {
        console.log('[store] No holdings to refresh');
        return;
      }

      const tickers = account.holdings.map(h => h.ticker);
      console.log('[store] Fetching prices for tickers:', tickers);

      try {
        const priceData = await fetchPrices(tickers, onProgress);
        console.log('[store] Received price data:', priceData);

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

        console.log('[store] Prices refreshed successfully');
      } catch (error) {
        console.error('[store] Error during price refresh:', error);
        throw error; // Re-throw to be caught by UI
      }
    },

    // Reset
    reset: () => {
      console.log('[store] reset: clearing all data');
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
      });
      persist();
    },
  };
});

