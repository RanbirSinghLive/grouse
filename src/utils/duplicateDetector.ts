// Duplicate detection for CSV imports
// Prevents importing the same transaction multiple times

import type { Transaction, Cashflow } from '../types/models';

// Check if transaction is duplicate
export const isDuplicate = (
  tx: Transaction,
  existingTransactions: Transaction[],
  existingCashflows: Cashflow[]
): boolean => {
  console.log('[duplicateDetector] Checking for duplicates:', tx.fingerprint);
  
  // 1. Exact fingerprint match
  const exactMatch = existingTransactions.some(
    existing => existing.fingerprint === tx.fingerprint
  );
  
  if (exactMatch) {
    console.log('[duplicateDetector] Exact fingerprint match found');
    return true;
  }
  
  // 2. Fuzzy match: same date, similar amount, similar description
  const fuzzyMatch = findSimilarTransactions(tx, existingTransactions);
  if (fuzzyMatch.length > 0) {
    console.log('[duplicateDetector] Fuzzy match found:', fuzzyMatch.length);
    return true;
  }
  
  // 3. Check against existing cashflows (for recurring transactions)
  const cashflowMatch = findMatchingCashflow(tx, existingCashflows);
  if (cashflowMatch) {
    console.log('[duplicateDetector] Matches existing cashflow pattern');
    // Don't mark as duplicate, but could be flagged for review
  }
  
  return false;
};

// Find similar transactions (fuzzy match)
export const findSimilarTransactions = (
  tx: Transaction,
  existing: Transaction[]
): Transaction[] => {
  const similar: Transaction[] = [];
  
  for (const existingTx of existing) {
    // Same date
    if (existingTx.date !== tx.date) continue;
    
    // Amount within $0.01 (handles rounding differences)
    const amountDiff = Math.abs(existingTx.amount - tx.amount);
    if (amountDiff > 0.01) continue;
    
    // Description similarity > 90%
    const similarity = calculateSimilarity(
      tx.description.toLowerCase(),
      existingTx.description.toLowerCase()
    );
    
    if (similarity > 0.9) {
      similar.push(existingTx);
    }
  }
  
  return similar;
};

// Calculate string similarity (simple Levenshtein-based)
const calculateSimilarity = (str1: string, str2: string): number => {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  // Simple word-based similarity
  const words1 = str1.split(/\s+/).filter(w => w.length > 2); // Ignore short words
  const words2 = str2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    // Fallback to character similarity
    return calculateCharacterSimilarity(str1, str2);
  }
  
  // Count matching words
  const matchingWords = words1.filter(w1 => 
    words2.some(w2 => w1 === w2 || w1.includes(w2) || w2.includes(w1))
  ).length;
  
  const maxWords = Math.max(words1.length, words2.length);
  return matchingWords / maxWords;
};

// Character-based similarity (Levenshtein distance)
const calculateCharacterSimilarity = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;
  
  // Create matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - (distance / maxLen);
};

// Check if transaction matches an existing cashflow pattern
export const findMatchingCashflow = (
  tx: Transaction,
  cashflows: Cashflow[]
): Cashflow | null => {
  // For now, simple name matching
  // In future, could use pattern matching
  const txName = tx.description.toLowerCase();
  
  for (const cashflow of cashflows) {
    const cfName = cashflow.name.toLowerCase();
    
    // Check if transaction description contains cashflow name
    if (txName.includes(cfName) || cfName.includes(txName)) {
      // Check if amount is similar (within 10%)
      const amountDiff = Math.abs(tx.amount - cashflow.amount);
      const percentDiff = amountDiff / cashflow.amount;
      
      if (percentDiff < 0.1) {
        return cashflow;
      }
    }
  }
  
  return null;
};

// Check for duplicates in a batch of transactions
export const findDuplicates = (
  transactions: Transaction[],
  existingTransactions: Transaction[],
  existingCashflows: Cashflow[]
): {
  duplicates: Transaction[];
  unique: Transaction[];
} => {
  console.log('[duplicateDetector] Finding duplicates in batch of', transactions.length);
  
  const duplicates: Transaction[] = [];
  const unique: Transaction[] = [];
  
  for (const tx of transactions) {
    if (isDuplicate(tx, existingTransactions, existingCashflows)) {
      duplicates.push(tx);
    } else {
      unique.push(tx);
    }
  }
  
  console.log('[duplicateDetector] Found', duplicates.length, 'duplicates,', unique.length, 'unique');
  return { duplicates, unique };
};

