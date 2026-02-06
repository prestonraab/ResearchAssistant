import * as https from 'https';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LiteratureIndexer } from './literatureIndexer';
import { EmbeddedSnippet } from './embeddingStore';
import { EmbeddingService } from './embeddingService';
import { ClaimQuoteConfidenceCache, ClaimValidationCache } from '@research-assistant/core';
import type { Claim } from '@research-assistant/core';

export interface VerificationResult {
  snippet: EmbeddedSnippet;
  supports: boolean;
  confidence: number;
  reasoning: string;
}

export interface SearchRound {
  round: number;
  query: string;
  snippets: EmbeddedSnippet[];
  verifications: VerificationResult[];
  supportingSnippets: EmbeddedSnippet[];
}

export interface SupportValidation {
  claimId: string;
  similarity: number;
  supported: boolean;
  suggestedQuotes?: string[];
  analysis?: string;
}

export interface ClaimAnalysis {
  exampleQuote: string;
  keyConcepts: string[];
  requiredElements: string[];
  strongSupportCriteria: string;
  weakSupportIndicators: string;
  searchTerms: string[];
}

/**
 * Implements verification feedback loop:
 * 1. Search literature by embedding similarity
 * 2. Verify results with LLM
 * 3. If unsupported, refine query and retry
 * 4. If still unsupported, do web search
 * 
 * Also handles claim support validation using semantic similarity
 */
export class VerificationFeedbackLoop {
  private literatureIndexer: LiteratureIndexer;
  private embeddingService: EmbeddingService;
  private confidenceCache: ClaimQuoteConfidenceCache | null = null;
  private validationCache: ClaimValidationCache | null = null;
  private openaiApiKey: string;
  private maxRounds: number = 3;
  private readonly WEAK_SUPPORT_THRESHOLD = 0.6;
  private readonly STRONG_SUPPORT_THRESHOLD = 0.75;
  private extractedTextPath: string;
  
  // Track if we've shown the Semantic Scholar API key prompt this session
  private static hasShownSemanticScholarApiKeyPrompt = false;

  constructor(
    literatureIndexer: LiteratureIndexer,
    openaiApiKey?: string,
    extractedTextPath: string = 'literature/ExtractedText',
    workspaceRoot?: string
  ) {
    this.literatureIndexer = literatureIndexer;
    this.embeddingService = new EmbeddingService(openaiApiKey);
    this.openaiApiKey = openaiApiKey || this.getSettingValue('openaiApiKey') || process.env.OPENAI_API_KEY || '';
    this.extractedTextPath = extractedTextPath;
    
    // Initialize caches if workspace root is provided
    if (workspaceRoot) {
      this.confidenceCache = new ClaimQuoteConfidenceCache(workspaceRoot);
      this.confidenceCache.initialize().catch((error: any) => {
        console.error('[VerificationFeedbackLoop] Failed to initialize confidence cache:', error);
      });
      
      this.validationCache = new ClaimValidationCache(workspaceRoot);
      this.validationCache.initialize().catch((error: any) => {
        console.error('[VerificationFeedbackLoop] Failed to initialize validation cache:', error);
      });
    }
  }

  /**
   * Get setting value from VS Code configuration
   */
  private getSettingValue(key: string): string {
    try {
      const config = vscode.workspace.getConfiguration('researchAssistant');
      return config.get<string>(key) || '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Public method to search snippets in literature
   * Used for rechecking if a quote can be found in local sources
   */
  async searchLiteratureSnippets(query: string, limit: number = 5): Promise<EmbeddedSnippet[]> {
    return this.literatureIndexer.searchSnippets(query, limit);
  }

  /**
   * Run full verification feedback loop
   * Streams results instead of keeping all rounds in memory
   * Supports cancellation via AbortSignal for non-blocking claim switching
   */
  async findSupportingEvidence(
    claim: string, 
    onRoundComplete?: (round: SearchRound) => void,
    streamCallbacks?: { 
      onCandidatesFound?: (round: number, candidates: EmbeddedSnippet[]) => void;
      onVerificationUpdate?: (round: number, snippetId: string, result: VerificationResult) => void;
      onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void;
    },
    signal?: AbortSignal
  ): Promise<SearchRound[]> {
    let currentQueries: string[] = [claim]; // Track multiple query variants
    let supportingSnippets: EmbeddedSnippet[] = [];
    const completedRounds: SearchRound[] = [];
    const queryHistory: string[] = [claim]; // Track all queries tried
    const seenSnippetIds = new Set<string>(); // Avoid duplicate snippets
    
    // Helper to log debug info
    const debugLog = (type: string, data: any) => {
      if (streamCallbacks?.onDebugLog) {
        streamCallbacks.onDebugLog({ type, timestamp: Date.now(), data });
      }
    };

    // Helper to check cancellation
    const checkCancelled = () => {
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
    };

    console.log('[VerificationFeedbackLoop] Starting verification loop for claim:', claim.substring(0, 50));

    // First, ensure literature is indexed (non-blocking)
    console.log('[VerificationFeedbackLoop] Ensuring literature is indexed...');
    
    try {
      checkCancelled();
      
      const indexStats = await this.literatureIndexer.indexChangedFiles();
      console.log('[VerificationFeedbackLoop] Index stats:', indexStats);
      
      // Yield to event loop after indexing
      await new Promise(resolve => setImmediate(resolve));

      // Step 0: Analyze the claim to understand what would constitute support
      checkCancelled();
      console.log('[VerificationFeedbackLoop] Analyzing claim requirements...');
      const claimAnalysis = await this.analyzeClaimRequirements(claim);
      debugLog('claim-analysis', {
        claim,
        analysis: claimAnalysis
      });
      console.log('[VerificationFeedbackLoop] Claim analysis complete');

      // Track pending Semantic Scholar searches (fire-and-forget per round)
      const pendingSemanticScholarResults: Promise<void>[] = [];

      for (let round = 1; round <= this.maxRounds; round++) {
        checkCancelled();
        
        console.log(`[VerificationFeedbackLoop] Round ${round}/${this.maxRounds}, queries: ${currentQueries.length}`);

        // Fire off async Semantic Scholar search (don't wait for it)
        const semanticScholarPromise = this.fireSemanticScholarSearch(
          currentQueries[0] || claim,
          round,
          seenSnippetIds,
          streamCallbacks,
          signal,
          claimAnalysis
        );
        pendingSemanticScholarResults.push(semanticScholarPromise);

        // Step 1: Search literature with all query variants and combine results
        const allSnippets: EmbeddedSnippet[] = [];
        for (const query of currentQueries) {
          const snippets = await this.literatureIndexer.searchSnippets(query, 10);
          // Deduplicate by snippet ID
          for (const snippet of snippets) {
            if (!seenSnippetIds.has(snippet.id)) {
              seenSnippetIds.add(snippet.id);
              allSnippets.push(snippet);
            }
          }
        }
        // Limit total snippets per round to avoid too much LLM verification
        const snippets = allSnippets.slice(0, 15);
        console.log(`[VerificationFeedbackLoop] Found ${snippets.length} unique snippets (from ${currentQueries.length} queries)`);

        checkCancelled();

        if (snippets.length === 0) {
          console.log('[VerificationFeedbackLoop] No snippets found, moving to web search');
          break;
        }

        // Stream candidates immediately if callback provided
        if (streamCallbacks?.onCandidatesFound) {
          // Add source type to help with debugging
          const candidatesWithSource = snippets.map(s => ({
            ...s,
            searchSource: 'literature' as const
          }));
          streamCallbacks.onCandidatesFound(round, candidatesWithSource as EmbeddedSnippet[]);
        }

        // Yield to event loop
        await new Promise(resolve => setImmediate(resolve));
        checkCancelled();

        // Generate claim embedding for similarity calculation (only on first round)
        let claimEmbedding: number[] = [];
        if (round === 1) {
          const embedding = await this.embeddingService.embed(claim);
          claimEmbedding = embedding || [];
        }

        checkCancelled();

        // Step 2: Verify with LLM (with streaming updates and cancellation support)
        const verifications = await this.verifySnippetsWithStreaming(
          claim, 
          snippets, 
          claimEmbedding,
          round,
          streamCallbacks?.onVerificationUpdate,
          signal,
          claimAnalysis,
          streamCallbacks?.onDebugLog
        );
        
        checkCancelled();
        
        const roundSupportingSnippets = snippets.filter((_, i) => verifications[i].supports);

        supportingSnippets.push(...roundSupportingSnippets);

        const roundData: SearchRound = {
          round,
          query: currentQueries.join(' | '),
          snippets,
          verifications,
          supportingSnippets: roundSupportingSnippets
        };

        completedRounds.push(roundData);
        
        // Stream result to caller if callback provided
        if (onRoundComplete) {
          onRoundComplete(roundData);
        }

        console.log(`[VerificationFeedbackLoop] Round ${round}: ${roundSupportingSnippets.length}/${snippets.length} snippets support claim (total: ${supportingSnippets.length})`);

        // Count only local literature snippets (not web sources) towards the 5-quote goal
        const localSupportingSnippets = supportingSnippets.filter(s => !s.searchSource || s.searchSource === 'literature');
        
        // Continue searching until we have at least 5 supporting quotes from local literature or run out of rounds
        if (localSupportingSnippets.length >= 5) {
          console.log(`[VerificationFeedbackLoop] Found ${localSupportingSnippets.length} supporting quotes from local literature, stopping`);
          break;
        }
        
        // Keep searching through all rounds to find more supporting evidence
        // Only stop early if we've exhausted all rounds

        // Step 3: Generate multiple refined queries based on verification feedback
        if (round < this.maxRounds) {
          checkCancelled();
          const { queries: newQueries, debugInfo } = await this.refineQueriesWithDebug(claim, verifications, supportingSnippets, queryHistory, claimAnalysis);
          currentQueries = newQueries;
          queryHistory.push(...currentQueries);
          console.log('[VerificationFeedbackLoop] Refined queries:', currentQueries.map(q => q.substring(0, 40)));
          
          // Log debug info
          debugLog('query-refinement', {
            round,
            prompt: debugInfo.prompt,
            response: debugInfo.response,
            generatedQueries: currentQueries
          });
        }
        
        // On round 3, also trigger web search in parallel with continued local search
        if (round === 3) {
          console.log('[VerificationFeedbackLoop] Round 3 reached - triggering web search in parallel');
          this.runWebSearchInParallel(claim, streamCallbacks, onRoundComplete, signal);
        }

        // Clear verification results from memory after processing
        // Keep only the supporting snippets
        verifications.length = 0;
        
        // Yield between rounds
        await new Promise(resolve => setImmediate(resolve));
      }

      checkCancelled();

      // If no supporting evidence found in literature and we didn't already run web search, do it now
      if (supportingSnippets.length === 0 && this.maxRounds < 3) {
        console.log('[VerificationFeedbackLoop] No supporting evidence in literature, attempting web search');
        const webRound = await this.runWebSearch(claim, streamCallbacks, signal);
        if (webRound) {
          completedRounds.push(webRound);
          if (onRoundComplete) {
            onRoundComplete(webRound);
          }
        }
      }

      return completedRounds;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[VerificationFeedbackLoop] Operation cancelled');
        throw error;
      }
      throw error;
    }
  }
  
  /**
   * Run web search and return results as a SearchRound
   */
  private async runWebSearch(
    claim: string, 
    streamCallbacks?: { 
      onCandidatesFound?: (round: number, candidates: EmbeddedSnippet[]) => void;
      onVerificationUpdate?: (round: number, snippetId: string, result: VerificationResult) => void;
      onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void;
    },
    signal?: AbortSignal
  ): Promise<SearchRound | null> {
    try {
      const webResults = await this.webSearch(claim);
      
      if (signal?.aborted) return null;
      
      if (webResults.length === 0) return null;
      
      // Filter out results with no useful content
      const usefulResults = webResults.filter(r => 
        r.snippet && 
        r.snippet.length > 50 && 
        !r.snippet.startsWith('Abstract available')
      );
      
      if (usefulResults.length === 0) return null;
      
      const webSnippets = usefulResults.map(r => ({
        ...this.convertWebResultToSnippet(r),
        searchSource: 'web' as const
      }));
      
      // Stream candidates first
      if (streamCallbacks?.onCandidatesFound) {
        streamCallbacks.onCandidatesFound(this.maxRounds + 1, webSnippets as EmbeddedSnippet[]);
      }
      
      // Verify web results too (they need confidence scores)
      console.log('[VerificationFeedbackLoop] Verifying web results...');
      const webVerifications = await this.verifySnippetsWithStreaming(
        claim,
        webSnippets as EmbeddedSnippet[],
        [], // No claim embedding for web results
        this.maxRounds + 1,
        streamCallbacks?.onVerificationUpdate,
        signal,
        undefined,
        streamCallbacks?.onDebugLog
      );
      
      if (signal?.aborted) return null;
      
      const supportingWebSnippets = webSnippets.filter((_, i) => webVerifications[i]?.supports);
      
      return {
        round: this.maxRounds + 1,
        query: `web search: ${claim}`,
        snippets: webSnippets as EmbeddedSnippet[],
        verifications: webVerifications,
        supportingSnippets: supportingWebSnippets as EmbeddedSnippet[]
      };
    } catch (error: any) {
      if (error.name === 'AbortError') throw error;
      console.error('[VerificationFeedbackLoop] Web search failed:', error);
      return null;
    }
  }
  
  /**
   * Run web search in parallel (fire and forget, results stream via callbacks)
   */
  private runWebSearchInParallel(
    claim: string,
    streamCallbacks?: { 
      onCandidatesFound?: (round: number, candidates: EmbeddedSnippet[]) => void;
      onVerificationUpdate?: (round: number, snippetId: string, result: VerificationResult) => void;
      onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void;
    },
    onRoundComplete?: (round: SearchRound) => void,
    signal?: AbortSignal
  ): void {
    // Run in background, don't await
    this.runWebSearch(claim, streamCallbacks, signal).then(webRound => {
      if (webRound && onRoundComplete && !signal?.aborted) {
        onRoundComplete(webRound);
      }
    }).catch(error => {
      if (error.name !== 'AbortError') {
        console.error('[VerificationFeedbackLoop] Parallel web search failed:', error);
      }
    });
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (!embedding1 || !embedding2 || embedding1.length === 0 || embedding2.length === 0) {
      return 0;
    }

    const dotProduct = embedding1.reduce((sum: number, a: number, i: number) => sum + a * embedding2[i], 0);
    const magnitudeA = Math.sqrt(embedding1.reduce((sum: number, a: number) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(embedding2.reduce((sum: number, b: number) => sum + b * b, 0));
    
    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  /**
   * Verify if snippets support the claim using LLM
   */
  private async verifySnippets(claim: string, snippets: EmbeddedSnippet[], claimEmbedding: number[]): Promise<VerificationResult[]> {
    return this.verifySnippetsWithStreaming(claim, snippets, claimEmbedding, 0, undefined);
  }

  /**
   * Verify snippets with optional streaming updates and cancellation support
   */
  private async verifySnippetsWithStreaming(
    claim: string, 
    snippets: EmbeddedSnippet[], 
    claimEmbedding: number[],
    round: number,
    onVerificationUpdate?: (round: number, snippetId: string, result: VerificationResult) => void,
    signal?: AbortSignal,
    claimAnalysis?: ClaimAnalysis,
    onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const snippet of snippets) {
      // Check cancellation before each verification
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      try {
        // Calculate semantic similarity between claim and snippet
        const similarity = claimEmbedding.length > 0 && snippet.embedding?.length > 0
          ? this.calculateCosineSimilarity(claimEmbedding, snippet.embedding)
          : 0;
        const result = await this.verifySnippetWithAnalysis(claim, snippet, similarity, claimAnalysis, onDebugLog);
        results.push(result);
        
        // Stream verification result if callback provided
        if (onVerificationUpdate) {
          onVerificationUpdate(round, snippet.id, result);
        }
      } catch (error) {
        console.error(`[VerificationFeedbackLoop] Failed to verify snippet ${snippet.id}:`, error);
        // Push a failed result so we don't leave it spinning
        const failedResult: VerificationResult = {
          snippet,
          supports: false,
          confidence: 0,
          reasoning: 'Verification failed'
        };
        results.push(failedResult);
        if (onVerificationUpdate) {
          onVerificationUpdate(round, snippet.id, failedResult);
        }
      }
      
      // Yield to event loop after each verification
      await new Promise(resolve => setImmediate(resolve));
    }

    return results;
  }

  /**
   * Verify a single snippet against the claim
   * Uses cache if available, otherwise calls LLM
   * Public method for use in quote verification flows
   */
  async verifySnippet(
    claim: string, 
    snippet: EmbeddedSnippet, 
    similarity: number = 0,
    onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void,
    claimAnalysis?: ClaimAnalysis
  ): Promise<VerificationResult> {
    return this.verifySnippetWithAnalysis(claim, snippet, similarity, claimAnalysis, onDebugLog);
  }

  /**
   * Verify a single snippet against the claim using claim analysis for better accuracy
   */
  private async verifySnippetWithAnalysis(
    claim: string, 
    snippet: EmbeddedSnippet, 
    similarity: number = 0,
    claimAnalysis?: ClaimAnalysis,
    onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void
  ): Promise<VerificationResult> {
    // Check cache first
    if (this.confidenceCache) {
      const cached = this.confidenceCache.get(claim, snippet.text);
      if (cached) {
        console.log(`[VerificationFeedbackLoop] Cache hit for claim-quote pair (confidence: ${cached.confidence.toFixed(2)})`);
        return {
          snippet,
          supports: cached.confidence >= this.WEAK_SUPPORT_THRESHOLD,
          confidence: cached.confidence,
          reasoning: 'Cached result'
        };
      }
    }

    if (!this.openaiApiKey) {
      console.warn('[VerificationFeedbackLoop] OpenAI API key not configured');
      return {
        snippet,
        supports: false,
        confidence: 0,
        reasoning: 'API key not configured'
      };
    }

    try {
      const similarityPercentage = Math.round(similarity * 100);
      
      // Build analysis context if available
      let analysisContext = '';
      if (claimAnalysis && claimAnalysis.keyConcepts.length > 0) {
        analysisContext = `
CLAIM ANALYSIS (what constitutes support):
- Example quote: ${claimAnalysis.exampleQuote}
- Key concepts that must be addressed: ${claimAnalysis.keyConcepts.join(', ')}
- Required elements: ${claimAnalysis.requiredElements.join(', ')}
- Strong support criteria: ${claimAnalysis.strongSupportCriteria}
- Weak/non-support indicators: ${claimAnalysis.weakSupportIndicators}
`;
      }
      else {
        analysisContext = `
CLAIM ANALYSIS (general guidance):
- Focus on whether the snippet provides direct evidence or support for this specific claim
- Look for key concepts, phenomena, or mechanisms mentioned in the claim
- Consider if the snippet describes results, methods, or observations that relate to the claim
`;
      }

      const prompt = `You are a rigorous fact-checking assistant. Determine if the following snippet directly supports or provides evidence for the specific claim.

CLAIM: ${claim}
${analysisContext}
SNIPPET: ${snippet.text}

SEMANTIC SIMILARITY: ${similarityPercentage}% (how textually similar the snippet is to the claim)

${claimAnalysis ? 'Use the claim analysis above to evaluate whether this snippet addresses the required concepts and meets the criteria for strong support.' : 'Focus on whether the snippet provides direct evidence or support for the claim.'}

Respond in JSON format:
{
  "reasoning": string (brief explanation - which required elements does it address or miss?),
  "confidence": number (0-1, how confident you are that this snippet directly supports the claim),
  "supports": boolean (true only if snippet directly supports or provides evidence for this specific claim)
}`;

      const response = await this.callOpenAIAPI(prompt, true);
      
      // Extract JSON from markdown code blocks if present
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);

      const result = {
        snippet,
        supports: parsed.supports === true,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || ''
      };

      // Log verification to debug panel
      if (onDebugLog) {
        onDebugLog({
          type: 'verification-with-analysis',
          timestamp: Date.now(),
          data: {
            claim,
            snippet: snippet.text.substring(0, 200),
            prompt,
            response,
            supports: result.supports,
            confidence: result.confidence,
            reasoning: result.reasoning
          }
        });
      }

      // Store in cache
      if (this.confidenceCache) {
        this.confidenceCache.set(claim, snippet.text, result.confidence);
        console.log(`[VerificationFeedbackLoop] Cached confidence score: ${result.confidence.toFixed(2)}`);
      }

      return result;
    } catch (error) {
      console.error('[VerificationFeedbackLoop] Error verifying snippet:', error);
      return {
        snippet,
        supports: false,
        confidence: 0,
        reasoning: `Error: ${error}`
      };
    }
  }

  /**
   * Analyze a claim to understand what would constitute supporting evidence
   * Returns structured analysis that guides search and verification
   */
  private async analyzeClaimRequirements(claim: string): Promise<ClaimAnalysis> {
    if (!this.openaiApiKey) {
      return {
        exampleQuote: '',
        keyConcepts: [],
        requiredElements: [],
        strongSupportCriteria: '',
        weakSupportIndicators: '',
        searchTerms: []
      };
    }

    try {
      const prompt = `Analyze this research claim to understand what would constitute supporting evidence.

CLAIM: ${claim}

Respond in JSON format:
{
  "exampleQuote": "a short example of a quote that would strongly support this claim",
  "negativeExamples: ["list of things that would contradict the claim"],
  "keyConcepts": ["list of 3-5 key concepts that must be addressed"],
  "requiredElements": ["what specific things must a quote declare to support this claim"],
  "strongSupportCriteria": "description of what makes a quote strongly support this claim",
  "weakSupportIndicators": "what would make a quote only weakly related or not actually supporting",
  "searchTerms": ["5-8 technical terms or phrases to search for"]
}`;

      const response = await this.callOpenAIAPI(prompt, true);
      
      // Extract JSON from markdown code blocks if present
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        exampleQuote: parsed.exampleQuote || '',
        keyConcepts: parsed.keyConcepts || [],
        requiredElements: parsed.requiredElements || [],
        strongSupportCriteria: parsed.strongSupportCriteria || '',
        weakSupportIndicators: parsed.weakSupportIndicators || '',
        searchTerms: parsed.searchTerms || []
      };
    } catch (error) {
      console.error('[VerificationFeedbackLoop] Error analyzing claim:', error);
      return {
        exampleQuote: '',
        keyConcepts: [],
        requiredElements: [],
        strongSupportCriteria: '',
        weakSupportIndicators: '',
        searchTerms: []
      };
    }
  }

  /**
   * Refine search query based on verification feedback
   * @deprecated Use refineQueries instead for multiple query variants
   */
  private async refineQuery(claim: string, verifications: VerificationResult[]): Promise<string> {
    const queries = await this.refineQueries(claim, verifications, [], [claim]);
    return queries[0] || claim;
  }

  /**
   * Generate multiple refined search queries based on verification feedback
   * Uses successful snippets, failure reasons, and query history to generate diverse queries
   */
  private async refineQueries(
    claim: string, 
    verifications: VerificationResult[],
    successfulSnippets: EmbeddedSnippet[],
    queryHistory: string[]
  ): Promise<string[]> {
    const result = await this.refineQueriesWithDebug(claim, verifications, successfulSnippets, queryHistory);
    return result.queries;
  }

  /**
   * Generate refined queries with debug info for UI display
   */
  private async refineQueriesWithDebug(
    claim: string, 
    verifications: VerificationResult[],
    successfulSnippets: EmbeddedSnippet[],
    queryHistory: string[],
    claimAnalysis?: ClaimAnalysis
  ): Promise<{ queries: string[]; debugInfo: { prompt: string; response: string } }> {
    if (!this.openaiApiKey) {
      return { queries: [claim], debugInfo: { prompt: '', response: '' } };
    }

    try {
      // Filter out cached results and get meaningful failure reasons
      const failureReasons = verifications
        .filter(v => !v.supports && v.reasoning && v.reasoning !== 'Cached result')
        .map(v => v.reasoning)
        .slice(0, 5)
        .join('\n- ');

      // Get actual text from successful snippets, not metadata
      const successfulExcerpts = successfulSnippets
        .slice(0, 3)
        .map(s => s.text.substring(0, 300))
        .filter(text => !text.toLowerCase().startsWith('citation:')) // Skip citation lines
        .join('\n---\n');

      const previousQueries = queryHistory.slice(-5).join(', ');

      // Build analysis context if available
      let analysisContext = '';
      if (claimAnalysis && claimAnalysis.searchTerms.length > 0) {
        analysisContext = `
CLAIM ANALYSIS (use these to guide your queries):
- Key concepts: ${claimAnalysis.keyConcepts.join(', ')}
- Suggested search terms: ${claimAnalysis.searchTerms.join(', ')}
`;
      }

      const prompt = `You are helping find academic literature to support a research claim. Generate 3-4 different search queries.

CLAIM TO SUPPORT:
${claim}
${analysisContext}
${successfulExcerpts ? `EXCERPTS THAT SUCCESSFULLY SUPPORTED THE CLAIM (find more like these):
${successfulExcerpts}
---` : ''}

${failureReasons ? `WHY SOME RESULTS DIDN'T WORK:
- ${failureReasons}` : ''}

QUERIES ALREADY TRIED (avoid these):
${previousQueries}

Generate 3-4 diverse search queries that might find supporting evidence. Each query can be a phrase or sentence fragment (5-15 words). ${claimAnalysis ? 'Use the suggested search terms and key concepts above.' : 'Try different angles: technical terminology, related concepts, specific phenomena, application domains.'}

Return ONLY the queries, one per line, no numbering or explanation.`;

      const response = await this.callOpenAIAPI(prompt);
      const queries = response
        .split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0 && q.length < 200)
        .filter(q => !queryHistory.includes(q)) // Filter out already-tried queries
        .slice(0, 4);

      return { 
        queries: queries.length > 0 ? queries : [claim],
        debugInfo: { prompt, response }
      };
    } catch (error) {
      console.error('[VerificationFeedbackLoop] Error refining queries:', error);
      return { queries: [claim], debugInfo: { prompt: '', response: `Error: ${error}` } };
    }
  }

  /**
   * Fire off a Semantic Scholar search asynchronously (non-blocking)
   * Results are streamed to the UI and verified when they arrive
   */
  private async fireSemanticScholarSearch(
    claim: string,
    round: number,
    seenSnippetIds: Set<string>,
    streamCallbacks?: { 
      onCandidatesFound?: (round: number, candidates: EmbeddedSnippet[]) => void;
      onVerificationUpdate?: (round: number, snippetId: string, result: VerificationResult) => void;
      onDebugLog?: (entry: { type: string; timestamp: number; data: any }) => void;
    },
    signal?: AbortSignal,
    claimAnalysis?: ClaimAnalysis
  ): Promise<void> {
    try {
      if (signal?.aborted) return;

      const { InternetPaperSearcher } = await import('@research-assistant/core');
      const searcher = new InternetPaperSearcher();
      
      const semanticScholarApiKey = this.getSettingValue('semanticScholarApiKey');
      if (semanticScholarApiKey) {
        searcher.setSemanticScholarApiKey(semanticScholarApiKey);
      }

      // Extract search terms for better API results
      const searchQuery = this.extractSearchTerms(claim);
      console.log(`[VerificationFeedbackLoop] Round ${round}: Firing Semantic Scholar search: "${searchQuery}"`);

      const papers = await searcher.searchSemanticScholarOnly(searchQuery);
      
      if (signal?.aborted) return;
      if (papers.length === 0) return;

      // Convert papers to snippet-like format for streaming
      const webSnippets = papers
        .filter((p: any) => p.abstract && p.abstract.length > 50)
        .slice(0, 5)
        .map((paper: any) => {
          const snippetId = `ss-${round}-${paper.title.substring(0, 20).replace(/\W/g, '')}`;
          if (seenSnippetIds.has(snippetId)) return null;
          seenSnippetIds.add(snippetId);
          
          return {
            id: snippetId,
            text: paper.abstract || '',
            fileName: `${paper.authors.slice(0, 2).join(', ')} (${paper.year})`,
            filePath: paper.url || '',
            startLine: 0,
            endLine: 0,
            embedding: [],
            timestamp: Date.now(),
            searchSource: 'semantic-scholar' as const,
            metadata: {
              title: paper.title,
              authors: paper.authors,
              year: paper.year,
              url: paper.url,
              doi: paper.doi,
              openAccessPdf: paper.openAccessPdf
            }
          };
        })
        .filter(Boolean) as EmbeddedSnippet[];

      if (webSnippets.length === 0) return;

      // Stream candidates first
      if (streamCallbacks?.onCandidatesFound) {
        console.log(`[VerificationFeedbackLoop] Round ${round}: Semantic Scholar returned ${webSnippets.length} papers`);
        streamCallbacks.onCandidatesFound(round, webSnippets);
      }

      // Now verify each snippet and stream updates
      for (const snippet of webSnippets) {
        if (signal?.aborted) return;
        
        try {
          const result = await this.verifySnippet(claim, snippet, 0, streamCallbacks?.onDebugLog, claimAnalysis);
          
          if (signal?.aborted) return;
          
          if (streamCallbacks?.onVerificationUpdate) {
            streamCallbacks.onVerificationUpdate(round, snippet.id, result);
          }
        } catch (error) {
          console.warn(`[VerificationFeedbackLoop] Failed to verify Semantic Scholar snippet:`, error);
          // Send a failed verification update
          if (streamCallbacks?.onVerificationUpdate) {
            streamCallbacks.onVerificationUpdate(round, snippet.id, {
              supports: false,
              confidence: 0,
              reasoning: 'Verification failed',
              snippet
            });
          }
        }
      }
    } catch (error) {
      // Don't fail the main search if Semantic Scholar fails
      console.warn(`[VerificationFeedbackLoop] Round ${round}: Semantic Scholar search failed:`, error);
    }
  }

  /**
   * Web search for supporting evidence
   * Uses free academic search APIs:
   * - arXiv (preprints)
   * - Semantic Scholar (peer-reviewed)
   * - CrossRef (scholarly metadata)
   * - PubMed (biomedical)
   * Semantic Scholar API key optional but recommended for better rate limits
   */
  private async webSearch(claim: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    try {
      // Import InternetPaperSearcher from core to reuse unified search
      const { InternetPaperSearcher } = await import('@research-assistant/core');
      const searcher = new InternetPaperSearcher();
      
      // Check for Semantic Scholar API key and configure searcher
      const semanticScholarApiKey = this.getSettingValue('semanticScholarApiKey');
      if (semanticScholarApiKey) {
        searcher.setSemanticScholarApiKey(semanticScholarApiKey);
      } else if (!VerificationFeedbackLoop.hasShownSemanticScholarApiKeyPrompt) {
        // Show prompt to configure API key (only once per session)
        VerificationFeedbackLoop.hasShownSemanticScholarApiKeyPrompt = true;
        
        vscode.window.showInformationMessage(
          'Web search works better with a Semantic Scholar API key. Would you like to configure one?',
          'Configure API Key',
          'Not Now'
        ).then(action => {
          if (action === 'Configure API Key') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant.semanticScholarApiKey');
          }
        });
      }
      
      // Extract key terms from claim for better search results
      // Academic APIs work better with keyword queries, not full sentences
      const searchQuery = this.extractSearchTerms(claim);
      console.log(`[VerificationFeedbackLoop] Web search query: "${searchQuery}" (from claim: "${claim.substring(0, 50)}...")`);
      
      const papers = await searcher.searchExternal(searchQuery);
      
      return papers.map((paper: any) => ({
        title: paper.title,
        url: paper.url || '',
        snippet: paper.abstract || `${paper.authors.join(', ')} (${paper.year})`,
      })).filter((r: any) => r.url);
    } catch (error) {
      console.error('[VerificationFeedbackLoop] Web search failed:', error);
      return [];
    }
  }

  /**
   * Extract key search terms from a claim for academic API queries
   * Removes common words and keeps domain-specific terms
   */
  private extractSearchTerms(claim: string): string {
    // Common words to filter out
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'cannot', 'this', 'that', 'these', 'those',
      'it', 'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
      'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how',
      'and', 'or', 'but', 'if', 'then', 'else', 'so', 'as', 'than',
      'for', 'of', 'to', 'from', 'by', 'with', 'without', 'in', 'on', 'at',
      'into', 'onto', 'upon', 'about', 'between', 'through', 'during', 'before', 'after',
      'above', 'below', 'under', 'over', 'again', 'further', 'once', 'while',
      'also', 'both', 'each', 'more', 'most', 'other', 'some', 'such', 'only',
      'same', 'very', 'just', 'even', 'still', 'already', 'often', 'however',
      'therefore', 'thus', 'hence', 'although', 'though', 'because', 'since',
      'show', 'shown', 'shows', 'demonstrate', 'demonstrated', 'demonstrates',
      'suggest', 'suggested', 'suggests', 'indicate', 'indicated', 'indicates',
      'provide', 'provided', 'provides', 'allow', 'allowed', 'allows',
      'enable', 'enabled', 'enables', 'require', 'required', 'requires',
      'use', 'used', 'uses', 'using', 'based', 'approach', 'method', 'methods'
    ]);
    
    // Extract words, filter stop words, keep meaningful terms
    const words = claim
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')  // Keep hyphens for compound terms
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Take top 5-7 terms to avoid overly specific queries
    const keyTerms = words.slice(0, 7);
    
    // If we filtered too aggressively, fall back to first few words
    if (keyTerms.length < 3) {
      return claim.split(/\s+/).slice(0, 5).join(' ');
    }
    
    return keyTerms.join(' ');
  }

  /**
   * Convert web search result to snippet format
   * Note: The full result object is stored in the candidate's metadata field (added separately)
   */
  private convertWebResultToSnippet(result: Record<string, unknown>): EmbeddedSnippet & { metadata?: { paperData: Record<string, unknown> } } {
    return {
      id: `web_${Date.now()}_${Math.random()}`,
      filePath: (result.url as string) || '',
      fileName: (result.title as string) || '',
      text: (result.snippet as string) || '',
      embedding: [], // Web results don't have embeddings
      startLine: 0,
      endLine: 0,
      timestamp: Date.now(),
      // Store full paper metadata for later use (type extension)
      metadata: {
        paperData: result // Store the entire result object
      }
    };
  }

  /**
   * Call OpenAI API
   */
  private callOpenAIAPI(prompt: string, jsonMode: boolean = false): Promise<string> {
    return new Promise((resolve, reject) => {
      const body: any = {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      };
      
      if (jsonMode) {
        body.response_format = { type: 'json_object' };
      }
      
      const payload = JSON.stringify(body);

      const options = {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.openaiApiKey}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const response = JSON.parse(data);
              const content = response.choices[0].message.content;
              resolve(content);
            } else {
              reject(new Error(`OpenAI API error: ${res.statusCode} ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Check if cached validation exists for a claim without running validation.
   * Returns the cached result if available, null otherwise.
   */
  getCachedValidation(claimText: string): SupportValidation | null {
    if (!this.validationCache) {
      return null;
    }
    const cached = this.validationCache.get(claimText);
    if (cached) {
      return {
        claimId: '',  // Will be filled in by caller
        similarity: cached.similarity,
        supported: cached.supported,
        suggestedQuotes: cached.suggestedQuotes,
        analysis: cached.analysis
      };
    }
    return null;
  }

  /**
   * Validate whether a claim's quote actually supports the claim text.
   * Uses semantic similarity between claim text and quote text.
   * Checks cache first before computing.
   * 
   * @param claim The claim to validate
   * @returns Validation result with similarity score and support status
   */
  async validateSupport(claim: Claim): Promise<SupportValidation> {
    try {
      // Check cache first
      if (this.validationCache) {
        const cached = this.validationCache.get(claim.text);
        if (cached) {
          console.log(`[VerificationFeedbackLoop] Cache hit for validation of claim ${claim.id}`);
          return {
            claimId: claim.id,
            similarity: cached.similarity,
            supported: cached.supported,
            suggestedQuotes: cached.suggestedQuotes,
            analysis: cached.analysis
          };
        }
      }
      
      // Get the quote text and source from primaryQuote
      const quoteText = claim.primaryQuote?.text || '';
      const source = claim.primaryQuote?.source || '';
      
      // Calculate similarity between claim text and primary quote
      const similarity = await this.analyzeSimilarity(claim.text, quoteText);
      
      // Determine if claim is supported
      const supported = similarity >= this.WEAK_SUPPORT_THRESHOLD;
      
      // If weakly supported, try to find better quotes
      let suggestedQuotes: string[] | undefined;
      if (similarity < this.STRONG_SUPPORT_THRESHOLD) {
        suggestedQuotes = await this.findBetterQuotes(claim.text, source);
      }
      
      // Generate analysis text
      const analysis = this.generateAnalysis(similarity, supported);
      
      const result: SupportValidation = {
        claimId: claim.id,
        similarity,
        supported,
        suggestedQuotes,
        analysis
      };
      
      // Store in cache
      if (this.validationCache) {
        this.validationCache.set(claim.text, {
          similarity,
          supported,
          suggestedQuotes: suggestedQuotes || [],
          analysis
        });
        console.log(`[VerificationFeedbackLoop] Cached validation result for claim ${claim.id}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error validating support for claim ${claim.id}:`, error);
      return {
        claimId: claim.id,
        similarity: 0,
        supported: false,
        analysis: `Error during validation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Analyze semantic similarity between claim text and quote.
   * 
   * @param claimText The claim statement
   * @param quote The supporting quote
   * @returns Similarity score between 0 and 1
   */
  async analyzeSimilarity(claimText: string, quote: string): Promise<number> {
    if (!claimText || !quote) {
      return 0;
    }

    try {
      // Generate embeddings for both texts
      const [claimEmbedding, quoteEmbedding] = await Promise.all([
        this.embeddingService.embed(claimText),
        this.embeddingService.embed(quote)
      ]);

      if (!claimEmbedding || !quoteEmbedding) {
        return 0;
      }

      // Calculate cosine similarity
      const similarity = this.calculateCosineSimilarity(claimEmbedding, quoteEmbedding);
      
      // Ensure result is between 0 and 1
      return Math.max(0, Math.min(1, similarity));
    } catch (error) {
      console.error('Error calculating similarity:', error);
      return 0;
    }
  }

  /**
   * Find better supporting quotes from the same paper.
   * 
   * @param claimText The claim statement
   * @param source The source identifier (AuthorYear format)
   * @returns Array of suggested quotes, or empty array if none found
   */
  async findBetterQuotes(claimText: string, source: string): Promise<string[]> {
    try {
      // Skip if no source provided
      if (!source || source.trim().length === 0) {
        console.debug('[VerificationFeedbackLoop] No source provided, skipping quote search');
        return [];
      }

      // Try to load the source text from extracted text directory
      const sourceText = await this.loadSourceText(source);
      
      if (!sourceText) {
        console.debug(`[VerificationFeedbackLoop] Source text not found for ${source}`);
        return [];
      }

      // Split source text into sentences
      const sentences = this.extractSentences(sourceText);
      
      if (sentences.length === 0) {
        return [];
      }

      // Generate embedding for claim
      const claimEmbedding = await this.embeddingService.embed(claimText);
      if (!claimEmbedding || claimEmbedding.length === 0) {
        return [];
      }
      
      // Calculate similarity for each sentence
      const sentenceScores: Array<{ sentence: string; similarity: number }> = [];
      
      // Process sentences in batches to avoid memory issues
      const BATCH_SIZE = 50;
      for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
        const batch = sentences.slice(i, i + BATCH_SIZE);
        const embeddings = await Promise.all(batch.map(s => this.embeddingService.embed(s)));
        
        for (let j = 0; j < batch.length; j++) {
          if (embeddings[j] && embeddings[j]!.length > 0) {
            const similarity = this.calculateCosineSimilarity(claimEmbedding, embeddings[j]!);
            sentenceScores.push({
              sentence: batch[j],
              similarity
            });
          }
        }
      }
      
      // Sort by similarity and take top 3
      sentenceScores.sort((a, b) => b.similarity - a.similarity);
      
      // Filter for sentences with reasonable similarity (> 0.5) and return top 3
      const suggestions = sentenceScores
        .filter(s => s.similarity > 0.5)
        .slice(0, 3)
        .map(s => s.sentence);
      
      return suggestions;
    } catch (error) {
      console.error(`Error finding better quotes for ${source}:`, error);
      return [];
    }
  }

  /**
   * Validate all claims in a batch.
   * 
   * @param claims Array of claims to validate
   * @param progressCallback Optional callback for progress updates
   * @returns Array of validation results
   */
  async batchValidate(
    claims: Claim[],
    progressCallback?: (current: number, total: number) => void
  ): Promise<SupportValidation[]> {
    const results: SupportValidation[] = [];
    const total = claims.length;
    
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      
      // Report progress
      if (progressCallback) {
        progressCallback(i + 1, total);
      }
      
      // Validate claim
      const validation = await this.validateSupport(claim);
      results.push(validation);
      
      // Yield to event loop to avoid blocking
      if (i % 10 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    return results;
  }

  /**
   * Flag claims with weak support (low similarity).
   * 
   * @param claims Array of claims to check
   * @param threshold Similarity threshold (default: 0.6)
   * @returns Array of claims with weak support
   */
  async flagWeakSupport(claims: Claim[], threshold?: number): Promise<Array<{ claim: Claim; validation: SupportValidation }>> {
    const effectiveThreshold = threshold ?? this.WEAK_SUPPORT_THRESHOLD;
    const weakClaims: Array<{ claim: Claim; validation: SupportValidation }> = [];
    
    for (const claim of claims) {
      const validation = await this.validateSupport(claim);
      
      if (validation.similarity < effectiveThreshold) {
        weakClaims.push({ claim, validation });
      }
    }
    
    return weakClaims;
  }

  /**
   * Generate a human-readable analysis of the validation result.
   */
  private generateAnalysis(similarity: number, supported: boolean): string {
    if (similarity >= this.STRONG_SUPPORT_THRESHOLD) {
      return `Strong support: The quote strongly supports the claim (similarity: ${(similarity * 100).toFixed(1)}%)`;
    } else if (similarity >= this.WEAK_SUPPORT_THRESHOLD) {
      return `Moderate support: The quote provides some support for the claim (similarity: ${(similarity * 100).toFixed(1)}%). Consider finding a more directly relevant quote.`;
    } else {
      return `Weak support: The quote may not adequately support the claim (similarity: ${(similarity * 100).toFixed(1)}%). Consider finding a better supporting quote.`;
    }
  }

  /**
   * Load source text from the extracted text directory.
   */
  private async loadSourceText(source: string): Promise<string | null> {
    try {
      // Try common filename patterns
      const possibleFilenames = [
        `${source}.txt`,
        `${source}.md`,
        `${source}_extracted.txt`,
        `${source}_extracted.md`
      ];
      
      for (const filename of possibleFilenames) {
        const filePath = path.join(this.extractedTextPath, filename);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          return content;
        } catch {
          // Try next filename
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error loading source text for ${source}:`, error);
      return null;
    }
  }

  /**
   * Extract sentences from text.
   * Uses simple sentence boundary detection.
   */
  private extractSentences(text: string): string[] {
    // Split on sentence boundaries (., !, ?)
    // Keep sentences that are at least 20 characters long
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length >= 20);
    
    return sentences;
  }

  /**
   * Update the extracted text path.
   */
  updateExtractedTextPath(newPath: string): void {
    this.extractedTextPath = newPath;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    if (!this.confidenceCache) {
      return null;
    }
    return this.confidenceCache.getStats();
  }

  /**
   * Clear the confidence cache
   */
  clearCache(): void {
    if (this.confidenceCache) {
      this.confidenceCache.clear();
      console.log('[VerificationFeedbackLoop] Confidence cache cleared');
    }
  }

  /**
   * Dispose and cleanup
   */
  async dispose(): Promise<void> {
    if (this.confidenceCache) {
      await this.confidenceCache.dispose();
    }
    if (this.validationCache) {
      await this.validationCache.dispose();
    }
  }
}
