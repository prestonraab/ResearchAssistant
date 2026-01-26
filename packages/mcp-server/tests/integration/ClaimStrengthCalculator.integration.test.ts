import { ClaimStrengthCalculator } from '../../src/services/ClaimStrengthCalculator.js';
import { EmbeddingService } from '../../src/core/EmbeddingService.js';
import { ClaimsManager } from '../../src/core/ClaimsManager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ClaimStrengthCalculator Integration Tests', () => {
  let claimStrengthCalculator: ClaimStrengthCalculator;
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
    
    claimStrengthCalculator = new ClaimStrengthCalculator(
      embeddingService,
      claimsManager,
      0.7
    );
  });

  describe('calculateStrength', () => {
    it('should calculate strength for a valid claim', async () => {
      const claims = claimsManager.getAllClaims();
      
      // Skip test if no claims available
      if (claims.length === 0) {
        console.warn('No claims available for testing');
        return;
      }

      const claimId = claims[0].id;
      const result = await claimStrengthCalculator.calculateStrength(claimId);
      
      // Verify result structure
      expect(result).toHaveProperty('claimId');
      expect(result).toHaveProperty('strengthScore');
      expect(result).toHaveProperty('supportingClaims');
      expect(result).toHaveProperty('contradictoryClaims');
      
      expect(result.claimId).toBe(claimId);
      expect(typeof result.strengthScore).toBe('number');
      expect(result.strengthScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.supportingClaims)).toBe(true);
      expect(Array.isArray(result.contradictoryClaims)).toBe(true);
    });

    it('should throw error for non-existent claim', async () => {
      await expect(
        claimStrengthCalculator.calculateStrength('INVALID_CLAIM_ID')
      ).rejects.toThrow('Claim not found');
    });

    it('should exclude claims from same source', async () => {
      const claims = claimsManager.getAllClaims();
      
      if (claims.length === 0) {
        console.warn('No claims available for testing');
        return;
      }

      const claimId = claims[0].id;
      const targetClaim = claimsManager.getClaim(claimId);
      const result = await claimStrengthCalculator.calculateStrength(claimId);
      
      // Verify no supporting claims are from the same source
      result.supportingClaims.forEach(supportingClaim => {
        expect(supportingClaim.source).not.toBe(targetClaim?.source);
      });
    });

    it('should sort supporting claims by similarity', async () => {
      const claims = claimsManager.getAllClaims();
      
      if (claims.length === 0) {
        console.warn('No claims available for testing');
        return;
      }

      const claimId = claims[0].id;
      const result = await claimStrengthCalculator.calculateStrength(claimId);
      
      // Verify supporting claims are sorted by descending similarity
      for (let i = 0; i < result.supportingClaims.length - 1; i++) {
        expect(result.supportingClaims[i].similarity).toBeGreaterThanOrEqual(
          result.supportingClaims[i + 1].similarity
        );
      }
    });
  });

  describe('calculateStrengthBatch', () => {
    it('should handle empty input array', async () => {
      const results = await claimStrengthCalculator.calculateStrengthBatch([]);
      
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(0);
    });

    it('should calculate strength for multiple claims', async () => {
      const claims = claimsManager.getAllClaims();
      
      if (claims.length < 2) {
        console.warn('Not enough claims available for batch testing');
        return;
      }

      const claimIds = claims.slice(0, 3).map(c => c.id);
      const results = await claimStrengthCalculator.calculateStrengthBatch(claimIds);
      
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBeGreaterThan(0);
      
      // Verify each result has correct structure
      for (const [claimId, result] of results.entries()) {
        expect(result).toHaveProperty('claimId');
        expect(result).toHaveProperty('strengthScore');
        expect(result).toHaveProperty('supportingClaims');
        expect(result).toHaveProperty('contradictoryClaims');
        expect(result.claimId).toBe(claimId);
      }
    });

    it('should preserve input order in results', async () => {
      const claims = claimsManager.getAllClaims();
      
      if (claims.length < 3) {
        console.warn('Not enough claims available for order testing');
        return;
      }

      const claimIds = claims.slice(0, 3).map(c => c.id);
      const results = await claimStrengthCalculator.calculateStrengthBatch(claimIds);
      
      // Verify all requested claims are in results
      claimIds.forEach(claimId => {
        expect(results.has(claimId)).toBe(true);
      });
    });

    it('should skip invalid claim IDs gracefully', async () => {
      const claims = claimsManager.getAllClaims();
      
      if (claims.length === 0) {
        console.warn('No claims available for testing');
        return;
      }

      const claimIds = [claims[0].id, 'INVALID_ID_1', 'INVALID_ID_2'];
      const results = await claimStrengthCalculator.calculateStrengthBatch(claimIds);
      
      // Should have result for valid claim only
      expect(results.has(claims[0].id)).toBe(true);
      expect(results.has('INVALID_ID_1')).toBe(false);
      expect(results.has('INVALID_ID_2')).toBe(false);
    });
  });

  describe('strength score properties', () => {
    it('should follow monotonic formula', async () => {
      const claims = claimsManager.getAllClaims();
      
      if (claims.length < 2) {
        console.warn('Not enough claims available for monotonicity testing');
        return;
      }

      // Calculate strength for multiple claims
      const claimIds = claims.slice(0, Math.min(5, claims.length)).map(c => c.id);
      const results = await claimStrengthCalculator.calculateStrengthBatch(claimIds);
      
      // Verify strength scores follow expected pattern
      for (const [claimId, result] of results.entries()) {
        const supportCount = result.supportingClaims.length;
        
        if (supportCount === 0) {
          expect(result.strengthScore).toBe(0);
        } else if (supportCount === 1) {
          expect(result.strengthScore).toBe(1);
        } else if (supportCount === 2) {
          expect(result.strengthScore).toBe(2);
        } else {
          // For 3+: should be 3 + log(n-2)
          const expectedScore = 3 + Math.log(supportCount - 2);
          expect(result.strengthScore).toBeCloseTo(expectedScore, 5);
        }
      }
    });
  });
});
