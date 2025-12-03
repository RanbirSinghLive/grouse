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
        return format as BankFormat;
      }
    }
  }
  
  return 'generic';
};

// Get column mapping for a bank format
export const getColumnMapping = (format: BankFormat, headers: string[]): ColumnMapping | null => {
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
const parseDate = (dateStr: string): string => {
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
  // Common patterns:
  // Pattern 1: Date, Description, Debit, Credit, Balance (5 columns)
  // Pattern 2: Date, Description, Debit, Credit (4 columns) - CIBC format
  // Pattern 3: Date, Description, Amount, Balance (4 columns)
  // Pattern 4: Date, Description, Amount (3 columns)
  
  if (firstDataLine.length >= 5) {
    // Likely: Date, Description, Debit, Credit, Balance (or extra column like card number)
    // Check if columns 2 and 3 (index 2, 3) look like Debit/Credit pattern
    // In Debit/Credit pattern, typically one is empty and the other has a value
    const col2 = firstDataLine[2]?.trim() || '';
    const col3 = firstDataLine[3]?.trim() || '';
    const col4 = firstDataLine[4]?.trim() || '';
    
    // Check if col2 and col3 look like numbers (debit/credit) or if one is empty
    const col2IsNumber = /^\d+\.?\d*$/.test(col2);
    const col3IsNumber = /^\d+\.?\d*$/.test(col3);
    const col4IsNumber = /^\d+\.?\d*$/.test(col4);
    
    // If col2 and col3 are numbers and one is empty, it's Debit/Credit
    // If col4 is a number, it might be Balance
    if ((col2IsNumber || col3IsNumber) && (!col2 || !col3)) {
      // Debit/Credit pattern
      return {
        date: 'Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
        balance: col4IsNumber ? 'Balance' : undefined,
      };
    } else if (col4IsNumber) {
      // Likely: Date, Description, Debit, Credit, Balance
      return {
        date: 'Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
        balance: 'Balance',
      };
    } else {
      // Extra column (like card number), but still Debit/Credit pattern
      return {
        date: 'Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
      };
    }
  } else if (firstDataLine.length >= 4) {
    // 4 columns - need to distinguish between:
    // - Date, Description, Debit, Credit (CIBC format)
    // - Date, Description, Amount, Balance
    
    const col2 = firstDataLine[2]?.trim() || '';
    const col3 = firstDataLine[3]?.trim() || '';
    
    // Check if columns 2 and 3 look like Debit/Credit (one empty, one has value)
    // vs Amount/Balance (both might have values)
    // Use a more lenient number check that handles decimals and commas
    const numberPattern = /^[\d,]+\.?\d*$/;
    const col2IsNumber = col2 && numberPattern.test(col2.replace(/,/g, ''));
    const col3IsNumber = col3 && numberPattern.test(col3.replace(/,/g, ''));
    
    // If one is empty and the other is a number, it's Debit/Credit
    // Also check if both are numbers but one is significantly larger (likely Balance)
    const col2Num = col2 ? parseFloat(col2.replace(/,/g, '')) : 0;
    const col3Num = col3 ? parseFloat(col3.replace(/,/g, '')) : 0;
    const isLikelyBalance = col3Num > 1000 && col2Num < col3Num; // Balance is usually larger
    
    if ((!col2 && col3IsNumber) || (col2IsNumber && !col3)) {
      // Debit/Credit pattern (CIBC format) - one empty, one has value
      return {
        date: 'Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
      };
    } else if (isLikelyBalance) {
      // Likely: Date, Description, Amount, Balance (col3 is much larger, likely balance)
      return {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        balance: 'Balance',
      };
    } else if (col2IsNumber && col3IsNumber) {
      // Both are numbers - default to Debit/Credit for CIBC format
      return {
        date: 'Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
      };
    } else {
      // Default to Debit/Credit for CIBC format (most common for 4-column headerless CSVs)
      return {
        date: 'Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
      };
    }
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
        
        // Check if first value looks like a date (YYYY-MM-DD or MM/DD/YYYY)
        const firstValue = firstLineValues[0]?.trim() || '';
        const looksLikeDate = /^\d{4}-\d{2}-\d{2}$/.test(firstValue) || /^\d{2}\/\d{2}\/\d{4}$/.test(firstValue);
        
        // If first value is a date, it's definitely not a header (it's data)
        // Also check if second value looks like a description (not a header keyword)
        const secondValue = firstLineValues[1]?.trim() || '';
        const secondValueIsLong = secondValue.length > 20; // Descriptions are usually longer than header names
        
        // Header detection: if first value is a date OR second value is long (description), it's likely data
        const hasHeader = !looksLikeDate && !secondValueIsLong && looksLikeHeader(firstLine);
        
        let headers: string[];
        let mapping: ColumnMapping | null;
        let dataStartIndex: number;
        
        if (hasHeader) {
          // Has header row
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
          dataStartIndex = 0;
          
          // Use first data line to detect structure
          mapping = detectColumnStructure(firstLineValues);
          if (!mapping) {
            reject(new Error('Could not detect CSV column structure. Please ensure CSV has Date, Description, and Amount columns.'));
            return;
          }
          
          // For headerless CSVs, we assume standard column order:
          // Position 0: Date
          // Position 1: Description
          // Position 2: Debit (if debit/credit format) or Amount (if single amount format)
          // Position 3: Credit (if debit/credit format) or Balance (if single amount format)
          // Position 4: Balance (if 5 columns) or extra column
          
          // Create synthetic headers that match the detected structure
          headers = ['Date', 'Description'];
          if (mapping.debit && mapping.credit) {
            headers.push('Debit', 'Credit');
            if (mapping.balance) headers.push('Balance');
          } else if (mapping.amount) {
            headers.push('Amount');
            if (mapping.balance) headers.push('Balance');
          }
          
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
          
          // For headerless CSVs, use positional indexing
          // For CSVs with headers, use header name lookup
          const getValue = (colName: string | undefined, position: number): string => {
            if (!colName) return '';
            if (!hasHeader) {
              // Headerless: use position directly
              return values[position] || '';
            } else {
              // Has header: find by header name
              const idx = headers.indexOf(colName);
              return idx >= 0 ? (values[idx] || '') : '';
            }
          };
          
          // Create raw transaction
          const rawTx: RawTransaction = {
            date: getValue(mapping.date, 0),
            description: getValue(mapping.description, 1),
            amount: '',
          };
          
          // Handle amount based on format
          if (mapping.debit && mapping.credit) {
            const debit = getValue(mapping.debit, 2);
            const credit = getValue(mapping.credit, 3);
            
            // Check which column has a value (debit = expense, credit = income/refund)
            if (debit && debit.trim() && parseAmount(debit) > 0) {
              rawTx.amount = debit;
              rawTx.debit = debit;
            } else if (credit && credit.trim() && parseAmount(credit) > 0) {
              rawTx.amount = credit;
              rawTx.credit = credit;
            }
          } else if (mapping.amount) {
            rawTx.amount = getValue(mapping.amount, 2);
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

