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
} from '@research-assistant/core';
import { ZoteroService } from './services/ZoteroService.js';
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
  zoteroService?: ZoteroService;
  doclingService?: DoclingService;
}

/**
 * Tool handler mapping - maps tool names to service methods
 */
const toolHandlers: Record<string, (args: any, services: Services) => Promise<any>> = {
  search_by_question: async (args, s) => s.searchService.searchByQuestion(args.question, args.threshold),
  search_by_draft: async (args, s) => s.searchService.searchByDraft(args.draft_text, args.mode, args.threshold),
  find_multi_source_support: async (args, s) => s.searchService.findMultiSourceSupport(args.statement, args.min_sources),
  analyze_section_coverage: async (args, s) => s.coverageAnalyzer.analyzeSectionCoverage(args.section_id),
  analyze_manuscript_coverage: async (args, s) => s.coverageAnalyzer.analyzeManuscriptCoverage(),
  calculate_claim_strength: async (args, s) => s.claimStrengthCalculator.calculateStrength(args.claim_id),
  calculate_claim_strength_batch: async (args, s) => s.claimStrengthCalculator.calculateStrengthBatch(args.claim_ids),
  rank_papers_for_section: async (args, s) => s.paperRanker.rankPapersForSection(args.section_id, args.papers),
  rank_papers_for_query: async (args, s) => s.paperRanker.rankPapersForQuery(args.query, args.papers),
  extract_claims_from_text: async (args, s) => s.claimExtractor.extractFromText(args.text, args.source),
  suggest_sections_for_claim: async (args, s) => s.claimExtractor.suggestSections(args.claim_text, args.sections),
  group_claims_by_theme: async (args, s) => s.synthesisEngine.groupClaimsByTheme(args.claims, args.threshold),
  generate_paragraph: async (args, s) => s.synthesisEngine.generateParagraph({
    claims: args.claims,
    style: args.style,
    includeCitations: args.include_citations,
    maxLength: args.max_length || 0,
  }),
  generate_search_queries: async (args, s) => s.searchQueryGenerator.generateQueriesForSection(args.section_id),
  
  // Zotero tools
  zotero_get_collections: async (args, s) => {
    if (!s.zoteroService) throw new Error('Zotero service not configured');
    return s.zoteroService.getCollections();
  },
  zotero_get_collection_items: async (args, s) => {
    if (!s.zoteroService) throw new Error('Zotero service not configured');
    return s.zoteroService.getCollectionItems(args.collection_key);
  },
  zotero_add_paper: async (args, s) => {
    if (!s.zoteroService) throw new Error('Zotero service not configured');
    return s.zoteroService.addPaper(
      args.collection_name,
      args.title,
      args.authors,
      {
        date: args.date,
        DOI: args.doi,
        publicationTitle: args.publication_title
      }
    );
  },

  // Docling tools
  extract_pdf_with_docling: async (args, s) => {
    if (!s.doclingService) throw new Error('Docling service not configured');
    return s.doclingService.extractPDFViaScript(args.pdf_path, args.output_path);
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
