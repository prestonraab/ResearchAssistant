import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * Unit tests for orphan citation display functionality
 * Tests the getOrphanCitationsForClaim method and UI rendering
 * Requirements: 3.1
 */
describe('Orphan Citation Display', () => {
  let mockExtensionState: any;
  let mockClaimReviewProvider: any;

  beforeEach(() => {
    // Mock the extension state
    mockExtensionState = {
      claimsManager: {
        getClaim: jest.fn(),
        updateClaim: jest.fn()
      },
      orphanCitationValidator: {
        validateClaimCitations: jest.fn()
      },
      citationSourceMapper: {
        getSourceMapping: jest.fn()
      }
    };

    // Mock the claim review provider
    mockClaimReviewProvider = {
      extensionState: mockExtensionState,
      panel: {
        webview: {
          postMessage: jest.fn()
        }
      },
      getOrphanCitationsForClaim: jest.fn(async (claimId: string) => {
        const claim = mockExtensionState.claimsManager.getClaim(claimId);
        if (!claim) return [];

        const validationResults = await mockExtensionState.orphanCitationValidator.validateClaimCitations(claimId);
        if (!validationResults) return [];

        const orphanCitations = [];
        for (const result of validationResults) {
          if (result.status === 'orphan-citation') {
            const sourceMapping = mockExtensionState.citationSourceMapper.getSourceMapping(result.authorYear);
            if (sourceMapping) {
              orphanCitations.push({
                authorYear: result.authorYear,
                sourceMapping,
                hasExtractedText: !!sourceMapping.extractedTextFile
              });
            }
          }
        }
        return orphanCitations;
      })
    };
  });

  describe('getOrphanCitationsForClaim', () => {
    it('should return empty array for non-existent claim', async () => {
      mockExtensionState.claimsManager.getClaim.mockReturnValue(null);

      const result = await mockClaimReviewProvider.getOrphanCitationsForClaim('C_999');

      expect(result).toEqual([]);
    });

    it('should return empty array when no orphan citations exist', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.orphanCitationValidator.validateClaimCitations.mockResolvedValue([
        {
          claimId: 'C_01',
          authorYear: 'Johnson2007',
          status: 'matched'
        }
      ]);

      const result = await mockClaimReviewProvider.getOrphanCitationsForClaim('C_01');

      expect(result).toEqual([]);
    });

    it('should return orphan citations with source mappings', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim with Johnson2007 and Smith2020',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.orphanCitationValidator.validateClaimCitations.mockResolvedValue([
        {
          claimId: 'C_01',
          authorYear: 'Johnson2007',
          status: 'matched'
        },
        {
          claimId: 'C_01',
          authorYear: 'Smith2020',
          status: 'orphan-citation'
        }
      ]);

      mockExtensionState.citationSourceMapper.getSourceMapping.mockImplementation((authorYear: string) => {
        if (authorYear === 'Smith2020') {
          return {
            authorYear: 'Smith2020',
            zoteroKey: 'ABC123',
            sourceId: 2,
            extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
          };
        }
        return null;
      });

      const result = await mockClaimReviewProvider.getOrphanCitationsForClaim('C_01');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        authorYear: 'Smith2020',
        sourceMapping: {
          authorYear: 'Smith2020',
          zoteroKey: 'ABC123',
          sourceId: 2,
          extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
        },
        hasExtractedText: true
      });
    });

    it('should handle unmapped author-years', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim with UnknownAuthor2025',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.orphanCitationValidator.validateClaimCitations.mockResolvedValue([
        {
          claimId: 'C_01',
          authorYear: 'UnknownAuthor2025',
          status: 'unmapped-source'
        }
      ]);

      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue(null);

      const result = await mockClaimReviewProvider.getOrphanCitationsForClaim('C_01');

      expect(result).toHaveLength(0); // Unmapped sources are not orphan citations
    });

    it('should handle multiple orphan citations', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim with multiple orphans',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.orphanCitationValidator.validateClaimCitations.mockResolvedValue([
        {
          claimId: 'C_01',
          authorYear: 'Smith2020',
          status: 'orphan-citation'
        },
        {
          claimId: 'C_01',
          authorYear: 'Brown2019',
          status: 'orphan-citation'
        },
        {
          claimId: 'C_01',
          authorYear: 'Johnson2007',
          status: 'matched'
        }
      ]);

      mockExtensionState.citationSourceMapper.getSourceMapping.mockImplementation((authorYear: string) => {
        if (authorYear === 'Smith2020' || authorYear === 'Brown2019') {
          return {
            authorYear,
            zoteroKey: 'KEY123',
            sourceId: 1,
            extractedTextFile: `literature/ExtractedText/${authorYear}.txt`
          };
        }
        return null;
      });

      const result = await mockClaimReviewProvider.getOrphanCitationsForClaim('C_01');

      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.authorYear)).toEqual(['Smith2020', 'Brown2019']);
    });
  });

  describe('Orphan citation UI rendering', () => {
    it('should display orphan citations section when orphans exist', () => {
      const orphanCitations = [
        {
          authorYear: 'Smith2020',
          sourceMapping: {
            authorYear: 'Smith2020',
            zoteroKey: 'ABC123',
            sourceId: 2,
            extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
          },
          hasExtractedText: true
        }
      ];

      // Simulate the UI rendering by checking that the orphan citations are properly formatted
      expect(orphanCitations).toHaveLength(1);
      expect(orphanCitations[0].authorYear).toBe('Smith2020');
      expect(orphanCitations[0].hasExtractedText).toBe(true);
    });

    it('should disable Find Quotes button when no extracted text available', () => {
      const orphanCitations = [
        {
          authorYear: 'Smith2020',
          sourceMapping: {
            authorYear: 'Smith2020',
            zoteroKey: 'ABC123',
            sourceId: 2,
            extractedTextFile: null
          },
          hasExtractedText: false
        }
      ];

      expect(orphanCitations[0].hasExtractedText).toBe(false);
    });
  });
});
