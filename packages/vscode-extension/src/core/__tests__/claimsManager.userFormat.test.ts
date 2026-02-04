import { jest } from '@jest/globals';
import { ClaimsManager } from '../claimsManagerWrapper';
import { setupTest, aClaim } from '../../__tests__/helpers';

describe('ClaimsManager - User Format Compatibility', () => {
  setupTest();
  let claimsFile: string;
  let manager: ClaimsManager;

  beforeEach(() => {
    claimsFile = '/test/claims_and_evidence.md';
    manager = new ClaimsManager(claimsFile, { inMemory: true });
  });

  describe('User Format Parsing', () => {
    test('should parse claims with citation prefixes in quotes', async () => {
      const claim = aClaim()
        .withId('C_31')
        .withText('The Gene Expression Omnibus (GEO) is an international public repository')
        .withCategory('Data Source')
        .withSource('Clough2023')
        .withContext('Handles over 200,000 studies and 6.5 million samples.')
        .withPrimaryQuote('The Gene Expression Omnibus (GEO) is an international public repository that archives gene expression and epigenomics data sets.', 'Clough2023')
        .withSupportingQuote('GEO is a widely used international public repository for high-throughput gene expression and epigenomic data.', 'Clough2023')
        .build();

      manager.addClaim(claim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_31');
      expect(claims[0].text).toBe('The Gene Expression Omnibus (GEO) is an international public repository');
      expect(claims[0].category).toBe('Data Source');
      expect(claims[0].primaryQuote.source).toBe('Clough2023');
      expect(claims[0].context).toBe('Handles over 200,000 studies and 6.5 million samples.');
      expect(claims[0].primaryQuote.text).toContain('Gene Expression Omnibus');
      expect(claims[0].supportingQuotes).toHaveLength(1);
      expect(claims[0].supportingQuotes[0].text).toContain('widely used');
    });

    test('should parse multiple category files', async () => {
      const dataSourceClaim = aClaim()
        .withId('C_31')
        .withText('GEO is a public repository')
        .withCategory('Data Source')
        .withSource('Clough2023')
        .withContext('Test context')
        .withPrimaryQuote('Test quote', 'Clough2023')
        .build();

      const methodClaim = aClaim()
        .withId('C_01')
        .withText('ComBat adjusts for batch effects')
        .withCategory('Method - Batch Correction')
        .withSource('Johnson2007')
        .withContext('Uses empirical Bayes')
        .withPrimaryQuote('ComBat uses empirical Bayes methods', 'Johnson2007')
        .build();

      manager.addClaim(dataSourceClaim);
      manager.addClaim(methodClaim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(2);
      
      const geoClaim = claims.find(c => c.id === 'C_31');
      expect(geoClaim).toBeDefined();
      expect(geoClaim?.category).toBe('Data Source');
      
      const combatClaim = claims.find(c => c.id === 'C_01');
      expect(combatClaim).toBeDefined();
      expect(combatClaim?.category).toBe('Method - Batch Correction');
    });

    test('should handle claims without Sections field', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim without sections')
        .withCategory('Method')
        .withSource('Test2024')
        .withContext('No sections field')
        .withPrimaryQuote('Test quote', 'Test2024')
        .build();

      manager.addClaim(claim);
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].sections).toEqual([]);
    });

    test('should parse claims with Sections field', async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim with sections')
        .withCategory('Method')
        .withSource('Test2024')
        .withContext('Has sections field')
        .withPrimaryQuote('Test quote', 'Test2024')
        .build();

      manager.addClaim(claim);
      await manager.addSectionToClaim(claim.id, 'section-1');
      await manager.addSectionToClaim(claim.id, 'section-2');
      const claims = manager.getClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].sections).toContain('section-1');
      expect(claims[0].sections).toContain('section-2');
    });
  });

  describe('Section Association Methods', () => {
    beforeEach(async () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withSource('Test2024')
        .withContext('Test')
        .withPrimaryQuote('Test quote', 'Test2024')
        .build();

      manager.addClaim(claim);
    });

    test('should add section to claim', async () => {
      await manager.addSectionToClaim('C_01', 'section-1');

      const claim = manager.getClaim('C_01');
      expect(claim?.sections).toContain('section-1');
    });

    test('should not add duplicate sections', async () => {
      await manager.addSectionToClaim('C_01', 'section-1');
      await manager.addSectionToClaim('C_01', 'section-1');

      const claim = manager.getClaim('C_01');
      expect(claim?.sections).toEqual(['section-1']);
    });

    test('should remove section from claim', async () => {
      await manager.addSectionToClaim('C_01', 'section-1');
      await manager.addSectionToClaim('C_01', 'section-2');
      await manager.removeSectionFromClaim('C_01', 'section-1');

      const claim = manager.getClaim('C_01');
      expect(claim?.sections).toEqual(['section-2']);
    });

    test('should persist sections when saving', async () => {
      await manager.addSectionToClaim('C_01', 'section-1');

      const claim = manager.getClaim('C_01');
      expect(claim?.sections).toContain('section-1');
    });
  });

  describe('Serialization with User Format', () => {
    test('should serialize claims with citation prefixes preserved', async () => {
      const claim = aClaim()
        .withId('C_99')
        .withText('Test claim')
        .withCategory('Data Source')
        .withSource('Test2024')
        .withContext('Test context')
        .withPrimaryQuote('Test primary quote', 'Test2024')
        .withSupportingQuote('Supporting quote 1', 'Test2024')
        .withSupportingQuote('Supporting quote 2', 'Test2024')
        .build();

      manager.addClaim(claim);
      await manager.addSectionToClaim('C_99', 'section-1');
      await manager.saveClaim(claim);

      const savedClaim = manager.getClaim('C_99');
      
      expect(savedClaim).toBeDefined();
      expect(savedClaim?.id).toBe('C_99');
      expect(savedClaim?.text).toBe('Test claim');
      expect(savedClaim?.category).toBe('Data Source');
      expect(savedClaim?.primaryQuote.source).toBe('Test2024');
      expect(savedClaim?.sections).toContain('section-1');
      expect(savedClaim?.context).toBe('Test context');
      expect(savedClaim?.primaryQuote.text).toBe('Test primary quote');
      expect(savedClaim?.supportingQuotes).toHaveLength(2);
    });
  });
});
