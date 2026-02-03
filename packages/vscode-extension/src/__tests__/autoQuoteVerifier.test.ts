import { AutoQuoteVerifier } from '../core/autoQuoteVerifier';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';

interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

describe('AutoQuoteVerifier', () => {
    }))
  },
  commands: {
    executeCommand: jest.fn()
  },
  ProgressLocation: {
    Notification: 15
  }
}));

// Mock logger
jest.mock('../core/loggingService', () => ({
  getLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    dispose: jest.fn()
  })),
  initializeLogger: jest.fn(),
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  }
}));

// Mock UnifiedQuoteSearch
jest.mock('../services/unifiedQuoteSearch', () => ({
  UnifiedQuoteSearch: jest.fn().mockImplementation(() => ({
    search: jest.fn().mockResolvedValue([])
  }))
}));

// Mock LiteratureIndexer
jest.mock('../services/literatureIndexer', () => ({
  LiteratureIndexer: jest.fn().mockImplementation(() => ({}))
}));

describe('AutoQuoteVerifier', () => {
  let verifier: AutoQuoteVerifier;
  let mockClaimsManager: jest.Mocked<ClaimsManager>;

  beforeEach(() => {
    // Create mock ClaimsManager
    mockClaimsManager = {
      getClaim: jest.fn(),
      updateClaim: jest.fn(),
      onClaimSaved: jest.fn()
    } as any;

    verifier = new AutoQuoteVerifier(mockClaimsManager);
    
    // Spy on processVerificationQueue to prevent automatic processing in tests
    jest.spyOn(verifier as any, 'processVerificationQueue').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    verifier.dispose();
  });

  describe('verifyOnSave', () => {
    it('should skip verification if claim has no quote', () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: undefined, // No quote
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(0);
    });

    it('should skip verification if claim has no source', () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: '', // No source
        sourceId: 1,
        context: '',
        primaryQuote: {
          text: 'Test quote',
          source: ''
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(0);
    });

    it('should add claim to queue if it has quote and source', () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: {
          text: 'Test quote',
          source: 'Author2020'
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(1);
    });

    it('should update existing queue item if claim already in queue', () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: {
          text: 'Test quote',
          source: 'Author2020'
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      verifier.verifyOnSave(claim);
      verifier.verifyOnSave(claim); // Add same claim again

      expect(verifier.getQueueSize()).toBe(1); // Should still be 1
    });
  });

  describe('verifyClaimManually', () => {
    it('should return null if claim not found', async () => {
      mockClaimsManager.getClaim.mockReturnValue(null);

      const result = await verifier.verifyClaimManually('C_99');

      expect(result).toBeNull();
    });

    it('should return null if claim has no quote', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: '', // No quote
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.getClaim.mockReturnValue(claim);

      const result = await verifier.verifyClaimManually('C_01');

      expect(result).toBeNull();
    });

    it('should verify quote and update claim on success', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: {
          text: 'Test quote',
          source: 'Author2020'
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      const mockSearchResults = [
        {
          matchedText: 'Test quote',
          similarity: 0.95,
          sourceFile: 'Author - 2020 - Title.txt',
          startLine: 10,
          endLine: 12
        }
      ];

      mockClaimsManager.getClaim.mockReturnValue(claim);
      
      // Mock the UnifiedQuoteSearch.search method
      const mockSearch = jest.fn().mockResolvedValue(mockSearchResults);
      (verifier as any).unifiedQuoteSearch.search = mockSearch;
      
      mockClaimsManager.updateClaim.mockResolvedValue(undefined);

      const result = await verifier.verifyClaimManually('C_01');

      expect(result).toEqual({
        verified: true,
        similarity: 0.95,
        closestMatch: 'Test quote'
      });
      expect(mockSearch).toHaveBeenCalledWith('Test quote', 5);
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: true });
    });

    it('should show warning on verification failure', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: {
          text: 'Test quote',
          source: 'Author2020'
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      const mockSearchResults = [
        {
          matchedText: 'Similar but not exact quote',
          similarity: 0.45,
          sourceFile: 'Author - 2020 - Title.txt',
          startLine: 10,
          endLine: 12
        }
      ];

      mockClaimsManager.getClaim.mockReturnValue(claim);
      
      // Mock the UnifiedQuoteSearch.search method
      const mockSearch = jest.fn().mockResolvedValue(mockSearchResults);
      (verifier as any).unifiedQuoteSearch.search = mockSearch;
      
      mockClaimsManager.updateClaim.mockResolvedValue(undefined);

      const result = await verifier.verifyClaimManually('C_01');

      expect(result).toEqual({
        verified: false,
        similarity: 0.45,
        closestMatch: 'Similar but not exact quote'
      });
      expect(mockClaimsManager.updateClaim).toHaveBeenCalledWith('C_01', { verified: false });
    });
  });

  describe('getQueueSize', () => {
    it('should return 0 for empty queue', () => {
      expect(verifier.getQueueSize()).toBe(0);
    });

    it('should return correct queue size', () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Author2020',
        sourceId: 1,
        context: '',
        primaryQuote: 'Test quote',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      verifier.verifyOnSave(claim);

      expect(verifier.getQueueSize()).toBe(1);
    });
  });

  describe('clearQueue', () => {
    it('should clear the verification queue', () => {
      // Clear queue starts at 0
      expect(verifier.getQueueSize()).toBe(0);
      
      verifier.clearQueue();
      
      // Still 0 after clear
      expect(verifier.getQueueSize()).toBe(0);
    });
  });
});
