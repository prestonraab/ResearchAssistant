import { jest } from '@jest/globals';
import { SentenceClaimMapper } from '../sentenceClaimMapper';

describe('SentenceClaimMapper', () => {
  let mapper: SentenceClaimMapper;
  let mockClaimsManager: any;

  beforeEach(() => {
    mockClaimsManager = {};
    mapper = new SentenceClaimMapper(mockClaimsManager);
  });

  describe('linkSentenceToClaim', () => {
    test('should link a sentence to a claim', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');

      const claims = mapper.getClaimsForSentence('S_1');
      expect(claims).toContain('C_1');
    });

    test('should not duplicate links', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_1');

      const claims = mapper.getClaimsForSentence('S_1');
      expect(claims).toHaveLength(1);
    });

    test('should link multiple claims to one sentence', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_2');
      await mapper.linkSentenceToClaim('S_1', 'C_3');

      const claims = mapper.getClaimsForSentence('S_1');
      expect(claims).toHaveLength(3);
      expect(claims).toContain('C_1');
      expect(claims).toContain('C_2');
      expect(claims).toContain('C_3');
    });

    test('should update timestamp on link', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');

      const mappings = mapper.getAllMappings();
      expect(mappings[0].updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('unlinkSentenceFromClaim', () => {
    test('should unlink a sentence from a claim', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.unlinkSentenceFromClaim('S_1', 'C_1');

      const claims = mapper.getClaimsForSentence('S_1');
      expect(claims).not.toContain('C_1');
    });

    test('should remove mapping when no claims left', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.unlinkSentenceFromClaim('S_1', 'C_1');

      expect(mapper.getMappingCount()).toBe(0);
    });

    test('should keep mapping if other claims exist', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_2');
      await mapper.unlinkSentenceFromClaim('S_1', 'C_1');

      const claims = mapper.getClaimsForSentence('S_1');
      expect(claims).toContain('C_2');
      expect(mapper.getMappingCount()).toBe(1);
    });
  });

  describe('getClaimsForSentence', () => {
    test('should return empty array for unmapped sentence', () => {
      const claims = mapper.getClaimsForSentence('S_unknown');
      expect(claims).toEqual([]);
    });

    test('should return all claims for a sentence', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_2');

      const claims = mapper.getClaimsForSentence('S_1');
      expect(claims).toHaveLength(2);
    });

    test('should return a copy of the claims array', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');

      const claims1 = mapper.getClaimsForSentence('S_1');
      const claims2 = mapper.getClaimsForSentence('S_1');

      expect(claims1).not.toBe(claims2); // Different arrays
      expect(claims1).toEqual(claims2); // Same content
    });
  });

  describe('getSentencesForClaim', () => {
    test('should return empty array for unmapped claim', () => {
      const sentences = mapper.getSentencesForClaim('C_unknown');
      expect(sentences).toEqual([]);
    });

    test('should return all sentences for a claim', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_2', 'C_1');

      const sentences = mapper.getSentencesForClaim('C_1');
      expect(sentences).toHaveLength(2);
      expect(sentences).toContain('S_1');
      expect(sentences).toContain('S_2');
    });
  });

  describe('deleteSentence', () => {
    test('should delete a sentence and preserve claims', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.deleteSentence('S_1');

      expect(mapper.getClaimsForSentence('S_1')).toEqual([]);
      expect(mapper.getMappingCount()).toBe(0);
    });

    test('should not affect other sentences', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_2', 'C_1');
      await mapper.deleteSentence('S_1');

      const sentences = mapper.getSentencesForClaim('C_1');
      expect(sentences).toContain('S_2');
    });
  });

  describe('deleteClaim', () => {
    test('should delete a claim from all sentences', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_2', 'C_1');
      await mapper.deleteClaim('C_1');

      expect(mapper.getClaimsForSentence('S_1')).not.toContain('C_1');
      expect(mapper.getClaimsForSentence('S_2')).not.toContain('C_1');
    });

    test('should remove empty mappings', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.deleteClaim('C_1');

      expect(mapper.getMappingCount()).toBe(0);
    });

    test('should keep mappings with other claims', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_2');
      await mapper.deleteClaim('C_1');

      expect(mapper.getClaimsForSentence('S_1')).toContain('C_2');
      expect(mapper.getMappingCount()).toBe(1);
    });
  });

  describe('getAllMappings', () => {
    test('should return all mappings', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_2', 'C_2');

      const mappings = mapper.getAllMappings();
      expect(mappings).toHaveLength(2);
    });

    test('should return empty array when no mappings', () => {
      const mappings = mapper.getAllMappings();
      expect(mappings).toEqual([]);
    });
  });

  describe('clearMappings', () => {
    test('should clear all mappings', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_2', 'C_2');

      mapper.clearMappings();

      expect(mapper.getMappingCount()).toBe(0);
    });
  });

  describe('getMappingCount', () => {
    test('should return correct count', async () => {
      expect(mapper.getMappingCount()).toBe(0);

      await mapper.linkSentenceToClaim('S_1', 'C_1');
      expect(mapper.getMappingCount()).toBe(1);

      await mapper.linkSentenceToClaim('S_2', 'C_2');
      expect(mapper.getMappingCount()).toBe(2);
    });
  });

  describe('complex scenarios', () => {
    test('should handle many-to-many relationships', async () => {
      // Sentence 1 has claims 1, 2, 3
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_2');
      await mapper.linkSentenceToClaim('S_1', 'C_3');

      // Sentence 2 has claims 2, 3, 4
      await mapper.linkSentenceToClaim('S_2', 'C_2');
      await mapper.linkSentenceToClaim('S_2', 'C_3');
      await mapper.linkSentenceToClaim('S_2', 'C_4');

      expect(mapper.getClaimsForSentence('S_1')).toHaveLength(3);
      expect(mapper.getClaimsForSentence('S_2')).toHaveLength(3);
      expect(mapper.getSentencesForClaim('C_2')).toHaveLength(2);
      expect(mapper.getSentencesForClaim('C_3')).toHaveLength(2);
    });

    test('should handle deletion in complex scenario', async () => {
      await mapper.linkSentenceToClaim('S_1', 'C_1');
      await mapper.linkSentenceToClaim('S_1', 'C_2');
      await mapper.linkSentenceToClaim('S_2', 'C_2');

      await mapper.deleteClaim('C_2');

      expect(mapper.getClaimsForSentence('S_1')).toEqual(['C_1']);
      expect(mapper.getClaimsForSentence('S_2')).toEqual([]);
      expect(mapper.getMappingCount()).toBe(1);
    });
  });
});
