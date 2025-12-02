// Pattern learning system
// Learns from user classifications and improves over time

import type { Transaction, TransactionPattern } from '../types/models';
import { extractKeywords, createPatternFromTransaction, updatePatternConfidence } from './patternMatcher';

export type TransactionClassification = {
  type: 'income' | 'expense' | 'transfer';
  category: string;
  owner?: string;
};

// Learn from user classification
export const learnFromClassification = (
  tx: Transaction,
  classification: TransactionClassification,
  existingPatterns: TransactionPattern[],
  householdId: string
): TransactionPattern[] => {
  console.log('[patternLearner] Learning from classification:', tx.description, classification);
  
  // Check if a similar pattern already exists
  const similarPattern = findSimilarPattern(tx, classification, existingPatterns);
  
  if (similarPattern) {
    // Update existing pattern
    console.log('[patternLearner] Updating existing pattern:', similarPattern.id);
    return existingPatterns.map(p => {
      if (p.id === similarPattern.id) {
        return updatePatternConfidence(p, true);
      }
      return p;
    });
  } else {
    // Create new pattern
    console.log('[patternLearner] Creating new pattern');
    const newPattern = createPatternFromTransaction(tx, classification, householdId);
    return [...existingPatterns, newPattern];
  }
};

// Find similar pattern to transaction
const findSimilarPattern = (
  tx: Transaction,
  classification: TransactionClassification,
  patterns: TransactionPattern[]
): TransactionPattern | null => {
  const txKeywords = extractKeywords(tx.description);
  
  for (const pattern of patterns) {
    // Must match type and category
    if (pattern.type !== classification.type) continue;
    if (pattern.category !== classification.category) continue;
    
    // Check keyword overlap
    const keywordOverlap = txKeywords.filter(k => 
      pattern.descriptionKeywords.some(pk => 
        k.includes(pk) || pk.includes(k)
      )
    ).length;
    
    // If significant overlap, consider it similar
    if (keywordOverlap >= Math.min(2, txKeywords.length / 2)) {
      return pattern;
    }
  }
  
  return null;
};

// Update pattern based on user feedback
export const updatePatternFromFeedback = (
  patternId: string,
  feedback: 'correct' | 'incorrect' | 'partial',
  patterns: TransactionPattern[]
): TransactionPattern[] => {
  console.log('[patternLearner] Updating pattern from feedback:', patternId, feedback);
  
  return patterns.map(p => {
    if (p.id !== patternId) return p;
    
    let updated = { ...p };
    
    switch (feedback) {
      case 'correct':
        updated = updatePatternConfidence(updated, true);
        updated.userConfirmed = true;
        break;
      case 'incorrect':
        updated = updatePatternConfidence(updated, false);
        updated.userRejected = true;
        break;
      case 'partial':
        // Slight confidence boost, but not as much as correct
        updated.confidence = Math.min(100, updated.confidence + 2);
        break;
    }
    
    return updated;
  });
};

// Merge similar patterns
export const mergeSimilarPatterns = (
  patterns: TransactionPattern[]
): TransactionPattern[] => {
  console.log('[patternLearner] Merging similar patterns');
  
  const merged: TransactionPattern[] = [];
  const processed = new Set<string>();
  
  for (let i = 0; i < patterns.length; i++) {
    if (processed.has(patterns[i].id)) continue;
    
    const pattern = patterns[i];
    const similar: TransactionPattern[] = [pattern];
    
    // Find similar patterns
    for (let j = i + 1; j < patterns.length; j++) {
      if (processed.has(patterns[j].id)) continue;
      
      if (arePatternsSimilar(pattern, patterns[j])) {
        similar.push(patterns[j]);
        processed.add(patterns[j].id);
      }
    }
    
    // Merge similar patterns
    if (similar.length > 1) {
      const mergedPattern = mergePatterns(similar);
      merged.push(mergedPattern);
    } else {
      merged.push(pattern);
    }
    
    processed.add(pattern.id);
  }
  
  console.log('[patternLearner] Merged', patterns.length, 'patterns into', merged.length);
  return merged;
};

// Check if two patterns are similar
const arePatternsSimilar = (p1: TransactionPattern, p2: TransactionPattern): boolean => {
  // Must have same type and category
  if (p1.type !== p2.type) return false;
  if (p1.category !== p2.category) return false;
  
  // Check keyword overlap
  const keywords1 = new Set(p1.descriptionKeywords);
  const keywords2 = new Set(p2.descriptionKeywords);
  
  const intersection = [...keywords1].filter(k => keywords2.has(k));
  const union = [...new Set([...keywords1, ...keywords2])];
  
  // Jaccard similarity
  const similarity = intersection.length / union.length;
  
  return similarity > 0.5; // 50% keyword overlap
};

// Merge multiple patterns into one
const mergePatterns = (patterns: TransactionPattern[]): TransactionPattern => {
  const base = patterns[0];
  
  // Combine all keywords
  const allKeywords = new Set<string>();
  patterns.forEach(p => {
    p.descriptionKeywords.forEach(k => allKeywords.add(k));
  });
  
  // Calculate merged amount range
  const amounts: number[] = [];
  patterns.forEach(p => {
    if (p.amountRange) {
      if (p.amountRange.min !== undefined) amounts.push(p.amountRange.min);
      if (p.amountRange.max !== undefined) amounts.push(p.amountRange.max);
    }
  });
  
  const amountRange = amounts.length > 0
    ? {
        min: Math.min(...amounts),
        max: Math.max(...amounts),
      }
    : undefined;
  
  // Average confidence
  const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
  
  // Sum match counts
  const totalMatches = patterns.reduce((sum, p) => sum + p.matchCount, 0);
  
  return {
    ...base,
    descriptionKeywords: [...allKeywords],
    amountRange,
    confidence: Math.round(avgConfidence),
    matchCount: totalMatches,
    userConfirmed: patterns.some(p => p.userConfirmed),
    userRejected: patterns.every(p => p.userRejected),
  };
};

