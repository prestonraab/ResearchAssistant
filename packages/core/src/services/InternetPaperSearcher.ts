import * as https from 'https';
import * as http from 'http';
import type { ExternalPaper } from '../types/index.js';

/**
 * InternetPaperSearcher - Platform-agnostic academic paper search
 * 
 * Searches across 4 free academic APIs:
 * - CrossRef: Scholarly metadata
 * - PubMed: Biomedical literature
 * - arXiv: Preprints
 * - Semantic Scholar: Computer science and beyond
 * 
 * All APIs are free and require no authentication.
 * Results are deduplicated by DOI and title.
 */
export class InternetPaperSearcher {
  private readonly SEARCH_TIMEOUT = 10000; // 10 seconds
  private readonly MAX_RESULTS = 10;

  /**
   * Search external sources for papers
   * Searches all 4 academic sources in parallel
   * @param query - Search query string
   * @returns Array of papers sorted by year (most recent first)
   */
  public async searchExternal(query: string): Promise<ExternalPaper[]> {
    const results: ExternalPaper[] = [];

    try {
      // Search all 4 sources in parallel
      const [crossrefResults, pubmedResults, arxivResults, semanticScholarResults] = await Promise.allSettled([
        this.searchCrossRef(query),
        this.searchPubMed(query),
        this.searchArxiv(query),
        this.searchSemanticScholar(query),
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

      if (arxivResults.status === 'fulfilled') {
        results.push(...arxivResults.value);
      } else {
        console.warn('arXiv search failed:', arxivResults.reason);
      }

      if (semanticScholarResults.status === 'fulfilled') {
        results.push(...semanticScholarResults.value);
      } else {
        console.warn('Semantic Scholar search failed:', semanticScholarResults.reason);
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
   * Search arXiv for preprints
   * Free API, no authentication required
   */
  private async searchArxiv(query: string): Promise<ExternalPaper[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=10&sortBy=relevance&sortOrder=descending`;

      return await new Promise((resolve) => {
        https.get(url, { timeout: this.SEARCH_TIMEOUT }, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              // Parse Atom XML response
              const entries = data.match(/<entry>[\s\S]*?<\/entry>/g) || [];
              const results = entries.map((entry: string) => {
                const titleMatch = entry.match(/<title>(.*?)<\/title>/);
                const idMatch = entry.match(/<id>(.*?)<\/id>/);
                const summaryMatch = entry.match(/<summary>(.*?)<\/summary>/);
                const authorMatches = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>/g) || [];
                const publishedMatch = entry.match(/<published>(.*?)<\/published>/);

                const authors = authorMatches.map((a: string) => {
                  const nameMatch = a.match(/<name>(.*?)<\/name>/);
                  return nameMatch ? nameMatch[1] : 'Unknown';
                });

                const year = publishedMatch ? parseInt(publishedMatch[1].substring(0, 4)) : new Date().getFullYear();

                return {
                  title: titleMatch ? titleMatch[1].trim() : 'arXiv Paper',
                  authors: authors.length > 0 ? authors : ['Unknown'],
                  year,
                  abstract: summaryMatch ? summaryMatch[1].trim() : '',
                  url: idMatch ? idMatch[1].replace('http://arxiv.org/abs/', 'https://arxiv.org/abs/') : '',
                  source: 'scholar' as const,
                  venue: 'arXiv',
                };
              }).filter((r: any) => r.url && r.title);

              resolve(results);
            } catch (error) {
              console.warn('[InternetPaperSearcher] Error parsing arXiv response:', error);
              resolve([]);
            }
          });
        }).on('error', (error) => {
          console.warn('[InternetPaperSearcher] arXiv search error:', error);
          resolve([]);
        });
      });
    } catch (error) {
      console.error('[InternetPaperSearcher] arXiv search failed:', error);
      return [];
    }
  }

  /**
   * Search Semantic Scholar for papers
   * Free API, no authentication required
   */
  private async searchSemanticScholar(query: string): Promise<ExternalPaper[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=10&fields=title,url,abstract,year,authors`;

      return await new Promise((resolve) => {
        https.get(url, {
          timeout: this.SEARCH_TIMEOUT,
          headers: {
            'User-Agent': 'Research-Assistant/1.0',
          },
        }, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode === 200) {
                const parsed = JSON.parse(data);
                const results = (parsed.data || []).map((item: any) => ({
                  title: item.title,
                  authors: (item.authors || []).map((a: any) => a.name || 'Unknown'),
                  year: item.year || new Date().getFullYear(),
                  abstract: item.abstract || '',
                  url: item.url || `https://www.semanticscholar.org/paper/${item.paperId}`,
                  source: 'scholar' as const,
                  venue: 'Semantic Scholar',
                }));
                resolve(results);
              } else {
                resolve([]);
              }
            } catch (error) {
              console.warn('[InternetPaperSearcher] Error parsing Semantic Scholar response:', error);
              resolve([]);
            }
          });
        }).on('error', (error) => {
          console.warn('[InternetPaperSearcher] Semantic Scholar search error:', error);
          resolve([]);
        });
      });
    } catch (error) {
      console.error('[InternetPaperSearcher] Semantic Scholar search failed:', error);
      return [];
    }
  }

  /**
   * Deduplicate results by DOI and title similarity
   */
  public deduplicateResults(results: ExternalPaper[]): ExternalPaper[] {
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
   * Helper method to make HTTPS GET requests
   */
  private httpsGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      const request = protocol.get(url, {
        headers: {
          'User-Agent': 'Research-Assistant/1.0',
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
}
