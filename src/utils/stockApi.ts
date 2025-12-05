// Alpha Vantage API integration for stock price fetching
// Free tier: 5 calls per minute, 500 calls per day

const ALPHA_VANTAGE_API_KEY = '2VMVNXI1Y44STF85'; // Replace with your API key
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

export type PriceData = {
  ticker: string;
  price: number;
  currency: 'CAD' | 'USD';
  lastUpdated: string;
  error?: string;
};

export type HistoricalReturnData = {
  ticker: string;
  growthRate: number; // CAGR (Compound Annual Growth Rate) or simple return for short periods
  dividendYield: number; // Average annual dividend yield
  yearsOfData: number; // Years of historical data available
  monthsOfData?: number; // Number of months of data available
  dataQuality?: 'reliable' | 'limited' | 'insufficient'; // Quality indicator for the data
  startDate?: string; // First available date
  endDate?: string; // Most recent date
  error?: string;
  warning?: string; // Warning message about data limitations
};

const CACHE_KEY_PREFIX = 'grouse-price-cache-';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache
const HISTORICAL_CACHE_KEY_PREFIX = 'grouse-historical-cache-';
const HISTORICAL_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours cache

// Check if cached price is still valid
const isCacheValid = (cached: PriceData): boolean => {
  const cacheAge = Date.now() - new Date(cached.lastUpdated).getTime();
  return cacheAge < CACHE_DURATION_MS;
};

// Get cached price
export const getCachedPrice = (ticker: string): PriceData | null => {
  console.log('[stockApi] getCachedPrice:', ticker);
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${ticker}`);
    if (cached) {
      const data = JSON.parse(cached) as PriceData;
      if (isCacheValid(data)) {
        console.log('[stockApi] Cache hit for:', ticker);
        return data;
      }
      console.log('[stockApi] Cache expired for:', ticker);
    }
  } catch (error) {
    console.error('[stockApi] Error reading cache:', error);
  }
  return null;
};

// Cache price data
const cachePrice = (data: PriceData): void => {
  console.log('[stockApi] Caching price:', data.ticker);
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${data.ticker}`, JSON.stringify(data));
  } catch (error) {
    console.error('[stockApi] Error caching price:', error);
  }
};

// Determine currency from ticker
const getCurrencyFromTicker = (ticker: string): 'CAD' | 'USD' => {
  // TSX = Toronto Stock Exchange (CAD)
  // V = TSX Venture (CAD)
  // .TO suffix = Toronto (CAD)
  if (ticker.includes('.TO') || ticker.includes('.TSX') || ticker.includes('.V')) {
    return 'CAD';
  }
  // Default to USD for most tickers
  return 'USD';
};

// Fetch price from Alpha Vantage API
export const fetchPrice = async (ticker: string): Promise<PriceData> => {
  console.log('[stockApi] fetchPrice:', ticker);

  // Special handling for CASH
  if (ticker === 'CASH') {
    const cashData: PriceData = {
      ticker: 'CASH',
      price: 1.0,
      currency: 'CAD',
      lastUpdated: new Date().toISOString(),
    };
    cachePrice(cashData);
    return cashData;
  }

  // Check cache first
  const cached = getCachedPrice(ticker);
  if (cached) {
    return cached;
  }

  // For TSX stocks, we need to use the correct symbol format
  // Alpha Vantage uses different formats for different exchanges
  // Canadian tickers (TSX) typically need .TO suffix
  let apiSymbol = ticker;
  
  // Handle different ticker formats
  if (ticker.includes('.B') || ticker.includes('.A') || ticker.includes('.UN')) {
    // Class shares (e.g., BTCC.B, BTCC.A) - try with .TO suffix
    apiSymbol = `${ticker}.TO`;
  } else if (!ticker.includes('.TO') && !ticker.includes('.TSX') && !ticker.includes('.V') && !ticker.includes('.')) {
    // If ticker doesn't have exchange suffix, try with .TO suffix for Canadian stocks
    apiSymbol = `${ticker}.TO`;
  }

  try {
    const url = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${apiSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    console.log('[stockApi] Fetching from API:', url);

    const response = await fetch(url);
    const data = await response.json();

    console.log('[stockApi] API response:', data);

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    if (data['Note']) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }

    const quote = data['Global Quote'];
    if (!quote) {
      console.error('[stockApi] No Global Quote in response:', data);
      throw new Error(`No price data found for ${ticker}. The ticker may be invalid or not supported.`);
    }

    // Check if quote is empty object
    if (Object.keys(quote).length === 0) {
      console.error('[stockApi] Empty Global Quote object:', quote);
      throw new Error(`Empty price data for ${ticker}. The ticker may not be available in Alpha Vantage.`);
    }

    // Try different possible price field names
    const priceStr = quote['05. price'] || quote['price'] || quote['Price'] || quote['close'] || quote['Close'];
    if (!priceStr || priceStr === '') {
      console.error('[stockApi] No price field in quote:', quote);
      // Try alternative ticker formats before giving up
      throw new Error(`Could not find price for ${ticker}. Response: ${JSON.stringify(quote)}`);
    }

    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0) {
      console.error('[stockApi] Invalid price value:', priceStr);
      throw new Error(`Invalid price value for ${ticker}: ${priceStr}`);
    }

    const currency = getCurrencyFromTicker(ticker);

    const priceData: PriceData = {
      ticker,
      price,
      currency,
      lastUpdated: new Date().toISOString(),
    };

    cachePrice(priceData);
    return priceData;
  } catch (error) {
    console.error('[stockApi] Error fetching price:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Try alternative formats for Canadian tickers
    if (ticker.includes('.B') || ticker.includes('.A') || ticker.includes('.UN')) {
      // For class shares, try without the class suffix first, then with .TO
      const baseTicker = ticker.split('.')[0];
      
      // Try base ticker with .TO
      if (apiSymbol !== `${baseTicker}.TO`) {
        console.log('[stockApi] Retrying with base ticker + .TO:', `${baseTicker}.TO`);
        try {
          const retryUrl = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${baseTicker}.TO&apikey=${ALPHA_VANTAGE_API_KEY}`;
          const retryResponse = await fetch(retryUrl);
          const retryData = await retryResponse.json();
          
          if (retryData['Global Quote'] && retryData['Global Quote']['05. price']) {
            const price = parseFloat(retryData['Global Quote']['05. price']);
            const priceData: PriceData = {
              ticker, // Keep original ticker with class suffix
              price,
              currency: 'CAD',
              lastUpdated: new Date().toISOString(),
            };
            cachePrice(priceData);
            return priceData;
          }
        } catch (retryError) {
          console.error('[stockApi] Retry with base ticker failed:', retryError);
        }
      }
      
      // Try original ticker without .TO
      if (apiSymbol.includes('.TO')) {
        console.log('[stockApi] Retrying without .TO suffix for:', ticker);
        try {
          const retryUrl = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
          const retryResponse = await fetch(retryUrl);
          const retryData = await retryResponse.json();
          
          if (retryData['Global Quote'] && retryData['Global Quote']['05. price']) {
            const price = parseFloat(retryData['Global Quote']['05. price']);
            const priceData: PriceData = {
              ticker,
              price,
              currency: 'CAD',
              lastUpdated: new Date().toISOString(),
            };
            cachePrice(priceData);
            return priceData;
          }
        } catch (retryError) {
          console.error('[stockApi] Retry without .TO failed:', retryError);
        }
      }
    } else if (apiSymbol.includes('.TO') && apiSymbol !== ticker) {
      // If we tried with .TO and it failed, try without .TO (for US stocks)
      console.log('[stockApi] Retrying without .TO suffix for:', ticker);
      try {
        const retryUrl = `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const retryResponse = await fetch(retryUrl);
        const retryData = await retryResponse.json();
        
        if (retryData['Global Quote'] && retryData['Global Quote']['05. price']) {
          const price = parseFloat(retryData['Global Quote']['05. price']);
          const priceData: PriceData = {
            ticker,
            price,
            currency: 'USD',
            lastUpdated: new Date().toISOString(),
          };
          cachePrice(priceData);
          return priceData;
        }
      } catch (retryError) {
        console.error('[stockApi] Retry also failed:', retryError);
      }
    }
    
    // Return error data
    return {
      ticker,
      price: 0,
      currency: getCurrencyFromTicker(ticker),
      lastUpdated: new Date().toISOString(),
      error: errorMessage,
    };
  }
};

// Fetch prices for multiple tickers (with rate limiting)
export const fetchPrices = async (
  tickers: string[],
  onProgress?: (current: number, total: number, ticker: string) => void
): Promise<PriceData[]> => {
  console.log('[stockApi] fetchPrices:', tickers);
  const results: PriceData[] = [];

  // Filter out CASH and check cache first
  const toFetch: string[] = [];
  for (const ticker of tickers) {
    if (ticker === 'CASH') {
      results.push({
        ticker: 'CASH',
        price: 1.0,
        currency: 'CAD',
        lastUpdated: new Date().toISOString(),
      });
    } else {
      const cached = getCachedPrice(ticker);
      if (cached) {
        results.push(cached);
      } else {
        toFetch.push(ticker);
      }
    }
  }

  // Fetch remaining prices with rate limiting (5 calls per minute)
  // Wait 12 seconds between calls (5 calls per minute = 12 seconds per call)
  for (let i = 0; i < toFetch.length; i++) {
    if (i > 0) {
      // Wait 12 seconds between calls to respect rate limit
      await new Promise(resolve => setTimeout(resolve, 12000));
    }
    if (onProgress) {
      onProgress(i + 1, toFetch.length, toFetch[i]);
    }
    const priceData = await fetchPrice(toFetch[i]);
    results.push(priceData);
  }

  return results;
};

// Get cached historical returns
const getCachedHistoricalReturns = (ticker: string): HistoricalReturnData | null => {
  console.log('[stockApi] getCachedHistoricalReturns:', ticker);
  try {
    const cached = localStorage.getItem(`${HISTORICAL_CACHE_KEY_PREFIX}${ticker}`);
    if (cached) {
      const data = JSON.parse(cached) as HistoricalReturnData;
      const cacheAge = Date.now() - new Date(data.endDate || Date.now().toString()).getTime();
      if (cacheAge < HISTORICAL_CACHE_DURATION_MS) {
        console.log('[stockApi] Historical cache hit for:', ticker);
        return data;
      }
      console.log('[stockApi] Historical cache expired for:', ticker);
    }
  } catch (error) {
    console.error('[stockApi] Error reading historical cache:', error);
  }
  return null;
};

// Cache historical returns
const cacheHistoricalReturns = (data: HistoricalReturnData): void => {
  console.log('[stockApi] Caching historical returns:', data.ticker);
  try {
    localStorage.setItem(`${HISTORICAL_CACHE_KEY_PREFIX}${data.ticker}`, JSON.stringify(data));
  } catch (error) {
    console.error('[stockApi] Error caching historical returns:', error);
  }
};

// Fetch historical returns from Alpha Vantage
export const fetchHistoricalReturns = async (ticker: string, bypassCache: boolean = false): Promise<HistoricalReturnData> => {
  console.log('[stockApi] fetchHistoricalReturns:', ticker, 'bypassCache:', bypassCache);

  // Special handling for CASH
  if (ticker === 'CASH') {
    const cashData: HistoricalReturnData = {
      ticker: 'CASH',
      growthRate: 0,
      dividendYield: 0,
      yearsOfData: 0,
      error: 'CASH holdings have no historical returns',
    };
    return cashData;
  }

  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cached = getCachedHistoricalReturns(ticker);
    if (cached) {
      return cached;
    }
  } else {
    console.log('[stockApi] Bypassing cache for:', ticker);
  }

  // Format ticker for API (same logic as fetchPrice)
  let apiSymbol = ticker;
  if (ticker.includes('.B') || ticker.includes('.A') || ticker.includes('.UN')) {
    apiSymbol = `${ticker}.TO`;
  } else if (!ticker.includes('.TO') && !ticker.includes('.TSX') && !ticker.includes('.V') && !ticker.includes('.')) {
    apiSymbol = `${ticker}.TO`;
  }

  try {
    // Use TIME_SERIES_MONTHLY_ADJUSTED for price and dividend data
    const url = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${apiSymbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    console.log('[stockApi] Fetching historical data from API:', url);

    const response = await fetch(url);
    const data = await response.json();

    console.log('[stockApi] Historical API response keys:', Object.keys(data));

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    if (data['Note']) {
      throw new Error('API rate limit exceeded. Please try again later.');
    }

    const timeSeries = data['Monthly Adjusted Time Series'];
    if (!timeSeries) {
      console.error('[stockApi] No Monthly Adjusted Time Series in response:', data);
      throw new Error(`No historical data found for ${ticker}. The ticker may be invalid or not supported.`);
    }

    // Get all dates and sort them
    const dates = Object.keys(timeSeries).sort();
    if (dates.length === 0) {
      throw new Error(`No historical data points found for ${ticker}`);
    }

    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const startPrice = parseFloat(timeSeries[startDate]['5. adjusted close'] || timeSeries[startDate]['4. close']);
    const endPrice = parseFloat(timeSeries[endDate]['5. adjusted close'] || timeSeries[endDate]['4. close']);

    if (isNaN(startPrice) || isNaN(endPrice) || startPrice <= 0 || endPrice <= 0) {
      throw new Error(`Invalid price data for ${ticker}`);
    }

    // Calculate years of data
    const start = new Date(startDate);
    const end = new Date(endDate);
    const yearsOfData = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const monthsOfData = dates.length;
    const minimumMonthsForReliableData = 6; // Require at least 6 months for reliable CAGR
    const minimumMonthsForAnyData = 2; // Need at least 2 months to calculate any return
    
    // Check if we have sufficient data
    const hasInsufficientData = monthsOfData < minimumMonthsForReliableData;
    const hasMinimalData = monthsOfData >= minimumMonthsForAnyData && monthsOfData < minimumMonthsForReliableData;
    
    // Calculate growth rate
    let growthRate = 0;
    let dataQuality: 'reliable' | 'limited' | 'insufficient' = 'reliable';
    
    if (yearsOfData > 0 && monthsOfData >= minimumMonthsForAnyData) {
      if (hasMinimalData) {
        // For short periods (< 6 months), calculate annualized rate but mark as unreliable
        // CAGR can be misleading for very short periods (e.g., 1 month of 10% gain = 214% annualized)
        // But we still annualize for consistency - the warning will indicate it's less reliable
        growthRate = Math.pow(endPrice / startPrice, 1 / yearsOfData) - 1;
        dataQuality = 'limited';
        console.warn(`[stockApi] Limited data for ${ticker}: only ${monthsOfData} months (${yearsOfData.toFixed(2)} years). Annualized rate may be unreliable due to short time period.`);
      } else {
        // For periods >= 6 months, use CAGR (more reliable)
        growthRate = Math.pow(endPrice / startPrice, 1 / yearsOfData) - 1;
        dataQuality = 'reliable';
      }
    } else {
      dataQuality = 'insufficient';
      console.warn(`[stockApi] Insufficient data for ${ticker}: only ${monthsOfData} months. Cannot calculate reliable returns.`);
    }

    // Calculate average dividend yield from dividend amount field
    // Alpha Vantage provides "7. dividend amount" in monthly adjusted time series
    let totalDividends = 0;
    let totalPrice = 0;
    let dividendMonths = 0;

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const dividendAmountStr = timeSeries[date]['7. dividend amount'] || '0';
      const dividendAmount = parseFloat(dividendAmountStr);
      const closePrice = parseFloat(timeSeries[date]['4. close']);

      if (!isNaN(dividendAmount) && !isNaN(closePrice) && closePrice > 0) {
        if (dividendAmount > 0) {
          totalDividends += dividendAmount;
          totalPrice += closePrice;
          dividendMonths++;
        }
      }
    }
    
    console.log(`[stockApi] Dividend amount field check for ${ticker}: ${dividendMonths} months with dividends, total dividends: ${totalDividends.toFixed(4)}`);

    // Calculate dividend yield: (total dividends paid / average price) / years
    // This gives the annual yield over the historical period
    let dividendYield = 0;
    if (dividendMonths > 0 && yearsOfData > 0) {
      // Calculate average price across ALL months (not just dividend months)
      let sumAllPrices = 0;
      let validPrices = 0;
      for (let i = 0; i < dates.length; i++) {
        const closePrice = parseFloat(timeSeries[dates[i]]['4. close']);
        if (!isNaN(closePrice) && closePrice > 0) {
          sumAllPrices += closePrice;
          validPrices++;
        }
      }
      
      if (validPrices > 0 && sumAllPrices > 0) {
        const avgPrice = sumAllPrices / validPrices;
        
        // Total dividends paid over the period, divided by average price, divided by years = annual yield
        dividendYield = (totalDividends / avgPrice) / yearsOfData;
        console.log(`[stockApi] Dividend yield for ${ticker}: ${(dividendYield * 100).toFixed(2)}% (${totalDividends.toFixed(4)} total dividends, ${avgPrice.toFixed(2)} avg price, ${yearsOfData.toFixed(1)} years)`);
      }
    } else {
      // Fallback: calculate from monthly total return vs price-only return difference
      // This is better for bond ETFs where dividend amount field may be empty
      // Total return includes distributions (from adjusted close)
      // Price-only return excludes distributions (from close)
      let totalReturnDifference = 0;
      let returnCount = 0;
      
      for (let i = 1; i < dates.length; i++) {
        const currentDate = dates[i];
        const prevDate = dates[i - 1];
        const currentAdjusted = parseFloat(timeSeries[currentDate]['5. adjusted close'] || timeSeries[currentDate]['4. close']);
        const currentClose = parseFloat(timeSeries[currentDate]['4. close']);
        const prevAdjusted = parseFloat(timeSeries[prevDate]['5. adjusted close'] || timeSeries[prevDate]['4. close']);
        const prevClose = parseFloat(timeSeries[prevDate]['4. close']);
        
        if (!isNaN(currentAdjusted) && !isNaN(currentClose) && !isNaN(prevAdjusted) && !isNaN(prevClose) && prevClose > 0 && prevAdjusted > 0) {
          // Calculate monthly returns
          const priceReturn = (currentClose - prevClose) / prevClose;
          const totalReturn = (currentAdjusted - prevAdjusted) / prevAdjusted;
          // The difference is the distribution yield for that month
          // For bond ETFs, total return (adjusted) should be higher than price return (close) when distributions are paid
          const distributionYield = totalReturn - priceReturn;
          
          // Count all positive differences (distributions paid)
          // Also count small negative differences as they might be due to rounding or timing
          if (!isNaN(distributionYield)) {
            if (distributionYield > 0) {
              totalReturnDifference += distributionYield;
              returnCount++;
            } else if (distributionYield > -0.001) {
              // Very small negative (likely rounding error) - treat as zero distribution
              returnCount++;
            }
            // Large negative differences are likely price movements, not distributions
          }
        }
      }
      
      if (returnCount > 0) {
        // Average monthly distribution yield, then annualize
        dividendYield = (totalReturnDifference / returnCount) * 12;
        console.log(`[stockApi] Using total return difference method for ${ticker}: ${(dividendYield * 100).toFixed(2)}% annual yield from ${returnCount} months (total diff: ${totalReturnDifference.toFixed(6)})`);
      } else {
        console.log(`[stockApi] No valid return differences found for ${ticker} (checked ${dates.length - 1} month pairs)`);
        // Last resort: use overall CAGR difference
        const startClose = parseFloat(timeSeries[startDate]['4. close']);
        const endClose = parseFloat(timeSeries[endDate]['4. close']);
        if (!isNaN(startClose) && !isNaN(endClose) && startClose > 0) {
          const priceOnlyReturn = yearsOfData > 0 ? Math.pow(endClose / startClose, 1 / yearsOfData) - 1 : 0;
          const totalReturn = growthRate; // From adjusted close, includes distributions
          // Dividend yield is the difference between total return and price-only return
          dividendYield = Math.max(0, totalReturn - priceOnlyReturn);
          console.log(`[stockApi] Using overall CAGR difference for ${ticker}: ${(dividendYield * 100).toFixed(2)}% annual yield`);
        }
      }
    }

    // Sanity check: cap dividend yield at 15% (anything higher is likely a calculation error)
    // Most stocks/ETFs have yields between 0-10%, with some REITs/bonds up to 15%
    if (dividendYield > 0.15) {
      console.warn(`[stockApi] Dividend yield ${(dividendYield * 100).toFixed(2)}% seems too high for ${ticker}, capping at 15%`);
      dividendYield = 0.15;
    }
    
    // Ensure it's not negative
    dividendYield = Math.max(0, dividendYield);

    // Generate warning message if data is limited
    let warning: string | undefined;
    if (dataQuality === 'insufficient') {
      warning = `Insufficient data: Only ${monthsOfData} month${monthsOfData !== 1 ? 's' : ''} available. Consider using scenario defaults or manual rates.`;
    } else if (dataQuality === 'limited') {
      warning = `Limited data: Only ${monthsOfData} month${monthsOfData !== 1 ? 's' : ''} (${yearsOfData.toFixed(1)} years). Returns may be less reliable. Consider using scenario defaults for more stable projections.`;
    }

    const returnData: HistoricalReturnData = {
      ticker,
      growthRate,
      dividendYield,
      yearsOfData: Math.round(yearsOfData * 10) / 10, // Round to 1 decimal
      monthsOfData,
      dataQuality,
      startDate,
      endDate,
      warning,
    };

    cacheHistoricalReturns(returnData);
    return returnData;
  } catch (error) {
    console.error('[stockApi] Error fetching historical returns:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Try alternative ticker formats (similar to fetchPrice)
    if (ticker.includes('.B') || ticker.includes('.A') || ticker.includes('.UN')) {
      const baseTicker = ticker.split('.')[0];
      if (apiSymbol !== `${baseTicker}.TO`) {
        console.log('[stockApi] Retrying historical with base ticker + .TO:', `${baseTicker}.TO`);
        try {
          const retryUrl = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${baseTicker}.TO&apikey=${ALPHA_VANTAGE_API_KEY}`;
          const retryResponse = await fetch(retryUrl);
          const retryData = await retryResponse.json();

          if (retryData['Monthly Adjusted Time Series']) {
            // Recursively call with the working ticker format
            return fetchHistoricalReturns(baseTicker + '.TO');
          }
        } catch (retryError) {
          console.error('[stockApi] Retry with base ticker failed:', retryError);
        }
      }
    } else if (apiSymbol.includes('.TO') && apiSymbol !== ticker) {
      // Try without .TO for US stocks
      console.log('[stockApi] Retrying historical without .TO suffix for:', ticker);
      try {
        const retryUrl = `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`;
        const retryResponse = await fetch(retryUrl);
        const retryData = await retryResponse.json();

        if (retryData['Monthly Adjusted Time Series']) {
          return fetchHistoricalReturns(ticker);
        }
      } catch (retryError) {
        console.error('[stockApi] Retry also failed:', retryError);
      }
    }

    // Return error data
    return {
      ticker,
      growthRate: 0,
      dividendYield: 0,
      yearsOfData: 0,
      error: errorMessage,
    };
  }
};

