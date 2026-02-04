import { OrphanCitationValidator, CitationValidationResult } from '../../src/services/OrphanCitationValidator.js';
import { CitationSourceMapper } from '../../src/services/CitationSourceMapper.js';
import { ClaimsManager } from '../../src/managers/ClaimsManager.js';
import type { Claim, SourcedQuote } from '../../src/types/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('OrphanCitationValidator', () => {
  let tempDir: string;
  let validator: OrphanCitationValidator;
  let mapper: CitationSourceMapper;
  let claimsManager: ClaimsManager;
  let sourcesPath: string;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-validator-test-'));
    sourcesPath = path.join(tempDir, 'sources.md');

    // Create CitationSourceMapper with test sources
    mapper = new CitationSourceMapper(tempDir, 'sources.md', 'extracted-text');

    // Create ClaimsManager in in-memory mode
    claimsManager = new ClaimsManager('', { inMemory: true });

    // Create validator
    validator = new OrphanCitationValidator(mapper, claimsManager);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('validateClaimCitations', () => {
    beforeEach(async () => {
      // Set up sources
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
| 3 | Smith2015 | ABC123XY | Smith, John | 2015 | Third Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should return matched status when citation has supporting quote', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim about Johnson2007.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'This is a quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        claimId: 'C_01',
        authorYear: 'Johnson2007',
        status: 'matched',
        matchedQuoteSource: 'Johnson2007'
      });
    });

    it('should return orphan-citation status when citation has no supporting quote', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim about Johnson2007.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'This is a quote from Zhang2020',
          source: 'Zhang2020',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        claimId: 'C_01',
        authorYear: 'Johnson2007',
        status: 'orphan-citation'
      });
    });

    it('should return unmapped-source status for unknown author-year', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim about Unknown2025.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'This is a quote',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        claimId: 'C_01',
        authorYear: 'Unknown2025',
        status: 'unmapped-source'
      });
    });

    it('should return missing-claim status for non-existent claim', async () => {
      const results = await validator.validateClaimCitations('C_NONEXISTENT');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        claimId: 'C_NONEXISTENT',
        authorYear: '',
        status: 'missing-claim'
      });
    });

    it('should validate multiple citations in a single claim', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This claim mentions Johnson2007 and Zhang2020 and Smith2015.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [
          {
            text: 'Quote from Zhang2020',
            source: 'Zhang2020',
            verified: false
          }
        ],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(3);
      
      const johnson = results.find(r => r.authorYear === 'Johnson2007');
      expect(johnson?.status).toBe('matched');

      const zhang = results.find(r => r.authorYear === 'Zhang2020');
      expect(zhang?.status).toBe('matched');

      const smith = results.find(r => r.authorYear === 'Smith2015');
      expect(smith?.status).toBe('orphan-citation');
    });

    it('should extract citations from supporting quotes', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim mentioning Johnson2007 and Zhang2020.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'Quote text',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [
          {
            text: 'Another quote mentioning Zhang2020',
            source: 'Zhang2020',
            verified: false
          }
        ],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(2);
      expect(results.some(r => r.authorYear === 'Johnson2007')).toBe(true);
      expect(results.some(r => r.authorYear === 'Zhang2020')).toBe(true);
    });

    it('should handle claims with no citations', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim with no citations.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'Quote text',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(0);
    });

    it('should cache validation results', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim about Johnson2007.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      // First call
      const results1 = await validator.validateClaimCitations('C_01');

      // Second call should use cache
      const results2 = await validator.validateClaimCitations('C_01');

      expect(results1).toEqual(results2);
      expect(validator.getCacheStats().size).toBe(1);
    });

    it('should invalidate cache on manuscript change', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This is a claim about Johnson2007.',
        category: 'Method',
        context: 'Test context',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      // First validation
      await validator.validateClaimCitations('C_01');
      expect(validator.getCacheStats().size).toBe(1);

      // Invalidate cache with new manuscript content
      validator.invalidateCacheOnManuscriptChange('New manuscript content');

      // Cache should be cleared
      expect(validator.getCacheStats().size).toBe(0);
    });
  });

  describe('getOrphanCitationsForPair', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should return map of orphan citations by claim', async () => {
      const claim1: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007 and Zhang2020.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      const claim2: Claim = {
        id: 'C_02',
        text: 'This mentions Zhang2020.',
        category: 'Result',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim1);
      claimsManager.addClaim(claim2);

      const orphanMap = await validator.getOrphanCitationsForPair('pair_01');

      expect(orphanMap.has('C_01')).toBe(true);
      expect(orphanMap.get('C_01')).toContain('Zhang2020');
      expect(orphanMap.has('C_02')).toBe(true);
      expect(orphanMap.get('C_02')).toContain('Zhang2020');
    });

    it('should return empty map when no orphan citations exist', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const orphanMap = await validator.getOrphanCitationsForPair('pair_01');

      expect(orphanMap.size).toBe(0);
    });
  });

  describe('isOrphanCitation', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should return true for orphan citation', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Zhang2020',
          source: 'Zhang2020',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const isOrphan = await validator.isOrphanCitation('C_01', 'Johnson2007');

      expect(isOrphan).toBe(true);
    });

    it('should return false for matched citation', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const isOrphan = await validator.isOrphanCitation('C_01', 'Johnson2007');

      expect(isOrphan).toBe(false);
    });

    it('should return false for unmapped citation', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Unknown2025.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const isOrphan = await validator.isOrphanCitation('C_01', 'Unknown2025');

      expect(isOrphan).toBe(false);
    });
  });

  describe('edge cases', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | O'Brien2020 | SY5YRHHX | O'Brien, Patrick | 2020 | Another Paper | Test |
| 3 | van-der-Waals2015 | ABC123XY | van der Waals, Y. | 2015 | Third Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should handle author-years with apostrophes', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: "This mentions O'Brien2020 in the claim text.",
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: "Quote from O'Brien2020",
          source: "O'Brien2020",
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(1);
      expect(results[0].authorYear).toBe("O'Brien2020");
      expect(results[0].status).toBe('matched');
    });

    it('should handle author-years with hyphens', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Waals2015 in the claim text.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Waals2015',
          source: 'Waals2015',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(1);
      expect(results[0].authorYear).toBe('Waals2015');
      expect(results[0].status).toBe('matched');
    });

    it('should not match partial author-years', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson in 2007 separately.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote text',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      // Should not extract "Johnson" or "2007" separately
      expect(results).toHaveLength(0);
    });

    it('should handle duplicate citations in claim text', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Johnson2007 says something. Johnson2007 also says something else.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      // Should only have one result for Johnson2007, not duplicates
      expect(results).toHaveLength(1);
      expect(results[0].authorYear).toBe('Johnson2007');
    });

    it('should find quotes in supporting quotes', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Zhang2020',
          source: 'Zhang2020',
          verified: false
        },
        supportingQuotes: [
          {
            text: 'Quote from Johnson2007',
            source: 'Johnson2007',
            verified: false
          }
        ],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('matched');
      expect(results[0].matchedQuoteSource).toBe('Johnson2007');
    });
  });

  describe('cache management', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should clear cache on demand', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      await validator.validateClaimCitations('C_01');
      expect(validator.getCacheStats().size).toBe(1);

      validator.clearCache();
      expect(validator.getCacheStats().size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      const claim1: Claim = {
        id: 'C_01',
        text: 'This mentions Johnson2007.',
        category: 'Method',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      const claim2: Claim = {
        id: 'C_02',
        text: 'Another claim.',
        category: 'Result',
        context: 'Test',
        verified: false,
        primaryQuote: {
          text: 'Quote from Johnson2007',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim1);
      claimsManager.addClaim(claim2);

      await validator.validateClaimCitations('C_01');
      await validator.validateClaimCitations('C_02');

      const stats = validator.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toContain('C_01');
      expect(stats.entries).toContain('C_02');
    });
  });

  describe('real-world scenarios', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan; Li, Cheng; Rabinovic, Ariel | 2007 | Adjusting batch effects | Original ComBat paper |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing; Parmigiani, Giovanni; Johnson, W Evan | 2020 | ComBat-seq | ComBat-Seq paper |
| 3 | Soneson2014 | 4CFFLXQX | Soneson, Charlotte; Gerster, Sarah; Delorenzi, Mauro | 2014 | Batch Effect Confounding | Batch effect paper |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should validate a realistic claim with multiple citations', async () => {
      const claim: Claim = {
        id: 'C_01',
        text: 'Batch effect correction is a critical preprocessing step. Johnson2007 introduced ComBat, which was later extended by Zhang2020 for RNA-seq data. Soneson2014 demonstrated the importance of this correction.',
        category: 'Background',
        context: 'Introduction section',
        verified: false,
        primaryQuote: {
          text: 'Adjusting batch effects in microarray expression data using empirical Bayes methods',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [
          {
            text: 'ComBat-seq: batch effect adjustment for RNA-seq count data',
            source: 'Zhang2020',
            verified: false
          }
        ],
        sections: ['1.1'],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_01');

      expect(results).toHaveLength(3);
      
      const johnson = results.find(r => r.authorYear === 'Johnson2007');
      expect(johnson?.status).toBe('matched');

      const zhang = results.find(r => r.authorYear === 'Zhang2020');
      expect(zhang?.status).toBe('matched');

      const soneson = results.find(r => r.authorYear === 'Soneson2014');
      expect(soneson?.status).toBe('orphan-citation');
    });

    it('should handle complex claim with mixed matched and orphan citations', async () => {
      const claim: Claim = {
        id: 'C_02',
        text: 'Previous work by Johnson2007, Zhang2020, and Smith2015 has shown various approaches.',
        category: 'Background',
        context: 'Related work section',
        verified: false,
        primaryQuote: {
          text: 'Adjusting batch effects in microarray expression data',
          source: 'Johnson2007',
          verified: false
        },
        supportingQuotes: [
          {
            text: 'ComBat-seq for RNA-seq',
            source: 'Zhang2020',
            verified: false
          }
        ],
        sections: ['2.1'],
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      claimsManager.addClaim(claim);

      const results = await validator.validateClaimCitations('C_02');

      expect(results).toHaveLength(3);
      expect(results.filter(r => r.status === 'matched')).toHaveLength(2);
      expect(results.filter(r => r.status === 'orphan-citation')).toHaveLength(1);
    });
  });
});
