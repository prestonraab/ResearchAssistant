/**
 * Caching services for the research assistant
 * 
 * These caches are shared between the VS Code extension and MCP server
 * to avoid redundant computations and API calls.
 */

export { QuoteVerificationCache, QuoteVerificationEntry } from './QuoteVerificationCache.js';
export { ClaimQuoteConfidenceCache, ConfidenceCacheEntry } from './ClaimQuoteConfidenceCache.js';
export { ClaimValidationCache, CachedValidationResult } from './ClaimValidationCache.js';
