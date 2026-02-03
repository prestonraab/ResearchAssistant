import { ClaimsManager } from '../claimsManagerWrapper';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ClaimsManager - User Format Compatibility', () => {
  let tempDir: string;
  let claimsFile: string;
  let claimsDir: string;
  let manager: ClaimsManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claims-user-format-'));
    claimsFile = path.join(tempDir, 'claims_and_evidence.md');
    claimsDir = path.join(tempDir, 'claims');
    await fs.mkdir(claimsDir, { recursive: true });
    
    // Create placeholder main file to enable category file detection
    await fs.writeFile(claimsFile, '# Claims and Evidence\n\nSee claims/ directory for organized claims.\n', 'utf-8');
    
    manager = new ClaimsManager(claimsFile);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('User Format Parsing', () => {
    test('should parse claims with citation prefixes in quotes', async () => {
      const content = `# Claims and Evidence: Data Source

This file contains all **Data Source** claims with their supporting evidence.

---

## C_31: The Gene Expression Omnibus (GEO) is an international public repository

**Category**: Data Source  
**Source**: Clough2023 (Source ID: 17)  
**Context**: Handles over 200,000 studies and 6.5 million samples.

**Primary Quote** (Abstract):
> "The Gene Expression Omnibus (GEO) is an international public repository that archives gene expression and epigenomics data sets."

**Supporting Quotes**:
- (Conclusion): "GEO is a widely used international public repository for high-throughput gene expression and epigenomic data."

---
`;

      const filePath = path.join(claimsDir, 'data_sources.md');
      await fs.writeFile(filePath, content, 'utf-8');

      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_31');
      expect(claims[0].text).toBe('The Gene Expression Omnibus (GEO) is an international public repository');
      expect(claims[0].category).toBe('Data Source');
      expect(claims[0].source).toBe('Clough2023');
      expect(claims[0].sourceId).toBe(17);
      expect(claims[0].context).toBe('Handles over 200,000 studies and 6.5 million samples.');
      expect(claims[0].primaryQuote).toContain('Gene Expression Omnibus');
      expect(claims[0].supportingQuotes).toHaveLength(1);
      expect(claims[0].supportingQuotes[0]).toContain('widely used');
    });

    test('should parse multiple category files', async () => {
      const dataSourceContent = `# Claims and Evidence: Data Source

---

## C_31: GEO is a public repository

**Category**: Data Source  
**Source**: Clough2023 (Source ID: 17)  
**Context**: Test context

**Primary Quote**:
> "Test quote"

---
`;

      const methodContent = `# Claims and Evidence: Method - Batch Correction

---

## C_01: ComBat adjusts for batch effects

**Category**: Method - Batch Correction  
**Source**: Johnson2007 (Source ID: 1)  
**Context**: Uses empirical Bayes

**Primary Quote**:
> "ComBat uses empirical Bayes methods"

---
`;

      await fs.writeFile(path.join(claimsDir, 'data_sources.md'), dataSourceContent, 'utf-8');
      await fs.writeFile(path.join(claimsDir, 'methods_batch_correction.md'), methodContent, 'utf-8');

      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(2);
      
      const geoClaim = claims.find(c => c.id === 'C_31');
      expect(geoClaim).toBeDefined();
      expect(geoClaim?.category).toBe('Data Source');
      
      const combatClaim = claims.find(c => c.id === 'C_01');
      expect(combatClaim).toBeDefined();
      expect(combatClaim?.category).toBe('Method - Batch Correction');
    });

    test('should handle claims without Sections field', async () => {
      const content = `# Claims and Evidence: Method

---

## C_01: Test claim without sections

**Category**: Method  
**Source**: Test2024 (Source ID: 1)  
**Context**: No sections field

**Primary Quote**:
> "Test quote"

---
`;

      await fs.writeFile(path.join(claimsDir, 'methods_batch_correction.md'), content, 'utf-8');

      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].sections).toEqual([]);
    });

    test('should parse claims with Sections field', async () => {
      const content = `# Claims and Evidence: Method

---

## C_01: Test claim with sections

**Category**: Method  
**Source**: Test2024 (Source ID: 1)  
**Sections**: [section-1, section-2]
**Context**: Has sections field

**Primary Quote**:
> "Test quote"

---
`;

      await fs.writeFile(path.join(claimsDir, 'methods_batch_correction.md'), content, 'utf-8');

      const claims = await manager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].sections).toEqual(['section-1', 'section-2']);
    });
  });

  describe('Section Association Methods', () => {
    beforeEach(async () => {
      const content = `# Claims and Evidence: Method

---

## C_01: Test claim

**Category**: Method  
**Source**: Test2024 (Source ID: 1)  
**Context**: Test

**Primary Quote**:
> "Test quote"

---
`;

      await fs.writeFile(path.join(claimsDir, 'methods_batch_correction.md'), content, 'utf-8');
      await manager.loadClaims();
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

      // Reload from file
      const newManager = new ClaimsManager(claimsFile);
      await newManager.loadClaims();

      const claim = newManager.getClaim('C_01');
      expect(claim?.sections).toContain('section-1');
    });
  });

  describe('Serialization with User Format', () => {
    test('should serialize claims with citation prefixes preserved', async () => {
      const claim = {
        id: 'C_99',
        text: 'Test claim',
        category: 'Data Source',
        source: 'Test2024',
        sourceId: 99,
        context: 'Test context',
        primaryQuote: 'Test primary quote',
        supportingQuotes: ['(Section 2): Supporting quote 1', 'Supporting quote 2'],
        sections: ['section-1'],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      await manager.saveClaim(claim);

      // Read the file and check format
      const files = await fs.readdir(claimsDir);
      const dataSourceFile = files.find(f => f === 'data_sources.md');
      expect(dataSourceFile).toBeDefined();

      const content = await fs.readFile(path.join(claimsDir, dataSourceFile!), 'utf-8');
      
      expect(content).toContain('## C_99: Test claim');
      expect(content).toContain('**Category**: Data Source');
      expect(content).toContain('**Source**: Test2024 (Source ID: 99)');
      expect(content).toContain('**Sections**: [section-1]');
      expect(content).toContain('**Context**: Test context');
      expect(content).toContain('**Primary Quote**:');
      expect(content).toContain('> "Test primary quote"');
      expect(content).toContain('**Supporting Quotes**:');
      expect(content).toContain('- (Section 2): "Supporting quote 1"');
      expect(content).toContain('- "Supporting quote 2"');
    });
  });
});
