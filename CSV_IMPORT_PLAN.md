# 📋 CSV Import & Pattern Learning Feature Plan

## 🎯 Overview

Add a CSV import feature to the Budget tab that allows users to upload bank statements, automatically categorize transactions, learn patterns over time, and prevent duplicate imports.

---

## 📊 Data Model Extensions

### 1. Transaction (Raw CSV Data)
```ts
type Transaction = {
  id: string;
  householdId: string;
  // Raw CSV data
  date: string; // ISO date
  description: string; // Merchant/payee name from CSV
  amount: number; // Absolute value (always positive)
  isDebit: boolean; // true = expense, false = income
  rawData: Record<string, string>; // Store all original CSV columns for reference
  
  // User classification
  type: 'income' | 'expense' | 'transfer' | 'unclassified';
  category?: string; // User-assigned category
  owner?: string;
  
  // Duplicate detection
  fingerprint: string; // Hash of (date, amount, description) for duplicate detection
  importedAt: string; // ISO timestamp
  sourceFile?: string; // Original CSV filename
  
  // Pattern matching
  matchedPatternId?: string; // ID of pattern that matched this transaction
};
```

### 2. Transaction Pattern (Learned Rules)
```ts
type TransactionPattern = {
  id: string;
  householdId: string;
  
  // Pattern matching criteria
  descriptionKeywords: string[]; // Keywords to match in description (e.g., ["TIM HORTONS", "TIM HORTON"])
  amountRange?: { min?: number; max?: number }; // Optional amount range
  isDebit: boolean; // Expected transaction type
  
  // Classification
  type: 'income' | 'expense' | 'transfer';
  category: string;
  owner?: string;
  
  // Learning metadata
  confidence: number; // 0-100, increases with successful matches
  matchCount: number; // Number of times this pattern matched
  lastMatchedAt?: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  
  // User feedback
  userConfirmed: boolean; // Has user explicitly confirmed this pattern?
  userRejected: boolean; // Has user rejected this pattern?
};
```

### 3. Import Session (Batch Import State)
```ts
type ImportSession = {
  id: string;
  householdId: string;
  fileName: string;
  uploadedAt: string;
  transactions: Transaction[]; // Parsed transactions
  status: 'parsing' | 'reviewing' | 'applying' | 'completed' | 'cancelled';
  duplicatesFound: number;
  patternsMatched: number;
};
```

---

## 🔧 Core Components

### 1. CSV Parser (`src/utils/csvParser.ts`)

**Responsibilities:**
- Parse CSV files (handle different bank formats: TD, RBC, Scotiabank, etc.)
- Detect column mapping (date, description, amount, debit/credit)
- Normalize dates, amounts, descriptions
- Generate transaction fingerprints for duplicate detection

**Key Functions:**
```ts
// Detect bank format and map columns
detectBankFormat(headers: string[]): BankFormat;

// Parse CSV file into raw transactions
parseCSV(file: File): Promise<RawTransaction[]>;

// Normalize transaction data
normalizeTransaction(raw: RawTransaction): Transaction;

// Generate fingerprint for duplicate detection
generateFingerprint(tx: Transaction): string;
```

**Supported Bank Formats:**
- TD Canada Trust
- RBC Royal Bank
- Scotiabank
- BMO
- CIBC
- Tangerine
- Generic format (user can map columns manually)

### 2. Pattern Matcher (`src/utils/patternMatcher.ts`)

**Responsibilities:**
- Match transactions against learned patterns
- Score pattern matches by confidence
- Learn new patterns from user actions
- Update pattern confidence based on user feedback

**Key Functions:**
```ts
// Find matching patterns for a transaction
findMatchingPatterns(tx: Transaction, patterns: TransactionPattern[]): PatternMatch[];

// Create new pattern from transaction
createPatternFromTransaction(tx: Transaction, classification: TransactionClassification): TransactionPattern;

// Update pattern confidence after user confirmation
updatePatternConfidence(patternId: string, wasCorrect: boolean): void;

// Merge similar patterns
mergeSimilarPatterns(patterns: TransactionPattern[]): TransactionPattern[];
```

**Pattern Matching Algorithm:**
1. **Exact Match:** Description contains all keywords (case-insensitive)
2. **Fuzzy Match:** Description similarity score > 80%
3. **Amount Range:** If pattern has amount range, check if transaction amount falls within range
4. **Confidence Score:** Based on keyword match count, amount match, and historical accuracy

### 3. Duplicate Detector (`src/utils/duplicateDetector.ts`)

**Responsibilities:**
- Detect duplicate transactions (same transaction imported multiple times)
- Check against existing cashflows and transactions
- Prevent double-counting

**Key Functions:**
```ts
// Check if transaction is duplicate
isDuplicate(tx: Transaction, existingTransactions: Transaction[], existingCashflows: Cashflow[]): boolean;

// Find similar transactions (fuzzy match)
findSimilarTransactions(tx: Transaction, existing: Transaction[]): Transaction[];
```

**Duplicate Detection Strategy:**
1. **Exact Match:** Same fingerprint (date, amount, description hash)
2. **Fuzzy Match:** Same date, amount within $0.01, description similarity > 90%
3. **Time Window:** Same transaction within 7 days (handles pending vs posted)
4. **Cashflow Match:** Check if transaction matches existing cashflow pattern

### 4. Pattern Learner (`src/utils/patternLearner.ts`)

**Responsibilities:**
- Learn patterns from user classifications
- Improve pattern matching over time
- Handle user corrections and feedback

**Key Functions:**
```ts
// Learn from user classification
learnFromClassification(tx: Transaction, userClassification: TransactionClassification): void;

// Update pattern based on user feedback
updatePatternFromFeedback(patternId: string, feedback: 'correct' | 'incorrect' | 'partial'): void;

// Extract keywords from description
extractKeywords(description: string): string[];
```

**Learning Strategy:**
1. **Initial Pattern:** Create pattern from first user classification
2. **Keyword Extraction:** Extract meaningful keywords (remove common words, numbers, dates)
3. **Confidence Boost:** Increase confidence when pattern matches correctly
4. **Confidence Penalty:** Decrease confidence when user rejects match
5. **Pattern Refinement:** Update keywords based on successful matches

---

## 🎨 UI Components

### 1. CSV Upload Component (`src/components/CSVUpload.tsx`)

**Features:**
- Drag & drop or file picker
- Show upload progress
- Preview first few rows
- Bank format detection/selection

**UI:**
```
┌─────────────────────────────────────┐
│  📁 Upload Bank Statement (CSV)     │
│                                     │
│  [Drag & drop or click to browse]  │
│                                     │
│  Supported: TD, RBC, Scotiabank...  │
└─────────────────────────────────────┘
```

### 2. Transaction Review Table (`src/components/TransactionReview.tsx`)

**Features:**
- Show all parsed transactions
- Highlight duplicates
- Show pattern match suggestions
- Allow bulk actions (select multiple, apply category)
- Filter by type (income/expense/transfer/unclassified)

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Review Transactions (45 found, 3 duplicates, 38 patterns)      │
│                                                                 │
│  [All] [Income] [Expense] [Transfer] [Unclassified]            │
│                                                                 │
│  ☑ Date      Description          Amount   Type    Category     │
│  ☑ 2025-01-15 TIM HORTONS #1234   $5.67   Expense Food [✓]     │
│  ☑ 2025-01-15 INTERAC TRANSFER    $100.00 Transfer [→]        │
│  ☐ 2025-01-16 AMAZON.CA            $45.99 Expense ? [Suggest] │
│                                                                 │
│  [Apply Selected] [Skip Duplicates] [Import All]                │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Pattern Suggestion Modal (`src/components/PatternSuggestionModal.tsx`)

**Features:**
- Show suggested classification before saving
- Allow user to confirm, reject, or modify
- Show confidence score
- Show why pattern matched (highlighted keywords)

**UI:**
```
┌─────────────────────────────────────┐
│  💡 Pattern Match Suggestion       │
│                                     │
│  Transaction: "TIM HORTONS #1234"    │
│  Amount: $5.67                      │
│                                     │
│  Suggested:                          │
│  ✓ Type: Expense                    │
│  ✓ Category: Food                   │
│  ✓ Confidence: 95%                 │
│                                     │
│  Matched keywords: TIM HORTONS      │
│                                     │
│  [✓ Confirm] [✗ Reject] [✏️ Edit]   │
└─────────────────────────────────────┘
```

### 4. Pattern Management (`src/components/PatternManager.tsx`)

**Features:**
- View all learned patterns
- Edit/delete patterns
- See pattern statistics (match count, accuracy)
- Test patterns against sample transactions

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│  Learned Patterns (12 patterns)                            │
│                                                             │
│  Pattern                    Category    Confidence  Matches │
│  TIM HORTONS                Food        95%         23      │
│  AMAZON.CA                  Shopping    90%         45      │
│  INTERAC TRANSFER           Transfer    85%         12      │
│                                                             │
│  [Edit] [Delete] [Test Pattern]                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 User Flow

### Phase 1: Initial Import (First Time)

1. **Upload CSV**
   - User uploads bank statement CSV
   - System detects bank format (or user selects)
   - System parses transactions

2. **Review & Classify**
   - System shows all transactions
   - User manually tags each as income/expense/transfer
   - User assigns categories
   - User marks duplicates to skip

3. **Learn Patterns**
   - System creates patterns from user classifications
   - Patterns stored with initial confidence (50%)

4. **Import to Cashflows**
   - System converts transactions to cashflows
   - Transfers are skipped (not imported)
   - Duplicates are skipped

### Phase 2: Subsequent Imports (With Learning)

1. **Upload CSV**
   - Same as Phase 1

2. **Auto-Match Patterns**
   - System matches transactions against learned patterns
   - Shows suggestions with confidence scores
   - Highlights matched keywords

3. **Review Suggestions**
   - User reviews each suggestion
   - Can confirm, reject, or modify
   - Bulk actions for similar transactions

4. **Learn from Feedback**
   - System updates pattern confidence based on user actions
   - Creates new patterns for unmatched transactions
   - Refines existing patterns

5. **Import to Cashflows**
   - Only confirmed transactions are imported
   - Duplicates automatically detected and skipped

### Phase 3: Continuous Improvement

- Pattern confidence increases with successful matches
- Pattern confidence decreases with rejections
- New patterns created for recurring transactions
- Similar patterns merged automatically
- User can manually manage patterns

---

## 💾 Data Storage

### LocalStorage Structure

```ts
type ImportData = {
  transactions: Transaction[]; // All imported transactions (for duplicate detection)
  patterns: TransactionPattern[]; // Learned patterns
  importHistory: ImportSession[]; // Import history (last 10 imports)
};
```

**Storage Keys:**
- `grouse-import-transactions`: All imported transactions
- `grouse-import-patterns`: Learned patterns
- `grouse-import-history`: Import session history

**Data Retention:**
- Transactions: Keep for 2 years (for duplicate detection)
- Patterns: Keep indefinitely (user can delete manually)
- Import History: Keep last 10 sessions

---

## 🛠️ Implementation Phases

### Phase 1: Basic CSV Import (MVP)
- ✅ CSV parser for common bank formats
- ✅ Transaction review table
- ✅ Manual classification
- ✅ Duplicate detection
- ✅ Import to cashflows

### Phase 2: Pattern Learning
- ✅ Pattern creation from user actions
- ✅ Pattern matching for suggestions
- ✅ Pattern suggestion modal
- ✅ Confidence scoring

### Phase 3: Advanced Learning
- ✅ Fuzzy matching
- ✅ Pattern merging
- ✅ Amount range matching
- ✅ Pattern management UI

### Phase 4: Polish & Optimization
- ✅ Bulk actions
- ✅ Keyboard shortcuts
- ✅ Import history
- ✅ Pattern statistics

---

## 🎯 Key Features

### 1. Duplicate Detection
- **Fingerprint Matching:** Hash of (date, amount, description)
- **Fuzzy Matching:** Similar transactions within time window
- **Cashflow Matching:** Check against existing cashflows
- **Visual Indicators:** Highlight duplicates in review table

### 2. Pattern Learning
- **Keyword Extraction:** Smart keyword extraction from descriptions
- **Confidence Scoring:** 0-100% based on match accuracy
- **Auto-Improvement:** Patterns get better over time
- **User Feedback:** Learn from confirmations and rejections

### 3. Transfer Handling
- **Auto-Detection:** Detect common transfer patterns (INTERAC, E-TRANSFER)
- **Skip Import:** Transfers marked as "transfer" are not imported
- **Pattern Learning:** Learn to recognize transfers automatically

### 4. Category Suggestions
- **Pattern-Based:** Suggest category based on matched pattern
- **Common Categories:** Pre-populate with common categories
- **User Customization:** User can create custom categories

### 5. Bulk Operations
- **Select Multiple:** Select multiple transactions
- **Bulk Classify:** Apply same classification to selected
- **Bulk Category:** Apply same category to selected
- **Bulk Skip:** Skip multiple duplicates at once

---

## 🔍 Edge Cases & Considerations

### 1. Different Bank Formats
- **Solution:** Support multiple bank formats with auto-detection
- **Fallback:** Manual column mapping if auto-detection fails

### 2. International Transactions
- **Solution:** Support multiple currencies (CAD, USD)
- **Exchange Rate:** Store exchange rate at time of transaction

### 3. Pending vs Posted
- **Solution:** Detect pending transactions (negative amounts, future dates)
- **Handling:** Option to import pending or wait for posted

### 4. Split Transactions
- **Solution:** Manual splitting in review table
- **Future:** AI-powered split detection (e.g., "GROCERY STORE" → Food + Household)

### 5. Recurring Transactions
- **Solution:** Pattern learning will recognize recurring transactions
- **Future:** Auto-create cashflows for recurring transactions

### 6. Large Files
- **Solution:** Stream parsing for large CSV files
- **Performance:** Process in chunks, show progress

### 7. Pattern Conflicts
- **Solution:** Show multiple pattern matches, let user choose
- **Handling:** Higher confidence pattern shown first

---

## 📊 Success Metrics

- **Time Saved:** Reduce manual entry time by 80%
- **Accuracy:** Pattern matching accuracy > 90% after 3 months
- **User Satisfaction:** Users import statements monthly without frustration
- **Duplicate Prevention:** Zero duplicate transactions imported

---

## 🚀 Future Enhancements

1. **AI-Powered Categorization:** Use ML model for better categorization
2. **Receipt OCR:** Upload receipt images, extract transaction data
3. **Auto-Import:** Connect to bank APIs for automatic imports
4. **Multi-Account:** Support multiple bank accounts in one import
5. **Transaction Rules:** User-defined rules for complex patterns
6. **Export Patterns:** Share patterns with other users
7. **Category Budgets:** Set budgets based on imported transactions

---

## 📝 Summary

This feature will transform the Budget tab from manual entry to intelligent import with learning capabilities. The system will:

1. **Parse** bank CSV files (multiple formats)
2. **Learn** patterns from user classifications
3. **Suggest** classifications for new transactions
4. **Prevent** duplicate imports
5. **Improve** accuracy over time

The key innovation is the pattern learning system that gets smarter with each import, reducing manual work while maintaining user control through review and confirmation steps.

