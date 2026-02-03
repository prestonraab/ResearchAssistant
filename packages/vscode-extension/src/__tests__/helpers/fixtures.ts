import { createMockClaim, createMockZoteroItem, createMockVerificationResult } from './mockFactories';
import type { Claim } from '@research-assistant/core';
import type { ZoteroItem, VerificationResult } from '@research-assistant/core';

/**
 * Shared test fixtures for common test scenarios
 * Use these for consistent test data across test files
 */

// ============================================================================
// Claim Fixtures
// ============================================================================

export const TEST_CLAIMS: Record<string, Claim> = {
  method: createMockClaim({
    id: 'C_01',
    category: 'Method',
    text: 'ComBat uses Empirical Bayes to estimate location and scale parameters',
    context: 'Assumes Gaussian distribution',
    primaryQuote: { text: 'We propose parametric and non-parametric empirical Bayes frameworks for adjusting data for batch effects', source: 'Johnson2007', verified: false },
    supportingQuotes: [
      { text: 'Location and scale (L/S) adjustments can be defined as a wide family of adjustments', source: 'Johnson2007', verified: false },
      { text: 'The γ ig and δ ig represent the additive and multiplicative batch effects', source: 'Johnson2007', verified: false }
    ],
    verified: true
  }),

  result: createMockClaim({
    id: 'C_02',
    category: 'Result',
    text: 'ComBat improved classification accuracy by 15%',
    context: 'Tested on tuberculosis dataset',
    primaryQuote: { text: 'Batch correction with ComBat significantly improved model performance', source: 'Zhang2020', verified: false },
    supportingQuotes: [{ text: 'Accuracy increased from 0.75 to 0.90', source: 'Zhang2020', verified: false }],
    verified: true
  }),

  challenge: createMockClaim({
    id: 'C_03',
    category: 'Challenge',
    text: 'Batch effects can confound biological signals',
    context: 'Major issue in genomics',
    primaryQuote: { text: 'Batch effects are widespread and critical in high-throughput data', source: 'Leek2010', verified: false },
    supportingQuotes: [],
    verified: false
  }),

  unverified: createMockClaim({
    id: 'C_04',
    category: 'Method',
    text: 'SVA removes unwanted variation',
    context: '',
    primaryQuote: { text: 'Surrogate variable analysis captures heterogeneity', source: 'Leek2007', verified: false },
    supportingQuotes: [],
    verified: false
  }),

  minimal: createMockClaim({
    id: 'C_05',
    category: '',
    text: 'Minimal claim with no details',
    context: '',
    primaryQuote: { text: '', source: '', verified: false },
    supportingQuotes: [],
    verified: false
  })
};

// ============================================================================
// Zotero Item Fixtures
// ============================================================================

export const TEST_ZOTERO_ITEMS: Record<string, ZoteroItem> = {
  johnson2007: createMockZoteroItem({
    key: 'JOHNSON2007',
    title: 'Adjusting batch effects in microarray expression data using empirical Bayes methods',
    creators: [
      { firstName: 'W. Evan', lastName: 'Johnson' },
      { firstName: 'Cheng', lastName: 'Li' },
      { firstName: 'Ariel', lastName: 'Rabinovic' }
    ],
    date: '2007',
    itemType: 'journalArticle',
    abstractNote: 'Non-biological experimental variation or "batch effects" are commonly observed across multiple batches of microarray experiments',
    doi: '10.1093/biostatistics/kxj037'
  }),

  zhang2020: createMockZoteroItem({
    key: 'ZHANG2020',
    title: 'ComBat-seq: batch effect adjustment for RNA-seq count data',
    creators: [
      { firstName: 'Yuqing', lastName: 'Zhang' },
      { firstName: 'Giovanni', lastName: 'Parmigiani' },
      { firstName: 'W. Evan', lastName: 'Johnson' }
    ],
    date: '2020',
    itemType: 'journalArticle',
    abstractNote: 'Batch effects are technical sources of variation that have been widely observed in high-throughput experiments',
    doi: '10.1093/nargab/lqaa078'
  }),

  leek2010: createMockZoteroItem({
    key: 'LEEK2010',
    title: 'Tackling the widespread and critical impact of batch effects in high-throughput data',
    creators: [
      { firstName: 'Jeffrey T.', lastName: 'Leek' },
      { firstName: 'Robert B.', lastName: 'Scharpf' },
      { firstName: 'Héctor', lastName: 'Corrada Bravo' }
    ],
    date: '2010',
    itemType: 'journalArticle',
    abstractNote: 'High-throughput technologies are widely used, for example to assay genetic variants, gene and protein expression',
    doi: '10.1038/nrg2825'
  }),

  book: createMockZoteroItem({
    key: 'BOOK001',
    title: 'Statistical Methods in Bioinformatics',
    creators: [
      { firstName: 'Warren J.', lastName: 'Ewens' },
      { firstName: 'Gregory R.', lastName: 'Grant' }
    ],
    date: '2005',
    itemType: 'book',
    abstractNote: 'An introduction to statistics for bioinformatics'
  }),

  preprint: createMockZoteroItem({
    key: 'PREPRINT001',
    title: 'Novel batch correction method for single-cell RNA-seq',
    creators: [{ firstName: 'Jane', lastName: 'Doe' }],
    date: '2024',
    itemType: 'preprint',
    abstractNote: 'We present a new approach to batch correction'
  })
};

// ============================================================================
// Verification Result Fixtures
// ============================================================================

export const TEST_VERIFICATION_RESULTS: Record<string, VerificationResult> = {
  verified: createMockVerificationResult({
    verified: true,
    similarity: 1.0,
    confidence: 1.0
  }),

  highSimilarity: createMockVerificationResult({
    verified: false,
    similarity: 0.95,
    confidence: 0.95,
    nearestMatch: 'We propose parametric and nonparametric empirical Bayes frameworks'
  }),

  mediumSimilarity: createMockVerificationResult({
    verified: false,
    similarity: 0.75,
    confidence: 0.75,
    nearestMatch: 'Empirical Bayes methods are used for batch correction'
  }),

  lowSimilarity: createMockVerificationResult({
    verified: false,
    similarity: 0.3,
    confidence: 0.3,
    nearestMatch: 'Statistical methods for genomics'
  }),

  notFound: createMockVerificationResult({
    verified: false,
    similarity: 0,
    confidence: 0,
    nearestMatch: undefined
  })
};

// ============================================================================
// Collection Fixtures
// ============================================================================

export const TEST_CLAIM_COLLECTIONS = {
  methods: [TEST_CLAIMS.method, TEST_CLAIMS.unverified],
  results: [TEST_CLAIMS.result],
  verified: [TEST_CLAIMS.method, TEST_CLAIMS.result],
  unverified: [TEST_CLAIMS.challenge, TEST_CLAIMS.unverified],
  withQuotes: [TEST_CLAIMS.method, TEST_CLAIMS.result, TEST_CLAIMS.challenge],
  empty: [] as Claim[]
};

export const TEST_ZOTERO_COLLECTIONS = {
  articles: [TEST_ZOTERO_ITEMS.johnson2007, TEST_ZOTERO_ITEMS.zhang2020, TEST_ZOTERO_ITEMS.leek2010],
  books: [TEST_ZOTERO_ITEMS.book],
  recent: [TEST_ZOTERO_ITEMS.preprint, TEST_ZOTERO_ITEMS.zhang2020],
  empty: [] as ZoteroItem[]
};

// ============================================================================
// Markdown Content Fixtures
// ============================================================================

export const TEST_MARKDOWN_CONTENT = {
  singleClaim: `## C_01: ComBat uses Empirical Bayes

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  

**Primary Quote**:
> "We propose parametric and non-parametric empirical Bayes frameworks"

---
`,

  multipleClaims: `## C_01: First claim

**Category**: Method  

---

## C_02: Second claim

**Category**: Result  

---
`,

  claimWithReferences: `This is a sentence with a claim reference C_01 in the middle.

Another paragraph mentioning C_02 and C_03.`,

  empty: '',

  noClaimReferences: `This is a document with no claim references.

Just regular text here.`
};

// ============================================================================
// Error Fixtures
// ============================================================================

export const TEST_ERRORS = {
  networkError: new Error('Network request failed'),
  timeoutError: new Error('Request timeout'),
  validationError: new Error('Validation failed'),
  notFoundError: new Error('Resource not found'),
  unauthorizedError: new Error('Unauthorized'),
  forbiddenError: new Error('Forbidden'),
  conflictError: new Error('Resource conflict'),
  serverError: new Error('Internal server error'),
  serviceUnavailableError: new Error('Service unavailable')
};

// ============================================================================
// Response Fixtures
// ============================================================================

export const TEST_API_RESPONSES = {
  successResponse: { status: 'success', data: 'test' },
  errorResponse: { status: 'error', message: 'Test error' },
  emptyResponse: {},
  paginatedResponse: {
    items: [TEST_ZOTERO_ITEMS.johnson2007],
    page: 1,
    pageSize: 10,
    total: 100
  },
  batchResponse: {
    results: [
      { id: 1, status: 'success', data: 'result1' },
      { id: 2, status: 'error', error: 'Failed' }
    ],
    successful: 1,
    failed: 1
  }
};

// ============================================================================
// Configuration Fixtures
// ============================================================================

export const TEST_CONFIGURATIONS = {
  default: {
    'outlinePath': '03_Drafting/outline.md',
    'claimsDatabasePath': '01_Knowledge_Base/claims_and_evidence.md',
    'extractedTextPath': 'literature/ExtractedText',
    'coverageThresholds': { low: 3, moderate: 6, strong: 7 },
    'embeddingCacheSize': 1000
  },
  minimal: {
    'outlinePath': 'outline.md',
    'claimsDatabasePath': 'claims.md'
  },
  custom: {
    'outlinePath': 'custom/outline.md',
    'claimsDatabasePath': 'custom/claims.md',
    'extractedTextPath': 'custom/extracted',
    'coverageThresholds': { low: 5, moderate: 10, strong: 15 },
    'embeddingCacheSize': 5000
  }
};

// ============================================================================
// Document Fixtures
// ============================================================================

export const TEST_DOCUMENTS = {
  simple: {
    uri: 'file:///test/simple.md',
    fileName: 'simple.md',
    isUntitled: false,
    languageId: 'markdown',
    version: 1,
    isDirty: false,
    isClosed: false,
    lineCount: 5,
    getText: () => '# Title\n\nContent here.'
  },
  withClaims: {
    uri: 'file:///test/claims.md',
    fileName: 'claims.md',
    isUntitled: false,
    languageId: 'markdown',
    version: 1,
    isDirty: false,
    isClosed: false,
    lineCount: 10,
    getText: () => 'This references C_01 and C_02.'
  },
  empty: {
    uri: 'file:///test/empty.md',
    fileName: 'empty.md',
    isUntitled: false,
    languageId: 'markdown',
    version: 1,
    isDirty: false,
    isClosed: false,
    lineCount: 0,
    getText: () => ''
  }
};

// ============================================================================
// Search Query Fixtures
// ============================================================================

export const TEST_SEARCH_QUERIES = {
  simple: 'batch effects',
  complex: 'batch effects AND correction',
  withAuthor: 'batch effects author:Johnson',
  withYear: 'batch effects year:2007',
  withDOI: 'doi:10.1093/biostatistics/kxj037',
  empty: '',
  special: 'test & special | characters'
};

// ============================================================================
// Embedding Fixtures
// ============================================================================

export const TEST_EMBEDDINGS = {
  single: new Array(1536).fill(0).map(() => Math.random()),
  batch: Array.from({ length: 3 }, () => 
    new Array(1536).fill(0).map(() => Math.random())
  ),
  similar: [
    new Array(1536).fill(0.5),
    new Array(1536).fill(0.5)
  ],
  dissimilar: [
    new Array(1536).fill(0),
    new Array(1536).fill(1)
  ]
};

// ============================================================================
// Event Fixtures
// ============================================================================

export const TEST_EVENTS = {
  claimCreated: { type: 'claim.created', data: { claimId: 'C_01' } },
  claimUpdated: { type: 'claim.updated', data: { claimId: 'C_01' } },
  claimDeleted: { type: 'claim.deleted', data: { claimId: 'C_01' } },
  paperAdded: { type: 'paper.added', data: { paperId: 'PAPER001' } },
  paperRemoved: { type: 'paper.removed', data: { paperId: 'PAPER001' } },
  syncStarted: { type: 'sync.started', data: {} },
  syncCompleted: { type: 'sync.completed', data: { itemsProcessed: 10 } },
  syncFailed: { type: 'sync.failed', data: { error: 'Network error' } }
};
