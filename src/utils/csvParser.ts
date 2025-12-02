// CSV Parser for bank statement imports
// Supports multiple bank formats with auto-detection

export type BankFormat = 'td' | 'rbc' | 'scotiabank' | 'bmo' | 'cibc' | 'tangerine' | 'generic';

export type RawTransaction = {
  date: string;
  description: string;
  amount: string; // String from CSV, will be parsed
  debit?: string; // Some banks have separate debit/credit columns
  credit?: string;
  balance?: string;
  [key: string]: string | undefined; // Other columns
};

export type ColumnMapping = {
  date: string;
  description: string;
  amount?: string; // Optional if debit/credit columns exist
  debit?: string;
  credit?: string;
  balance?: string;
};

// Common bank format patterns
const BANK_FORMATS: Record<BankFormat, {
  headers: string[][]; // Possible header variations
  dateFormat: string;
  amountColumn: 'single' | 'debit_credit';
}> = {
  td: {
    headers: [
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ['Transaction Date', 'Description', 'Debit', 'Credit', 'Balance'],
    ],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'debit_credit',
  },
  rbc: {
    headers: [
      ['Date', 'Description', 'Amount', 'Balance'],
      ['Transaction Date', 'Description', 'Amount', 'Balance'],
    ],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'single',
  },
  scotiabank: {
    headers: [
      ['Date', 'Description', 'Amount', 'Balance'],
      ['Transaction Date', 'Description', 'Amount', 'Balance'],
    ],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'single',
  },
  bmo: {
    headers: [
      ['Date', 'Description', 'Amount', 'Balance'],
      ['Transaction Date', 'Description', 'Amount', 'Balance'],
    ],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'single',
  },
  cibc: {
    headers: [
      ['Date', 'Description', 'Debit', 'Credit', 'Balance'],
      ['Transaction Date', 'Description', 'Debit', 'Credit', 'Balance'],
    ],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'debit_credit',
  },
  tangerine: {
    headers: [
      ['Date', 'Description', 'Amount', 'Balance'],
      ['Transaction Date', 'Description', 'Amount', 'Balance'],
    ],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'single',
  },
  generic: {
    headers: [],
    dateFormat: 'YYYY-MM-DD',
    amountColumn: 'single',
  },
};

// Detect bank format from CSV headers
export const detectBankFormat = (headers: string[]): BankFormat | null => {
  console.log('[csvParser] Detecting bank format from headers:', headers);
  
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  
  for (const [format, config] of Object.entries(BANK_FORMATS)) {
    if (format === 'generic') continue;
    
    for (const formatHeaders of config.headers) {
      const normalizedFormatHeaders = formatHeaders.map(h => h.trim().toLowerCase());
      
      // Check if all format headers are present
      const allMatch = normalizedFormatHeaders.every(header => 
        normalizedHeaders.includes(header)
      );
      
      if (allMatch) {
        console.log('[csvParser] Detected format:', format);
        return format as BankFormat;
      }
    }
  }
  
  console.log('[csvParser] No format detected, using generic');
  return 'generic';
};

// Get column mapping for a bank format
export const getColumnMapping = (format: BankFormat, headers: string[]): ColumnMapping | null => {
  console.log('[csvParser] Getting column mapping for format:', format, 'headers:', headers);
  
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  
  if (format === 'generic') {
    // Try to auto-detect common column names
    const mapping: ColumnMapping = {
      date: '',
      description: '',
      amount: '',
    };
    
    // Find date column
    const dateKeywords = ['date', 'transaction date', 'trans date'];
    for (const keyword of dateKeywords) {
      const idx = normalizedHeaders.findIndex(h => h.includes(keyword));
      if (idx >= 0) {
        mapping.date = headers[idx];
        break;
      }
    }
    
    // Find description column
    const descKeywords = ['description', 'desc', 'details', 'memo', 'payee', 'merchant'];
    for (const keyword of descKeywords) {
      const idx = normalizedHeaders.findIndex(h => h.includes(keyword));
      if (idx >= 0) {
        mapping.description = headers[idx];
        break;
      }
    }
    
    // Find amount column
    const amountKeywords = ['amount', 'amt'];
    for (const keyword of amountKeywords) {
      const idx = normalizedHeaders.findIndex(h => h.includes(keyword));
      if (idx >= 0) {
        mapping.amount = headers[idx];
        break;
      }
    }
    
    // Find debit/credit columns
    const debitIdx = normalizedHeaders.findIndex(h => h.includes('debit'));
    const creditIdx = normalizedHeaders.findIndex(h => h.includes('credit'));
    if (debitIdx >= 0) mapping.debit = headers[debitIdx];
    if (creditIdx >= 0) mapping.credit = headers[creditIdx];
    
    if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit)) {
      console.error('[csvParser] Could not auto-detect required columns');
      return null;
    }
    
    return mapping;
  }
  
  const config = BANK_FORMATS[format];
  if (!config) return null;
  
  // Use first header pattern as reference
  const formatHeaders = config.headers[0];
  const mapping: ColumnMapping = {
    date: formatHeaders[0],
    description: formatHeaders[1],
    amount: '',
  };
  
  // Find actual column names in CSV
  const dateIdx = normalizedHeaders.findIndex(h => h.includes(formatHeaders[0].toLowerCase()));
  const descIdx = normalizedHeaders.findIndex(h => h.includes(formatHeaders[1].toLowerCase()));
  
  if (dateIdx >= 0) mapping.date = headers[dateIdx];
  if (descIdx >= 0) mapping.description = headers[descIdx];
  
  if (config.amountColumn === 'debit_credit') {
    const debitIdx = normalizedHeaders.findIndex(h => h.includes('debit'));
    const creditIdx = normalizedHeaders.findIndex(h => h.includes('credit'));
    if (debitIdx >= 0) mapping.debit = headers[debitIdx];
    if (creditIdx >= 0) mapping.credit = headers[creditIdx];
  } else {
    const amountIdx = normalizedHeaders.findIndex(h => h.includes('amount'));
    if (amountIdx >= 0) mapping.amount = headers[amountIdx];
  }
  
  return mapping;
};

// Parse date string to ISO format
const parseDate = (dateStr: string, format: string = 'YYYY-MM-DD'): string => {
  console.log('[csvParser] Parsing date:', dateStr, 'format:', format);
  
  if (!dateStr || !dateStr.trim()) {
    console.error('[csvParser] Empty date string');
    return new Date().toISOString().split('T')[0]; // Default to today
  }
  
  const trimmed = dateStr.trim();
  
  // Handle MM/DD/YYYY format explicitly
  const mmddyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = trimmed.match(mmddyyyy);
  if (match) {
    const [, month, day, year] = match;
    // Create date in YYYY-MM-DD format
    const date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // Try common date formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
  ];
  
  for (const regex of formats) {
    if (regex.test(trimmed)) {
      // Try to parse
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Fallback: try Date.parse
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  console.error('[csvParser] Could not parse date:', dateStr);
  return new Date().toISOString().split('T')[0]; // Default to today if can't parse
};

// Parse amount string to number
const parseAmount = (amountStr: string): number => {
  if (!amountStr || amountStr.trim() === '') return 0;
  
  // Remove currency symbols, commas, spaces
  const cleaned = amountStr.replace(/[$,\s]/g, '');
  const amount = parseFloat(cleaned);
  
  if (isNaN(amount)) {
    console.error('[csvParser] Could not parse amount:', amountStr);
    return 0;
  }
  
  return Math.abs(amount); // Always return positive
};

// Check if a line looks like a header (contains common header words)
const looksLikeHeader = (line: string): boolean => {
  const headerKeywords = ['date', 'description', 'amount', 'debit', 'credit', 'balance', 'transaction'];
  const lowerLine = line.toLowerCase();
  return headerKeywords.some(keyword => lowerLine.includes(keyword));
};

// Auto-detect column structure for headerless CSV
const detectColumnStructure = (firstDataLine: string[]): ColumnMapping | null => {
  console.log('[csvParser] Detecting column structure from first data line:', firstDataLine);
  
  // Common patterns:
  // Pattern 1: Date, Description, Debit, Credit, Balance (5 columns)
  // Pattern 2: Date, Description, Amount, Balance (4 columns)
  // Pattern 3: Date, Description, Amount (3 columns)
  
  if (firstDataLine.length >= 5) {
    // Likely: Date, Description, Debit, Credit, Balance
    return {
      date: 'Date',
      description: 'Description',
      debit: 'Debit',
      credit: 'Credit',
      balance: 'Balance',
    };
  } else if (firstDataLine.length >= 4) {
    // Likely: Date, Description, Amount, Balance
    return {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      balance: 'Balance',
    };
  } else if (firstDataLine.length >= 3) {
    // Likely: Date, Description, Amount
    return {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
    };
  }
  
  return null;
};

// Parse CSV file into raw transactions
export const parseCSV = async (file: File): Promise<RawTransaction[]> => {
  console.log('[csvParser] Parsing CSV file:', file.name);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 1) {
          reject(new Error('CSV file is empty'));
          return;
        }
        
        // Check if first line is a header
        const firstLine = lines[0];
        const firstLineValues = firstLine.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const hasHeader = looksLikeHeader(firstLine);
        
        let headers: string[];
        let mapping: ColumnMapping | null;
        let dataStartIndex: number;
        
        if (hasHeader) {
          // Has header row
          console.log('[csvParser] CSV has header row');
          headers = firstLineValues;
          dataStartIndex = 1;
          
          // Detect format
          const format = detectBankFormat(headers);
          if (!format) {
            // Try generic format
            mapping = getColumnMapping('generic', headers);
          } else {
            mapping = getColumnMapping(format, headers);
          }
        } else {
          // No header row - auto-detect structure
          console.log('[csvParser] CSV has no header row, auto-detecting structure');
          dataStartIndex = 0;
          
          // Use first data line to detect structure
          mapping = detectColumnStructure(firstLineValues);
          if (!mapping) {
            reject(new Error('Could not detect CSV column structure. Please ensure CSV has Date, Description, and Amount columns.'));
            return;
          }
          
          // Create synthetic headers for consistency
          headers = [];
          if (mapping.date) headers.push(mapping.date);
          if (mapping.description) headers.push(mapping.description);
          if (mapping.amount) headers.push(mapping.amount);
          if (mapping.debit) headers.push(mapping.debit);
          if (mapping.credit) headers.push(mapping.credit);
          if (mapping.balance) headers.push(mapping.balance);
          
          // Ensure we have at least date, description, and one amount field
          if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit)) {
            reject(new Error('Could not detect required columns (Date, Description, and Amount/Debit).'));
            return;
          }
        }
        
        if (!mapping) {
          reject(new Error('Could not map CSV columns. Please check file format.'));
          return;
        }
        
        console.log('[csvParser] Using column mapping:', mapping);
        
        // Parse data rows
        const transactions: RawTransaction[] = [];
        
        for (let i = dataStartIndex; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;
          
          // Simple CSV parsing (handles quoted fields)
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim()); // Last value
          
          // Create raw transaction
          const rawTx: RawTransaction = {
            date: values[headers.indexOf(mapping.date)] || '',
            description: values[headers.indexOf(mapping.description)] || '',
            amount: '',
          };
          
          // Handle amount based on format
          if (mapping.debit && mapping.credit) {
            const debitIdx = headers.indexOf(mapping.debit);
            const creditIdx = headers.indexOf(mapping.credit);
            const debit = values[debitIdx] || '';
            const credit = values[creditIdx] || '';
            
            // Check which column has a value (debit = expense, credit = income/refund)
            if (debit && debit.trim() && parseAmount(debit) > 0) {
              rawTx.amount = debit;
              rawTx.debit = debit;
            } else if (credit && credit.trim() && parseAmount(credit) > 0) {
              rawTx.amount = credit;
              rawTx.credit = credit;
            }
          } else if (mapping.amount) {
            rawTx.amount = values[headers.indexOf(mapping.amount)] || '';
          }
          
          // Store all raw data
          headers.forEach((header, idx) => {
            if (values[idx] !== undefined) {
              rawTx[header] = values[idx] || '';
            }
          });
          
          // Only add if we have required fields (date, description, and at least one amount)
          if (rawTx.date && rawTx.description && (rawTx.amount || rawTx.debit || rawTx.credit)) {
            transactions.push(rawTx);
          }
        }
        
        console.log('[csvParser] Parsed', transactions.length, 'transactions');
        resolve(transactions);
      } catch (error) {
        console.error('[csvParser] Error parsing CSV:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };
    
    reader.readAsText(file);
  });
};

// Normalize raw transaction to Transaction type
export const normalizeTransaction = (
  raw: RawTransaction,
  householdId: string,
  sourceFile?: string
): import('../types/models').Transaction => {
  console.log('[csvParser] Normalizing transaction:', raw);
  
  // Determine amount and transaction type
  let amount = 0;
  let isDebit = true; // Default to expense
  
  if (raw.debit && raw.debit.trim() && parseAmount(raw.debit) > 0) {
    // Has debit value = expense
    amount = parseAmount(raw.debit);
    isDebit = true;
  } else if (raw.credit && raw.credit.trim() && parseAmount(raw.credit) > 0) {
    // Has credit value = income/refund
    amount = parseAmount(raw.credit);
    isDebit = false;
  } else if (raw.amount && raw.amount.trim()) {
    // Single amount column - check if negative (expense) or positive (income)
    amount = parseAmount(raw.amount);
    // If original amount was negative, it's a debit
    const originalAmount = parseFloat(raw.amount.replace(/[$,\s]/g, ''));
    isDebit = originalAmount < 0;
  }
  
  // Generate fingerprint for duplicate detection
  const fingerprint = generateFingerprint({
    date: parseDate(raw.date),
    amount,
    description: raw.description,
  });
  
  // Convert raw transaction to Record<string, string> for rawData
  const rawData: Record<string, string> = {};
  Object.keys(raw).forEach(key => {
    const value = raw[key];
    if (value !== undefined) {
      rawData[key] = value;
    }
  });

  // Set initial type based on isDebit flag (which is already determined from debit/credit columns)
  // isDebit = true means expense, isDebit = false means income
  let initialType: 'income' | 'expense' | 'transfer' | 'unclassified' = 'unclassified';
  if (amount > 0) {
    // Only set type if we have a valid amount
    initialType = isDebit ? 'expense' : 'income';
    console.log('[csvParser] Setting type:', initialType, 'for transaction:', raw.description, 'isDebit:', isDebit, 'amount:', amount);
  } else {
    console.log('[csvParser] No amount or amount is 0, keeping as unclassified:', raw.description);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    householdId,
    date: parseDate(raw.date),
    description: raw.description.trim(),
    amount,
    isDebit,
    rawData,
    type: initialType,
    fingerprint,
    importedAt: new Date().toISOString(),
    sourceFile,
  };
};

// Generate fingerprint for duplicate detection
export const generateFingerprint = (tx: {
  date: string;
  amount: number;
  description: string;
}): string => {
  // Create a hash-like fingerprint from date, amount (rounded to 2 decimals), and normalized description
  const normalizedDesc = tx.description
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 20); // First 20 alphanumeric chars
  
  const roundedAmount = Math.round(tx.amount * 100) / 100; // Round to 2 decimals
  
  return `${tx.date}-${roundedAmount}-${normalizedDesc}`;
};

