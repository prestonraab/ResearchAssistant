import * as https from 'https';
import * as vscode from 'vscode';
import { LiteratureIndexer } from './literatureIndexer';
import { EmbeddedSnippet } from './embeddingStore';

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

/**
 * Implements verification feedback loop:
 * 1. Search literature by embedding similarity
 * 2. Verify results with LLM
 * 3. If unsupported, refine query and retry
 * 4. If still unsupported, do web search
 */
export class VerificationFeedbackLoop {
  private literatureIndexer: LiteratureIndexer;
  private openaiApiKey: string;
  private maxRounds: number = 3;

  constructor(literatureIndexer: LiteratureIndexer, openaiApiKey?: string) {
    this.literatureIndexer = literatureIndexer;
    this.openaiApiKey = openaiApiKey || this.getSettingValue('openaiApiKey') || process.env.OPENAI_API_KEY || '';
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
   */
  async findSupportingEvidence(claim: string, onRoundComplete?: (round: SearchRound) => void): Promise<SearchRound[]> {
    let currentQuery = claim;
    let supportingSnippets: EmbeddedSnippet[] = [];
    const completedRounds: SearchRound[] = [];

    console.log('[VerificationFeedbackLoop] Starting verification loop for claim:', claim.substring(0, 50));

    // First, ensure literature is indexed
    console.log('[VerificationFeedbackLoop] Ensuring literature is indexed...');
    
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Indexing literature...',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0, message: 'Scanning files...' });
        
        const indexStats = await this.literatureIndexer.indexChangedFiles();
        console.log('[VerificationFeedbackLoop] Index stats:', indexStats);
        
        progress.report({ 
          increment: 100, 
          message: `Indexed ${indexStats.indexed} files, skipped ${indexStats.skipped}` 
        });

        for (let round = 1; round <= this.maxRounds; round++) {
          console.log(`[VerificationFeedbackLoop] Round ${round}/${this.maxRounds}`);

          // Step 1: Search literature
          const snippets = await this.literatureIndexer.searchSnippets(currentQuery, 5);
          console.log(`[VerificationFeedbackLoop] Found ${snippets.length} snippets`);

          if (snippets.length === 0) {
            console.log('[VerificationFeedbackLoop] No snippets found, moving to web search');
            break;
          }

          // Step 2: Verify with LLM
          const verifications = await this.verifySnippets(claim, snippets);
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
            currentQuery = await this.refineQuery(claim, verifications);
            console.log('[VerificationFeedbackLoop] Refined query:', currentQuery.substring(0, 50));
          }

          // Clear verification results from memory after processing
          // Keep only the supporting snippets
          verifications.length = 0;
        }

        // If no supporting evidence found in literature, do web search
        if (supportingSnippets.length === 0) {
          console.log('[VerificationFeedbackLoop] No supporting evidence in literature, attempting web search');
          const webResults = await this.webSearch(claim);
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
      }
    );
  }

  /**
   * Verify if snippets support the claim using LLM
   */
  private async verifySnippets(claim: string, snippets: EmbeddedSnippet[]): Promise<VerificationResult[]> {
    const results: VerificationResult[] = [];

    for (const snippet of snippets) {
      const result = await this.verifySnippet(claim, snippet);
      results.push(result);
    }

    return results;
  }

  /**
   * Verify a single snippet against the claim
   */
  private async verifySnippet(claim: string, snippet: EmbeddedSnippet): Promise<VerificationResult> {
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
      const prompt = `You are a fact-checking assistant. Determine if the following snippet supports, refutes, or is unrelated to the claim.

CLAIM: ${claim}

SNIPPET: ${snippet.text}

Respond in JSON format:
{
  "supports": boolean (true if snippet supports the claim),
  "confidence": number (0-1, how confident you are),
  "reasoning": string (brief explanation)
}`;

      const response = await this.callOpenAIAPI(prompt);
      const parsed = JSON.parse(response);

      return {
        snippet,
        supports: parsed.supports === true,
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || ''
      };
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
   */
  private async webSearch(claim: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
    // This would integrate with a web search API (Google, Bing, etc.)
    // For now, return empty array - user can implement with their preferred API
    console.log('[VerificationFeedbackLoop] Web search not yet implemented');
    return [];
  }

  /**
   * Convert web search result to snippet format
   */
  private convertWebResultToSnippet(result: any): EmbeddedSnippet {
    return {
      id: `web_${Date.now()}_${Math.random()}`,
      filePath: result.url,
      fileName: result.title,
      text: result.snippet,
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
}
