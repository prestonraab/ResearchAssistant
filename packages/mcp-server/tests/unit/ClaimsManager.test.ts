import { ClaimsManager } from '@research-assistant/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('ClaimsManager', () => {
  let tempDir: string;
  let claimsManager: ClaimsManager;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'claims-test-'));
    claimsManager = new ClaimsManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('loadClaims', () => {
    it('should load claims from individual claim files', async () => {
      // Create claims directory with test files
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaim = `# Claims and Evidence: Methods

---

## C_01: Test claim about methods

**Category**: Method  
**Source**: Smith2020  
**Context**: Test context

**Primary Quote** (Abstract):
> "This is a test quote from the abstract."

**Supporting Quotes**:
- (Methods): "This is a supporting quote from methods."
- (Results): "This is another supporting quote."

---

## C_02: Another test claim

**Category**: Result  
**Source**: Jones2021  

**Primary Quote** (Results):
> "This is the primary quote for the second claim."

---
`;

      await fs.writeFile(path.join(claimsDir, 'methods.md'), testClaim);

      const claims = await claimsManager.loadClaims();

      expect(claims).toHaveLength(2);
      expect(claims[0].id).toBe('C_01');
      expect(claims[0].text).toBe('Test claim about methods');
      expect(claims[0].category).toBe('Method');
      expect(claims[0].primaryQuote.source).toBe('Smith2020');
      expect(claims[0].context).toBe('Test context');
      expect(claims[0].primaryQuote.text).toBe('This is a test quote from the abstract.');
      expect(claims[0].supportingQuotes).toHaveLength(2);
      expect(claims[0].supportingQuotes[0].text).toContain('supporting quote from methods');

      expect(claims[1].id).toBe('C_02');
      expect(claims[1].text).toBe('Another test claim');
      expect(claims[1].category).toBe('Result');
      expect(claims[1].primaryQuote.source).toBe('Jones2021');
    });

    it('should fallback to claims_and_evidence.md when claims directory is empty', async () => {
      // Create empty claims directory
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      // Create fallback file
      const fallbackFile = path.join(tempDir, '01_Knowledge_Base', 'claims_and_evidence.md');
      const testClaim = `## C_10: Fallback claim

**Category**: Background  
**Source**: Brown2019  

**Primary Quote**:
> "This is from the fallback file."

---
`;
      await fs.writeFile(fallbackFile, testClaim);

      const claims = await claimsManager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_10');
      expect(claims[0].text).toBe('Fallback claim');
      expect(claims[0].primaryQuote.source).toBe('Brown2019');
    });

    it('should fallback to claims_and_evidence.md when claims directory does not exist', async () => {
      // Only create the fallback file
      const knowledgeBaseDir = path.join(tempDir, '01_Knowledge_Base');
      await fs.mkdir(knowledgeBaseDir, { recursive: true });

      const fallbackFile = path.join(knowledgeBaseDir, 'claims_and_evidence.md');
      const testClaim = `## C_20: Another fallback claim

**Category**: Conclusion  
**Source**: Davis2022  

**Primary Quote**:
> "Fallback quote text."

---
`;
      await fs.writeFile(fallbackFile, testClaim);

      const claims = await claimsManager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].id).toBe('C_20');
      expect(claims[0].primaryQuote.source).toBe('Davis2022');
    });

    it('should return empty array when no claims files exist', async () => {
      const claims = await claimsManager.loadClaims();
      expect(claims).toHaveLength(0);
    });

    it('should handle claims with Source ID in parentheses', async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaim = `## C_30: Claim with source ID

**Category**: Method  
**Source**: Johnson2023 (Source ID: 42)  

**Primary Quote**:
> "Test quote."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaim);

      const claims = await claimsManager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].primaryQuote.source).toBe('Johnson2023');
    });

    it('should handle multi-line quotes', async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaim = `## C_40: Claim with multi-line quote

**Category**: Result  
**Source**: Wilson2024  

**Primary Quote** (Abstract):
> "This is the first line of the quote.
> This is the second line of the quote.
> This is the third line."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaim);

      const claims = await claimsManager.loadClaims();

      expect(claims).toHaveLength(1);
      expect(claims[0].primaryQuote.text).toContain('first line');
      expect(claims[0].primaryQuote.text).toContain('second line');
      expect(claims[0].primaryQuote.text).toContain('third line');
    });
  });

  describe('getClaim', () => {
    beforeEach(async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaim = `## C_50: Test claim for lookup

**Category**: Method  
**Source**: TestSource2020  

**Primary Quote**:
> "Test quote."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaim);
      await claimsManager.loadClaims();
    });

    it('should return claim by ID', () => {
      const claim = claimsManager.getClaim('C_50');
      expect(claim).not.toBeNull();
      expect(claim?.id).toBe('C_50');
      expect(claim?.text).toBe('Test claim for lookup');
    });

    it('should return null for non-existent claim ID', () => {
      const claim = claimsManager.getClaim('C_999');
      expect(claim).toBeNull();
    });

    it('should throw error if claims not loaded', () => {
      const newManager = new ClaimsManager(tempDir);
      expect(() => newManager.getClaim('C_50')).toThrow('Claims not loaded');
    });
  });

  describe('findClaimsBySource', () => {
    beforeEach(async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaims = `## C_60: First claim from source

**Category**: Method  
**Source**: CommonSource2020  

**Primary Quote**:
> "Quote one."

---

## C_61: Second claim from source

**Category**: Result  
**Source**: CommonSource2020  

**Primary Quote**:
> "Quote two."

---

## C_62: Claim from different source

**Category**: Method  
**Source**: DifferentSource2021  

**Primary Quote**:
> "Quote three."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaims);
      await claimsManager.loadClaims();
    });

    it('should return all claims from a specific source', () => {
      const claims = claimsManager.findClaimsBySource('CommonSource2020');
      expect(claims).toHaveLength(2);
      expect(claims[0].id).toBe('C_60');
      expect(claims[1].id).toBe('C_61');
    });

    it('should return empty array for non-existent source', () => {
      const claims = claimsManager.findClaimsBySource('NonExistentSource');
      expect(claims).toHaveLength(0);
    });

    it('should throw error if claims not loaded', () => {
      const newManager = new ClaimsManager(tempDir);
      expect(() => newManager.findClaimsBySource('CommonSource2020')).toThrow('Claims not loaded');
    });
  });

  describe('findClaimsBySection', () => {
    beforeEach(async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaims = `## C_70: Claim for section 2.1

**Category**: Method  
**Source**: Source2020  

**Primary Quote**:
> "Quote."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaims);
      
      // Load claims and manually add section associations for testing
      await claimsManager.loadClaims();
      const claim = claimsManager.getClaim('C_70');
      if (claim) {
        claim.sections = ['2.1', '2.2'];
      }
      // Rebuild indexes to reflect the change
      await claimsManager.loadClaims();
    });

    it('should return empty array for section with no claims', () => {
      const claims = claimsManager.findClaimsBySection('3.1');
      expect(claims).toHaveLength(0);
    });

    it('should throw error if claims not loaded', () => {
      const newManager = new ClaimsManager(tempDir);
      expect(() => newManager.findClaimsBySection('2.1')).toThrow('Claims not loaded');
    });
  });

  describe('getAllClaims', () => {
    it('should return all loaded claims', async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaims = `## C_80: First claim

**Category**: Method  
**Source**: Source1  

**Primary Quote**:
> "Quote 1."

---

## C_81: Second claim

**Category**: Result  
**Source**: Source2  

**Primary Quote**:
> "Quote 2."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaims);
      await claimsManager.loadClaims();

      const allClaims = claimsManager.getAllClaims();
      expect(allClaims).toHaveLength(2);
      expect(allClaims[0].id).toBe('C_80');
      expect(allClaims[1].id).toBe('C_81');
    });

    it('should return a copy of claims array', async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaim = `## C_90: Test claim

**Category**: Method  
**Source**: Source  

**Primary Quote**:
> "Quote."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaim);
      await claimsManager.loadClaims();

      const claims1 = claimsManager.getAllClaims();
      const claims2 = claimsManager.getAllClaims();

      expect(claims1).not.toBe(claims2); // Different array instances
      expect(claims1).toEqual(claims2); // Same content
    });
  });

  describe('getClaimCount', () => {
    it('should return the correct count of loaded claims', async () => {
      const claimsDir = path.join(tempDir, '01_Knowledge_Base', 'claims');
      await fs.mkdir(claimsDir, { recursive: true });

      const testClaims = `## C_100: Claim 1

**Category**: Method  
**Source**: Source  

**Primary Quote**:
> "Quote."

---

## C_101: Claim 2

**Category**: Result  
**Source**: Source  

**Primary Quote**:
> "Quote."

---

## C_102: Claim 3

**Category**: Conclusion  
**Source**: Source  

**Primary Quote**:
> "Quote."

---
`;
      await fs.writeFile(path.join(claimsDir, 'test.md'), testClaims);
      await claimsManager.loadClaims();

      expect(claimsManager.getClaimCount()).toBe(3);
    });

    it('should return 0 when no claims are loaded', () => {
      expect(claimsManager.getClaimCount()).toBe(0);
    });
  });
});
