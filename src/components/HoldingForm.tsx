import { useState, useEffect, useRef } from 'react';
import { useHouseholdStore } from '../store/useHouseholdStore';

interface HoldingFormProps {
  accountId: string;
  holdingId?: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export const HoldingForm = ({ accountId, holdingId, onCancel, onSuccess }: HoldingFormProps) => {
  const { accounts, addHolding, updateHolding } = useHouseholdStore();
  const account = accounts.find(a => a.id === accountId);
  const holding = holdingId ? account?.holdings?.find(h => h.id === holdingId) : null;

  // Get all unique tickers from all accounts for autocomplete
  const allTickers = Array.from(new Set(
    accounts.flatMap(acc => acc.holdings?.map(h => h.ticker) || [])
  )).sort();

  const [formData, setFormData] = useState({
    ticker: '',
    shares: 0,
    currentPrice: 0,
    currency: (account?.currency || 'CAD') as 'CAD' | 'USD',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTickerSuggestions, setShowTickerSuggestions] = useState(false);
  const [filteredTickers, setFilteredTickers] = useState<string[]>([]);
  const tickerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (holding) {
      console.log('[HoldingForm] Loading holding for editing:', holding);
      setFormData({
        ticker: holding.ticker,
        shares: holding.shares,
        currentPrice: holding.currentPrice,
        currency: holding.currency,
      });
      setErrors({});
    } else {
      console.log('[HoldingForm] Resetting form for new holding');
      setFormData({
        ticker: '',
        shares: 0,
        currentPrice: 0,
        currency: (account?.currency || 'CAD') as 'CAD' | 'USD',
      });
      setErrors({});
    }
  }, [holding, account]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.ticker.trim()) {
      newErrors.ticker = 'Please enter a ticker symbol';
    }

    if (formData.shares <= 0) {
      newErrors.shares = 'Shares must be > 0';
    }

    if (formData.currentPrice <= 0 && formData.ticker.toUpperCase() !== 'CASH') {
      newErrors.currentPrice = 'Current price must be > 0';
    }

    setErrors(newErrors);
    console.log('[HoldingForm] Validation result:', Object.keys(newErrors).length === 0 ? 'valid' : 'invalid', newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[HoldingForm] Form submitted:', formData);

    if (!validate()) {
      console.log('[HoldingForm] Validation failed');
      return;
    }

    const holdingData = {
      ticker: formData.ticker.trim().toUpperCase(),
      shares: formData.shares,
      currentPrice: formData.currentPrice,
      currency: formData.currency,
    };

    if (holdingId) {
      updateHolding(accountId, holdingId, holdingData);
    } else {
      addHolding(accountId, holdingData);
    }
    onSuccess();
  };

  const handleBlur = (field: keyof typeof formData) => {
    console.log('[HoldingForm] Field blurred:', field);
    if (field === 'shares' && formData.shares <= 0) {
      setErrors({ ...errors, shares: 'Shares must be > 0' });
    }
    if (field === 'currentPrice' && formData.currentPrice <= 0 && formData.ticker.toUpperCase() !== 'CASH') {
      setErrors({ ...errors, currentPrice: 'Current price must be > 0' });
    }
  };

  const handleTickerChange = (value: string) => {
    const upperCaseValue = value.toUpperCase();
    setFormData({ ...formData, ticker: upperCaseValue });

    if (upperCaseValue === 'CASH') {
      setFormData(prev => ({ ...prev, currentPrice: 1 }));
    }

    if (upperCaseValue.length > 0) {
      const filtered = allTickers.filter(t => t.startsWith(upperCaseValue));
      setFilteredTickers(filtered);
      setShowTickerSuggestions(filtered.length > 0);
    } else {
      setShowTickerSuggestions(false);
    }
  };

  const handleTickerSelect = (ticker: string) => {
    setFormData(prev => ({ ...prev, ticker }));
    setShowTickerSuggestions(false);
    if (ticker === 'CASH') {
      setFormData(prev => ({ ...prev, currentPrice: 1 }));
    }
    tickerInputRef.current?.focus(); // Keep focus on the input after selection
  };

  const isCashHolding = formData.ticker.toUpperCase() === 'CASH';

  return (
    <div className="bg-gradient-to-br from-white to-indigo-50 p-6 rounded-2xl border-2 border-indigo-200 shadow-lg mb-4">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <span className="text-2xl">{holdingId ? '✏️' : '➕'}</span>
        {holdingId ? 'Edit Holding' : 'Add Holding'}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ticker Symbol *
            </label>
            <input
              ref={tickerInputRef}
              type="text"
              value={formData.ticker}
              onChange={(e) => handleTickerChange(e.target.value)}
              onFocus={() => {
                if (formData.ticker && allTickers.length > 0) {
                  const filtered = allTickers.filter(t => t.startsWith(formData.ticker));
                  setFilteredTickers(filtered);
                  setShowTickerSuggestions(filtered.length > 0);
                } else if (allTickers.length > 0) {
                  setFilteredTickers(allTickers);
                  setShowTickerSuggestions(true);
                }
              }}
              onBlur={() => {
                // Delay hiding to allow click on suggestion
                setTimeout(() => setShowTickerSuggestions(false), 200);
              }}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.ticker ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="e.g., VTI, XEQT.TO, CASH"
            />
            {errors.ticker && <p className="text-red-500 text-sm mt-1">{errors.ticker}</p>}
            {showTickerSuggestions && filteredTickers.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-auto">
                {filteredTickers.slice(0, 10).map((ticker) => (
                  <button
                    key={ticker}
                    type="button"
                    onClick={() => handleTickerSelect(ticker)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                  >
                    {ticker}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value as 'CAD' | 'USD' })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              disabled={isCashHolding} // Disable currency for CASH
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shares *
            </label>
            <input
              type="number"
              step="0.0001"
              value={formData.shares === 0 ? '' : formData.shares} // Show empty for 0
              onChange={(e) => setFormData({ ...formData, shares: Number(e.target.value) })}
              onBlur={() => handleBlur('shares')}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.shares ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="0.0000"
            />
            {errors.shares && <p className="text-red-500 text-sm mt-1">{errors.shares}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Price *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.currentPrice === 0 ? '' : formData.currentPrice} // Show empty for 0
              onChange={(e) => setFormData({ ...formData, currentPrice: Number(e.target.value) })}
              onBlur={() => handleBlur('currentPrice')}
              className={`w-full px-4 py-2.5 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.currentPrice ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
              }`}
              placeholder="0.00"
              disabled={isCashHolding} // Disable price for CASH
            />
            {errors.currentPrice && <p className="text-red-500 text-sm mt-1">{errors.currentPrice}</p>}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-md">
          <div className="text-sm">
            <span className="font-medium">Total Value: </span>
            <span className="text-lg font-bold">
              ${(formData.shares * formData.currentPrice).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            {holdingId ? '💾 Save Changes' : '➕ Add Holding'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-8 py-3 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

