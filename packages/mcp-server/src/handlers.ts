/**
 * Tool request handlers for the MCP server.
 * Each handler delegates to core services or external integrations.
 */

import {
  EmbeddingService,
  ClaimsManager,
  OutlineParser,
  SearchService,
  CoverageAnalyzer,
  ClaimStrengthCalculator,
  PaperRanker,
  ClaimExtractor,
  SynthesisEngine,
  SearchQueryGenerator,
  LiteratureIndexer,
} from '@research-assistant/core';
import { ZoteroClient } from '@research-assistant/core';
import { DoclingService } from './services/DoclingService.js';

export interface Services {
  embeddingService: EmbeddingService;
  claimsManager: ClaimsManager;
  searchService: SearchService;
  outlineParser: OutlineParser;
  coverageAnalyzer: CoverageAnalyzer;
  claimStrengthCalculator: ClaimStrengthCalculator;
  paperRanker: PaperRanker;
  claimExtractor: ClaimExtractor;
  synthesisEngine: SynthesisEngine;
  searchQueryGenerator: SearchQueryGenerator;
  literatureIndexer: LiteratureIndexer;
  zoteroClient?: ZoteroClient;
  doclingService?: DoclingService;
  workspaceRoot: string;
}

/**
 * Tool handler mapping - maps tool names to service methods
 */
const toolHandlers: Record<string, (args: any, services: Services) => Promise<any>> = {
  search_by_question: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.searchService.searchByQuestion(args.question, args.threshold);
  },
  validate_draft_citations: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.searchService.searchByDraft(args.draft_text, args.mode, args.threshold);
  },
  find_multi_source_support: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.searchService.findMultiSourceSupport(args.statement, args.min_sources);
  },
  check_section_coverage: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.coverageAnalyzer.analyzeSectionCoverage(args.section_id);
  },
  check_manuscript_coverage: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.coverageAnalyzer.analyzeManuscriptCoverage();
  },
  calculate_claim_strength: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.claimStrengthCalculator.calculateStrength(args.claim_id);
  },
  calculate_claim_strength_batch: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    return s.claimStrengthCalculator.calculateStrengthBatch(args.claim_ids);
  },
  rank_papers_for_section: async (args, s) => s.paperRanker.rankPapersForSection(args.section_id, args.papers),
  rank_papers_for_query: async (args, s) => s.paperRanker.rankPapersForQuery(args.query, args.papers),
  extract_claims_from_text: async (args, s) => s.claimExtractor.extractFromText(args.text, args.source),
  suggest_sections_for_claim: async (args, s) => s.claimExtractor.suggestSections(args.claim_text, args.sections),
  group_claims_by_theme: async (args, s) => s.synthesisEngine.groupClaimsByTheme(args.claims, args.threshold),
  generate_search_queries: async (args, s) => s.searchQueryGenerator.generateQueriesForSection(args.section_id),
  
  // Utility tools
  list_claims: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    
    // Filter by category if provided
    let filtered = claims;
    if (args.category) {
      filtered = claims.filter(c => c.category.toLowerCase().includes(args.category.toLowerCase()));
    }
    
    // Filter by source if provided
    if (args.source) {
      filtered = filtered.filter(c => c.primaryQuote?.source?.toLowerCase().includes(args.source.toLowerCase()));
    }
    
    // Filter by text search if provided
    if (args.search_text) {
      const searchLower = args.search_text.toLowerCase();
      filtered = filtered.filter(c => 
        c.text.toLowerCase().includes(searchLower) ||
        c.primaryQuote?.text?.toLowerCase().includes(searchLower)
      );
    }
    
    // Limit results
    const limit = args.limit || 50;
    const results = filtered.slice(0, limit);
    
    return {
      total_claims: claims.length,
      filtered_count: filtered.length,
      returned_count: results.length,
      claims: results.map(c => ({
        id: c.id,
        text: c.text,
        category: c.category,
        source: c.primaryQuote?.source || 'Unknown',
        verified: c.verified,
        sections: c.sections
      }))
    };
  },
  
  get_claim_details: async (args, s) => {
    const claims = s.claimsManager.getAllClaims();
    if (claims.length === 0) {
      throw new Error('Claims not loaded. The server may still be initializing. Please wait a moment and try again.');
    }
    
    const claim = s.claimsManager.getClaim(args.claim_id);
    if (!claim) {
      throw new Error(`Claim not found: ${args.claim_id}`);
    }
    
    return claim;
  },
  
  // Zotero tools
  zotero_get_collections: async (args, s) => {
    if (!s.zoteroClient) throw new Error('Zotero client not configured');
    return s.zoteroClient.getCollections();
  },
  zotero_get_collection_items: async (args, s) => {
    if (!s.zoteroClient) throw new Error('Zotero client not configured');
    return s.zoteroClient.getCollectionItems(args.collection_key);
  },
  zotero_add_paper: async (args, s) => {
    if (!s.zoteroClient) throw new Error('Zotero client not configured');
    return s.zoteroClient.createItem({
      itemType: 'journalArticle',
      title: args.title,
      creators: args.authors,
      date: args.date,
      DOI: args.doi,
      publicationTitle: args.publication_title
    });
  },

  // Docling tools
  extract_pdf_with_docling: async (args, s) => {
    if (!s.doclingService) throw new Error('Docling service not configured');
    return s.doclingService.extractPDFViaScript(args.pdf_path, args.output_path);
  },

  // Verification tools
  verify_all_claims: async (args, s) => {
    // Verify all claims by checking similarity between claim text and primary quotes
    const allClaims = s.claimsManager.getAllClaims();
    const results = [];
    
    for (const claim of allClaims) {
      const validation = await s.claimStrengthCalculator.validateSupport(
        claim,
        1,
        args.similarity_threshold || 0.8
      );
      results.push(validation);
    }
    
    return {
      totalClaims: allClaims.length,
      verified: results.filter(r => r.supported).length,
      unverified: results.filter(r => !r.supported).length,
      results
    };
  },

  // New high-impact tools
  extract_claims_from_arbitrary_text: async (args, s) => {
    return s.claimExtractor.extractFromText(
      args.text,
      args.source,
      args.confidence_threshold || 0.5
    );
  },

  bulk_import_from_zotero: async (args, s) => {
    if (!s.zoteroClient) throw new Error('Zotero client not configured');
    const items = await s.zoteroClient.getCollectionItems(
      args.collection_key,
      args.limit || 50
    );
    return {
      papersImported: items.length,
      errors: []
    };
  },

  search_papers_for_text: async (args, s) => {
    const { text, papers, limit = 10, threshold = 0.3 } = args;
    
    if (!text || !papers || papers.length === 0) {
      return [];
    }

    try {
      // Generate embedding for the query text
      const textEmbedding = await s.embeddingService.generateEmbedding(text);

      // Extract abstracts and batch generate embeddings in parallel
      const abstracts = papers.map((p: any) => p.abstract || p.title);
      const abstractEmbeddings = await s.embeddingService.generateBatchParallel(abstracts, 100);

      // Calculate rankings
      const rankedPapers: any[] = [];

      for (let i = 0; i < papers.length; i++) {
        const paper = papers[i];
        const abstractEmbedding = abstractEmbeddings[i];

        // Calculate semantic similarity
        const semanticSimilarity = s.embeddingService.cosineSimilarity(
          textEmbedding,
          abstractEmbedding
        );

        // Skip papers below threshold
        if (threshold !== undefined && semanticSimilarity < threshold) {
          continue;
        }

        rankedPapers.push({
          paper,
          relevanceScore: semanticSimilarity,
          semanticSimilarity,
          estimatedReadingTime: 0
        });
      }

      // Sort by relevance and apply limit
      rankedPapers.sort((a, b) => b.relevanceScore - a.relevanceScore);
      return rankedPapers.slice(0, limit);
    } catch (error) {
      throw new Error(`Failed to search papers: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  validate_claim_support: async (args, s) => {
    const claim = s.claimsManager.getClaim(args.claim_id);
    if (!claim) {
      throw new Error(`Claim not found: ${args.claim_id}`);
    }
    
    return s.claimStrengthCalculator.validateSupport(
      claim,
      args.min_sources || 1,
      args.similarity_threshold || 0.6
    );
  },

  find_unsupported_claims: async (args, s) => {
    const allClaims = s.claimsManager.getAllClaims();
    const weakClaims = [];
    
    for (const claim of allClaims) {
      const validation = await s.claimStrengthCalculator.validateSupport(
        claim,
        args.min_sources || 1,
        args.similarity_threshold || 0.6
      );
      
      if (!validation.supported) {
        weakClaims.push({
          claim,
          validation
        });
      }
    }
    
    // Sort by similarity (weakest first) and limit results
    weakClaims.sort((a, b) => a.validation.similarity - b.validation.similarity);
    return weakClaims.slice(0, args.limit || 50);
  },

  find_quote_in_source: async (args, s) => {
    const { quote, source, threshold = 0.7 } = args;
    
    if (!quote || !source) {
      throw new Error('quote and source are required');
    }

    try {
      // Generate embedding for the quote (cached if exists)
      const quoteEmbedding = await s.embeddingService.generateEmbedding(quote);
      
      // Split source into sentences
      const sentences = source
        .split(/[.!?]+/)
        .map((sentence: string) => sentence.trim())
        .filter((sentence: string) => sentence.length > 10);
      
      if (sentences.length === 0) {
        return {
          found: false,
          quote,
          bestMatch: null,
          similarity: 0,
          context: null
        };
      }

      // Generate embeddings for all sentences in parallel batches
      const sentenceEmbeddings = await s.embeddingService.generateBatchParallel(sentences, 100);
      
      // Find best match
      let bestMatch = null;
      let bestSimilarity = 0;
      let bestIndex = -1;

      for (let i = 0; i < sentences.length; i++) {
        const similarity = s.embeddingService.cosineSimilarity(
          quoteEmbedding,
          sentenceEmbeddings[i]
        );

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = sentences[i];
          bestIndex = i;
        }
      }

      // Get context (surrounding sentences)
      const contextStart = Math.max(0, bestIndex - 1);
      const contextEnd = Math.min(sentences.length, bestIndex + 2);
      const context = sentences.slice(contextStart, contextEnd).join(' ');

      return {
        found: bestSimilarity >= threshold,
        quote,
        bestMatch,
        similarity: bestSimilarity,
        context,
        threshold
      };
    } catch (error) {
      throw new Error(`Failed to search for quote: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  find_quote_anywhere: async (args, s) => {
    const { quote, threshold = 0.7, top_n = 3 } = args;

    if (!quote || quote.trim().length === 0) {
      throw new Error('quote is required and cannot be empty');
    }

    try {
      // Generate embedding for the quote
      const quoteEmbedding = await s.embeddingService.generateEmbedding(quote);
      
      // Get more results than needed to filter by threshold
      const snippets = await s.literatureIndexer.searchSnippets(quote, top_n * 5);
      
      if (snippets.length === 0) {
        return {
          found: false,
          quote,
          totalFilesSearched: 0,
          matchesFound: 0,
          threshold,
          matches: []
        };
      }

      // Calculate similarities and filter by threshold
      const matches: any[] = [];
      for (const snippet of snippets) {
        const similarity = s.embeddingService.cosineSimilarity(quoteEmbedding, snippet.embedding);
        
        if (similarity >= threshold) {
          // Extract source ID from filename (e.g., "Johnson et al. - 2007 - ..." -> "Johnson2007")
          const sourceMatch = snippet.fileName.match(/^([A-Za-z]+)(?:\s+(?:et al\.|and))?.*?(\d{4})/);
          const sourceId = sourceMatch ? `${sourceMatch[1]}${sourceMatch[2]}` : snippet.fileName.replace('.txt', '');
          
          matches.push({
            source: sourceId,
            filename: snippet.fileName,
            bestMatch: snippet.text,
            similarity,
            context: snippet.text // The snippet already includes context
          });
        }
        
        if (matches.length >= top_n) break;
      }

      return {
        found: matches.length > 0,
        quote,
        totalFilesSearched: 'indexed',
        matchesFound: matches.length,
        threshold,
        matches
      };
    } catch (error) {
      throw new Error(`Failed to search for quote: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  batch_verify_quotes: async (args, s) => {
    const { claim_ids, similarity_threshold = 0.8 } = args;

    if (!claim_ids || !Array.isArray(claim_ids) || claim_ids.length === 0) {
      throw new Error('claim_ids must be a non-empty array');
    }

    const results: any[] = [];
    const failures: any[] = [];
    let verified = 0;
    let failed = 0;
    let errors = 0;

    // Load all claims once
    const allClaims = s.claimsManager.getAllClaims();
    const claimMap = new Map(allClaims.map(c => [c.id, c]));

    // Process each claim
    for (const claimId of claim_ids) {
      const claim = claimMap.get(claimId);

      if (!claim) {
        results.push({
          claimId,
          verified: false,
          similarity: 0,
          error: `Claim ${claimId} not found`
        });
        errors++;
        continue;
      }

      if (!claim.primaryQuote || !claim.primaryQuote.text || !claim.primaryQuote.source) {
        results.push({
          claimId,
          verified: false,
          similarity: 0,
          error: 'Claim missing primaryQuote or source'
        });
        errors++;
        continue;
      }

      try {
        // Generate embedding for the quote
        const quoteEmbedding = await s.embeddingService.generateEmbedding(claim.primaryQuote.text);

        // Try to find source text file in literature/ExtractedText
        let sourceText: string | null = null;
        try {
          const fs = await import('fs');
          const path = await import('path');
          const extractedTextDir = path.join(process.cwd(), 'literature', 'ExtractedText');
          
          if (fs.existsSync(extractedTextDir)) {
            const files = fs.readdirSync(extractedTextDir);
            
            // Look for file containing the source identifier
            for (const file of files) {
              if (file.includes(claim.primaryQuote.source) || file.includes(claim.primaryQuote.source.replace(/\s+/g, '_'))) {
                const filePath = path.join(extractedTextDir, file);
                sourceText = fs.readFileSync(filePath, 'utf-8');
                break;
              }
            }
          }
        } catch (fileError) {
          // Continue without source text
        }

        if (!sourceText) {
          results.push({
            claimId,
            verified: false,
            similarity: 0,
            error: `Source text not found for ${claim.primaryQuote.source}`
          });
          failed++;
          continue;
        }

        // Split source into sentences
        const sentences = sourceText
          .split(/[.!?]+/)
          .map((sentence: string) => sentence.trim())
          .filter((sentence: string) => sentence.length > 10);

        if (sentences.length === 0) {
          results.push({
            claimId,
            verified: false,
            similarity: 0,
            error: 'Source text has no valid sentences'
          });
          failed++;
          continue;
        }

        // Generate embeddings for all sentences in parallel batches
        const sentenceEmbeddings = await s.embeddingService.generateBatchParallel(sentences, 100);

        // Find best match
        let bestMatch = null;
        let bestSimilarity = 0;
        let bestIndex = -1;

        for (let i = 0; i < sentences.length; i++) {
          const similarity = s.embeddingService.cosineSimilarity(
            quoteEmbedding,
            sentenceEmbeddings[i]
          );

          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatch = sentences[i];
            bestIndex = i;
          }
        }

        // Get context (surrounding sentences)
        const contextStart = Math.max(0, bestIndex - 1);
        const contextEnd = Math.min(sentences.length, bestIndex + 2);
        const context = sentences.slice(contextStart, contextEnd).join(' ');

        const isVerified = bestSimilarity >= similarity_threshold;

        results.push({
          claimId,
          verified: isVerified,
          similarity: bestSimilarity,
          closestMatch: bestMatch,
          context
        });

        if (isVerified) {
          verified++;
        } else {
          failed++;
          failures.push({
            claimId,
            quote: claim.primaryQuote.text,
            source: claim.primaryQuote.source,
            closestMatch: bestMatch,
            similarity: bestSimilarity
          });
        }
      } catch (error) {
        results.push({
          claimId,
          verified: false,
          similarity: 0,
          error: error instanceof Error ? error.message : String(error)
        });
        errors++;
      }
    }

    return {
      totalClaims: claim_ids.length,
      verified,
      failed,
      errors,
      similarityThreshold: similarity_threshold,
      results,
      failures: failures.slice(0, 10) // Return top 10 failures
    };
  },

  categorize_claim: async (args, s) => {
    const { claim_text } = args;

    if (!claim_text || claim_text.trim().length === 0) {
      throw new Error('claim_text is required and cannot be empty');
    }

    try {
      // Use ClaimExtractor to categorize the claim
      const category = s.claimExtractor.categorizeClaim(claim_text);

      // Map internal category type to display name
      const categoryMap: Record<string, string> = {
        'method': 'Method',
        'result': 'Result',
        'conclusion': 'Conclusion',
        'background': 'Background',
        'challenge': 'Challenge',
        'data_source': 'Data Source',
        'data_trend': 'Data Trend',
        'impact': 'Impact',
        'application': 'Application',
        'phenomenon': 'Phenomenon'
      };

      const displayCategory = categoryMap[category] || 'Background';

      return {
        claimText: claim_text.substring(0, 100) + (claim_text.length > 100 ? '...' : ''),
        suggestedCategory: category,
        displayCategory,
        availableCategories: Object.values(categoryMap)
      };
    } catch (error) {
      throw new Error(`Failed to categorize claim: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

/**
 * Handle tool call requests by delegating to appropriate service
 */
export async function handleToolCall(
  toolName: string,
  args: any,
  services: Services
): Promise<any> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return await handler(args, services);
}
