// Pattern matching for transaction classification
// Matches transactions against learned patterns

import type { Transaction, TransactionPattern } from '../types/models';

export type PatternMatch = {
  pattern: TransactionPattern;
  confidence: number; // 0-100
  matchedKeywords: string[];
  reason: string; // Why this pattern matched
};

// Find matching patterns for a transaction
export const findMatchingPatterns = (
  tx: Transaction,
  patterns: TransactionPattern[]
): PatternMatch[] => {
  console.log('[patternMatcher] Finding patterns for transaction:', tx.description);
  
  const matches: PatternMatch[] = [];
  
  for (const pattern of patterns) {
    // Skip rejected patterns
    if (pattern.userRejected) continue;
    
    // Check if pattern matches
    const match = matchPattern(tx, pattern);
    if (match) {
      matches.push(match);
    }
  }
  
  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);
  
  console.log('[patternMatcher] Found', matches.length, 'matches');
  return matches;
};

// Match a transaction against a pattern
const matchPattern = (
  tx: Transaction,
  pattern: TransactionPattern
): PatternMatch | null => {
  // Check transaction type (debit/credit)
  if (pattern.isDebit !== tx.isDebit) {
    return null;
  }
  
  // Amount range is optional and not a hard filter
  // We use it for confidence adjustment, but don't reject matches based on amount alone
  // This allows patterns to match even if amounts vary (e.g., $5 coffee vs $15 coffee)
  
  // Check description keywords
  const description = tx.description.toUpperCase();
  const matchedKeywords: string[] = [];
  let keywordMatches = 0;
  
  for (const keyword of pattern.descriptionKeywords) {
    const upperKeyword = keyword.toUpperCase();
    if (description.includes(upperKeyword)) {
      matchedKeywords.push(keyword);
      keywordMatches++;
    }
  }
  
  // Need at least one keyword match
  if (keywordMatches === 0) {
    return null;
  }
  
  // Calculate confidence
  // Base confidence from pattern confidence
  let confidence = pattern.confidence;
  
  // DESCRIPTION MATCHING (Primary factor - 80% weight)
  const allKeywordsMatch = keywordMatches === pattern.descriptionKeywords.length;
  const keywordMatchRatio = keywordMatches / pattern.descriptionKeywords.length;
  
  if (allKeywordsMatch) {
    // All keywords match - strong signal
    confidence = Math.min(100, confidence + 20);
  } else {
    // Partial keyword match - scale confidence by match ratio
    // More keywords matched = higher confidence
    confidence = confidence * (0.5 + 0.5 * keywordMatchRatio);
  }
  
  // AMOUNT MATCHING (Secondary factor - 20% weight, optional)
  // Only use amount as a tie-breaker or fine-tuning, not a primary filter
  if (pattern.amountRange) {
    const { min, max } = pattern.amountRange;
    if (min !== undefined && max !== undefined) {
      const range = max - min;
      if (range > 0) {
        const distanceFromCenter = Math.abs(tx.amount - (min + max) / 2);
        const amountMatch = Math.max(0, 1 - (distanceFromCenter / range));
        // Amount only provides small boost/penalty (±10%)
        confidence = confidence * (0.9 + 0.1 * amountMatch);
      }
    }
  }
  
  // Generate reason
  const reason = allKeywordsMatch
    ? `All keywords matched: ${matchedKeywords.join(', ')}`
    : `Partial match: ${matchedKeywords.join(', ')} of ${pattern.descriptionKeywords.length} keywords`;
  
  return {
    pattern,
    confidence: Math.round(confidence),
    matchedKeywords,
    reason,
  };
};

// Extract keywords from description
export const extractKeywords = (description: string): string[] => {
  // Remove common words, numbers, dates
  const commonWords = [
    'THE', 'A', 'AN', 'AND', 'OR', 'BUT', 'IN', 'ON', 'AT', 'TO', 'FOR',
    'OF', 'WITH', 'BY', 'FROM', 'AS', 'IS', 'WAS', 'BE', 'BEEN', 'BEING',
    'HAVE', 'HAS', 'HAD', 'DO', 'DOES', 'DID', 'WILL', 'WOULD', 'SHOULD',
    'COULD', 'MAY', 'MIGHT', 'MUST', 'CAN', 'CANT', 'CANNOT',
  ];
  
  // Split into words
  const words = description
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ') // Remove special chars
    .split(/\s+/)
    .filter(w => w.length > 2) // Minimum 3 characters
    .filter(w => !/^\d+$/.test(w)) // Remove pure numbers
    .filter(w => !commonWords.includes(w)); // Remove common words
  
  // Remove duplicates and return
  return [...new Set(words)];
};

// Create new pattern from transaction
export const createPatternFromTransaction = (
  tx: Transaction,
  classification: {
    type: 'income' | 'expense' | 'transfer';
    category: string;
    owner?: string;
  },
  householdId: string
): TransactionPattern => {
  console.log('[patternMatcher] Creating pattern from transaction:', tx.description);
  
  const keywords = extractKeywords(tx.description);
  
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    householdId,
    descriptionKeywords: keywords,
    // Amount range is optional - wider tolerance since amounts vary more than descriptions
    // Only set if we have a reasonable amount (not $0)
    amountRange: tx.amount > 0 ? {
      min: tx.amount * 0.5, // 50% tolerance (wider range, less strict)
      max: tx.amount * 2.0, // Allow up to 2x the amount
    } : undefined,
    isDebit: tx.isDebit,
    type: classification.type,
    category: classification.category,
    owner: classification.owner,
    confidence: 50, // Start with 50% confidence
    matchCount: 0,
    lastUsed: new Date().toISOString(),
    userConfirmed: false,
    userRejected: false,
  };
};

// Update pattern confidence after user feedback
export const updatePatternConfidence = (
  pattern: TransactionPattern,
  wasCorrect: boolean
): TransactionPattern => {
  console.log('[patternMatcher] Updating pattern confidence:', pattern.id, 'wasCorrect:', wasCorrect);
  
  let newConfidence = pattern.confidence;
  
  if (wasCorrect) {
    // Increase confidence (capped at 100)
    newConfidence = Math.min(100, pattern.confidence + 5);
  } else {
    // Decrease confidence (floored at 0)
    newConfidence = Math.max(0, pattern.confidence - 10);
  }
  
  return {
    ...pattern,
    confidence: newConfidence,
    matchCount: pattern.matchCount + 1,
      lastUsed: new Date().toISOString(),
  };
};

