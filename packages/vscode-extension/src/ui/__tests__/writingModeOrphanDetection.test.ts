import { jest } from '@jest/globals';
import { WritingModeProvider, OrphanCitationDisplay } from '../writingModeProvider';
import { ExtensionState } from '../../core/state';
import { OrphanCitationValidator, type CitationValidationResult, CitationSourceMapper } from '@research-assistant/core';
import type { Claim } from '@research-assistant/core';

/**
 * Test suite for WritingModeProvider orphan detection methods
 * Tests position finding and tooltip generation for orphan citations
 * 
 * Validates: Requirements 1.1, 1.3
 */
describe('WritingModeProvider - Orphan Detection', () => {
  let provider: WritingModeProvider;
  let mockExtensionState: jest.Mocked<ExtensionState>;
  let mockContext: any;
  let mockClaimsManager: any;
  let mockOrphanValidator: jest.Mocked<OrphanCitationValidator>;
  let mockSourceMapper: jest.Mocked<CitationSourceMapper>;

  beforeEach(() => {
    // Create mock claims manager
    mockClaimsManager = {
      getClaim: jest.fn(),
      getAllClaims: jest.fn(),
      addClaim: jest.fn(),
      updateClaim: jest.fn(),
      deleteClaim: jest.fn()
    };

    // Create mock extension state
    mockExtensionState = {
      claimsManager: mockClaimsManager,
      getWorkspaceRoot: jest.fn().mockReturnValue('/workspace'),
      getAbsolutePath: jest.fn().mockReturnValue('/workspace/path'),
      getConfig: jest.fn().mockReturnValue({})
    } as any;

    // Create mock context
    mockContext = {
      extensionUri: { fsPath: '/extension' }
    };

    // Create provider instance
    provider = new WritingModeProvider(mockExtensionState, mockContext);

    // Mock the orphan validator and source mapper
    mockOrphanValidator = {
      validateClaimCitations: jest.fn(),
      getOrphanCitationsForPair: jest.fn(),
      isOrphanCitation: jest.fn(),
      invalidateCacheOnManuscriptChange: jest.fn(),
      clearCache: jest.fn(),
      getCacheStats: jest.fn()
    } as any;

    mockSourceMapper = {
      loadSourceMappings: jest.fn(),
      getSourceMapping: jest.fn(),
      getExtractedTextPath: jest.fn(),
      getAllMappings: jest.fn(),
      isMapped: jest.fn(),
      getUnmappedAuthorYears: jest.fn(),
      clearCache: jest.fn()
    } as any;

    // Inject mocks into provider
    (provider as any).orphanCitationValidator = mockOrphanValidator;
    (provider as any).citationSourceMapper = mockSourceMapper;
  });

  describe('getOrphanCitationsForDisplay', () => {
    test('should return empty array when no orphan citations exist', async () => {
      mockClaimsManager.getAllClaims.mockReturnValue([]);
      mockOrphanValidator.validateClaimCitations.mockResolvedValue([]);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toEqual([]);
    });

    test('should return orphan citations with positions', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim citing Johnson2007 and Smith2020',
        primaryQuote: { source: 'Johnson2007', text: 'quote text', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        {
          claimId: 'C_01',
          authorYear: 'Johnson2007',
          status: 'matched',
          matchedQuoteSource: 'Johnson2007'
        },
        {
          claimId: 'C_01',
          authorYear: 'Smith2020',
          status: 'orphan-citation'
        }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toHaveLength(1);
      expect(result[0].claimId).toBe('C_01');
      expect(result[0].authorYear).toBe('Smith2020');
      expect(result[0].position.start).toBe(claim.text.indexOf('Smith2020'));
      expect(result[0].position.end).toBe(claim.text.indexOf('Smith2020') + 'Smith2020'.length);
    });

    test('should find multiple occurrences of same orphan citation', async () => {
      const claim: Claim = {
        id: 'C_02',
        text: 'Johnson2007 is cited here and Johnson2007 is cited again',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        {
          claimId: 'C_02',
          authorYear: 'Johnson2007',
          status: 'orphan-citation'
        }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toHaveLength(2);
      expect(result[0].position.start).toBe(0);
      expect(result[1].position.start).toBe(claim.text.indexOf('Johnson2007', 10));
    });

    test('should handle multiple orphan citations in same claim', async () => {
      const claim: Claim = {
        id: 'C_03',
        text: 'Smith2015 and Jones2018 are both orphaned',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        {
          claimId: 'C_03',
          authorYear: 'Smith2015',
          status: 'orphan-citation'
        },
        {
          claimId: 'C_03',
          authorYear: 'Jones2018',
          status: 'orphan-citation'
        }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toHaveLength(2);
      expect(result.map(r => r.authorYear)).toContain('Smith2015');
      expect(result.map(r => r.authorYear)).toContain('Jones2018');
    });

    test('should handle multiple claims with orphan citations', async () => {
      const claim1: Claim = {
        id: 'C_01',
        text: 'First claim with Johnson2007',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      const claim2: Claim = {
        id: 'C_02',
        text: 'Second claim with Smith2015',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim1, claim2]);

      mockOrphanValidator.validateClaimCitations
        .mockResolvedValueOnce([
          { claimId: 'C_01', authorYear: 'Johnson2007', status: 'orphan-citation' }
        ])
        .mockResolvedValueOnce([
          { claimId: 'C_02', authorYear: 'Smith2015', status: 'orphan-citation' }
        ]);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toHaveLength(2);
      expect(result[0].claimId).toBe('C_01');
      expect(result[1].claimId).toBe('C_02');
    });

    test('should return empty array when validator is not initialized', async () => {
      (provider as any).orphanCitationValidator = undefined;

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toEqual([]);
    });

    test('should handle errors gracefully', async () => {
      mockClaimsManager.getAllClaims.mockImplementation(() => {
        throw new Error('Claims manager error');
      });

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toEqual([]);
    });
  });

  describe('generateOrphanTooltip', () => {
    test('should generate tooltip with orphan author-years', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Some claim text',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const validationResults: CitationValidationResult[] = [
        {
          claimId: 'C_01',
          authorYear: 'Johnson2007',
          status: 'orphan-citation'
        },
        {
          claimId: 'C_01',
          authorYear: 'Smith2020',
          status: 'orphan-citation'
        }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toContain('Orphan Citations');
      expect(tooltip).toContain('Johnson2007');
      expect(tooltip).toContain('Smith2020');
      expect(tooltip).toContain('supporting quotes');
    });

    test('should return empty string when no orphan citations', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Some claim text',
        primaryQuote: { source: 'Johnson2007', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const validationResults: CitationValidationResult[] = [
        {
          claimId: 'C_01',
          authorYear: 'Johnson2007',
          status: 'matched',
          matchedQuoteSource: 'Johnson2007'
        }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toBe('');
    });

    test('should return empty string when claim not found', async () => {
      mockClaimsManager.getClaim.mockReturnValue(null);

      const tooltip = await provider.generateOrphanTooltip('C_INVALID');

      expect(tooltip).toBe('');
    });

    test('should escape HTML special characters in tooltip', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Some claim text',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const validationResults: CitationValidationResult[] = [
        {
          claimId: 'C_01',
          authorYear: 'Test<Script>2020',
          status: 'orphan-citation'
        }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toContain('&lt;');
      expect(tooltip).toContain('&gt;');
      expect(tooltip).not.toContain('<Script>');
    });

    test('should return empty string when validator is not initialized', async () => {
      (provider as any).orphanCitationValidator = undefined;

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toBe('');
    });

    test('should handle errors gracefully', async () => {
      mockClaimsManager.getClaim.mockImplementation(() => {
        throw new Error('Claims manager error');
      });

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toBe('');
    });

    test('should format multiple orphan citations with commas', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Some claim text',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: 'Author1', status: 'orphan-citation' },
        { claimId: 'C_01', authorYear: 'Author2', status: 'orphan-citation' },
        { claimId: 'C_01', authorYear: 'Author3', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toContain('Author1, Author2, Author3');
    });
  });

  describe('Position Finding - Edge Cases', () => {
    test('should find citations with numbers in author names', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Smith3rd2020 is cited here',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: 'Smith3rd2020', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toHaveLength(1);
      expect(result[0].authorYear).toBe('Smith3rd2020');
    });

    test('should find citations with special characters in author names', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: "O'Brien2015 and van-der-Waals2010 are cited",
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: "O'Brien2015", status: 'orphan-citation' },
        { claimId: 'C_01', authorYear: 'van-der-Waals2010', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result).toHaveLength(2);
    });

    test('should handle citations at start of text', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Johnson2007 starts the claim',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: 'Johnson2007', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result[0].position.start).toBe(0);
    });

    test('should handle citations at end of text', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'The claim ends with Johnson2007',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getAllClaims.mockReturnValue([claim]);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: 'Johnson2007', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const result = await provider.getOrphanCitationsForDisplay('pair-1');

      expect(result[0].position.end).toBe(claim.text.length);
    });
  });

  describe('HTML Escaping', () => {
    test('should escape ampersands', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Some claim text',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: 'Smith&Jones2020', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toContain('&amp;');
      expect(tooltip).not.toContain('Smith&Jones');
    });

    test('should escape quotes', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Some claim text',
        primaryQuote: { source: 'Other2020', text: 'quote', verified: true },
        supportingQuotes: [],
        category: 'Method',
        context: 'test context',
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const validationResults: CitationValidationResult[] = [
        { claimId: 'C_01', authorYear: 'Smith"Jones2020', status: 'orphan-citation' }
      ];

      mockOrphanValidator.validateClaimCitations.mockResolvedValue(validationResults);

      const tooltip = await provider.generateOrphanTooltip('C_01');

      expect(tooltip).toContain('&quot;');
    });
  });
});
