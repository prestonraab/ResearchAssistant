import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MCPClientManager } from '../mcp/mcpClient';
import { ClaimsManager, Claim } from './claimsManager';
import { EmbeddingService } from './embeddingService';

export type SearchResultType = 'paper' | 'claim' | 'draft' | 'extracted_text';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  location?: {
    filePath: string;
    lineNumber?: number;
  };
  metadata?: any;
}

export interface SearchOptions {
  types?: SearchResultType[];
  maxResults?: number;
  semanticSearch?: boolean;
  keywordSearch?: boolean;
}

export class UnifiedSearchService {
  private searchHistory: string[] = [];
  private readonly MAX_HISTORY = 20;

  constructor(
    private readonly mcpClient: MCPClientManager,
    private readonly claimsManager: ClaimsManager,
    private readonly embeddingService: EmbeddingService,
    private readonly workspaceRoot: string
  ) {}

  /**
   * Search across all content types
   */
  public async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<Map<SearchResultType, SearchResult[]>> {
    // Add to search history
    this.addToHistory(query);

    const {
      types = ['paper', 'claim', 'draft', 'extracted_text'],
      maxResults = 50,
      semanticSearch = true,
      keywordSearch = true
    } = options;

    const results = new Map<SearchResultType, SearchResult[]>();

    // Search in parallel
    const searchPromises: Promise<void>[] = [];

    if (types.includes('paper')) {
      searchPromises.push(
        this.searchPapers(query, semanticSearch, keywordSearch, maxResults)
          .then(paperResults => { results.set('paper', paperResults); })
      );
    }

    if (types.includes('claim')) {
      searchPromises.push(
        this.searchClaims(query, semanticSearch, keywordSearch, maxResults)
          .then(claimResults => { results.set('claim', claimResults); })
      );
    }

    if (types.includes('draft')) {
      searchPromises.push(
        this.searchDrafts(query, maxResults)
          .then(draftResults => { results.set('draft', draftResults); })
      );
    }

    if (types.includes('extracted_text')) {
      searchPromises.push(
        this.searchExtractedText(query, maxResults)
          .then(textResults => { results.set('extracted_text', textResults); })
      );
    }

    await Promise.all(searchPromises);

    return results;
  }

  /**
   * Search papers in Zotero library
   */
  private async searchPapers(
    query: string,
    semantic: boolean,
    keyword: boolean,
    maxResults: number
  ): Promise<SearchResult[]> {
    try {
      if (!this.mcpClient.isConnected('zotero')) {
        return [];
      }

      let papers: any[] = [];

      // Try semantic search first if enabled
      if (semantic) {
        papers = await this.mcpClient.zoteroSemanticSearch(query, maxResults);
      }

      // Fall back to keyword search if semantic fails or is disabled
      if ((!papers || papers.length === 0) && keyword) {
        papers = await this.mcpClient.zoteroSemanticSearch(query, maxResults);
      }

      return papers.map(paper => ({
        type: 'paper' as SearchResultType,
        id: paper.key || paper.itemKey,
        title: paper.title || 'Untitled',
        snippet: this.truncate(paper.abstract || '', 200),
        relevanceScore: paper.score || 0.5,
        metadata: {
          authors: paper.authors,
          year: paper.year,
          doi: paper.doi
        }
      }));
    } catch (error) {
      console.error('Error searching papers:', error);
      return [];
    }
  }

  /**
   * Search claims database
   */
  private async searchClaims(
    query: string,
    semantic: boolean,
    keyword: boolean,
    maxResults: number
  ): Promise<SearchResult[]> {
    try {
      const claims = await this.claimsManager.loadClaims();
      let results: Array<{ claim: Claim; score: number }> = [];

      // Semantic search
      if (semantic) {
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);
        
        const scoredClaims = await Promise.all(
          claims.map(async claim => {
            // Always generate embedding (caching is handled by EmbeddingService)
            const claimEmbedding = await this.embeddingService.generateEmbedding(claim.text);
            const score = this.embeddingService.cosineSimilarity(queryEmbedding, claimEmbedding);
            return { claim, score };
          })
        );

        results = scoredClaims.filter(r => r.score > 0.3);
      }

      // Keyword search (if semantic didn't find enough or is disabled)
      if ((!results || results.length < 5) && keyword) {
        const queryLower = query.toLowerCase();
        const keywordResults = claims
          .filter(claim => 
            claim.text.toLowerCase().includes(queryLower) ||
            claim.primaryQuote.toLowerCase().includes(queryLower) ||
            claim.category.toLowerCase().includes(queryLower)
          )
          .map(claim => ({ claim, score: 0.5 }));

        // Merge with semantic results
        const existingIds = new Set(results.map(r => r.claim.id));
        keywordResults.forEach(kr => {
          if (!existingIds.has(kr.claim.id)) {
            results.push(kr);
          }
        });
      }

      // Sort by score and limit
      results.sort((a, b) => b.score - a.score);
      results = results.slice(0, maxResults);

      return results.map(({ claim, score }) => ({
        type: 'claim' as SearchResultType,
        id: claim.id,
        title: `${claim.id}: ${this.truncate(claim.text, 80)}`,
        snippet: claim.text,
        relevanceScore: score,
        metadata: {
          category: claim.category,
          source: claim.source,
          verified: claim.verified
        }
      }));
    } catch (error) {
      console.error('Error searching claims:', error);
      return [];
    }
  }

  /**
   * Search draft files
   */
  private async searchDrafts(query: string, maxResults: number): Promise<SearchResult[]> {
    const draftsDir = path.join(this.workspaceRoot, '03_Drafting');
    
    if (!fs.existsSync(draftsDir)) {
      return [];
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    // Find all markdown files in drafts directory
    const files = fs.readdirSync(draftsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(draftsDir, f));

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Search for query in each line
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(queryLower)) {
            results.push({
              type: 'draft',
              id: `${path.basename(filePath)}:${index + 1}`,
              title: path.basename(filePath),
              snippet: this.highlightMatch(line, query),
              relevanceScore: 0.7,
              location: {
                filePath,
                lineNumber: index + 1
              }
            });
          }
        });
      } catch (error) {
        console.error(`Error searching file ${filePath}:`, error);
      }
    }

    // Sort by relevance and limit
    return results.slice(0, maxResults);
  }

  /**
   * Search extracted text files
   */
  private async searchExtractedText(query: string, maxResults: number): Promise<SearchResult[]> {
    const extractedTextDir = path.join(this.workspaceRoot, 'literature', 'ExtractedText');
    
    if (!fs.existsSync(extractedTextDir)) {
      return [];
    }

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    // Find all markdown files in extracted text directory
    const files = fs.readdirSync(extractedTextDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(extractedTextDir, f));

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        // Search for query in each line
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(queryLower)) {
            results.push({
              type: 'extracted_text',
              id: `${path.basename(filePath)}:${index + 1}`,
              title: path.basename(filePath, '.md'),
              snippet: this.highlightMatch(line, query),
              relevanceScore: 0.6,
              location: {
                filePath,
                lineNumber: index + 1
              }
            });
          }
        });
      } catch (error) {
        console.error(`Error searching file ${filePath}:`, error);
      }
    }

    // Sort by relevance and limit
    return results.slice(0, maxResults);
  }

  /**
   * Navigate to search result
   */
  public async navigateToResult(result: SearchResult): Promise<void> {
    if (result.location) {
      const document = await vscode.workspace.openTextDocument(result.location.filePath);
      const editor = await vscode.window.showTextDocument(document);

      if (result.location.lineNumber) {
        const line = result.location.lineNumber - 1;
        const position = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      }
    } else if (result.type === 'paper') {
      // Open paper in Zotero or show metadata
      vscode.window.showInformationMessage(`Paper: ${result.title}`);
    } else if (result.type === 'claim') {
      // Show claim details
      vscode.commands.executeCommand('researchAssistant.showClaimDetails', result.id);
    }
  }

  /**
   * Get search history
   */
  public getSearchHistory(): string[] {
    return [...this.searchHistory];
  }

  /**
   * Clear search history
   */
  public clearSearchHistory(): void {
    this.searchHistory = [];
  }

  /**
   * Add query to search history
   */
  private addToHistory(query: string): void {
    // Remove if already exists
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }

    // Add to beginning
    this.searchHistory.unshift(query);

    // Limit size
    if (this.searchHistory.length > this.MAX_HISTORY) {
      this.searchHistory = this.searchHistory.slice(0, this.MAX_HISTORY);
    }
  }

  /**
   * Truncate text to specified length
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Highlight matching text in snippet
   */
  private highlightMatch(text: string, query: string): string {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) {
      return this.truncate(text, 200);
    }

    // Get context around match
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + query.length + 50);
    
    let snippet = text.substring(start, end);
    if (start > 0) {
      snippet = '...' + snippet;
    }
    if (end < text.length) {
      snippet = snippet + '...';
    }

    return snippet;
  }

  /**
   * Group results by type with counts
   */
  public groupResults(
    results: Map<SearchResultType, SearchResult[]>
  ): Array<{ type: SearchResultType; count: number; results: SearchResult[] }> {
    const grouped: Array<{ type: SearchResultType; count: number; results: SearchResult[] }> = [];

    const typeOrder: SearchResultType[] = ['paper', 'claim', 'draft', 'extracted_text'];
    
    typeOrder.forEach(type => {
      const typeResults = results.get(type) || [];
      if (typeResults.length > 0) {
        grouped.push({
          type,
          count: typeResults.length,
          results: typeResults
        });
      }
    });

    return grouped;
  }
}
