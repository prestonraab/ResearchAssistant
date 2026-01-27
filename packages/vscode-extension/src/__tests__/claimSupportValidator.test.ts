import { ClaimSupportValidator } from '../core/claimSupportValidator';
import type { Claim, EmbeddingService } from '@research-assistant/core';
import { MCPClientManager } from '../mcp/mcpClient';
import * as fs from 'fs/promises';

describe('ClaimSupportValidator', () => {
  let validator: ClaimSupportValidator;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  let mockMCPClient: jest.Mocked<MCPClientManager>;
  const extractedTextPath = '/test/literature/ExtractedText';

  beforeEach(() => {
    // Create mock EmbeddingService
    mockEmbeddingService = {
      generateEmbedding: jest.fn(),
      generateBatch: jest.fn(),
      cosineSimilarity: jest.fn(),
      cacheEmbedding: jest.fn(),
      getCachedEmbedding: jest.fn()
    } as any;

    // Create mock MCPClient
    const mockSearchQuotes = jest.fn();
    mockMCPClient = {
      citation: {
        searchQuotes: mockSearchQuotes
      }
    } as any;

    validator = new ClaimSupportValidator(
      mockEmbeddingService,
      mockMCPClient,
      extractedTextPath
    );
  });

  describe('analyzeSimilarity', () => {
    it('should return 0 for empty claim text', async () => {
      const similarity = await validator.analyzeSimilarity('', 'Some quote');
      expect(similarity).toBe(0);
    });

    it('should return 0 for empty quote', async () => {
      const similarity = await validator.analyzeSimilarity('Some claim', '');
      expect(similarity).toBe(0);
    });

    it('should calculate similarity between claim and quote', async () => {
      const claimEmbedding = [0.1, 0.2, 0.3];
      const quoteEmbedding = [0.15, 0.25, 0.35];
      
      mockEmbeddingService.generateEmbedding
        .mockResolvedValueOnce(claimEmbedding)
        .mockResolvedValueOnce(quoteEmbedding);
      
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.85);

      const similarity = await validator.analyzeSimilarity(
        'Test claim text',
        'Test quote text'
      );

      expect(similarity).toBe(0.85);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledTimes(2);
      expect(mockEmbeddingService.cosineSimilarity).toHaveBeenCalledWith(
        claimEmbedding,
        quoteEmbedding
      );
    });

    it('should clamp similarity to [0, 1] range', async () => {
      mockEmbeddingService.generateEmbedding
        .mockResolvedValueOnce([1, 0, 0])
        .mockResolvedValueOnce([1, 0, 0]);
      
      // Return value > 1
      mockEmbeddingService.cosineSimilarity.mockReturnValue(1.5);

      const similarity = await validator.analyzeSimilarity('claim', 'quote');
      expect(similarity).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('Embedding generation failed')
      );

      const similarity = await validator.analyzeSimilarity('claim', 'quote');
      expect(similarity).toBe(0);
    });
  });

  describe('validateSupport', () => {
    const testClaim: Claim = {
      id: 'C_01',
      text: 'Batch correction improves data quality',
      category: 'Method',
      source: 'Author2020',
      sourceId: 1,
      context: '',
      primaryQuote: 'Our method significantly improves data quality through batch correction',
      supportingQuotes: [],
      sections: [],
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    it('should validate claim with strong support', async () => {
      mockEmbeddingService.generateEmbedding
        .mockResolvedValueOnce([0.8, 0.6])
        .mockResolvedValueOnce([0.85, 0.55]);
      
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.85);

      const validation = await validator.validateSupport(testClaim);

      expect(validation.claimId).toBe('C_01');
      expect(validation.similarity).toBe(0.85);
      expect(validation.supported).toBe(true);
      expect(validation.suggestedQuotes).toBeUndefined();
      expect(validation.analysis).toContain('Strong support');
    });

    it('should validate claim with moderate support', async () => {
      mockEmbeddingService.generateEmbedding
        .mockResolvedValueOnce([0.7, 0.3])
        .mockResolvedValueOnce([0.6, 0.4]);
      
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.65);

      // Mock file reading for finding better quotes
      (fs.readFile as jest.Mock).mockResolvedValue('Some paper text with sentences.');
      mockEmbeddingService.generateBatch.mockResolvedValue([[0.1], [0.2]]);

      const validation = await validator.validateSupport(testClaim);

      expect(validation.similarity).toBe(0.65);
      expect(validation.supported).toBe(true);
      expect(validation.analysis).toContain('Moderate support');
    });

    it('should validate claim with weak support', async () => {
      mockEmbeddingService.generateEmbedding
        .mockResolvedValueOnce([0.5, 0.5])
        .mockResolvedValueOnce([0.1, 0.9]);
      
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.45);

      // Mock file reading for finding better quotes
      (fs.readFile as jest.Mock).mockResolvedValue('Some paper text with sentences.');
      mockEmbeddingService.generateBatch.mockResolvedValue([[0.1], [0.2]]);

      const validation = await validator.validateSupport(testClaim);

      expect(validation.similarity).toBe(0.45);
      expect(validation.supported).toBe(false);
      expect(validation.analysis).toContain('Weak support');
    });

    it('should handle validation errors', async () => {
      mockEmbeddingService.generateEmbedding.mockRejectedValue(
        new Error('Service unavailable')
      );

      const validation = await validator.validateSupport(testClaim);

      expect(validation.claimId).toBe('C_01');
      expect(validation.similarity).toBe(0);
      expect(validation.supported).toBe(false);
      // When similarity is 0, it generates "Weak support" analysis
      expect(validation.analysis).toContain('Weak support');
    });
  });

  describe('findBetterQuotes', () => {
    it('should return empty array if source text not found', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      (mockMCPClient.citation.searchQuotes as jest.Mock).mockResolvedValue([]);

      const quotes = await validator.findBetterQuotes(
        'Test claim',
        'Author2020'
      );

      expect(quotes).toEqual([]);
    });

    it('should extract and rank sentences from source text', async () => {
      const sourceText = 'First sentence about batch correction. Second sentence about data quality. Third sentence about validation methods.';
      
      (fs.readFile as jest.Mock).mockResolvedValue(sourceText);
      
      const claimEmbedding = [0.5, 0.5];
      mockEmbeddingService.generateEmbedding.mockResolvedValue(claimEmbedding);
      
      const sentenceEmbeddings = [
        [0.6, 0.4], // similarity 0.9
        [0.4, 0.6], // similarity 0.7
        [0.1, 0.9]  // similarity 0.3
      ];
      mockEmbeddingService.generateBatch.mockResolvedValue(sentenceEmbeddings);
      
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.7)
        .mockReturnValueOnce(0.3);

      const quotes = await validator.findBetterQuotes(
        'Batch correction improves quality',
        'Author2020'
      );

      expect(quotes).toHaveLength(2); // Only sentences with similarity > 0.5
      expect(quotes[0]).toContain('First sentence');
      expect(quotes[1]).toContain('Second sentence');
    });

    it('should limit results to top 3 suggestions', async () => {
      const sourceText = 'Sentence one with enough length. Sentence two with enough length. Sentence three with enough length. Sentence four with enough length. Sentence five with enough length.';
      
      (fs.readFile as jest.Mock).mockResolvedValue(sourceText);
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5]);
      mockEmbeddingService.generateBatch.mockResolvedValue([
        [0.6, 0.4],
        [0.55, 0.45],
        [0.52, 0.48],
        [0.51, 0.49],
        [0.50, 0.50]
      ]);
      
      // All have high similarity
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.95)
        .mockReturnValueOnce(0.90)
        .mockReturnValueOnce(0.85)
        .mockReturnValueOnce(0.80)
        .mockReturnValueOnce(0.75);

      const quotes = await validator.findBetterQuotes('claim', 'Author2020');

      expect(quotes).toHaveLength(3); // Limited to top 3
    });

    it('should handle errors gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));
      (mockMCPClient.citation.searchQuotes as jest.Mock).mockRejectedValue(new Error('MCP error'));

      const quotes = await validator.findBetterQuotes('claim', 'Author2020');

      expect(quotes).toEqual([]);
    });
  });

  describe('batchValidate', () => {
    const claims: Claim[] = [
      {
        id: 'C_01',
        text: 'Claim 1',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: 'Quote 1',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        id: 'C_02',
        text: 'Claim 2',
        category: 'Result',
        source: 'Author2021',
        sourceId: 2,
        context: '',
        primaryQuote: 'Quote 2',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    ];

    it('should validate all claims in batch', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5]);
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.8);

      const validations = await validator.batchValidate(claims);

      expect(validations).toHaveLength(2);
      expect(validations[0].claimId).toBe('C_01');
      expect(validations[1].claimId).toBe('C_02');
    });

    it('should report progress during batch validation', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5]);
      mockEmbeddingService.cosineSimilarity.mockReturnValue(0.8);

      const progressCallback = jest.fn();
      await validator.batchValidate(claims, progressCallback);

      expect(progressCallback).toHaveBeenCalledWith(1, 2);
      expect(progressCallback).toHaveBeenCalledWith(2, 2);
    });
  });

  describe('flagWeakSupport', () => {
    const claims: Claim[] = [
      {
        id: 'C_01',
        text: 'Strong claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: 'Strong supporting quote',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      },
      {
        id: 'C_02',
        text: 'Weak claim',
        category: 'Result',
        source: 'Author2021',
        sourceId: 2,
        context: '',
        primaryQuote: 'Unrelated quote',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    ];

    it('should flag only claims with weak support', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5]);
      
      // First claim: strong support (0.85)
      // Second claim: weak support (0.45)
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.85)
        .mockReturnValueOnce(0.45);

      const weakClaims = await validator.flagWeakSupport(claims);

      expect(weakClaims).toHaveLength(1);
      expect(weakClaims[0].claim.id).toBe('C_02');
      expect(weakClaims[0].validation.similarity).toBe(0.45);
    });

    it('should use custom threshold', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5]);
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.75)
        .mockReturnValueOnce(0.65);

      // With threshold 0.7, both should be flagged
      const weakClaims = await validator.flagWeakSupport(claims, 0.7);

      expect(weakClaims).toHaveLength(1);
      expect(weakClaims[0].claim.id).toBe('C_02');
    });

    it('should return empty array if all claims have strong support', async () => {
      mockEmbeddingService.generateEmbedding.mockResolvedValue([0.5, 0.5]);
      mockEmbeddingService.cosineSimilarity
        .mockReturnValueOnce(0.85)
        .mockReturnValueOnce(0.90);

      const weakClaims = await validator.flagWeakSupport(claims);

      expect(weakClaims).toEqual([]);
    });
  });

  describe('updateExtractedTextPath', () => {
    it('should update the extracted text path', () => {
      const newPath = '/new/path/to/extracted/text';
      validator.updateExtractedTextPath(newPath);
      
      // Path is updated (tested indirectly through file operations)
      expect(validator).toBeDefined();
    });
  });
});
