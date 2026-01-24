import { ClaimsManager, Claim } from '../claimsManager';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ClaimsManager', () => {
  let tempDir: string;
  let claimsFilePath: string;
  let manager: ClaimsManager;

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claims-test-'));
    claimsFilePath = path.join(tempDir, 'claims_and_evidence.md');
    manager = new ClaimsManager(claimsFilePath);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parseClaimBlock', () => {
    it('should parse a valid claim with all fields', async () => {
      const claimContent = `## C_01: ComBat uses Empirical Bayes to estimate location and scale parameters

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  
**Context**: Assumes Gaussian distribution.

**Primary Quote**:
> "We propose parametric and non-parametric empirical Bayes frameworks for adjusting data for batch effects that is robust to outliers in small sample sizes"

**Supporting Quotes**:
- "Location and scale (L/S) adjustments can be defined as a wide family of adjustments"
- "The γ ig and δ ig represent the additive and multiplicative batch effects of batch i for gene g, respectively."

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_01');
      expect(claims[0].text).toBe('ComBat uses Empirical Bayes to estimate location and scale parameters');
      expect(claims[0].category).toBe('Method');
      expect(claims[0].source).toBe('Johnson2007');
      expect(claims[0].sourceId).toBe(1);
      expect(claims[0].context).toBe('Assumes Gaussian distribution.');
      expect(claims[0].primaryQuote).toContain('We propose parametric and non-parametric');
      expect(claims[0].supportingQuotes).toHaveLength(2);
    });

    it('should handle malformed claim headers gracefully', async () => {
      const claimContent = `## Invalid Header

**Category**: Method  

---

## C_02: Valid claim

**Category**: Result  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      const claims = await manager.loadClaims();

      // Should only parse the valid claim
      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_02');
    });

    it('should handle missing optional fields', async () => {
      const claimContent = `## C_03: Minimal claim

**Category**: Method  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_03');
      expect(claims[0].text).toBe('Minimal claim');
      expect(claims[0].context).toBe('');
      expect(claims[0].primaryQuote).toBe('');
      expect(claims[0].supportingQuotes).toHaveLength(0);
    });

    it('should handle multi-line quotes correctly', async () => {
      const claimContent = `## C_04: Multi-line quote test

**Category**: Method  

**Primary Quote**:
> "This is a very long quote that spans
> multiple lines and should be
> concatenated properly"

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].primaryQuote).toContain('This is a very long quote');
      expect(claims[0].primaryQuote).toContain('concatenated properly');
    });
  });

  describe('loadFromCategoryFiles', () => {
    it('should load claims from multiple category files', async () => {
      const claimsDir = path.join(tempDir, 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const methodsContent = `# Claims and Evidence: Method

---

## C_01: Method claim

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  

---
`;

      const resultsContent = `# Claims and Evidence: Result

---

## C_02: Result claim

**Category**: Result  
**Source**: Zhang2020 (Source ID: 2)  

---
`;

      await fs.writeFile(path.join(claimsDir, 'methods.md'), methodsContent);
      await fs.writeFile(path.join(claimsDir, 'results.md'), resultsContent);
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n'); // Main file

      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(2);
      expect(claims.find(c => c.id === 'C_01')).toBeDefined();
      expect(claims.find(c => c.id === 'C_02')).toBeDefined();
    });

    it('should handle errors in individual category files gracefully', async () => {
      const claimsDir = path.join(tempDir, 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const validContent = `## C_01: Valid claim

**Category**: Method  

---
`;

      await fs.writeFile(path.join(claimsDir, 'methods.md'), validContent);
      await fs.writeFile(path.join(claimsDir, 'corrupted.md'), 'Invalid content!!!');
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');

      const claims = await manager.loadClaims();

      // Should still load the valid claim
      expect(claims.length).toBeGreaterThanOrEqual(1);
      expect(claims.find(c => c.id === 'C_01')).toBeDefined();
    });
  });

  describe('CRUD operations', () => {
    it('should save a new claim', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');
      await manager.loadClaims();

      const newClaim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Test2024',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: 'Test quote',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      await manager.saveClaim(newClaim);

      const claims = manager.getClaims();
      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_01');
    });

    it('should update an existing claim', async () => {
      const claimContent = `## C_01: Original text

**Category**: Method  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      await manager.updateClaim('C_01', { text: 'Updated text', context: 'New context' });

      const claim = manager.getClaim('C_01');
      expect(claim?.text).toBe('Updated text');
      expect(claim?.context).toBe('New context');
    });

    it('should delete a claim', async () => {
      const claimContent = `## C_01: Test claim

**Category**: Method  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      await manager.deleteClaim('C_01');

      const claims = manager.getClaims();
      expect(claims).toHaveLength(0);
    });

    it('should throw error when updating non-existent claim', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');
      await manager.loadClaims();

      await expect(manager.updateClaim('C_99', { text: 'New text' }))
        .rejects.toThrow('Claim C_99 not found');
    });

    it('should throw error when deleting non-existent claim', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');
      await manager.loadClaims();

      await expect(manager.deleteClaim('C_99'))
        .rejects.toThrow('Claim C_99 not found');
    });
  });

  describe('generateClaimId', () => {
    it('should generate C_01 for empty database', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');
      await manager.loadClaims();

      const id = manager.generateClaimId();
      expect(id).toBe('C_01');
    });

    it('should generate next sequential ID', async () => {
      const claimContent = `## C_01: First claim

---

## C_02: Second claim

---

## C_05: Fifth claim

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      const id = manager.generateClaimId();
      expect(id).toBe('C_06'); // Should be max + 1
    });
  });

  describe('searchClaims', () => {
    beforeEach(async () => {
      const claimContent = `## C_01: Machine learning for classification

**Category**: Method  
**Context**: Uses neural networks

**Primary Quote**:
> "Deep learning achieves high accuracy"

---

## C_02: Statistical analysis methods

**Category**: Method  
**Context**: Traditional approaches

**Primary Quote**:
> "T-tests are commonly used"

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();
    });

    it('should find claims by text', async () => {
      const results = await manager.searchClaims('machine learning');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    it('should find claims by quote', async () => {
      const results = await manager.searchClaims('deep learning');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    it('should find claims by context', async () => {
      const results = await manager.searchClaims('neural networks');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    it('should return empty array for no matches', async () => {
      const results = await manager.searchClaims('quantum computing');
      expect(results).toHaveLength(0);
    });

    it('should be case-insensitive', async () => {
      const results = await manager.searchClaims('MACHINE LEARNING');
      expect(results).toHaveLength(1);
    });
  });

  describe('findClaimsBySection', () => {
    it('should find claims associated with a section', async () => {
      const claimContent = `## C_01: Test claim

**Category**: Method  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      // Manually add section association
      await manager.updateClaim('C_01', { sections: ['section-1', 'section-2'] });

      const results = manager.findClaimsBySection('section-1');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('C_01');
    });

    it('should return empty array for section with no claims', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');
      await manager.loadClaims();

      const results = manager.findClaimsBySection('nonexistent-section');
      expect(results).toHaveLength(0);
    });
  });

  describe('findClaimsBySource', () => {
    it('should find claims from a specific source', async () => {
      const claimContent = `## C_01: First claim

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  

---

## C_02: Second claim

**Category**: Result  
**Source**: Zhang2020 (Source ID: 2)  

---

## C_03: Third claim

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      const results = manager.findClaimsBySource('Johnson2007');
      expect(results).toHaveLength(2);
      expect(results.map(c => c.id)).toContain('C_01');
      expect(results.map(c => c.id)).toContain('C_03');
    });
  });

  describe('detectSimilarClaims', () => {
    beforeEach(async () => {
      const claimContent = `## C_01: ComBat uses Empirical Bayes for batch effect correction

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  

---

## C_02: Empirical Bayes methods are used in ComBat for adjusting batch effects

**Category**: Method  
**Source**: Zhang2020 (Source ID: 2)  

---

## C_03: Machine learning approaches for classification

**Category**: Method  
**Source**: Smith2021 (Source ID: 3)  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();
    });

    it('should detect similar claims above threshold', async () => {
      const results = await manager.detectSimilarClaims('ComBat uses Empirical Bayes for batch correction', 0.5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].claim.id).toMatch(/C_0[12]/); // Should match C_01 or C_02
      expect(results[0].similarity).toBeGreaterThan(0.5);
    });

    it('should return empty array when no similar claims found', async () => {
      const results = await manager.detectSimilarClaims('Quantum computing algorithms', 0.85);
      
      expect(results).toHaveLength(0);
    });

    it('should sort results by similarity descending', async () => {
      const results = await manager.detectSimilarClaims('ComBat Empirical Bayes batch', 0.3);
      
      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
        }
      }
    });

    it('should respect similarity threshold', async () => {
      const highThreshold = await manager.detectSimilarClaims('ComBat batch correction', 0.9);
      const lowThreshold = await manager.detectSimilarClaims('ComBat batch correction', 0.3);
      
      expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
    });
  });

  describe('mergeClaims', () => {
    beforeEach(async () => {
      const claimContent = `## C_01: First claim

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  
**Context**: First context

**Primary Quote**:
> "First quote"

**Supporting Quotes**:
- "First supporting quote"

---

## C_02: Second claim

**Category**: Method  
**Source**: Zhang2020 (Source ID: 2)  
**Context**: Second context

**Primary Quote**:
> "Second quote"

**Supporting Quotes**:
- "Second supporting quote"

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      // Add section associations
      await manager.updateClaim('C_01', { sections: ['section-1'] });
      await manager.updateClaim('C_02', { sections: ['section-2'] });
    });

    it('should merge multiple claims into one', async () => {
      const merged = await manager.mergeClaims(['C_01', 'C_02']);

      expect(merged.id).toMatch(/C_\d+/);
      expect(merged.text).toBe('First claim'); // Uses first claim's text
      expect(merged.source).toContain('Johnson2007');
      expect(merged.source).toContain('Zhang2020');
      expect(merged.context).toContain('First context');
      expect(merged.context).toContain('Second context');
    });

    it('should combine all quotes', async () => {
      const merged = await manager.mergeClaims(['C_01', 'C_02']);

      expect(merged.primaryQuote).toBe('First quote');
      expect(merged.supportingQuotes.length).toBeGreaterThanOrEqual(3); // Second primary + 2 supporting
    });

    it('should preserve all section associations', async () => {
      const merged = await manager.mergeClaims(['C_01', 'C_02']);

      expect(merged.sections).toContain('section-1');
      expect(merged.sections).toContain('section-2');
      expect(merged.sections).toHaveLength(2);
    });

    it('should throw error for less than 2 claims', async () => {
      await expect(manager.mergeClaims(['C_01']))
        .rejects.toThrow('Must provide at least 2 claim IDs');
    });

    it('should throw error for non-existent claims', async () => {
      await expect(manager.mergeClaims(['C_01', 'C_99']))
        .rejects.toThrow('One or more claim IDs not found');
    });
  });

  describe('persistClaims', () => {
    it('should write claims to file in correct format', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n');
      await manager.loadClaims();

      const newClaim: Claim = {
        id: 'C_01',
        text: 'Test claim text',
        category: 'Method',
        source: 'Test2024',
        sourceId: 1,
        context: 'Test context',
        primaryQuote: 'Test primary quote',
        supportingQuotes: ['Supporting quote 1', 'Supporting quote 2'],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      await manager.saveClaim(newClaim);

      // Reload and verify
      const newManager = new ClaimsManager(claimsFilePath);
      const claims = await newManager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_01');
      expect(claims[0].text).toBe('Test claim text');
      expect(claims[0].category).toBe('Method');
      expect(claims[0].primaryQuote).toBe('Test primary quote');
      expect(claims[0].supportingQuotes).toHaveLength(2);
    });

    it('should handle incremental updates without data loss', async () => {
      const claimContent = `## C_01: Original claim

**Category**: Method  

---

## C_02: Another claim

**Category**: Result  

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      await manager.loadClaims();

      // Update one claim
      await manager.updateClaim('C_01', { context: 'New context' });

      // Reload and verify both claims still exist
      const newManager = new ClaimsManager(claimsFilePath);
      const claims = await newManager.loadClaims();

      expect(claims).toHaveLength(2);
      expect(claims.find(c => c.id === 'C_01')?.context).toBe('New context');
      expect(claims.find(c => c.id === 'C_02')).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', async () => {
      await fs.writeFile(claimsFilePath, '');
      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(0);
    });

    it('should handle non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'nonexistent.md');
      const newManager = new ClaimsManager(nonExistentPath);
      const claims = await newManager.loadClaims();

      expect(claims).toHaveLength(0);
    });

    it('should handle file with only headers', async () => {
      await fs.writeFile(claimsFilePath, '# Claims and Evidence\n\n## Notes\n\nSome notes here.');
      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(0);
    });

    it('should handle claims with special characters', async () => {
      const claimContent = `## C_01: Claim with "quotes" and 'apostrophes'

**Category**: Method  
**Context**: Context with special chars: @#$%

**Primary Quote**:
> "Quote with 'nested' quotes and special chars: <>&"

---
`;

      await fs.writeFile(claimsFilePath, claimContent);
      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].text).toContain('quotes');
      expect(claims[0].text).toContain('apostrophes');
    });
  });
});
