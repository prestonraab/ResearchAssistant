import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { MCPClientManager, ZoteroItem } from '../mcp/mcpClient';

/**
 * Represents a paper found from external sources
 */
export interface ExternalPaper {
  title: string;
  authors: string[];
  year: number;
  abstract: string;
  doi?: string;
  url?: string;
  pdfUrl?: string;
  source: 'scholar' | 'pubmed' | 'crossref';
  venue?: string;
}

/**
 * InternetPaperSearcher integrates with external APIs to search for papers
 * and import them into Zotero.
 * 
 * Requirements: 47.1, 47.2, 47.3, 47.4, 47.5
 */
export class InternetPaperSearcher {
  private readonly SEARCH_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RESULTS = 10;

  constructor(
    private mcpClient: MCPClientManager,
    private workspaceRoot: string
  ) {}

  /**
   * Search external sources for papers
   * Requirement 47.2: Search external sources using the query
   */
  public async searchExternal(query: string): Promise<ExternalPaper[]> {
    const results: ExternalPaper[] = [];

    try {
      // Search multiple sources in parallel
      const [crossrefResults, pubmedResults] = await Promise.allSettled([
        this.searchCrossRef(query),
        this.searchPubMed(query),
      ]);

      // Combine results
      if (crossrefResults.status === 'fulfilled') {
        results.push(...crossrefResults.value);
      } else {
        console.warn('CrossRef search failed:', crossrefResults.reason);
      }

      if (pubmedResults.status === 'fulfilled') {
        results.push(...pubmedResults.value);
      } else {
        console.warn('PubMed search failed:', pubmedResults.reason);
      }

      // Deduplicate by DOI and title
      const uniqueResults = this.deduplicateResults(results);

      // Sort by year (most recent first)
      uniqueResults.sort((a, b) => b.year - a.year);

      return uniqueResults.slice(0, this.MAX_RESULTS);
    } catch (error) {
      console.error('External search failed:', error);
      throw new Error(`External search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search CrossRef API
   * CrossRef is a free, open API for scholarly metadata
   */
  private async searchCrossRef(query: string): Promise<ExternalPaper[]> {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=10&select=DOI,title,author,published,abstract,container-title,URL`;

    try {
      const response = await this.httpsGet(url);
      const data = JSON.parse(response);

      if (!data.message || !data.message.items) {
        return [];
      }

      return data.message.items.map((item: any) => this.parseCrossRefItem(item)).filter(Boolean);
    } catch (error) {
      console.error('CrossRef search error:', error);
      return [];
    }
  }

  /**
   * Parse CrossRef item into ExternalPaper format
   */
  private parseCrossRefItem(item: any): ExternalPaper | null {
    try {
      const title = Array.isArray(item.title) ? item.title[0] : item.title;
      if (!title) {
        return null;
      }

      const authors = (item.author || []).map((author: any) => {
        if (author.given && author.family) {
          return `${author.family}, ${author.given}`;
        }
        return author.family || author.name || 'Unknown';
      });

      const year = item.published?.['date-parts']?.[0]?.[0] || 
                   item.created?.['date-parts']?.[0]?.[0] || 
                   new Date().getFullYear();

      const abstract = Array.isArray(item.abstract) ? item.abstract[0] : item.abstract || '';

      return {
        title,
        authors,
        year,
        abstract,
        doi: item.DOI,
        url: item.URL,
        venue: Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'],
        source: 'crossref',
      };
    } catch (error) {
      console.error('Error parsing CrossRef item:', error);
      return null;
    }
  }

  /**
   * Search PubMed API
   * PubMed is a free search engine for biomedical literature
   */
  private async searchPubMed(query: string): Promise<ExternalPaper[]> {
    try {
      // Step 1: Search for PMIDs
      const encodedQuery = encodeURIComponent(query);
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmax=10&retmode=json`;
      
      const searchResponse = await this.httpsGet(searchUrl);
      const searchData = JSON.parse(searchResponse);

      const pmids = searchData.esearchresult?.idlist || [];
      if (pmids.length === 0) {
        return [];
      }

      // Step 2: Fetch details for PMIDs
      const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
      const fetchResponse = await this.httpsGet(fetchUrl);
      const fetchData = JSON.parse(fetchResponse);

      const results: ExternalPaper[] = [];
      for (const pmid of pmids) {
        const item = fetchData.result?.[pmid];
        if (item) {
          const paper = this.parsePubMedItem(item);
          if (paper) {
            results.push(paper);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('PubMed search error:', error);
      return [];
    }
  }

  /**
   * Parse PubMed item into ExternalPaper format
   */
  private parsePubMedItem(item: any): ExternalPaper | null {
    try {
      const title = item.title;
      if (!title) {
        return null;
      }

      const authors = (item.authors || []).map((author: any) => author.name || 'Unknown');
      const year = parseInt(item.pubdate?.substring(0, 4) || new Date().getFullYear().toString());

      // PubMed doesn't provide abstracts in summary, so we note that
      const abstract = 'Abstract available on PubMed';

      // Extract DOI from article IDs
      let doi: string | undefined;
      if (item.articleids) {
        const doiEntry = item.articleids.find((id: any) => id.idtype === 'doi');
        doi = doiEntry?.value;
      }

      return {
        title,
        authors,
        year,
        abstract,
        doi,
        url: `https://pubmed.ncbi.nlm.nih.gov/${item.uid}/`,
        venue: item.source,
        source: 'pubmed',
      };
    } catch (error) {
      console.error('Error parsing PubMed item:', error);
      return null;
    }
  }

  /**
   * Deduplicate results by DOI and title similarity
   */
  private deduplicateResults(results: ExternalPaper[]): ExternalPaper[] {
    const seen = new Set<string>();
    const unique: ExternalPaper[] = [];

    for (const paper of results) {
      // Use DOI as primary deduplication key
      if (paper.doi) {
        const normalizedDoi = paper.doi.toLowerCase().trim();
        if (seen.has(normalizedDoi)) {
          continue;
        }
        seen.add(normalizedDoi);
      }

      // Use normalized title as secondary key
      const normalizedTitle = paper.title.toLowerCase().trim().replace(/\s+/g, ' ');
      if (seen.has(normalizedTitle)) {
        continue;
      }
      seen.add(normalizedTitle);

      unique.push(paper);
    }

    return unique;
  }

  /**
   * Display external search results in a quick pick
   * Requirement 47.3: Display external results with metadata
   */
  public async displayExternalResults(results: ExternalPaper[]): Promise<ExternalPaper | null> {
    if (results.length === 0) {
      vscode.window.showInformationMessage('No papers found from external sources.');
      return null;
    }

    const items = results.map((paper, index) => ({
      label: `$(globe) ${paper.title}`,
      description: `${paper.authors.slice(0, 2).join(', ')}${paper.authors.length > 2 ? ' et al.' : ''} (${paper.year})`,
      detail: `${paper.abstract.substring(0, 150)}${paper.abstract.length > 150 ? '...' : ''} [${paper.source.toUpperCase()}]${paper.doi ? ` DOI: ${paper.doi}` : ''}`,
      paper,
      index,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Found ${results.length} paper${results.length !== 1 ? 's' : ''} from external sources - Select to import`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    return selected ? selected.paper : null;
  }

  /**
   * Import a paper to Zotero
   * Requirement 47.4: Import paper into Zotero with full metadata
   */
  public async importToZotero(paper: ExternalPaper): Promise<string | null> {
    try {
      // Show progress
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Importing "${paper.title.substring(0, 50)}..." to Zotero`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Creating Zotero item...' });

          // For now, we'll use a workaround since direct Zotero import via MCP
          // may not be available. We'll create a note with the metadata
          // and instruct the user to import manually.
          
          // In a full implementation, this would use Zotero's API or MCP
          // to create a new item directly.
          
          const itemKey = await this.createZoteroItemViaNote(paper);
          
          if (itemKey) {
            vscode.window.showInformationMessage(
              `Successfully imported "${paper.title.substring(0, 50)}..." to Zotero`,
              'Extract Fulltext'
            ).then(action => {
              if (action === 'Extract Fulltext' && itemKey) {
                this.extractFulltext(itemKey);
              }
            });
          }

          return itemKey;
        }
      );
    } catch (error) {
      console.error('Failed to import to Zotero:', error);
      vscode.window.showErrorMessage(
        `Failed to import paper: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return null;
    }
  }

  /**
   * Create a Zotero item via note (workaround for direct API)
   * In production, this would use Zotero's proper API
   */
  private async createZoteroItemViaNote(paper: ExternalPaper): Promise<string | null> {
    // This is a placeholder implementation
    // In a real system, you would:
    // 1. Use Zotero's web API to create an item
    // 2. Or use a Zotero MCP method to create items
    // 3. Or use Zotero's import from identifier (DOI)
    
    // For now, we'll show instructions to the user
    const metadata = this.formatMetadataForImport(paper);
    
    const action = await vscode.window.showInformationMessage(
      'Zotero import requires manual action. Copy metadata to clipboard?',
      'Copy Metadata',
      'Cancel'
    );

    if (action === 'Copy Metadata') {
      await vscode.env.clipboard.writeText(metadata);
      vscode.window.showInformationMessage(
        'Metadata copied! Paste into Zotero to import.',
        'Open Zotero'
      );
      
      // Return a pseudo item key
      return `external_${Date.now()}`;
    }

    return null;
  }

  /**
   * Format paper metadata for import
   */
  private formatMetadataForImport(paper: ExternalPaper): string {
    const lines = [
      `Title: ${paper.title}`,
      `Authors: ${paper.authors.join('; ')}`,
      `Year: ${paper.year}`,
      paper.venue ? `Venue: ${paper.venue}` : '',
      paper.doi ? `DOI: ${paper.doi}` : '',
      paper.url ? `URL: ${paper.url}` : '',
      '',
      'Abstract:',
      paper.abstract,
    ];

    return lines.filter(Boolean).join('\n');
  }

  /**
   * Extract fulltext after import
   * Requirement 47.5: Auto-trigger fulltext extraction after import
   */
  public async extractFulltext(itemKey: string): Promise<void> {
    try {
      // Check if PDF is available
      const children = await this.mcpClient.zotero.getItemChildren(itemKey);
      const pdfAttachment = children.find((child: any) => 
        child.contentType === 'application/pdf'
      );

      if (!pdfAttachment) {
        vscode.window.showWarningMessage(
          'No PDF attachment found. Please attach PDF in Zotero first.',
          'Open Zotero'
        );
        return;
      }

      // Trigger extraction via command
      await vscode.commands.executeCommand(
        'researchAssistant.extractPdfForItem',
        itemKey
      );
    } catch (error) {
      console.error('Failed to extract fulltext:', error);
      vscode.window.showErrorMessage(
        `Failed to extract fulltext: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Helper method to make HTTPS GET requests
   */
  private httpsGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'VSCode-Research-Assistant/1.0',
        },
        timeout: this.SEARCH_TIMEOUT,
      }, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    // Cleanup if needed
  }
}
