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

const CACHE_KEY_PREFIX = 'grouse-price-cache-';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

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

