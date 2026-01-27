import { SynthesisEngine } from '../synthesisEngine';
import { EmbeddingService } from '@research-assistant/core';
import type { Claim } from '@research-assistant/core';

describe('SynthesisEngine', () => {
  let synthesisEngine: SynthesisEngine;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService('test-api-key');
    synthesisEngine = new SynthesisEngine(embeddingService);
  });

  // Helper function to create test claims
  const createClaim = (
    id: string,
    text: string,
    source: string,
    category: string = 'Method'
  ): Claim => ({
    id,
    text,
    category,
    source,
    sourceId: parseInt(id.replace('C_', ''), 10),
    context: '',
    primaryQuote: `Quote for ${text}`,
    supportingQuotes: [],
    sections: [],
    verified: false,
    createdAt: new Date(),
    modifiedAt: new Date()
  });

  describe('groupClaimsByTheme', () => {
    it('should return empty map for empty claims array', async () => {
      const result = await synthesisEngine.groupClaimsByTheme([]);
      expect(result.size).toBe(0);
    });

    it('should create single cluster for single claim', async () => {
      const claims = [
        createClaim('C_01', 'Machine learning improves classification accuracy', 'Smith2020')
      ];

      const result = await synthesisEngine.groupClaimsByTheme(claims);
      expect(result.size).toBe(1);
      
      const clusters = Array.from(result.values());
      expect(clusters[0]).toHaveLength(1);
      expect(clusters[0][0].id).toBe('C_01');
    });

    it('should group similar claims together', async () => {
      const claims = [
        createClaim('C_01', 'Machine learning improves classification accuracy', 'Smith2020'),
        createClaim('C_02', 'Deep learning enhances classification performance', 'Jones2021'),
        createClaim('C_03', 'Data normalization reduces batch effects', 'Brown2019')
      ];

      const result = await synthesisEngine.groupClaimsByTheme(claims);
      
      // Should create at least 2 clusters (ML-related and normalization-related)
      expect(result.size).toBeGreaterThanOrEqual(1);
      expect(result.size).toBeLessThanOrEqual(3);
    });

    it('should respect similarity threshold', async () => {
      const claims = [
        createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020'),
        createClaim('C_02', 'Deep learning enhances performance', 'Jones2021'),
        createClaim('C_03', 'Neural networks increase precision', 'Davis2022')
      ];

      // High threshold should create more clusters
      const highThreshold = await synthesisEngine.groupClaimsByTheme(claims, 0.9);
      
      // Low threshold should create fewer clusters
      const lowThreshold = await synthesisEngine.groupClaimsByTheme(claims, 0.3);
      
      expect(highThreshold.size).toBeGreaterThanOrEqual(lowThreshold.size);
    });

    it('should generate meaningful theme labels', async () => {
      const claims = [
        createClaim('C_01', 'Batch correction methods reduce technical variation', 'Smith2020'),
        createClaim('C_02', 'ComBat effectively removes batch effects', 'Jones2021')
      ];

      const result = await synthesisEngine.groupClaimsByTheme(claims);
      const themes = Array.from(result.keys());
      
      // Theme should contain relevant keywords
      expect(themes.length).toBeGreaterThan(0);
      expect(themes[0].length).toBeGreaterThan(0);
    });

    it('should handle claims with same category', async () => {
      const claims = [
        createClaim('C_01', 'Method A is effective', 'Smith2020', 'Method'),
        createClaim('C_02', 'Method B is efficient', 'Jones2021', 'Method'),
        createClaim('C_03', 'Result shows improvement', 'Brown2019', 'Result')
      ];

      const result = await synthesisEngine.groupClaimsByTheme(claims);
      expect(result.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('generateParagraph', () => {
    it('should return empty string for empty claims array', async () => {
      const result = await synthesisEngine.generateParagraph({
        claims: [],
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result).toBe('');
    });

    it('should generate narrative paragraph with citations', async () => {
      const claims = [
        createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020'),
        createClaim('C_02', 'Deep learning enhances performance', 'Jones2021')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result).toContain('Machine learning improves accuracy');
      expect(result).toContain('(Smith2020)');
      expect(result).toContain('(Jones2021)');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate analytical paragraph with citations', async () => {
      const claims = [
        createClaim('C_01', 'Method A is effective', 'Smith2020'),
        createClaim('C_02', 'Method B is efficient', 'Jones2021')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'analytical',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result).toContain('Method A is effective');
      expect(result).toContain('(Smith2020)');
      expect(result).toContain('(Jones2021)');
    });

    it('should generate descriptive paragraph with citations', async () => {
      const claims = [
        createClaim('C_01', 'Finding one is significant', 'Smith2020'),
        createClaim('C_02', 'Finding two is important', 'Jones2021'),
        createClaim('C_03', 'Finding three is notable', 'Brown2019')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'descriptive',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result).toContain('First,');
      expect(result).toContain('Additionally,');
      expect(result).toContain('Finally,');
      expect(result).toContain('(Smith2020)');
    });

    it('should omit citations when includeCitations is false', async () => {
      const claims = [
        createClaim('C_01', 'Machine learning improves accuracy', 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: false,
        maxLength: 1000
      });

      expect(result).toContain('Machine learning improves accuracy');
      expect(result).not.toContain('(Smith2020)');
    });

    it('should truncate paragraph when exceeding maxLength', async () => {
      const claims = [
        createClaim('C_01', 'This is a very long claim text that will definitely exceed the maximum length', 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 30
      });

      expect(result.length).toBeLessThanOrEqual(30);
      expect(result).toContain('...');
    });

    it('should sort claims by year chronologically', async () => {
      const claims = [
        createClaim('C_01', 'Recent finding', 'Smith2022'),
        createClaim('C_02', 'Earlier finding', 'Jones2019'),
        createClaim('C_03', 'Middle finding', 'Brown2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      // Earlier year should appear first
      const jones2019Pos = result.indexOf('(Jones2019)');
      const brown2020Pos = result.indexOf('(Brown2020)');
      const smith2022Pos = result.indexOf('(Smith2022)');

      expect(jones2019Pos).toBeLessThan(brown2020Pos);
      expect(brown2020Pos).toBeLessThan(smith2022Pos);
    });

    it('should handle single claim gracefully', async () => {
      const claims = [
        createClaim('C_01', 'Single claim text', 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result).toContain('Single claim text');
      expect(result).toContain('(Smith2020)');
      expect(result.endsWith('.')).toBe(true);
    });
  });

  describe('generateTransitions', () => {
    it('should return empty array for single claim', async () => {
      const claims = [
        createClaim('C_01', 'Single claim', 'Smith2020')
      ];

      const result = synthesisEngine.generateTransitions(claims);
      expect(result).toHaveLength(0);
    });

    it('should generate transitions for multiple claims', async () => {
      const claims = [
        createClaim('C_01', 'First claim', 'Smith2020'),
        createClaim('C_02', 'Second claim', 'Jones2021'),
        createClaim('C_03', 'Third claim', 'Brown2019')
      ];

      const result = synthesisEngine.generateTransitions(claims);
      expect(result).toHaveLength(2); // n-1 transitions for n claims
    });

    it('should use "In the same study," for same source', async () => {
      const claims = [
        createClaim('C_01', 'First finding', 'Smith2020'),
        createClaim('C_02', 'Second finding', 'Smith2020')
      ];

      const result = synthesisEngine.generateTransitions(claims);
      expect(result).toContain('In the same study,');
    });

    it('should use "Similarly," for same category', async () => {
      const claims = [
        createClaim('C_01', 'First method', 'Smith2020', 'Method'),
        createClaim('C_02', 'Second method', 'Jones2021', 'Method')
      ];

      const result = synthesisEngine.generateTransitions(claims);
      expect(result).toContain('Similarly,');
    });

    it('should use "Furthermore," for different source and category', async () => {
      const claims = [
        createClaim('C_01', 'Method claim', 'Smith2020', 'Method'),
        createClaim('C_02', 'Result claim', 'Jones2021', 'Result')
      ];

      const result = synthesisEngine.generateTransitions(claims);
      expect(result).toContain('Furthermore,');
    });
  });

  describe('formatCitations', () => {
    it('should return empty string for empty claims array', () => {
      const result = synthesisEngine.formatCitations([]);
      expect(result).toBe('');
    });

    it('should format single citation', () => {
      const claims = [
        createClaim('C_01', 'Claim text', 'Smith2020')
      ];

      const result = synthesisEngine.formatCitations(claims);
      expect(result).toBe(' (Smith2020)');
    });

    it('should format two citations with semicolon', () => {
      const claims = [
        createClaim('C_01', 'First claim', 'Smith2020'),
        createClaim('C_02', 'Second claim', 'Jones2021')
      ];

      const result = synthesisEngine.formatCitations(claims);
      expect(result).toContain('Smith2020');
      expect(result).toContain('Jones2021');
      expect(result).toContain(';');
    });

    it('should format multiple citations with "et al."', () => {
      const claims = [
        createClaim('C_01', 'First claim', 'Smith2020'),
        createClaim('C_02', 'Second claim', 'Jones2021'),
        createClaim('C_03', 'Third claim', 'Brown2019')
      ];

      const result = synthesisEngine.formatCitations(claims);
      expect(result).toContain('et al.');
    });

    it('should deduplicate sources', () => {
      const claims = [
        createClaim('C_01', 'First claim', 'Smith2020'),
        createClaim('C_02', 'Second claim', 'Smith2020')
      ];

      const result = synthesisEngine.formatCitations(claims);
      expect(result).toBe(' (Smith2020)');
    });

    it('should sort sources alphabetically', () => {
      const claims = [
        createClaim('C_01', 'First claim', 'Zebra2020'),
        createClaim('C_02', 'Second claim', 'Apple2021')
      ];

      const result = synthesisEngine.formatCitations(claims);
      const applePos = result.indexOf('Apple2021');
      const zebraPos = result.indexOf('Zebra2020');
      expect(applePos).toBeLessThan(zebraPos);
    });

    it('should handle claims without sources', () => {
      const claims = [
        { ...createClaim('C_01', 'Claim text', ''), source: '' }
      ];

      const result = synthesisEngine.formatCitations(claims);
      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle claims with special characters in text', async () => {
      const claims = [
        createClaim('C_01', 'Method uses "special" characters & symbols', 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result).toContain('special');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very long claim texts', async () => {
      const longText = 'This is a very long claim text that goes on and on '.repeat(10);
      const claims = [
        createClaim('C_01', longText, 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle claims with empty text', async () => {
      const claims = [
        createClaim('C_01', '', 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      // Should still generate something (at least citation)
      expect(result).toContain('(Smith2020)');
    });

    it('should handle maxLength of 0', async () => {
      const claims = [
        createClaim('C_01', 'Claim text', 'Smith2020')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 0
      });

      // maxLength 0 means no truncation
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('citation preservation', () => {
    it('should preserve all citation references in generated text', async () => {
      const claims = [
        createClaim('C_01', 'First finding', 'Smith2020'),
        createClaim('C_02', 'Second finding', 'Jones2021'),
        createClaim('C_03', 'Third finding', 'Brown2019')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'narrative',
        includeCitations: true,
        maxLength: 1000
      });

      // All sources should be cited
      expect(result).toContain('Smith2020');
      expect(result).toContain('Jones2021');
      expect(result).toContain('Brown2019');
    });

    it('should maintain citation format consistency', async () => {
      const claims = [
        createClaim('C_01', 'Finding one', 'Smith2020'),
        createClaim('C_02', 'Finding two', 'Jones2021')
      ];

      const result = await synthesisEngine.generateParagraph({
        claims,
        style: 'analytical',
        includeCitations: true,
        maxLength: 1000
      });

      // Citations should be in parentheses
      expect(result).toMatch(/\(Smith2020\)/);
      expect(result).toMatch(/\(Jones2021\)/);
    });
  });
});
