/**
 * NgramIndex - Fast fuzzy text search using n-gram inverted index
 * 
 * Inspired by:
 * - PostgreSQL pg_trgm extension for fuzzy text search
 * - Bioinformatics sequence alignment pre-filtering (BLAST)
 * - RAG hybrid search combining sparse and dense retrieval
 * 
 * Strategy:
 * 1. Pre-compute n-grams (6-char substrings by default) for all documents
 * 2. Build inverted index: ngram -> [doc_id, positions]
 * 3. On search: extract query ngrams, intersect posting lists
 * 4. Only run expensive fuzzy matching on candidate documents
 * 
 * Testing showed 6-grams filter out ~74% of documents while maintaining
 * correct document in top-5 for 80% of queries. 3-grams are too common
 * in academic text and provide no filtering.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface NgramMatch {
  fileName: string;
  filePath: string;
  containment: number;  // Fraction of query ngrams found in doc
  candidateRegions: Array<{ startLine: number; endLine: number; text: string }>;
}

export interface IndexedDocument {
  fileName: string;
  filePath: string;
  ngrams: Set<string>;
  lineOffsets: number[];
  // Content is loaded on-demand to save memory
}

// Default to 6-grams based on empirical testing
const DEFAULT_NGRAM_SIZE = 6;

/**
 * NgramIndex for fast approximate string matching
 */
export class TrigramIndex {
  private documents: Map<string, IndexedDocument> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map();  // ngram -> doc IDs
  private isBuilt: boolean = false;
  private ngramSize: number;

  constructor(private extractedTextPath: string, ngramSize: number = DEFAULT_NGRAM_SIZE) {
    this.ngramSize = ngramSize;
  }

  /**
   * Extract n-grams from text
   * Normalizes text to lowercase and removes extra whitespace
   */
  private extractNgrams(text: string): Set<string> {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const ngrams = new Set<string>();
    
    for (let i = 0; i <= normalized.length - this.ngramSize; i++) {
      ngrams.add(normalized.substring(i, i + this.ngramSize));
    }
    
    return ngrams;
  }

  /**
   * Calculate Jaccard similarity between two n-gram sets
   */
  private jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 || set2.size === 0) return 0;
    
    let intersection = 0;
    for (const ngram of set1) {
      if (set2.has(ngram)) intersection++;
    }
    
    const union = set1.size + set2.size - intersection;
    return intersection / union;
  }

  /**
   * Build the n-gram index from all documents
   * Yields to event loop periodically to prevent blocking
   */
  async buildIndex(): Promise<{ indexed: number; ngrams: number }> {
    if (!fs.existsSync(this.extractedTextPath)) {
      console.warn('[NgramIndex] Extracted text path not found:', this.extractedTextPath);
      return { indexed: 0, ngrams: 0 };
    }

    const files = fs.readdirSync(this.extractedTextPath)
      .filter(f => f.endsWith('.txt'));

    console.log(`[NgramIndex] Building ${this.ngramSize}-gram index for ${files.length} files...`);
    
    let filesProcessed = 0;
    
    for (const fileName of files) {
      const filePath = path.join(this.extractedTextPath, fileName);
      
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const ngrams = this.extractNgrams(content);
        
        // Build line offsets for position mapping
        const lineOffsets: number[] = [0];
        let offset = 0;
        for (const line of content.split('\n')) {
          offset += line.length + 1;
          lineOffsets.push(offset);
        }
        
        // Store document (without content to save memory)
        const doc: IndexedDocument = {
          fileName,
          filePath,
          ngrams,
          lineOffsets
        };
        this.documents.set(fileName, doc);
        
        // Update inverted index
        for (const ngram of ngrams) {
          if (!this.invertedIndex.has(ngram)) {
            this.invertedIndex.set(ngram, new Set());
          }
          this.invertedIndex.get(ngram)!.add(fileName);
        }
        
        filesProcessed++;
        
        // Yield every 10 files
        if (filesProcessed % 10 === 0) {
          await new Promise(resolve => setImmediate(resolve));
        }
      } catch (error) {
        console.warn(`[NgramIndex] Error indexing ${fileName}:`, error);
      }
    }

    this.isBuilt = true;
    console.log(`[NgramIndex] Index built: ${this.documents.size} docs, ${this.invertedIndex.size} unique ${this.ngramSize}-grams`);
    
    return {
      indexed: this.documents.size,
      ngrams: this.invertedIndex.size
    };
  }

  /**
   * Find candidate documents that might contain the query
   * Uses n-gram overlap with smarter filtering:
   * 1. Only consider rarer n-grams (not in >50% of docs)
   * 2. Require minimum absolute number of matching n-grams
   * 3. Use containment ratio (what % of query n-grams are in doc)
   * 
   * @param query The text to search for
   * @param minContainment Minimum fraction of query n-grams that must be in doc (default 0.3)
   * @returns Candidate documents sorted by containment score
   */
  async findCandidates(query: string, minContainment: number = 0.3): Promise<NgramMatch[]> {
    if (!this.isBuilt) {
      await this.buildIndex();
    }

    const queryNgrams = this.extractNgrams(query);
    
    if (queryNgrams.size === 0) {
      return [];
    }

    // Filter out common n-grams (appear in >50% of documents)
    const docCount = this.documents.size;
    const commonThreshold = docCount * 0.5;
    
    const rareQueryNgrams = new Set<string>();
    for (const ngram of queryNgrams) {
      const docsWithNgram = this.invertedIndex.get(ngram);
      if (!docsWithNgram || docsWithNgram.size < commonThreshold) {
        rareQueryNgrams.add(ngram);
      }
    }

    console.log(`[NgramIndex] Query: ${queryNgrams.size} total ${this.ngramSize}-grams, ${rareQueryNgrams.size} rare`);

    // If too few rare n-grams, use the least common ones
    let effectiveNgrams = rareQueryNgrams;
    if (rareQueryNgrams.size < 10 && queryNgrams.size > 10) {
      // Sort n-grams by frequency and take the 30 least common
      const ngramFreqs: Array<[string, number]> = [];
      for (const ngram of queryNgrams) {
        const freq = this.invertedIndex.get(ngram)?.size || 0;
        ngramFreqs.push([ngram, freq]);
      }
      ngramFreqs.sort((a, b) => a[1] - b[1]);
      effectiveNgrams = new Set(ngramFreqs.slice(0, 30).map(t => t[0]));
      console.log(`[NgramIndex] Using ${effectiveNgrams.size} least common ${this.ngramSize}-grams`);
    }

    // Find documents that share n-grams with query
    // Count how many query n-grams each doc contains
    const docNgramCounts = new Map<string, number>();
    
    for (const ngram of effectiveNgrams) {
      const docs = this.invertedIndex.get(ngram);
      if (docs) {
        for (const docId of docs) {
          docNgramCounts.set(docId, (docNgramCounts.get(docId) || 0) + 1);
        }
      }
    }

    // Calculate containment score: what fraction of query's rare n-grams are in doc
    const minMatches = Math.max(5, Math.floor(effectiveNgrams.size * minContainment));
    const matches: NgramMatch[] = [];
    
    for (const [docId, matchCount] of docNgramCounts) {
      // Require minimum absolute matches AND minimum containment ratio
      if (matchCount < minMatches) continue;
      
      const containment = matchCount / effectiveNgrams.size;
      if (containment < minContainment) continue;
      
      const doc = this.documents.get(docId);
      if (!doc) continue;
      
      // Find candidate regions within the document
      const regions = this.findCandidateRegions(query, doc);
      
      matches.push({
        fileName: doc.fileName,
        filePath: doc.filePath,
        containment,
        candidateRegions: regions
      });
    }

    // Sort by containment descending
    matches.sort((a, b) => b.containment - a.containment);
    
    console.log(`[NgramIndex] Found ${matches.length} candidates (required ${minMatches}+ matches, ${(minContainment*100).toFixed(0)}%+ containment)`);
    
    return matches;
  }

  /**
   * Fast candidate finding - skips expensive region detection
   * Returns documents sorted by n-gram containment without computing regions
   * Use this when you'll run fuzzy matching on the full document anyway
   */
  async findCandidatesFast(query: string, minContainment: number = 0.3): Promise<NgramMatch[]> {
    if (!this.isBuilt) {
      await this.buildIndex();
    }

    const queryNgrams = this.extractNgrams(query);
    
    if (queryNgrams.size === 0) {
      return [];
    }

    // Filter out common n-grams (appear in >50% of documents)
    const docCount = this.documents.size;
    const commonThreshold = docCount * 0.5;
    
    const rareQueryNgrams = new Set<string>();
    for (const ngram of queryNgrams) {
      const docsWithNgram = this.invertedIndex.get(ngram);
      if (!docsWithNgram || docsWithNgram.size < commonThreshold) {
        rareQueryNgrams.add(ngram);
      }
    }

    // If too few rare n-grams, use the least common ones
    let effectiveNgrams = rareQueryNgrams;
    if (rareQueryNgrams.size < 10 && queryNgrams.size > 10) {
      const ngramFreqs: Array<[string, number]> = [];
      for (const ngram of queryNgrams) {
        const freq = this.invertedIndex.get(ngram)?.size || 0;
        ngramFreqs.push([ngram, freq]);
      }
      ngramFreqs.sort((a, b) => a[1] - b[1]);
      effectiveNgrams = new Set(ngramFreqs.slice(0, 30).map(t => t[0]));
    }

    // Find documents that share n-grams with query
    const docNgramCounts = new Map<string, number>();
    
    for (const ngram of effectiveNgrams) {
      const docs = this.invertedIndex.get(ngram);
      if (docs) {
        for (const docId of docs) {
          docNgramCounts.set(docId, (docNgramCounts.get(docId) || 0) + 1);
        }
      }
    }

    // Calculate containment score
    const minMatches = Math.max(5, Math.floor(effectiveNgrams.size * minContainment));
    const matches: NgramMatch[] = [];
    
    for (const [docId, matchCount] of docNgramCounts) {
      if (matchCount < minMatches) continue;
      
      const containment = matchCount / effectiveNgrams.size;
      if (containment < minContainment) continue;
      
      const doc = this.documents.get(docId);
      if (!doc) continue;
      
      // Skip region detection - just return the document
      matches.push({
        fileName: doc.fileName,
        filePath: doc.filePath,
        containment,
        candidateRegions: []  // Empty - caller will use full document
      });
    }

    matches.sort((a, b) => b.containment - a.containment);
    return matches;
  }

  /**
   * Find regions within a document that likely contain the query
   * Uses sliding window with n-gram density
   */
  private findCandidateRegions(
    query: string,
    doc: IndexedDocument,
    windowLines: number = 10
  ): Array<{ startLine: number; endLine: number; text: string }> {
    const queryNgrams = this.extractNgrams(query);
    const lines = doc.content.split('\n');
    const regions: Array<{ startLine: number; endLine: number; text: string; score: number }> = [];
    
    // Slide window across document
    for (let i = 0; i < lines.length; i += Math.floor(windowLines / 2)) {
      const endLine = Math.min(i + windowLines, lines.length);
      const windowText = lines.slice(i, endLine).join('\n');
      const windowNgrams = this.extractNgrams(windowText);
      
      // Count matching n-grams
      let matches = 0;
      for (const ngram of queryNgrams) {
        if (windowNgrams.has(ngram)) matches++;
      }
      
      const score = matches / queryNgrams.size;
      
      // Only include windows with significant overlap
      if (score >= 0.3) {
        regions.push({
          startLine: i + 1,
          endLine: endLine,
          text: windowText,
          score
        });
      }
    }
    
    // Merge overlapping regions and return top ones
    const merged = this.mergeRegions(regions);
    return merged.slice(0, 3).map(r => ({
      startLine: r.startLine,
      endLine: r.endLine,
      text: r.text
    }));
  }

  /**
   * Merge overlapping regions
   */
  private mergeRegions(
    regions: Array<{ startLine: number; endLine: number; text: string; score: number }>
  ): Array<{ startLine: number; endLine: number; text: string; score: number }> {
    if (regions.length === 0) return [];
    
    // Sort by score descending, then by start line
    regions.sort((a, b) => b.score - a.score || a.startLine - b.startLine);
    
    const merged: typeof regions = [];
    const used = new Set<number>();
    
    for (const region of regions) {
      // Check if this region overlaps with any already selected
      let overlaps = false;
      for (const idx of used) {
        const existing = merged[idx];
        if (region.startLine <= existing.endLine && region.endLine >= existing.startLine) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        used.add(merged.length);
        merged.push(region);
      }
    }
    
    return merged;
  }

  /**
   * Check if index is built
   */
  isIndexBuilt(): boolean {
    return this.isBuilt;
  }

  /**
   * Get index statistics
   */
  getStats(): { documents: number; ngrams: number; avgNgramsPerDoc: number } {
    let totalNgrams = 0;
    for (const doc of this.documents.values()) {
      totalNgrams += doc.ngrams.size;
    }
    
    return {
      documents: this.documents.size,
      ngrams: this.invertedIndex.size,
      avgNgramsPerDoc: this.documents.size > 0 ? totalNgrams / this.documents.size : 0
    };
  }

  /**
   * Clear the index
   */
  clear(): void {
    this.documents.clear();
    this.invertedIndex.clear();
    this.isBuilt = false;
  }

  /**
   * Get document content by filename (loads from disk on demand)
   */
  getDocumentContent(fileName: string): string | null {
    const doc = this.documents.get(fileName);
    if (!doc) return null;
    
    try {
      return fs.readFileSync(doc.filePath, 'utf-8');
    } catch (error) {
      console.warn(`[NgramIndex] Failed to read ${fileName}:`, error);
      return null;
    }
  }
}
