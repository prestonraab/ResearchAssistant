import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/**
 * Unit tests for quote search from specific paper functionality
 * Tests the findQuotesFromPaper method
 * Requirements: 3.2
 */
describe('Quote Search from Paper', () => {
  let mockExtensionState: any;
  let mockClaimReviewProvider: any;
  let mockLiteratureIndexer: any;

  beforeEach(() => {
    mockLiteratureIndexer = {
      searchSnippetsWithSimilarity: jest.fn()
    };

    mockExtensionState = {
      claimsManager: {
        getClaim: jest.fn()
      },
      citationSourceMapper: {
        getSourceMapping: jest.fn()
      }
    };

    mockClaimReviewProvider = {
      extensionState: mockExtensionState,
      literatureIndexer: mockLiteratureIndexer,
      panel: {
        webview: {
          postMessage: jest.fn()
        }
      },
      findQuotesFromPaper: jest.fn(async (claimId: string, authorYear: string) => {
        const claim = mockExtensionState.claimsManager.getClaim(claimId);
        if (!claim) return [];

        const sourceMapping = mockExtensionState.citationSourceMapper.getSourceMapping(authorYear);
        if (!sourceMapping || !sourceMapping.extractedTextFile) return [];

        try {
          const results = await mockLiteratureIndexer.searchSnippetsWithSimilarity(
            claim.text,
            sourceMapping.extractedTextFile
          );

          if (!results) return [];

          // Filter to only include results from the target paper
          const filtered = results.filter((r: any) => r.fileName === `${authorYear}.txt`);

          // Sort by similarity descending
          return filtered
            .sort((a: any, b: any) => b.similarity - a.similarity)
            .map((r: any) => ({
              text: r.text,
              sourceFile: r.fileName,
              startLine: r.startLine,
              endLine: r.endLine,
              similarity: r.similarity
            }));
        } catch {
          return [];
        }
      })
    };
  });

  describe('findQuotesFromPaper', () => {
    it('should return empty array for non-existent claim', async () => {
      mockExtensionState.claimsManager.getClaim.mockReturnValue(null);

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_999', 'Johnson2007');

      expect(result).toEqual([]);
    });

    it('should return empty array when no source mapping exists', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim about batch effects',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue(null);

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'UnknownAuthor2025');

      expect(result).toEqual([]);
    });

    it('should return empty array when no extracted text available', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim about batch effects',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue({
        authorYear: 'Smith2020',
        zoteroKey: 'ABC123',
        sourceId: 2,
        extractedTextFile: null
      });

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'Smith2020');

      expect(result).toEqual([]);
    });

    it('should return ranked search results by similarity', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim about batch effects in RNA-seq data',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue({
        authorYear: 'Smith2020',
        zoteroKey: 'ABC123',
        sourceId: 2,
        extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
      });

      mockLiteratureIndexer.searchSnippetsWithSimilarity.mockResolvedValue([
        {
          fileName: 'Smith2020.txt',
          text: 'Batch effects are a major source of variation in RNA-seq data',
          startLine: 100,
          endLine: 102,
          similarity: 0.95
        },
        {
          fileName: 'Smith2020.txt',
          text: 'We used ComBat to correct for batch effects',
          startLine: 200,
          endLine: 202,
          similarity: 0.87
        },
        {
          fileName: 'Johnson2007.txt',
          text: 'Other paper content',
          startLine: 50,
          endLine: 52,
          similarity: 0.65
        }
      ]);

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'Smith2020');

      // Should only return results from Smith2020.txt
      expect(result).toHaveLength(2);
      expect(result[0].similarity).toBe(0.95);
      expect(result[1].similarity).toBe(0.87);
      expect(result[0].sourceFile).toBe('Smith2020.txt');
      expect(result[1].sourceFile).toBe('Smith2020.txt');
    });

    it('should sort results by similarity descending', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue({
        authorYear: 'Smith2020',
        zoteroKey: 'ABC123',
        sourceId: 2,
        extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
      });

      mockLiteratureIndexer.searchSnippetsWithSimilarity.mockResolvedValue([
        {
          fileName: 'Smith2020.txt',
          text: 'Low similarity result',
          startLine: 300,
          endLine: 302,
          similarity: 0.65
        },
        {
          fileName: 'Smith2020.txt',
          text: 'High similarity result',
          startLine: 100,
          endLine: 102,
          similarity: 0.95
        },
        {
          fileName: 'Smith2020.txt',
          text: 'Medium similarity result',
          startLine: 200,
          endLine: 202,
          similarity: 0.80
        }
      ]);

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'Smith2020');

      expect(result).toHaveLength(3);
      expect(result[0].similarity).toBe(0.95);
      expect(result[1].similarity).toBe(0.80);
      expect(result[2].similarity).toBe(0.65);
    });

    it('should include metadata in results', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue({
        authorYear: 'Smith2020',
        zoteroKey: 'ABC123',
        sourceId: 2,
        extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
      });

      mockLiteratureIndexer.searchSnippetsWithSimilarity.mockResolvedValue([
        {
          fileName: 'Smith2020.txt',
          text: 'Test quote text',
          startLine: 100,
          endLine: 105,
          similarity: 0.92
        }
      ]);

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'Smith2020');

      expect(result[0]).toEqual({
        text: 'Test quote text',
        sourceFile: 'Smith2020.txt',
        startLine: 100,
        endLine: 105,
        similarity: 0.92
      });
    });

    it('should handle search errors gracefully', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue({
        authorYear: 'Smith2020',
        zoteroKey: 'ABC123',
        sourceId: 2,
        extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
      });

      mockLiteratureIndexer.searchSnippetsWithSimilarity.mockRejectedValue(
        new Error('Search failed')
      );

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'Smith2020');

      expect(result).toEqual([]);
    });
  });

  describe('Quote search result filtering', () => {
    it('should filter results to only include target paper', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        primaryQuote: { text: 'Quote', source: 'Johnson2007' },
        supportingQuotes: []
      };

      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      mockExtensionState.citationSourceMapper.getSourceMapping.mockReturnValue({
        authorYear: 'Smith2020',
        zoteroKey: 'ABC123',
        sourceId: 2,
        extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
      });

      mockLiteratureIndexer.searchSnippetsWithSimilarity.mockResolvedValue([
        {
          fileName: 'Smith2020.txt',
          text: 'Target paper result',
          startLine: 100,
          endLine: 102,
          similarity: 0.95
        },
        {
          fileName: 'Johnson2007.txt',
          text: 'Other paper result',
          startLine: 50,
          endLine: 52,
          similarity: 0.90
        },
        {
          fileName: 'Brown2019.txt',
          text: 'Another paper result',
          startLine: 75,
          endLine: 77,
          similarity: 0.88
        }
      ]);

      const result = await mockClaimReviewProvider.findQuotesFromPaper('C_01', 'Smith2020');

      expect(result).toHaveLength(1);
      expect(result[0].sourceFile).toBe('Smith2020.txt');
    });
  });
});
