/**
 * Comprehensive type definitions for the Research Assistant extension
 * Replaces `any` types with proper, type-safe alternatives
 */

import type { Claim, OutlineSection } from '@research-assistant/core';

// ============================================================================
// Message Types
// ============================================================================

export interface WebviewMessage {
  type: string;
  [key: string]: unknown;
}

export interface VerifyQuoteMessage extends WebviewMessage {
  type: 'verifyQuote';
  quote: string;
  source: string;
}

export interface AcceptQuoteMessage extends WebviewMessage {
  type: 'acceptQuote';
  claimId: string;
  quote: string;
  newQuote: string;
  newSource?: string;
  metadata?: QuoteMetadata;
}

export interface DeleteQuoteMessage extends WebviewMessage {
  type: 'deleteQuote';
  claimId: string;
  quote: string;
}

export interface FindNewQuotesMessage extends WebviewMessage {
  type: 'findNewQuotes';
  claimId: string;
  query: string;
}

export interface LoadSnippetTextMessage extends WebviewMessage {
  type: 'loadSnippetText';
  snippetId: string;
  filePath: string;
  confidence: number;
}

export interface AddSupportingQuoteMessage extends WebviewMessage {
  type: 'addSupportingQuote';
  claimId: string;
  quote: string;
  source: string;
  lineRange?: string;
  confidence: number;
}

export interface SearchInternetMessage extends WebviewMessage {
  type: 'searchInternet';
  query: string;
}

export interface ValidateSupportMessage extends WebviewMessage {
  type: 'validateSupport';
  claimId: string;
}

export interface NavigateToManuscriptMessage extends WebviewMessage {
  type: 'navigateToManuscript';
  lineNumber: number;
}

export interface UpdateCategoryMessage extends WebviewMessage {
  type: 'updateCategory';
  claimId: string;
  category: string;
}

export interface GetExpandedContextMessage extends WebviewMessage {
  type: 'getExpandedContext';
  sourceFile: string;
  startLine: number;
  endLine: number;
  expandLines: number;
}

export interface SwitchToEditingModeMessage extends WebviewMessage {
  type: 'switchToEditingMode';
}

export interface ShowHelpMessage extends WebviewMessage {
  type: 'showHelp';
}

// ============================================================================
// Quote Types
// ============================================================================

export interface QuoteMetadata {
  sourceFile: string;
  startLine: number;
  endLine: number;
}

export interface QuoteObject {
  text: string;
  source?: string;
  verified?: boolean;
  confidence?: number;
  metadata?: QuoteMetadata;
}

export type Quote = string | QuoteObject;

export interface VerificationResult {
  quote: string;
  type: 'primary' | 'supporting';
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  confidence?: number;
  alternativeSources?: AlternativeSource[];
  searchStatus: 'not_searched' | 'searching' | 'found' | 'not_found';
}

export interface AlternativeSource {
  source: string;
  similarity: number;
  matchedText: string;
  context: string;
  metadata: QuoteMetadata;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  supported: boolean;
  similarity: number;
  suggestedQuotes: string[];
  analysis: string;
}

// ============================================================================
// Manuscript Usage Types
// ============================================================================

export interface ManuscriptUsageLocation {
  section: string;
  context: string;
  lineNumber: number;
}

// ============================================================================
// Mode Context Types
// ============================================================================

export interface EditingModeContext {
  sentences?: unknown[];
  centerItemId?: string;
  centerItemPosition?: number;
  selectedSentenceId?: string;
  lastModifiedClaimId?: string;
}

export interface WritingModeContext {
  pairs?: unknown[];
  centerItemId?: string;
  centerItemPosition?: number;
  selectedPairId?: string;
}

export interface ClaimReviewContext {
  claimId?: string;
  claim?: ClaimData;
  verificationResults?: VerificationResult[];
  validationResult?: ValidationResult;
  usageLocations?: ManuscriptUsageLocation[];
  returnToSentenceId?: string;
}

export interface ClaimMatchingContext {
  sentenceId?: string;
  sentenceText?: string;
  similarClaims?: unknown[];
  linkedClaimId?: string;
}

export interface ModeContextChangeEvent {
  mode: 'editing' | 'writing' | 'claimReview' | 'claimMatching';
  context: EditingModeContext | WritingModeContext | ClaimReviewContext | ClaimMatchingContext;
}

// ============================================================================
// Claim Data Types
// ============================================================================

export interface ClaimData extends Claim {
  suggestedCategory?: string;
  availableCategories?: string[];
}

// ============================================================================
// Search Result Types
// ============================================================================

export interface SearchResult {
  source: string;
  similarity: number;
  matchedText: string;
  context: string;
  metadata: QuoteMetadata;
  creators?: CreatorInfo[];
  year?: number;
  doi?: string;
}

export interface CreatorInfo {
  name: string;
  firstName?: string;
  lastName?: string;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

// ============================================================================
// HTTP Request Types
// ============================================================================

export interface HttpRequestOptions {
  method?: string;
  body?: unknown;
}

export interface HttpResponse<T> {
  status: number;
  data: T;
}

// ============================================================================
// Zotero Types
// ============================================================================

export interface ZoteroCreator {
  lastName?: string;
  firstName?: string;
  name?: string;
}

export interface ZoteroItemData {
  creators?: ZoteroCreator[];
  [key: string]: unknown;
}

export interface ZoteroItemResponse {
  key?: string;
  data?: ZoteroItemData;
  [key: string]: unknown;
}

// ============================================================================
// Paper Search Types
// ============================================================================

export interface PaperSearchResult {
  title: string;
  creators?: CreatorInfo[];
  year?: number;
  doi?: string;
  score?: number;
  [key: string]: unknown;
}

// ============================================================================
// Snippet Types
// ============================================================================

export interface SnippetSearchResult {
  fileName: string;
  similarity: number;
  text: string;
  startLine: number;
  endLine: number;
}

// ============================================================================
// Failure Types
// ============================================================================

export interface VerificationFailure {
  claimId: string;
  similarity: number;
}

// ============================================================================
// Database Record Types
// ============================================================================

export interface DatabaseClaim {
  id: string;
  text: string;
  category: string;
  source: string;
  sourceId: number;
  context: string;
  primaryQuote: string;
  supportingQuotes: string[];
  sections: string[];
  verified: boolean;
  createdAt: Date;
  modifiedAt: Date;
  [key: string]: unknown;
}

// ============================================================================
// Service Interfaces
// ============================================================================

export interface ClaimsManager {
  getClaim(id: string): Claim | undefined;
  updateClaim(id: string, claim: Claim): Promise<void>;
  [key: string]: unknown;
}

export interface EmbeddingServiceInterface {
  generateEmbedding(text: string): Promise<number[]>;
  getCacheSize(): number;
  trimCache(percentage: number): void;
  [key: string]: unknown;
}

export interface PaperRanker {
  rank(papers: unknown[], query: string): Array<{ paper: { itemKey: string }; score: number }>;
  [key: string]: unknown;
}

// ============================================================================
// Generic Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T> = Promise<T | null>;
