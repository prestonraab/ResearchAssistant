import { createMockClaim, createMockZoteroItem, createMockVerificationResult } from './mockFactories';
import type { Claim } from '@research-assistant/core';
import type { ZoteroItem, VerificationResult } from '../../mcp/mcpClient';

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
    source: 'Johnson2007',
    sourceId: 1,
    context: 'Assumes Gaussian distribution',
    primaryQuote: 'We propose parametric and non-parametric empirical Bayes frameworks for adjusting data for batch effects',
    supportingQuotes: [
      'Location and scale (L/S) adjustments can be defined as a wide family of adjustments',
      'The γ ig and δ ig represent the additive and multiplicative batch effects'
    ],
    verified: true
  }),

  result: createMockClaim({
    id: 'C_02',
    category: 'Result',
    text: 'ComBat improved classification accuracy by 15%',
    source: 'Zhang2020',
    sourceId: 2,
    context: 'Tested on tuberculosis dataset',
    primaryQuote: 'Batch correction with ComBat significantly improved model performance',
    supportingQuotes: ['Accuracy increased from 0.75 to 0.90'],
    verified: true
  }),

  challenge: createMockClaim({
    id: 'C_03',
    category: 'Challenge',
    text: 'Batch effects can confound biological signals',
    source: 'Leek2010',
    sourceId: 3,
    context: 'Major issue in genomics',
    primaryQuote: 'Batch effects are widespread and critical in high-throughput data',
    supportingQuotes: [],
    verified: false
  }),

  unverified: createMockClaim({
    id: 'C_04',
    category: 'Method',
    text: 'SVA removes unwanted variation',
    source: 'Leek2007',
    sourceId: 4,
    context: '',
    primaryQuote: 'Surrogate variable analysis captures heterogeneity',
    supportingQuotes: [],
    verified: false
  }),

  minimal: createMockClaim({
    id: 'C_05',
    category: '',
    text: 'Minimal claim with no details',
    source: '',
    sourceId: 0,
    context: '',
    primaryQuote: '',
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
    DOI: '10.1093/biostatistics/kxj037'
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
    DOI: '10.1093/nargab/lqaa078'
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
    DOI: '10.1038/nrg2825'
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
    similarity: 1.0
  }),

  highSimilarity: createMockVerificationResult({
    verified: false,
    similarity: 0.95,
    closestMatch: 'We propose parametric and nonparametric empirical Bayes frameworks',
    context: 'for adjusting data for batch effects that is robust to outliers'
  }),

  mediumSimilarity: createMockVerificationResult({
    verified: false,
    similarity: 0.75,
    closestMatch: 'Empirical Bayes methods are used for batch correction',
    context: 'in the context of microarray analysis'
  }),

  lowSimilarity: createMockVerificationResult({
    verified: false,
    similarity: 0.3,
    closestMatch: 'Statistical methods for genomics',
    context: 'various approaches exist'
  }),

  notFound: createMockVerificationResult({
    verified: false,
    similarity: 0,
    closestMatch: undefined,
    context: undefined
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
