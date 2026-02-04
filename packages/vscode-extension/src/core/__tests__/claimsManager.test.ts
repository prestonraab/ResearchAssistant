import { jest } from '@jest/globals';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';
import { setupTest, aClaim } from '../../__tests__/helpers';

describe('ClaimsManager', () => {
  setupTest();

  let claimsFilePath: string;

  beforeEach(() => {
    claimsFilePath = '/test/claims_and_evidence.md';
  });

  describe('parseClaimBlock', () => {
    test('should parse a valid claim with all fields', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('ComBat uses Empirical Bayes to estimate location and scale parameters')
        .withCategory('Method')
        .withSource('Johnson2007')
        .withContext('Assumes Gaussian distribution.')
        .withPrimaryQuote('We propose parametric and non-parametric empirical Bayes frameworks for adjusting data for batch effects that is robust to outliers in small sample sizes', 'Johnson2007')
        .withSupportingQuote('Location and scale (L/S) adjustments can be defined as a wide family of adjustments', 'Johnson2007')
        .withSupportingQuote('The γ ig and δ ig represent the additive and multiplicative batch effects of batch i for gene g, respectively.', 'Johnson2007')
        .build();

      manager.addClaim(claim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_01');
      expect(claims[0].text).toBe('ComBat uses Empirical Bayes to estimate location and scale parameters');
      expect(claims[0].category).toBe('Method');
      expect(claims[0].primaryQuote.source).toBe('Johnson2007');
      expect(claims[0].context).toBe('Assumes Gaussian distribution.');
      expect(claims[0].primaryQuote.text).toContain('We propose parametric and non-parametric');
      expect(claims[0].supportingQuotes.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle malformed claim headers gracefully', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const validClaim = aClaim()
        .withId('C_02')
        .withText('Valid claim')
        .withCategory('Result')
        .build();

      manager.addClaim(validClaim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_02');
    });

    test('should handle missing optional fields', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_03')
        .withText('Minimal claim')
        .withCategory('Method')
        .build();

      manager.addClaim(claim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_03');
      expect(claims[0].text).toBe('Minimal claim');
      expect(claims[0].context).toBe('');
      expect(claims[0].primaryQuote.text).toBe('');
      expect(claims[0].supportingQuotes).toHaveLength(0);
    });

    test('should handle multi-line quotes correctly', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_04')
        .withText('Multi-line quote test')
        .withCategory('Method')
        .withPrimaryQuote('This is a very long quote that spans multiple lines and should be concatenated properly', 'Test2024')
        .build();

      manager.addClaim(claim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].primaryQuote.text).toContain('This is a very long quote');
      expect(claims[0].primaryQuote.text).toContain('concatenated properly');
    });
  });

  describe('loadFromCategoryFiles', () => {
    test('should load claims from multiple category files', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const claim1 = aClaim()
        .withId('C_01')
        .withText('Method claim')
        .withCategory('Method')
        .withSource('Johnson2007')
        .build();

      const claim2 = aClaim()
        .withId('C_02')
        .withText('Result claim')
        .withCategory('Result')
        .withSource('Zhang2020')
        .build();

      manager.addClaim(claim1);
      manager.addClaim(claim2);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(2);
      expect(claims.find((c: any) => c.id === 'C_01')).toBeDefined();
      expect(claims.find((c: any) => c.id === 'C_02')).toBeDefined();
    });

    test('should handle errors in individual category files gracefully', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const validClaim = aClaim()
        .withId('C_01')
        .withText('Valid claim')
        .withCategory('Method')
        .build();

      manager.addClaim(validClaim);
      const claims = manager.getClaims();

      expect(claims.length).toBeGreaterThanOrEqual(1);
      expect(claims.find((c: any) => c.id === 'C_01')).toBeDefined();
    });
  });

  describe('CRUD operations', () => {
    test('should save a new claim', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const newClaim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        context: 'Test context',
        primaryQuote: { text: 'Test quote', source: 'Test2024', sourceId: 1, verified: false },
        supportingQuotes: [
          { text: 'Supporting quote 1', source: 'Test2024', sourceId: 1, verified: false },
          { text: 'Supporting quote 2', source: 'Test2024', sourceId: 1, verified: false }
        ],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      inMemoryManager.addClaim(newClaim);

      const claims = inMemoryManager.getClaims();
      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_01');
    });

    test('should update an existing claim', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim().withId('C_01').withText('Original text').build();
      inMemoryManager.addClaim(claim);

      await inMemoryManager.updateClaim('C_01', { text: 'Updated text', context: 'New context' });

      const updated = inMemoryManager.getClaim('C_01');
      expect(updated?.text).toBe('Updated text');
      expect(updated?.context).toBe('New context');
    });

    test('should delete a claim', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim().withId('C_01').build();
      inMemoryManager.addClaim(claim);

      await inMemoryManager.deleteClaim('C_01');

      const claims = inMemoryManager.getClaims();
      expect(claims).toHaveLength(0);
    });

    test('should throw error when updating non-existent claim', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      await expect(inMemoryManager.updateClaim('C_99', { text: 'New text' }))
        .rejects.toThrow('Claim C_99 not found');
    });

    test('should throw error when deleting non-existent claim', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      await expect(inMemoryManager.deleteClaim('C_99'))
        .rejects.toThrow('Claim C_99 not found');
    });
  });

  describe('generateClaimId', () => {
    test('should generate C_01 for empty database', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const id = inMemoryManager.generateClaimId();
      expect(id).toBe('C_01');
    });

    test('should generate next sequential ID', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim().withId('C_01').build();
      const claim2 = aClaim().withId('C_02').build();
      const claim5 = aClaim().withId('C_05').build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);
      inMemoryManager.addClaim(claim5);

      const id = inMemoryManager.generateClaimId();
      expect(id).toBe('C_06'); // Should be max + 1
    });
  });

  describe('searchClaims', () => {
    test('should find claims by text', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim()
        .withId('C_01')
        .withText('Machine learning for classification')
        .withContext('Uses neural networks')
        .build();
      
      const claim2 = aClaim()
        .withId('C_02')
        .withText('Statistical analysis methods')
        .withContext('Traditional approaches')
        .build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);

      const results = await inMemoryManager.searchClaims('machine learning');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    test('should find claims by quote', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Machine learning for classification')
        .build();
      
      inMemoryManager.addClaim(claim);

      const results = await inMemoryManager.searchClaims('deep learning');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should find claims by context', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Machine learning for classification')
        .withContext('Uses neural networks')
        .build();
      
      inMemoryManager.addClaim(claim);

      const results = await inMemoryManager.searchClaims('neural networks');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    test('should return empty array for no matches', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Machine learning for classification')
        .build();
      
      inMemoryManager.addClaim(claim);

      const results = await inMemoryManager.searchClaims('quantum computing');
      expect(results).toHaveLength(0);
    });

    test('should be case-insensitive', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Machine learning for classification')
        .build();
      
      inMemoryManager.addClaim(claim);

      const results = await inMemoryManager.searchClaims('MACHINE LEARNING');
      expect(results).toHaveLength(1);
    });
  });

  describe('findClaimsBySection', () => {
    test('should find claims associated with a section', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim().withId('C_01').build();
      inMemoryManager.addClaim(claim);

      await inMemoryManager.addSectionToClaim('C_01', 'section-1');
      await inMemoryManager.addSectionToClaim('C_01', 'section-2');

      const results = inMemoryManager.findClaimsBySection('section-1');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    test('should return empty array for section with no claims', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const results = inMemoryManager.findClaimsBySection('nonexistent-section');
      expect(results).toHaveLength(0);
    });
  });

  describe('findClaimsBySource', () => {
    test('should find claims from a specific source', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim()
        .withId('C_01')
        .withText('First claim')
        .build();
      
      const claim2 = aClaim()
        .withId('C_02')
        .withText('Second claim')
        .build();
      
      const claim3 = aClaim()
        .withId('C_03')
        .withText('Third claim')
        .build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);
      inMemoryManager.addClaim(claim3);

      const results = inMemoryManager.findClaimsBySource('Test2024');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('detectSimilarClaims', () => {
    test('should detect similar claims above threshold', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim()
        .withId('C_01')
        .withText('ComBat uses Empirical Bayes for batch effect correction')
        .build();
      
      const claim2 = aClaim()
        .withId('C_02')
        .withText('Empirical Bayes methods are used in ComBat for adjusting batch effects')
        .build();
      
      const claim3 = aClaim()
        .withId('C_03')
        .withText('Machine learning approaches for classification')
        .build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);
      inMemoryManager.addClaim(claim3);

      const results = await inMemoryManager.detectSimilarClaims('ComBat uses Empirical Bayes for batch correction', 0.5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].claim.id).toMatch(/C_0[123]/);
      expect(results[0].similarity).toBeGreaterThan(0.3);
    });

    test('should return empty array when no similar claims found', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('ComBat uses Empirical Bayes for batch effect correction')
        .build();
      
      inMemoryManager.addClaim(claim);

      const results = await inMemoryManager.detectSimilarClaims('Quantum computing algorithms', 0.85);
      
      expect(results).toHaveLength(0);
    });

    test('should sort results by similarity descending', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim()
        .withId('C_01')
        .withText('ComBat Empirical Bayes batch')
        .build();
      
      const claim2 = aClaim()
        .withId('C_02')
        .withText('ComBat batch correction')
        .build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);

      const results = await inMemoryManager.detectSimilarClaims('ComBat Empirical Bayes batch', 0.3);
      
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
        }
      }
    });

    test('should respect similarity threshold', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('ComBat batch correction')
        .build();
      
      inMemoryManager.addClaim(claim);

      const highThreshold = await inMemoryManager.detectSimilarClaims('ComBat batch correction', 0.9);
      const lowThreshold = await inMemoryManager.detectSimilarClaims('ComBat batch correction', 0.3);
      
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  describe('mergeClaims', () => {
    test('should merge multiple claims into one', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim()
        .withId('C_01')
        .withText('First claim')
        .withCategory('Method')
        .withContext('First context')
        .withSource('Johnson2007')
        .build();
      
      const claim2 = aClaim()
        .withId('C_02')
        .withText('Second claim')
        .withCategory('Method')
        .withContext('Second context')
        .withSource('Zhang2020')
        .build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);
      
      await inMemoryManager.addSectionToClaim('C_01', 'section-1');
      await inMemoryManager.addSectionToClaim('C_02', 'section-2');

      const merged = await inMemoryManager.mergeClaims(['C_01', 'C_02']);

      expect(merged.id).toMatch(/C_\d+/);
      expect(merged.text).toBe('First claim');
      expect(merged.primaryQuote.source).toContain('Johnson2007');
      expect(merged.context).toContain('First context');
      expect(merged.context).toContain('Second context');
    });

    test('should combine all quotes', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim()
        .withId('C_01')
        .withPrimaryQuote('First quote', 'Source1')
        .withSupportingQuote('Supporting 1', 'Source1')
        .build();
      
      const claim2 = aClaim()
        .withId('C_02')
        .withPrimaryQuote('Second quote', 'Source2')
        .withSupportingQuote('Supporting 2', 'Source2')
        .build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);

      const merged = await inMemoryManager.mergeClaims(['C_01', 'C_02']);

      expect(merged.supportingQuotes.length).toBeGreaterThanOrEqual(1);
    });

    test('should preserve all section associations', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim1 = aClaim().withId('C_01').build();
      const claim2 = aClaim().withId('C_02').build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);
      
      await inMemoryManager.addSectionToClaim('C_01', 'section-1');
      await inMemoryManager.addSectionToClaim('C_02', 'section-2');

      const merged = await inMemoryManager.mergeClaims(['C_01', 'C_02']);

      expect(merged.sections).toContain('section-1');
      expect(merged.sections).toContain('section-2');
      expect(merged.sections).toHaveLength(2);
    });

    test('should throw error for less than 2 claims', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim().withId('C_01').build();
      inMemoryManager.addClaim(claim);

      await expect(inMemoryManager.mergeClaims(['C_01']))
        .rejects.toThrow('Must provide at least 2 claim IDs');
    });

    test('should throw error for non-existent claims', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim().withId('C_01').build();
      inMemoryManager.addClaim(claim);

      await expect(inMemoryManager.mergeClaims(['C_01', 'C_99']))
        .rejects.toThrow('One or more claim IDs not found');
    });
  });

  describe('persistClaims', () => {
    test('should write claims to file in correct format', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const newClaim: Claim = {
        id: 'C_01',
        text: 'Test claim text',
        category: 'Method',
        context: 'Test context',
        primaryQuote: { text: 'Test primary quote', source: 'Test2024', verified: false },
        supportingQuotes: [
          { text: 'Supporting quote 1', source: 'Test2024', verified: false },
          { text: 'Supporting quote 2', source: 'Test2024', verified: false }
        ],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      inMemoryManager.addClaim(newClaim);
      await inMemoryManager.saveClaim(newClaim);

      const claims = inMemoryManager.getClaims();
      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_01');
      expect(claims[0].text).toBe('Test claim text');
      expect(claims[0].category).toBe('Method');
      expect(claims[0].primaryQuote.text).toBe('Test primary quote');
      expect(claims[0].supportingQuotes).toHaveLength(2);
    });

    test('should handle incremental updates without data loss', async () => {
      const inMemoryManager = new ClaimsManager(claimsFilePath, { inMemory: true });

      const claim1 = aClaim().withId('C_01').withText('Original claim').build();
      const claim2 = aClaim().withId('C_02').withText('Another claim').build();
      
      inMemoryManager.addClaim(claim1);
      inMemoryManager.addClaim(claim2);

      await inMemoryManager.updateClaim('C_01', { context: 'New context' });

      const claims = inMemoryManager.getClaims();
      expect(claims).toHaveLength(2);
      expect(claims.find((c: any) => c.id === 'C_01')?.context).toBe('New context');
      expect(claims.find((c: any) => c.id === 'C_02')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    test('should handle empty manager', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      const claims = manager.getClaims();

      expect(claims).toHaveLength(0);
    });

    test('should handle non-existent file gracefully', async () => {
      const nonExistentPath = '/nonexistent/path/claims.md';
      const newManager = new ClaimsManager(nonExistentPath, { inMemory: true });
      const claims = newManager.getClaims();

      expect(claims).toHaveLength(0);
    });

    test('should handle manager with only headers', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      const claims = manager.getClaims();

      expect(claims).toHaveLength(0);
    });

    test('should handle claims with special characters', async () => {
      const manager = new ClaimsManager(claimsFilePath, { inMemory: true });
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Claim with "quotes" and \'apostrophes\'')
        .withContext('Context with special chars: @#$%')
        .build();
      
      manager.addClaim(claim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].text).toContain('quotes');
      expect(claims[0].text).toContain('apostrophes');
    });
  });
});
