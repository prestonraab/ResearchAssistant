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
      this.confidenceCache.initialize().catch(error => {
        console.error('[VerificationFeedbackLoop] Failed to initialize confidence cache:', error);
      });
      
      this.validationCache = new ClaimValidationCache(workspaceRoot);
      this.validationCache.initialize().catch(error => {
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
    },
    signal?: AbortSignal
  ): Promise<SearchRound[]> {
    let currentQuery = claim;
    let supportingSnippets: EmbeddedSnippet[] = [];
    const completedRounds: SearchRound[] = [];

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

      for (let round = 1; round <= this.maxRounds; round++) {
        checkCancelled();
        
        console.log(`[VerificationFeedbackLoop] Round ${round}/${this.maxRounds}`);

        // Step 1: Search literature
        const snippets = await this.literatureIndexer.searchSnippets(currentQuery, 5);
        console.log(`[VerificationFeedbackLoop] Found ${snippets.length} snippets`);

        checkCancelled();

        if (snippets.length === 0) {
          console.log('[VerificationFeedbackLoop] No snippets found, moving to web search');
          break;
        }

        // Stream candidates immediately if callback provided
        if (streamCallbacks?.onCandidatesFound) {
          streamCallbacks.onCandidatesFound(round, snippets);
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
          signal
        );
        
        checkCancelled();
        
        const roundSupportingSnippets = snippets.filter((_, i) => verifications[i].supports);

        supportingSnippets.push(...roundSupportingSnippets);

        const roundData: SearchRound = {
          round,
          query: currentQuery,
          snippets,
          verifications,
          supportingSnippets: roundSupportingSnippets
        };

        completedRounds.push(roundData);
        
        // Stream result to caller if callback provided
        if (onRoundComplete) {
          onRoundComplete(roundData);
        }

        console.log(`[VerificationFeedbackLoop] Round ${round}: ${roundSupportingSnippets.length}/${snippets.length} snippets support claim`);

        // If we found supporting evidence, we're done
        if (roundSupportingSnippets.length > 0) {
          console.log('[VerificationFeedbackLoop] Found supporting evidence, stopping');
          break;
        }

        // Step 3: Refine query based on verification feedback
        if (round < this.maxRounds) {
          checkCancelled();
          currentQuery = await this.refineQuery(claim, verifications);
          console.log('[VerificationFeedbackLoop] Refined query:', currentQuery.substring(0, 50));
        }

        // Clear verification results from memory after processing
        // Keep only the supporting snippets
        verifications.length = 0;
        
        // Yield between rounds
        await new Promise(resolve => setImmediate(resolve));
      }

      checkCancelled();

      // If no supporting evidence found in literature, do web search
      if (supportingSnippets.length === 0) {
        console.log('[VerificationFeedbackLoop] No supporting evidence in literature, attempting web search');
        const webResults = await this.webSearch(claim);
        
        checkCancelled();
        
        if (webResults.length > 0) {
          const webRound: SearchRound = {
            round: this.maxRounds + 1,
            query: `web search: ${claim}`,
            snippets: webResults.map(r => this.convertWebResultToSnippet(r)),
            verifications: [],
            supportingSnippets: webResults.map(r => this.convertWebResultToSnippet(r))
          };
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
    signal?: AbortSignal
  ): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const snippet of snippets) {
      // Check cancellation before each verification
      if (signal?.aborted) {
        throw new DOMException('Operation cancelled', 'AbortError');
      }
      
      // Calculate semantic similarity between claim and snippet
      const similarity = this.calculateCosineSimilarity(claimEmbedding, snippet.embedding);
      const result = await this.verifySnippet(claim, snippet, similarity);
      results.push(result);
      
      // Stream verification result if callback provided
      if (onVerificationUpdate) {
        onVerificationUpdate(round, snippet.id, result);
      }
      
      // Yield to event loop after each verification
      await new Promise(resolve => setImmediate(resolve));
    }

    return results;
  }

  /**
   * Verify a single snippet against the claim
   * Uses cache if available, otherwise calls LLM
   */
  private async verifySnippet(claim: string, snippet: EmbeddedSnippet, similarity: number = 0): Promise<VerificationResult> {
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
      const prompt = `You are a rigorous fact-checking assistant. Determine if the following snippet directly supports or provides evidence for the specific claim. Do not count tangential or loosely related content as support.

CLAIM: ${claim}

SNIPPET: ${snippet.text}

SEMANTIC SIMILARITY: ${similarityPercentage}% (how textually similar the snippet is to the claim)

Consider the semantic similarity as context, but focus on whether the snippet provides direct evidence or support for the claim, regardless of textual similarity.

Respond in JSON format:
{
  "supports": boolean (true only if snippet directly supports or provides evidence for this specific claim),
  "confidence": number (0-1, how confident you are that this snippet directly supports the claim),
  "reasoning": string (brief explanation of why or why not)
}`;

      const response = await this.callOpenAIAPI(prompt);
      const parsed = JSON.parse(response);

      const result = {
        snippet,
        supports: parsed.supports === true,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || ''
      };

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
   * Refine search query based on verification feedback
   */
  private async refineQuery(claim: string, verifications: VerificationResult[]): Promise<string> {
    if (!this.openaiApiKey) {
      return claim;
    }

    try {
      const failureReasons = verifications
        .filter(v => !v.supports)
        .map(v => v.reasoning)
        .join('; ');

      const prompt = `You are helping refine a search query for academic papers.

ORIGINAL CLAIM: ${claim}

REASONS WHY PREVIOUS RESULTS DIDN'T SUPPORT THE CLAIM:
${failureReasons}

Generate a refined search query (2-5 words) that would find more relevant papers. Return only the query, no explanation.`;

      const response = await this.callOpenAIAPI(prompt);
      return response.trim();
    } catch (error) {
      console.error('[VerificationFeedbackLoop] Error refining query:', error);
      return claim;
    }
  }

  /**
   * Web search for supporting evidence
   * Uses free academic search APIs:
   * - arXiv (preprints)
   * - Semantic Scholar (peer-reviewed)
   * - CrossRef (scholarly metadata)
   * - PubMed (biomedical)
   * All free, no authentication required
   */
  private async webSearch(claim: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    try {
      // Import InternetPaperSearcher from core to reuse unified search
      const { InternetPaperSearcher } = await import('@research-assistant/core');
      const searcher = new InternetPaperSearcher();
      
      const papers = await searcher.searchExternal(claim);
      
      return papers.map(paper => ({
        title: paper.title,
        url: paper.url || '',
        snippet: paper.abstract || `${paper.authors.join(', ')} (${paper.year})`,
      })).filter(r => r.url);
    } catch (error) {
      console.error('[VerificationFeedbackLoop] Web search failed:', error);
      return [];
    }
  }

  /**
   * Convert web search result to snippet format
   */
  private convertWebResultToSnippet(result: Record<string, unknown>): EmbeddedSnippet {
    return {
      id: `web_${Date.now()}_${Math.random()}`,
      filePath: (result.url as string) || '',
      fileName: (result.title as string) || '',
      text: (result.snippet as string) || '',
      embedding: [], // Web results don't have embeddings
      startLine: 0,
      endLine: 0,
      timestamp: Date.now()
    };
  }

  /**
   * Call OpenAI API
   */
  private callOpenAIAPI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      });

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
