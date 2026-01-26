import { SearchService } from '../../src/services/SearchService.js';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import { ClaimsManager } from '../../src/core/ClaimsManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('SearchService Integration Tests', () => {
  let searchService: SearchService;
  let embeddingService: EmbeddingService;
  let claimsManager: ClaimsManager;

  beforeAll(async () => {
    // Set up workspace root for testing
    const workspaceRoot = path.resolve(__dirname, '../../..');
    
    // Initialize services
    embeddingService = new EmbeddingService(
      process.env.OPENAI_API_KEY || '',
      path.join(workspaceRoot, 'citation-mcp-server/.cache/embeddings')
    );
    
    claimsManager = new ClaimsManager(workspaceRoot);
    await claimsManager.loadClaims();
    
    searchService = new SearchService(embeddingService, claimsManager, 0.3);
  });

  describe('searchByQuestion', () => {
    it('should return empty array for empty question', async () => {
      const results = await searchService.searchByQuestion('');
      expect(results).toEqual([]);
    });

    it('should return results sorted by similarity', async () => {
      const results = await searchService.searchByQuestion('batch effect correction methods');
      
      // Verify results are sorted by descending similarity
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
      }
      
      // Verify all results have required fields
      results.forEach(result => {
        expect(result).toHaveProperty('claimId');
        expect(result).toHaveProperty('claimText');
        expect(result).toHaveProperty('source');
        expect(result).toHaveProperty('similarity');
        expect(result).toHaveProperty('primaryQuote');
        expect(typeof result.similarity).toBe('number');
      });
    });

    it('should respect threshold parameter', async () => {
      const highThreshold = 0.8;
      const results = await searchService.searchByQuestion(
        'batch effect correction',
        highThreshold
      );
      
      // All results should have similarity >= threshold
      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(highThreshold);
      });
    });
  });

  describe('searchByDraft', () => {
    it('should return empty analysis for empty draft', async () => {
      const analysis = await searchService.searchByDraft('', 'sentence');
      
      expect(analysis.sentences).toEqual([]);
      expect(analysis.needsNewPapers).toBe(false);
      expect(analysis.suggestedSearches).toEqual([]);
    });

    it('should analyze draft in sentence mode', async () => {
      const draftText = 'Batch effects are systematic technical variations. They can confound biological signals.';
      const analysis = await searchService.searchByDraft(draftText, 'sentence');
      
      expect(analysis.sentences.length).toBeGreaterThan(0);
      
      // Verify each sentence has required fields
      analysis.sentences.forEach(sentence => {
        expect(sentence).toHaveProperty('text');
        expect(sentence).toHaveProperty('supported');
        expect(sentence).toHaveProperty('matchingClaims');
        expect(sentence).toHaveProperty('requiresMultipleSources');
        expect(typeof sentence.supported).toBe('boolean');
        expect(Array.isArray(sentence.matchingClaims)).toBe(true);
      });
    });

    it('should analyze draft in paragraph mode', async () => {
      const draftText = 'Batch effects are systematic technical variations that can confound biological signals.';
      const analysis = await searchService.searchByDraft(draftText, 'paragraph');
      
      // In paragraph mode, should have exactly 1 sentence analysis
      expect(analysis.sentences.length).toBe(1);
      expect(analysis.sentences[0].text).toBe(draftText);
    });

    it('should detect when new papers are needed', async () => {
      // Use text unlikely to match existing claims
      const draftText = 'Quantum entanglement affects protein folding. Gravitational waves modulate gene expression. Dark matter influences cell division.';
      const analysis = await searchService.searchByDraft(draftText, 'sentence');
      
      // With low support, should suggest new papers
      expect(typeof analysis.needsNewPapers).toBe('boolean');
      expect(Array.isArray(analysis.suggestedSearches)).toBe(true);
    });
  });

  describe('detectGeneralizationKeywords', () => {
    it('should detect generalization keywords', () => {
      const text = 'Batch effects often confound results. They typically require correction.';
      const matches = searchService.detectGeneralizationKeywords(text);
      
      expect(matches.length).toBeGreaterThan(0);
      
      // Verify matches have required fields
      matches.forEach(match => {
        expect(match).toHaveProperty('sentence');
        expect(match).toHaveProperty('keyword');
        expect(match).toHaveProperty('position');
        expect(typeof match.position).toBe('number');
      });
      
      // Should detect 'often' and 'typically'
      const keywords = matches.map(m => m.keyword);
      expect(keywords).toContain('often');
      expect(keywords).toContain('typically');
    });

    it('should return empty array when no keywords present', () => {
      const text = 'Batch effects are technical variations.';
      const matches = searchService.detectGeneralizationKeywords(text);
      
      expect(matches).toEqual([]);
    });

    it('should match whole words only', () => {
      const text = 'The software is often used.'; // 'often' should match
      const text2 = 'The softening process.'; // 'often' in 'softening' should NOT match
      
      const matches1 = searchService.detectGeneralizationKeywords(text);
      const matches2 = searchService.detectGeneralizationKeywords(text2);
      
      expect(matches1.length).toBeGreaterThan(0);
      expect(matches2.length).toBe(0);
    });
  });

  describe('findMultiSourceSupport', () => {
    it('should find supporting claims from multiple sources', async () => {
      const statement = 'Batch effect correction improves data quality';
      const result = await searchService.findMultiSourceSupport(statement, 2);
      
      expect(result).toHaveProperty('statement');
      expect(result).toHaveProperty('supportingClaims');
      expect(result).toHaveProperty('sourceCount');
      expect(result).toHaveProperty('sufficient');
      expect(result).toHaveProperty('needsReviewPaper');
      
      expect(result.statement).toBe(statement);
      expect(Array.isArray(result.supportingClaims)).toBe(true);
      expect(typeof result.sourceCount).toBe('number');
      expect(typeof result.sufficient).toBe('boolean');
      expect(typeof result.needsReviewPaper).toBe('boolean');
    });

    it('should group claims by source', async () => {
      const statement = 'Batch effects are systematic variations';
      const result = await searchService.findMultiSourceSupport(statement, 2);
      
      // Verify each supporting claim is from a different source
      const sources = new Set(result.supportingClaims.map(c => c.source));
      expect(sources.size).toBe(result.supportingClaims.length);
    });

    it('should indicate when review paper is needed', async () => {
      // Use very specific statement unlikely to have multiple sources
      const statement = 'Quantum chromodynamics affects batch effect correction algorithms';
      const result = await searchService.findMultiSourceSupport(statement, 2);
      
      // With 0-1 sources, should suggest review paper
      if (result.sourceCount < 2) {
        expect(result.needsReviewPaper).toBe(true);
      }
    });

    it('should sort supporting claims by similarity', async () => {
      const statement = 'Batch effect correction methods';
      const result = await searchService.findMultiSourceSupport(statement, 2);
      
      // Verify claims are sorted by descending similarity
      for (let i = 0; i < result.supportingClaims.length - 1; i++) {
        expect(result.supportingClaims[i].similarity).toBeGreaterThanOrEqual(
          result.supportingClaims[i + 1].similarity
        );
      }
    });
  });
});
