/**
 * @research-assistant/core
 * 
 * Core library for the Research Assistant project.
 * Provides shared types, managers, services, and utilities for both
 * the MCP server and VS Code extension.
 * 
 * @packageDocumentation
 */

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Claim Models
 * 
 * Types related to research claims and their metadata.
 */
export type {
  Claim,
  ClaimType,
  PotentialClaim,
} from './types/index.js';

/**
 * Search Models
 * 
 * Types for search operations and results.
 */
export type {
  ClaimMatch,
  SearchResult,
  DraftAnalysis,
  SentenceAnalysis,
  GeneralizationMatch,
  MultiSourceResult,
} from './types/index.js';

/**
 * Coverage Models
 * 
 * Types for manuscript coverage analysis.
 */
export type {
  SentenceType,
  SentenceCoverage,
  SectionCoverage,
  ManuscriptCoverage,
  CoverageMetrics,
  CoverageReport,
} from './types/index.js';

/**
 * Outline Models
 * 
 * Types for manuscript outline structure.
 */
export type {
  OutlineSection,
  SectionTree,
} from './types/index.js';

/**
 * Paper Models
 * 
 * Types for research paper metadata and ranking.
 */
export type {
  PaperMetadata,
  RankedPaper,
  RankingConfig,
  ExternalPaper,
} from './types/index.js';

/**
 * Claim Strength Models
 * 
 * Types for analyzing claim support and strength.
 */
export type {
  SupportingClaim,
  ContradictoryClaim,
  ClaimStrengthResult,
} from './types/index.js';

/**
 * Synthesis Models
 * 
 * Types for synthesizing claims into paragraphs.
 */
export type {
  SynthesisStyle,
  SynthesisOptions,
  ClaimCluster,
  SectionSuggestion,
} from './types/index.js';

/**
 * Embedding Models
 * 
 * Types for text embeddings and caching.
 */
export type {
  EmbeddingVector,
  EmbeddingCacheEntry,
} from './types/index.js';

/**
 * Verification Models
 * 
 * Types for quote verification operations.
 */
export type {
  VerificationResult,
  QuoteMatch,
  QuoteVerificationResult,
  BatchVerificationResult,
  VerificationReport,
} from './types/index.js';

/**
 * Configuration Models
 * 
 * Types for workspace and user configuration.
 */
export type {
  WorkspaceConfiguration,
  UserPreferences,
} from './types/index.js';

/**
 * Performance Models
 * 
 * Types for performance monitoring and metrics.
 */
export type {
  PerformanceMetrics,
} from './types/index.js';

/**
 * Error Models
 * 
 * Types for error handling and reporting.
 */
export type {
  ErrorType,
  ErrorResponse,
  ErrorContext,
} from './types/index.js';

/**
 * Batch Operation Models
 * 
 * Types for batch processing operations.
 */
export type {
  BatchOperationResult,
  BatchProgress,
} from './types/index.js';

/**
 * Import/Export Models
 * 
 * Types for data import and export operations.
 */
export type {
  ExportFormat,
  ExportOptions,
  ImportProgress,
  ImportResult,
} from './types/index.js';

/**
 * Reading Status Models
 * 
 * Types for tracking paper reading progress.
 */
export type {
  ReadingStatus,
  ReadingProgress,
} from './types/index.js';

/**
 * Citation Network Models
 * 
 * Types for citation network analysis.
 */
export type {
  CitationNode,
  CitationCluster,
  NetworkMetrics,
} from './types/index.js';

/**
 * Manuscript Context Models
 * 
 * Types for manuscript context detection.
 */
export type {
  ManuscriptContext,
} from './types/index.js';

/**
 * Dashboard Models
 * 
 * Types for dashboard metrics and visualization.
 */
export type {
  DashboardMetrics,
  ActivityItem,
  CoverageTrendItem,
} from './types/index.js';

/**
 * Quick Claim Models
 * 
 * Types for quick claim creation workflows.
 */
export type {
  QuickClaimForm,
} from './types/index.js';

/**
 * Fulltext Status Models
 * 
 * Types for tracking fulltext availability.
 */
export type {
  FulltextStatus,
} from './types/index.js';

/**
 * Extraction Models
 * 
 * Types for PDF text extraction.
 */
export type {
  ExtractionResult,
} from './types/index.js';

// ============================================================================
// Manager Exports
// ============================================================================

/**
 * Claims Manager
 * 
 * Handles loading and querying claims from the workspace.
 */
export { ClaimsManager } from './managers/ClaimsManager.js';

// ============================================================================
// Service Exports
// ============================================================================

/**
 * Embedding Service
 * 
 * Generates and caches text embeddings using OpenAI API.
 */
export { EmbeddingService } from './services/EmbeddingService.js';

/**
 * Search Service
 * 
 * Performs semantic search across claims database.
 */
export { SearchService } from './services/SearchService.js';

/**
 * Coverage Analyzer
 * 
 * Analyzes literature coverage at the sentence level.
 */
export { CoverageAnalyzer } from './services/CoverageAnalyzer.js';

/**
 * Claim Strength Calculator
 * 
 * Calculates how well claims are supported across sources.
 */
export { ClaimStrengthCalculator } from './services/ClaimStrengthCalculator.js';

/**
 * Paper Ranker
 * 
 * Ranks papers by relevance to sections or queries.
 */
export { PaperRanker } from './services/PaperRanker.js';

/**
 * Claim Extractor
 * 
 * Extracts potential claims from paper text and suggests relevant sections.
 */
export { ClaimExtractor } from './services/ClaimExtractor.js';

/**
 * Synthesis Engine
 * 
 * Generates coherent prose from multiple related claims.
 */
export { SynthesisEngine } from './services/SynthesisEngine.js';

/**
 * Search Query Generator
 * 
 * Generates targeted search queries for outline sections.
 */
export { SearchQueryGenerator } from './services/SearchQueryGenerator.js';

// ============================================================================
// Parser Exports
// ============================================================================

/**
 * Outline Parser
 * 
 * Parses markdown outline files and extracts hierarchical sections.
 */
export { OutlineParser } from './parsers/OutlineParser.js';

// ============================================================================
// Future Exports (Services, Utils)
// ============================================================================

// Note: The following exports will be added as we migrate code from
// the MCP server and extension to the core library:
//
// Services:
// - export { SearchService } from './services/SearchService.js';
// - export { CoverageAnalyzer } from './services/CoverageAnalyzer.js';
// - export { ClaimStrengthCalculator } from './services/ClaimStrengthCalculator.js';
// - export { PaperRanker } from './services/PaperRanker.js';
// - export { ClaimExtractor } from './services/ClaimExtractor.js';
// - export { SynthesisEngine } from './services/SynthesisEngine.js';
// - export { SearchQueryGenerator } from './services/SearchQueryGenerator.js';
//
// Utils:
// - export { normalizeText, cleanQuote } from './utils/text.js';
// - export { validateClaim, validateSection } from './utils/validation.js';
