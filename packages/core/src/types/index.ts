/**
 * Core type definitions for the Research Assistant
 * 
 * This file contains all shared types used across the MCP server and VS Code extension.
 * Types are organized by domain for clarity.
 */

// ============================================================================
// Zotero Integration Models
// ============================================================================

/**
 * Metadata for quotes imported from Zotero highlights
 * Stores annotation key, highlight color, and import information for bidirectional linking
 * 
 * @see Requirements 3.1, 3.2, 8.1, 8.6 - Zotero PDF Integration
 */
export interface ZoteroQuoteMetadata {
  annotationKey: string;         // Zotero annotation key for bidirectional linking (immutable)
  highlightColor: string;        // Hex color code (e.g., "#ffff00" for yellow)
  importedAt: string;            // ISO timestamp of when the highlight was imported
  fromZotero: boolean;           // Flag indicating quote originated from Zotero (for search prioritization)
  matchConfidence?: number;      // Fuzzy match confidence score (0-1), undefined if exact match
  originalText?: string;         // Original Zotero text if different from matched text
  itemKey?: string;              // Zotero item key for the parent PDF (for deep linking)
}

/**
 * Zotero annotation data structure for import processing
 * Represents a highlight annotation from Zotero's PDF reader
 */
export interface ZoteroAnnotation {
  key: string;                   // Unique annotation key
  type: 'highlight' | 'note' | 'image' | 'ink' | 'underline';  // Annotation type
  text: string;                  // Highlighted/annotated text
  color: string;                 // Highlight color (hex code)
  pageNumber: number;            // Page number in PDF (1-indexed)
  position: ZoteroAnnotationPosition;  // Position information
  dateModified: string;          // ISO timestamp of last modification
  parentItemKey: string;         // Key of the parent PDF attachment
}

/**
 * Position information for a Zotero annotation
 */
export interface ZoteroAnnotationPosition {
  pageIndex: number;             // Page index (0-indexed)
  rects: number[][];             // Bounding rectangles [[x1, y1, x2, y2], ...]
}

/**
 * Result of fuzzy matching a Zotero highlight against extracted text
 */
export interface FuzzyMatchResult {
  matched: boolean;              // Whether a match was found above threshold
  startOffset?: number;          // Start character offset in document text
  endOffset?: number;            // End character offset in document text
  confidence: number;            // Match confidence score (0-1)
  matchedText?: string;          // The matched text from the document
}

// ============================================================================
// Claim Models
// ============================================================================

/**
 * A quote with its source information
 */
export interface SourcedQuote {
  text: string;                  // Quote text
  source: string;                // Source reference (e.g., "Smith2020")
  sourceId?: number;             // Numeric source identifier
  pageNumber?: number;           // Page number in source
  verified: boolean;             // Whether quote verified in source
  confidence?: number;           // Confidence score (0-1) from verification feedback loop
  metadata?: {                   // Optional metadata about quote location
    sourceFile?: string;         // Filename in literature/ExtractedText
    startLine?: number;          // Starting line number in source file
    endLine?: number;            // Ending line number in source file
  };
  
  // Zotero integration fields (Requirements 3.1, 3.2, 8.1, 8.6)
  startOffset?: number;          // Start character offset in source document
  endOffset?: number;            // End character offset in source document
  zoteroMetadata?: ZoteroQuoteMetadata;  // Zotero-specific metadata for imported highlights
}

/**
 * Represents a research claim with supporting evidence
 */
export interface Claim {
  id: string;                    // Unique identifier (e.g., "C_01")
  text: string;                  // The claim statement
  category: string;              // Category (e.g., "Method", "Result")
  context: string;               // Additional context
  primaryQuote: SourcedQuote;    // Main supporting quote with source
  supportingQuotes: SourcedQuote[];  // Additional supporting quotes with sources
  sections: string[];            // Associated outline sections
  verified: boolean;             // Overall verification status
  createdAt: Date;               // Creation timestamp
  modifiedAt: Date;              // Last modification timestamp
}

/**
 * Tracks sentence-claim-quote relationships and citation status
 * Used to mark specific quotes from claims as "to be cited" for particular sentences
 */
export interface SentenceClaimQuoteLink {
  sentenceId: string;            // Sentence identifier
  claimId: string;               // Claim identifier
  quoteIndex: number;            // Index of quote in claim (0 = primary, 1+ = supporting)
  citedForFinal: boolean;        // Whether this quote should be cited in final version
  createdAt: Date;               // Creation timestamp
  updatedAt: Date;               // Last modification timestamp
}

/**
 * Types of claims that can be extracted
 */
export type ClaimType = 
  | 'method' 
  | 'result' 
  | 'conclusion' 
  | 'background' 
  | 'challenge' 
  | 'data_source' 
  | 'data_trend' 
  | 'impact' 
  | 'application' 
  | 'phenomenon';

/**
 * A potential claim extracted from text
 */
export interface PotentialClaim {
  text: string;                  // The claim text
  context: string;               // Surrounding context
  confidence: number;            // Confidence score (0-1)
  type: ClaimType;               // Claim type
  lineNumber: number;            // Line number in source
}

// ============================================================================
// Search Models
// ============================================================================

/**
 * A claim that matches a search query
 */
export interface ClaimMatch {
  claimId: string;               // Claim identifier
  claimText: string;             // Claim text
  source: string;                // Source reference
  similarity: number;            // Similarity score (0-1)
  primaryQuote: string;          // Supporting quote
}

/**
 * Generic search result (used by unified search)
 */
export interface SearchResult {
  type: 'paper' | 'claim' | 'draft' | 'extracted_text';
  id: string;                    // Unique identifier
  title: string;                 // Display title
  snippet: string;               // Preview text
  relevance: number;             // Relevance score (0-1)
  metadata?: Record<string, unknown>;  // Additional metadata
}

/**
 * Analysis of a draft text
 */
export interface DraftAnalysis {
  sentences: SentenceAnalysis[]; // Per-sentence analysis
  needsNewPapers: boolean;       // Whether new papers are needed
  suggestedSearches: string[];   // Suggested search queries
}

/**
 * Analysis of a single sentence
 */
export interface SentenceAnalysis {
  text: string;                  // Sentence text
  supported: boolean;            // Whether claim support exists
  matchingClaims: ClaimMatch[];  // Matching claims
  requiresMultipleSources: boolean;  // Whether multiple sources needed
}

/**
 * A match for a generalization keyword
 */
export interface GeneralizationMatch {
  sentence: string;              // Sentence containing keyword
  keyword: string;               // The keyword matched
  position: number;              // Position in text
}

/**
 * Result of multi-source support search
 */
export interface MultiSourceResult {
  statement: string;             // The statement being checked
  supportingClaims: ClaimMatch[]; // Supporting claims
  sourceCount: number;           // Number of unique sources
  sufficient: boolean;           // Whether support is sufficient
  needsReviewPaper: boolean;     // Whether a review paper is needed
}

// ============================================================================
// Coverage Models
// ============================================================================

/**
 * Types of sentences in manuscript
 */
export type SentenceType = 'factual' | 'opinion' | 'transition' | 'question';

/**
 * Coverage analysis for a single sentence
 */
export interface SentenceCoverage {
  text: string;                  // Sentence text
  type: SentenceType;            // Sentence type
  supported: boolean;            // Whether supported by claims
  matchingClaims: ClaimMatch[];  // Matching claims
  suggestedSearches: string[];   // Suggested searches
}

/**
 * Coverage analysis for a section
 */
export interface SectionCoverage {
  sectionId: string;             // Section identifier
  sectionTitle: string;          // Section title
  totalSentences: number;        // Total sentence count
  factualSentences: number;      // Factual sentence count
  supportedSentences: number;    // Supported sentence count
  coveragePercentage: number;    // Coverage percentage (0-100)
  sentenceDetails: SentenceCoverage[];  // Per-sentence details
}

/**
 * Coverage analysis for entire manuscript
 */
export interface ManuscriptCoverage {
  totalSections: number;         // Total section count
  averageCoverage: number;       // Average coverage percentage
  sections: SectionCoverage[];   // Per-section coverage
  weakestSections: SectionCoverage[];  // Sections needing work
}

/**
 * Simple coverage metrics
 */
export interface CoverageMetrics {
  sectionId: string;             // Section identifier
  claimCount: number;            // Number of claims
  coveragePercentage: number;    // Coverage percentage
}

/**
 * Coverage report summary
 */
export interface CoverageReport {
  totalSections: number;         // Total sections
  sectionsWithNoCoverage: number; // Sections without claims
  averageCoverage: number;       // Average coverage
  metrics: CoverageMetrics[];    // Per-section metrics
}

// ============================================================================
// Outline Models
// ============================================================================

/**
 * A section in the manuscript outline
 */
export interface OutlineSection {
  id: string;                    // Section identifier (e.g., "2.1")
  title: string;                 // Section heading
  level: number;                 // Heading level (1-6)
  lineStart: number;             // Start line in file
  lineEnd: number;               // End line in file
  content: string[];             // Section content lines
}

/**
 * Hierarchical section tree (for nested sections)
 */
export interface SectionTree {
  section: OutlineSection;       // The section
  children: SectionTree[];       // Child sections
}

// ============================================================================
// Paper Models
// ============================================================================

/**
 * Metadata for a research paper
 */
export interface PaperMetadata {
  itemKey: string;               // Zotero item key
  title: string;                 // Paper title
  authors: string[];             // Author list
  year: number;                  // Publication year
  abstract: string;              // Abstract text
  citationCount?: number;        // Citation count
  pageCount?: number;            // Number of pages
  wordCount?: number;            // Word count
}

/**
 * A paper ranked by relevance
 */
export interface RankedPaper {
  paper: PaperMetadata;          // Paper metadata
  relevanceScore: number;        // Overall relevance score
  semanticSimilarity: number;    // Semantic similarity score
  citationBoost: number;         // Citation boost factor
  estimatedReadingTime: number;  // Estimated reading time (minutes)
}

/**
 * Configuration for paper ranking
 */
export interface RankingConfig {
  citationBoostFactor: number;   // Multiplier for citation boost
  citationThreshold: number;     // Minimum citations for boost
  recencyWeight: number;         // Weight for recent papers
}

/**
 * External paper from internet search
 */
export interface ExternalPaper {
  title: string;                 // Paper title
  authors: string[];             // Author list
  year?: number;                 // Publication year
  abstract?: string;             // Abstract text
  url?: string;                  // Paper URL
  doi?: string;                  // DOI
}

// ============================================================================
// Claim Strength Models
// ============================================================================

/**
 * A claim that supports another claim
 */
export interface SupportingClaim {
  claimId: string;               // Claim identifier
  source: string;                // Source reference
  similarity: number;            // Similarity score
}

/**
 * A claim that contradicts another claim
 */
export interface ContradictoryClaim {
  claimId: string;               // Claim identifier
  source: string;                // Source reference
  similarity: number;            // Similarity score
  sentimentOpposition: boolean;  // Whether sentiment opposes
}

/**
 * Result of claim strength analysis
 */
export interface ClaimStrengthResult {
  claimId: string;               // Claim identifier
  strengthScore: number;         // Strength score (0-1)
  supportingClaims: SupportingClaim[];  // Supporting claims
  contradictoryClaims: ContradictoryClaim[];  // Contradictory claims
}

// ============================================================================
// Synthesis Models
// ============================================================================

/**
 * Writing style for synthesis
 */
export type SynthesisStyle = 'narrative' | 'analytical' | 'descriptive';

/**
 * Options for paragraph synthesis
 */
export interface SynthesisOptions {
  claims: Claim[];               // Claims to synthesize
  style: SynthesisStyle;         // Writing style
  includeCitations: boolean;     // Whether to include citations
  maxLength: number;             // Maximum length (characters)
}

/**
 * A cluster of related claims
 */
export interface ClaimCluster {
  theme: string;                 // Theme description
  claims: Claim[];               // Claims in cluster
  coherence: number;             // Cluster coherence score
}

/**
 * Suggestion for section placement
 */
export interface SectionSuggestion {
  sectionId: string;             // Section identifier
  sectionTitle: string;          // Section title
  similarity: number;            // Similarity score
}

// ============================================================================
// Embedding Models
// ============================================================================

/**
 * An embedding vector with metadata
 */
export interface EmbeddingVector {
  text: string;                  // Original text
  vector: number[];              // Embedding vector
  timestamp?: Date;              // Generation timestamp
}

/**
 * Cache entry for embeddings
 */
export interface EmbeddingCacheEntry {
  text: string;                  // Original text
  vector: number[];              // Embedding vector
  timestamp: Date;               // Cache timestamp
  accessCount: number;           // Number of accesses
  lastAccessed: Date;            // Last access time
}

// ============================================================================
// Verification Models
// ============================================================================

/**
 * Result of quote verification
 */
export interface VerificationResult {
  verified: boolean;             // Whether quote verified
  similarity: number;            // Similarity score
  nearestMatch?: string;         // Nearest matching text
  confidence: number;            // Confidence score
}

/**
 * A matching quote from source
 */
export interface QuoteMatch {
  quote: string;                 // Quote text
  source: string;                // Source reference
  similarity: number;            // Similarity score
}

/**
 * Result of quote verification for a claim
 */
export interface QuoteVerificationResult {
  claimId: string;               // Claim identifier
  verified: boolean;             // Whether verified
  primaryQuoteVerified: boolean; // Primary quote verified
  supportingQuotesVerified: number;  // Number of supporting quotes verified
  details: VerificationResult[]; // Detailed results
}

/**
 * Batch verification results
 */
export interface BatchVerificationResult {
  totalClaims: number;           // Total claims checked
  totalQuotes: number;           // Total quotes checked
  verifiedQuotes: number;        // Verified quotes
  failedQuotes: number;          // Failed quotes
  results: QuoteVerificationResult[];  // Per-claim results
}

/**
 * Verification report summary
 */
export interface VerificationReport {
  totalQuotes: number;           // Total quotes
  verified: number;              // Verified count
  failed: number;                // Failed count
  pending: number;               // Pending count
  bySource: Record<string, { verified: number; total: number }>;  // By source
}

// ============================================================================
// Configuration Models
// ============================================================================

/**
 * Workspace configuration
 */
export interface WorkspaceConfiguration {
  workspaceRoot: string;         // Workspace root path
  outlinePath: string;           // Outline file path
  manuscriptPath: string;        // Manuscript file path
  claimsPath: string;            // Claims file/directory path
  extractedTextPath: string;     // Extracted text directory
}

/**
 * User preferences
 */
export interface UserPreferences {
  citationStyle: string;         // Citation style
  coverageThresholds: {
    minimum: number;             // Minimum coverage threshold
    target: number;              // Target coverage threshold
  };
  embeddingModel: string;        // Embedding model name
  similarityThreshold: number;   // Default similarity threshold
}

// ============================================================================
// Performance Models
// ============================================================================

/**
 * Performance metrics for an operation
 */
export interface PerformanceMetrics {
  operation: string;             // Operation name
  duration: number;              // Duration (milliseconds)
  timestamp: Date;               // Timestamp
  metadata?: Record<string, unknown>;  // Additional metadata
}

// ============================================================================
// Error Models
// ============================================================================

/**
 * Error types
 */
export type ErrorType = 
  | 'FILE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PROCESSING_ERROR'
  | 'EMPTY_RESULT'
  | 'API_ERROR'
  | 'NETWORK_ERROR';

/**
 * Error response
 */
export interface ErrorResponse {
  error: string;                 // Error type
  message: string;               // Error message
  context?: Record<string, unknown>;  // Error context
  suggestions?: string[];        // Suggested fixes
}

/**
 * Error context for logging
 */
export interface ErrorContext {
  operation: string;             // Operation name
  component: string;             // Component name
  details?: Record<string, unknown>;  // Additional details
}

// ============================================================================
// Batch Operation Models
// ============================================================================

/**
 * Result of a batch operation
 */
export interface BatchOperationResult<T> {
  successful: T[];               // Successful items
  failed: Array<{ item: T; error: string }>;  // Failed items
  totalProcessed: number;        // Total processed
  duration: number;              // Duration (milliseconds)
}

/**
 * Progress of a batch operation
 */
export interface BatchProgress {
  current: number;               // Current item
  total: number;                 // Total items
  percentage: number;            // Percentage complete
  stage?: string;                // Current stage
}

// ============================================================================
// Import/Export Models
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'markdown' | 'csv' | 'json' | 'bibtex';

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;          // Export format
  outputPath: string;            // Output file path
  includeMetadata?: boolean;     // Include metadata
  filterBySection?: string[];    // Filter by sections
}

/**
 * Import progress
 */
export interface ImportProgress {
  stage: 'papers' | 'extraction' | 'analysis' | 'parsing' | 'complete';
  current: number;               // Current item
  total: number;                 // Total items
  message?: string;              // Progress message
}

/**
 * Import result
 */
export interface ImportResult {
  papersImported: number;        // Papers imported
  textsExtracted: number;        // Texts extracted
  claimsCreated: number;         // Claims created
  errors: string[];              // Errors encountered
}

// ============================================================================
// Reading Status Models
// ============================================================================

/**
 * Reading status for a paper
 */
export type ReadingStatus = 'to-read' | 'reading' | 'read';

/**
 * Reading progress for a paper
 */
export interface ReadingProgress {
  status: ReadingStatus;         // Reading status
  startedAt?: Date;              // Started reading date
  completedAt?: Date;            // Completed reading date
  notes?: string;                // Reading notes
  rating?: number;               // Paper rating (1-5)
}

// ============================================================================
// Citation Network Models
// ============================================================================

/**
 * A node in the citation network
 */
export interface CitationNode {
  paperId: string;               // Paper identifier
  title: string;                 // Paper title
  authors: string[];             // Authors
  year: number;                  // Publication year
  citationCount: number;         // Citation count
  connections: string[];         // Connected paper IDs
}

/**
 * A cluster in the citation network
 */
export interface CitationCluster {
  nodes: CitationNode[];         // Nodes in cluster
  centralPapers: string[];       // Central papers
  theme?: string;                // Cluster theme
}

/**
 * Citation network metrics
 */
export interface NetworkMetrics {
  totalPapers: number;           // Total papers
  totalCitations: number;        // Total citations
  averageCitations: number;      // Average citations per paper
  clusters: number;              // Number of clusters
}

// ============================================================================
// Manuscript Context Models
// ============================================================================

/**
 * Context information for current manuscript position
 */
export interface ManuscriptContext {
  currentSection: OutlineSection | null;  // Current section
  sectionText: string;           // Section text
  coverage: SectionCoverage | null;  // Section coverage
  relevantClaims: Claim[];       // Relevant claims
}

// ============================================================================
// Dashboard Models
// ============================================================================

/**
 * Dashboard metrics
 */
export interface DashboardMetrics {
  papersTotal: number;           // Total papers
  papersRead: number;            // Papers read
  claimsTotal: number;           // Total claims
  claimsVerified: number;        // Verified claims
  averageCoverage: number;       // Average coverage
  sectionsComplete: number;      // Complete sections
  sectionsTotal: number;         // Total sections
}

/**
 * Activity item for dashboard
 */
export interface ActivityItem {
  type: 'paper_read' | 'claim_added' | 'claim_verified';
  timestamp: Date;               // Activity timestamp
  details: string;               // Activity details
}

/**
 * Coverage trend item
 */
export interface CoverageTrendItem {
  date: string;                  // Date
  papersRead: number;            // Papers read
  claimsAdded: number;           // Claims added
  coverage: number;              // Coverage percentage
}

// ============================================================================
// Quick Claim Models
// ============================================================================

/**
 * Form data for quick claim creation
 */
export interface QuickClaimForm {
  claimText: string;             // Claim text (pre-filled)
  category: string;              // Category (auto-detected)
  source: string;                // Source (from context)
  primaryQuote: string;          // Primary quote (from selection)
  sections: string[];            // Sections (from context)
}

// ============================================================================
// Fulltext Status Models
// ============================================================================

/**
 * Fulltext availability status
 */
export interface FulltextStatus {
  itemKey: string;               // Zotero item key
  hasFulltext: boolean;          // Whether fulltext available
  extractedPath?: string;        // Path to extracted text
  lastChecked: Date;             // Last check timestamp
}

// ============================================================================
// Extraction Models
// ============================================================================

/**
 * Result of PDF extraction
 */
export interface ExtractionResult {
  success: boolean;              // Whether extraction succeeded
  outputPath?: string;           // Output file path
  error?: string;                // Error message
  pageCount?: number;            // Number of pages
  wordCount?: number;            // Word count
}

// ============================================================================
// Zotero Sync Models
// ============================================================================

/**
 * State for Zotero highlight synchronization
 * Persisted across extension restarts
 * 
 * @see Requirements 5.1, 5.9 - Zotero PDF Integration
 */
export interface ZoteroSyncState {
  lastSyncTimestamp: string | null;  // ISO timestamp of last successful sync
  syncEnabled: boolean;              // Whether automatic sync is enabled
  syncIntervalMinutes: number;       // Sync interval in minutes (default: 15)
  lastSyncStatus: 'success' | 'error' | 'in_progress' | 'never';  // Status of last sync
  lastError?: string;                // Error message from last failed sync
  retryCount?: number;               // Current retry count for exponential backoff
}

/**
 * Audit log entry for deleted quotes with Zotero annotation keys
 * Retained for potential future reconciliation
 * 
 * @see Requirements 8.3 - Zotero PDF Integration
 */
export interface ZoteroAnnotationAuditEntry {
  annotationKey: string;             // The Zotero annotation key
  quoteId: string;                   // Original quote identifier
  quoteText: string;                 // The quote text at time of deletion
  paperId: string;                   // Associated paper identifier
  deletedAt: string;                 // ISO timestamp of deletion
  deletedBy?: string;                // User or process that deleted the quote
  reason?: string;                   // Reason for deletion (if provided)
}

/**
 * Zotero annotation key validation result
 * 
 * @see Requirements 8.2 - Zotero PDF Integration
 */
export interface AnnotationKeyValidation {
  valid: boolean;                    // Whether the key is valid
  key: string;                       // The key that was validated
  error?: string;                    // Error message if invalid
}

/**
 * Result of importing Zotero highlights
 */
export interface ZoteroImportResult {
  totalHighlights: number;           // Total highlights found
  imported: number;                  // Successfully imported count
  matched: number;                   // Highlights with successful fuzzy match
  unmatched: number;                 // Highlights without fuzzy match (warning)
  skipped: number;                   // Skipped (already imported or invalid)
  errors: string[];                  // Error messages
  quoteIds: string[];                // IDs of created quotes
}

/**
 * Options for Zotero highlight import
 */
export interface ZoteroImportOptions {
  paperId: string;                   // Paper to import highlights for
  itemKey: string;                   // Zotero item key for the PDF
  skipExisting?: boolean;            // Skip highlights already imported (default: true)
  matchThreshold?: number;           // Fuzzy match threshold (default: 0.85)
}
