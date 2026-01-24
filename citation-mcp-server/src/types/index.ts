/**
 * Core data models for agent research capabilities
 */

// ============================================================================
// Claim Models
// ============================================================================

export interface Claim {
  id: string;                    // e.g., "C_01"
  text: string;                  // The claim statement
  category: string;              // e.g., "Method", "Result"
  source: string;                // e.g., "Smith2020"
  verified: boolean;             // Quote verification status
  primaryQuote: string;          // Main supporting quote
  supportingQuotes: string[];    // Additional quotes
  sections: string[];            // Associated outline sections
  context?: string;              // Additional context
}

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

export interface PotentialClaim {
  text: string;
  context: string;
  confidence: number;
  type: ClaimType;
  lineNumber: number;
}

// ============================================================================
// Search Models
// ============================================================================

export interface ClaimMatch {
  claimId: string;
  claimText: string;
  source: string;
  similarity: number;
  primaryQuote: string;
}

export interface DraftAnalysis {
  sentences: SentenceAnalysis[];
  needsNewPapers: boolean;
  suggestedSearches: string[];
}

export interface SentenceAnalysis {
  text: string;
  supported: boolean;
  matchingClaims: ClaimMatch[];
  requiresMultipleSources: boolean;
}

export interface GeneralizationMatch {
  sentence: string;
  keyword: string;
  position: number;
}

export interface MultiSourceResult {
  statement: string;
  supportingClaims: ClaimMatch[];
  sourceCount: number;
  sufficient: boolean;
  needsReviewPaper: boolean;
}

// ============================================================================
// Coverage Models
// ============================================================================

export type SentenceType = 'factual' | 'opinion' | 'transition' | 'question';

export interface SentenceCoverage {
  text: string;
  type: SentenceType;
  supported: boolean;
  matchingClaims: ClaimMatch[];
  suggestedSearches: string[];
}

export interface SectionCoverage {
  sectionId: string;
  sectionTitle: string;
  totalSentences: number;
  factualSentences: number;
  supportedSentences: number;
  coveragePercentage: number;
  sentenceDetails: SentenceCoverage[];
}

export interface ManuscriptCoverage {
  totalSections: number;
  averageCoverage: number;
  sections: SectionCoverage[];
  weakestSections: SectionCoverage[];
}

// ============================================================================
// Outline Models
// ============================================================================

export interface OutlineSection {
  id: string;                    // e.g., "2.1"
  title: string;                 // Section heading
  level: number;                 // Heading level (1-6)
  lineStart: number;             // Start line in file
  lineEnd: number;               // End line in file
  content: string[];             // Section content lines
}

// ============================================================================
// Paper Models
// ============================================================================

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

export interface RankedPaper {
  paper: PaperMetadata;
  relevanceScore: number;
  semanticSimilarity: number;
  citationBoost: number;
  estimatedReadingTime: number;
}

// ============================================================================
// Claim Strength Models
// ============================================================================

export interface SupportingClaim {
  claimId: string;
  source: string;
  similarity: number;
}

export interface ContradictoryClaim {
  claimId: string;
  source: string;
  similarity: number;
  sentimentOpposition: boolean;
}

export interface ClaimStrengthResult {
  claimId: string;
  strengthScore: number;
  supportingClaims: SupportingClaim[];
  contradictoryClaims: ContradictoryClaim[];
}

// ============================================================================
// Synthesis Models
// ============================================================================

export type SynthesisStyle = 'narrative' | 'analytical' | 'descriptive';

export interface SynthesisOptions {
  claims: Claim[];
  style: SynthesisStyle;
  includeCitations: boolean;
  maxLength: number;
}

export interface SectionSuggestion {
  sectionId: string;
  sectionTitle: string;
  similarity: number;
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface SearchService {
  searchByQuestion(question: string, threshold?: number): Promise<ClaimMatch[]>;
  searchByDraft(draftText: string, mode: 'paragraph' | 'sentence', threshold?: number): Promise<DraftAnalysis>;
  detectGeneralizationKeywords(text: string): GeneralizationMatch[];
  findMultiSourceSupport(statement: string, minSources: number): Promise<MultiSourceResult>;
}

export interface CoverageAnalyzer {
  analyzeSectionCoverage(sectionId: string): Promise<SectionCoverage>;
  analyzeManuscriptCoverage(): Promise<ManuscriptCoverage>;
  classifySentence(sentence: string): SentenceType;
  generateSearchQuery(sentence: string): string[];
}

export interface ClaimStrengthCalculator {
  calculateStrength(claimId: string): Promise<ClaimStrengthResult>;
  calculateStrengthBatch(claimIds: string[]): Promise<Map<string, ClaimStrengthResult>>;
  detectContradiction(claim1: string, claim2: string, similarity: number): boolean;
}

export interface PaperRanker {
  rankPapersForSection(sectionId: string, papers: PaperMetadata[]): Promise<RankedPaper[]>;
  rankPapersForQuery(query: string, papers: PaperMetadata[]): Promise<RankedPaper[]>;
  calculateReadingTime(paper: PaperMetadata): number;
}

export interface ClaimExtractor {
  extractFromText(text: string, source: string): PotentialClaim[];
  categorizeClaim(text: string): ClaimType;
  suggestSections(claimText: string, sections: OutlineSection[]): Promise<SectionSuggestion[]>;
}

export interface SynthesisEngine {
  groupClaimsByTheme(claims: Claim[], threshold?: number): Promise<Map<string, Claim[]>>;
  generateParagraph(options: SynthesisOptions): Promise<string>;
  generateTransitions(claims: Claim[]): string[];
}

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateBatch(texts: string[]): Promise<number[][]>;
  cosineSimilarity(vec1: number[], vec2: number[]): number;
  trimCache(maxSize: number): void;
}

export interface OutlineParser {
  parse(filePath: string): Promise<OutlineSection[]>;
  getSectionAtPosition(position: number): OutlineSection | null;
  getSectionById(sectionId: string): OutlineSection | null;
}

export interface ClaimsManager {
  loadClaims(): Promise<Claim[]>;
  getClaim(claimId: string): Claim | null;
  findClaimsBySource(source: string): Claim[];
  findClaimsBySection(sectionId: string): Claim[];
}

// ============================================================================
// Error Models
// ============================================================================

export interface ErrorResponse {
  error: string;
  message: string;
  context?: Record<string, unknown>;
  suggestions?: string[];
}

export type ErrorType = 
  | 'FILE_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PROCESSING_ERROR'
  | 'EMPTY_RESULT';
