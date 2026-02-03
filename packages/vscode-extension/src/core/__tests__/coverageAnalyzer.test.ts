import { describe, test, expect, beforeEach } from '@jest/globals';
import { CoverageAnalyzer } from '../coverageAnalyzer';
import type { OutlineSection, Claim } from '@research-assistant/core';
import { setupTest, createMockEmbeddingService, aClaim } from '../../__tests__/helpers';

describe('CoverageAnalyzer', () => {
  setupTest();

  let analyzer: CoverageAnalyzer;
  let mockClaimsManager: any;
  let mockEmbeddingService: ReturnType<typeof createMockEmbeddingService>;

  beforeEach(() => {
    // Create mock dependencies using factory
    mockClaimsManager = {};
    mockEmbeddingService = createMockEmbeddingService();
    
    analyzer = new CoverageAnalyzer(mockClaimsManager, mockEmbeddingService);
  });

  // Helper function to create test sections
  const createSection = (id: string, level: number, title: string, lineStart: number, content: string[] = []): OutlineSection => ({
    id,
    level,
    title,
    content,
    lineStart,
    lineEnd: lineStart + 10
  });

  // Helper function to create test claims
  const createClaim = (id: string, sections: string[]): Claim => aClaim()
    .withId(id)
    .withText(`Test claim ${id}`)
    .withSections(sections)
    .build();

  describe('analyzeCoverage', () => {
    test('should map claims to sections using section IDs', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10)
      ];

      const claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1']),
        createClaim('C_03', ['section-2'])
      ];

      const metrics = analyzer.analyzeCoverage(sections, claims);

      expect(metrics).toHaveLength(2);
      expect(metrics[0].sectionId).toBe('section-1');
      expect(metrics[0].claimCount).toBe(2);
      expect(metrics[1].sectionId).toBe('section-2');
      expect(metrics[1].claimCount).toBe(1);
    });

    test('should calculate coverage level as "none" for 0 claims', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      const claims: Claim[] = [];

      const metrics = analyzer.analyzeCoverage(sections, claims);

      expect(metrics[0].coverageLevel).toBe('none');
      expect(metrics[0].claimCount).toBe(0);
    });

    test('should calculate coverage level as "low" for 1-3 claims', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      
      // Test with 1 claim
      let claims = [createClaim('C_01', ['section-1'])];
      let metrics = analyzer.analyzeCoverage(sections, claims);
      expect(metrics[0].coverageLevel).toBe('low');
      expect(metrics[0].claimCount).toBe(1);

      // Test with 2 claims
      claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1'])
      ];
      metrics = analyzer.analyzeCoverage(sections, claims);
      expect(metrics[0].coverageLevel).toBe('low');
      expect(metrics[0].claimCount).toBe(2);

      // Test with 3 claims
      claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1']),
        createClaim('C_03', ['section-1'])
      ];
      metrics = analyzer.analyzeCoverage(sections, claims);
      expect(metrics[0].coverageLevel).toBe('low');
      expect(metrics[0].claimCount).toBe(3);
    });

    test('should calculate coverage level as "moderate" for 4-6 claims', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      
      // Test with 4 claims
      let claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1']),
        createClaim('C_03', ['section-1']),
        createClaim('C_04', ['section-1'])
      ];
      let metrics = analyzer.analyzeCoverage(sections, claims);
      expect(metrics[0].coverageLevel).toBe('moderate');
      expect(metrics[0].claimCount).toBe(4);

      // Test with 6 claims
      claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1']),
        createClaim('C_03', ['section-1']),
        createClaim('C_04', ['section-1']),
        createClaim('C_05', ['section-1']),
        createClaim('C_06', ['section-1'])
      ];
      metrics = analyzer.analyzeCoverage(sections, claims);
      expect(metrics[0].coverageLevel).toBe('moderate');
      expect(metrics[0].claimCount).toBe(6);
    });

    test('should calculate coverage level as "strong" for 7+ claims', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      
      const claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1']),
        createClaim('C_03', ['section-1']),
        createClaim('C_04', ['section-1']),
        createClaim('C_05', ['section-1']),
        createClaim('C_06', ['section-1']),
        createClaim('C_07', ['section-1'])
      ];
      
      const metrics = analyzer.analyzeCoverage(sections, claims);
      expect(metrics[0].coverageLevel).toBe('strong');
      expect(metrics[0].claimCount).toBe(7);
    });

    test('should include suggested queries for each section', () => {
      const sections = [createSection('section-1', 2, 'Machine Learning Methods', 1)];
      const claims: Claim[] = [];

      const metrics = analyzer.analyzeCoverage(sections, claims);

      expect(metrics[0].suggestedQueries).toBeDefined();
      expect(metrics[0].suggestedQueries.length).toBeGreaterThanOrEqual(2);
      expect(metrics[0].suggestedQueries.length).toBeLessThanOrEqual(5);
    });

    test('should set lastUpdated timestamp', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      const claims: Claim[] = [];

      const before = new Date();
      const metrics = analyzer.analyzeCoverage(sections, claims);
      const after = new Date();

      expect(metrics[0].lastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(metrics[0].lastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should handle claims associated with multiple sections', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10)
      ];

      const claims = [
        createClaim('C_01', ['section-1', 'section-2'])
      ];

      const metrics = analyzer.analyzeCoverage(sections, claims);

      // Claim should be counted in both sections
      expect(metrics[0].claimCount).toBe(1);
      expect(metrics[1].claimCount).toBe(1);
    });
  });

  describe('identifyGaps', () => {
    test('should identify sections with fewer than 2 claims by default', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10),
        createSection('section-3', 2, 'Results', 20)
      ];

      const claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-2']),
        createClaim('C_03', ['section-2']),
        createClaim('C_04', ['section-2'])
      ];

      const gaps = analyzer.identifyGaps(sections, claims);

      // section-1 has 1 claim (< 2), section-3 has 0 claims (< 2)
      expect(gaps).toHaveLength(2);
      expect(gaps.some(g => g.sectionId === 'section-1')).toBe(true);
      expect(gaps.some(g => g.sectionId === 'section-3')).toBe(true);
    });

    test('should respect custom threshold parameter', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10)
      ];

      const claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1']),
        createClaim('C_03', ['section-1']),
        createClaim('C_04', ['section-2'])
      ];

      // With threshold of 4, section-1 (3 claims) and section-2 (1 claim) are gaps
      const gaps = analyzer.identifyGaps(sections, claims, 4);

      expect(gaps).toHaveLength(2);
    });

    test('should rank gaps by section depth (level) - shallower sections first', () => {
      const sections = [
        createSection('section-1', 3, 'Subsection', 10),
        createSection('section-2', 2, 'Main Section', 1)
      ];

      const claims: Claim[] = [];

      const gaps = analyzer.identifyGaps(sections, claims);

      // section-2 (level 2) should come before section-1 (level 3)
      expect(gaps[0].sectionId).toBe('section-2');
      expect(gaps[1].sectionId).toBe('section-1');
    });

    test('should rank gaps by position when depth is equal - earlier sections first', () => {
      const sections = [
        createSection('section-1', 2, 'Section B', 20),
        createSection('section-2', 2, 'Section A', 10)
      ];

      const claims: Claim[] = [];

      const gaps = analyzer.identifyGaps(sections, claims);

      // section-2 (line 10) should come before section-1 (line 20)
      expect(gaps[0].sectionId).toBe('section-2');
      expect(gaps[1].sectionId).toBe('section-1');
    });

    test('should return empty array when no gaps exist', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1)
      ];

      const claims = [
        createClaim('C_01', ['section-1']),
        createClaim('C_02', ['section-1'])
      ];

      const gaps = analyzer.identifyGaps(sections, claims);

      expect(gaps).toHaveLength(0);
    });
  });

  describe('suggestSearchQueries', () => {
    test('should generate 2-5 queries for a section', () => {
      const section = createSection('section-1', 2, 'Machine Learning Methods', 1, [
        'What are the main approaches?',
        'How do neural networks work?'
      ]);

      const queries = analyzer.suggestSearchQueries(section);

      expect(queries.length).toBeGreaterThanOrEqual(2);
      expect(queries.length).toBeLessThanOrEqual(5);
    });

    test('should include the section title as a query', () => {
      const section = createSection('section-1', 2, 'Deep Learning Applications', 1);

      const queries = analyzer.suggestSearchQueries(section);

      expect(queries).toContain('Deep Learning Applications');
    });

    test('should extract key terms from content', () => {
      const section = createSection('section-1', 2, 'Methods', 1, [
        'We use convolutional neural networks for image classification',
        'The model architecture includes attention mechanisms'
      ]);

      const queries = analyzer.suggestSearchQueries(section);

      // Should have queries that combine title with key terms
      expect(queries.length).toBeGreaterThan(1);
    });

    test('should convert questions to search queries', () => {
      const section = createSection('section-1', 2, 'Research Questions', 1, [
        'What are the main challenges in climate modeling?',
        'How do we validate predictions?'
      ]);

      const queries = analyzer.suggestSearchQueries(section);

      // Should include question without question mark
      const hasQuestionQuery = queries.some(q => 
        q.includes('challenges in climate modeling') || 
        q.includes('validate predictions')
      );
      expect(hasQuestionQuery).toBe(true);
    });

    test('should extract domain-specific terms (acronyms, hyphenated terms)', () => {
      const section = createSection('section-1', 2, 'NLP Methods', 1, [
        'We use BERT and GPT-3 for text generation',
        'The state-of-the-art models show improvements'
      ]);

      const queries = analyzer.suggestSearchQueries(section);

      // Should extract acronyms and hyphenated terms
      expect(queries.length).toBeGreaterThan(1);
    });

    test('should return unique queries only', () => {
      const section = createSection('section-1', 2, 'Methods', 1, [
        'Methods for analysis',
        'Analysis methods'
      ]);

      const queries = analyzer.suggestSearchQueries(section);

      // Check for uniqueness
      const uniqueQueries = new Set(queries);
      expect(uniqueQueries.size).toBe(queries.length);
    });

    test('should handle sections with no content', () => {
      const section = createSection('section-1', 2, 'Introduction', 1, []);

      const queries = analyzer.suggestSearchQueries(section);

      // Should still generate at least the title query
      expect(queries.length).toBeGreaterThanOrEqual(1);
      expect(queries).toContain('Introduction');
    });
  });

  describe('generateReport', () => {
    test('should calculate total sections correctly', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10),
        createSection('section-3', 2, 'Results', 20)
      ];
      const claims: Claim[] = [];

      const report = analyzer.generateReport(sections, claims);

      expect(report.totalSections).toBe(3);
    });

    test('should count sections by coverage level', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10),
        createSection('section-3', 2, 'Results', 20),
        createSection('section-4', 2, 'Discussion', 30)
      ];

      const claims = [
        // section-1: 0 claims (none)
        // section-2: 2 claims (low)
        createClaim('C_01', ['section-2']),
        createClaim('C_02', ['section-2']),
        // section-3: 5 claims (moderate)
        createClaim('C_03', ['section-3']),
        createClaim('C_04', ['section-3']),
        createClaim('C_05', ['section-3']),
        createClaim('C_06', ['section-3']),
        createClaim('C_07', ['section-3']),
        // section-4: 8 claims (strong)
        createClaim('C_08', ['section-4']),
        createClaim('C_09', ['section-4']),
        createClaim('C_10', ['section-4']),
        createClaim('C_11', ['section-4']),
        createClaim('C_12', ['section-4']),
        createClaim('C_13', ['section-4']),
        createClaim('C_14', ['section-4']),
        createClaim('C_15', ['section-4'])
      ];

      const report = analyzer.generateReport(sections, claims);

      expect(report.sectionsWithNoCoverage).toBe(1);
      expect(report.sectionsWithLowCoverage).toBe(1);
      expect(report.sectionsWithModerateCoverage).toBe(1);
      expect(report.sectionsWithStrongCoverage).toBe(1);
    });

    test('should calculate overall coverage percentage', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10),
        createSection('section-3', 2, 'Results', 20),
        createSection('section-4', 2, 'Discussion', 30)
      ];

      const claims = [
        // section-1: 0 claims (none)
        // section-2: 2 claims (low)
        createClaim('C_01', ['section-2']),
        createClaim('C_02', ['section-2']),
        // section-3: 5 claims (moderate) - covered
        createClaim('C_03', ['section-3']),
        createClaim('C_04', ['section-3']),
        createClaim('C_05', ['section-3']),
        createClaim('C_06', ['section-3']),
        createClaim('C_07', ['section-3']),
        // section-4: 8 claims (strong) - covered
        createClaim('C_08', ['section-4']),
        createClaim('C_09', ['section-4']),
        createClaim('C_10', ['section-4']),
        createClaim('C_11', ['section-4']),
        createClaim('C_12', ['section-4']),
        createClaim('C_13', ['section-4']),
        createClaim('C_14', ['section-4']),
        createClaim('C_15', ['section-4'])
      ];

      const report = analyzer.generateReport(sections, claims);

      // 2 out of 4 sections have moderate or strong coverage = 50%
      expect(report.overallCoveragePercentage).toBe(50);
    });

    test('should include gaps in the report', () => {
      const sections = [
        createSection('section-1', 2, 'Introduction', 1),
        createSection('section-2', 2, 'Methods', 10)
      ];

      const claims = [
        createClaim('C_01', ['section-1'])
      ];

      const report = analyzer.generateReport(sections, claims);

      // Both sections have < 2 claims
      expect(report.gaps).toHaveLength(2);
    });

    test('should set timestamp', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      const claims: Claim[] = [];

      const before = new Date();
      const report = analyzer.generateReport(sections, claims);
      const after = new Date();

      expect(report.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(report.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    test('should handle empty sections and claims', () => {
      const sections: OutlineSection[] = [];
      const claims: Claim[] = [];

      const report = analyzer.generateReport(sections, claims);

      expect(report.totalSections).toBe(0);
      expect(report.overallCoveragePercentage).toBe(0);
      expect(report.gaps).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('should handle sections with no associated claims', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      const claims = [createClaim('C_01', ['section-2'])]; // Different section

      const metrics = analyzer.analyzeCoverage(sections, claims);

      expect(metrics[0].claimCount).toBe(0);
      expect(metrics[0].coverageLevel).toBe('none');
    });

    test('should handle empty sections array', () => {
      const sections: OutlineSection[] = [];
      const claims = [createClaim('C_01', ['section-1'])];

      const metrics = analyzer.analyzeCoverage(sections, claims);

      expect(metrics).toHaveLength(0);
    });

    test('should handle empty claims array', () => {
      const sections = [createSection('section-1', 2, 'Introduction', 1)];
      const claims: Claim[] = [];

      const metrics = analyzer.analyzeCoverage(sections, claims);

      expect(metrics).toHaveLength(1);
      expect(metrics[0].claimCount).toBe(0);
    });

    test('should handle sections with special characters in title', () => {
      const section = createSection('section-1', 2, 'Methods: A/B Testing & Analysis', 1);

      const queries = analyzer.suggestSearchQueries(section);

      expect(queries.length).toBeGreaterThanOrEqual(1);
      expect(queries[0]).toContain('Methods');
    });
  });
});
