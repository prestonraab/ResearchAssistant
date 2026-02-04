import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CitationSourceMapper, SourceMapping } from '../src/services/CitationSourceMapper.js';

describe('CitationSourceMapper', () => {
  let tempDir: string;
  let mapper: CitationSourceMapper;
  let sourcesPath: string;
  let extractedTextPath: string;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'citation-mapper-test-'));
    sourcesPath = path.join(tempDir, 'sources.md');
    extractedTextPath = path.join(tempDir, 'extracted-text');
    fs.mkdirSync(extractedTextPath, { recursive: true });

    mapper = new CitationSourceMapper(tempDir, 'sources.md', 'extracted-text');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadSourceMappings', () => {
    it('should parse a valid sources.md file', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.isMapped('Johnson2007')).toBe(true);
      expect(mapper.isMapped('Zhang2020')).toBe(true);
      expect(mapper.isMapped('Unknown2025')).toBe(false);
    });

    it('should extract correct source mapping data', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      const mapping = mapper.getSourceMapping('Johnson2007');
      expect(mapping).not.toBeNull();
      expect(mapping?.authorYear).toBe('Johnson2007');
      expect(mapping?.zoteroKey).toBe('LM86I2Q4');
      expect(mapping?.sourceId).toBe(1);
    });

    it('should handle missing sources.md gracefully', async () => {
      // Don't create the file
      await mapper.loadSourceMappings();

      expect(mapper.isMapped('Johnson2007')).toBe(false);
      expect(mapper.getAllMappings().size).toBe(0);
    });

    it('should skip malformed rows', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| invalid | row | data |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.isMapped('Johnson2007')).toBe(true);
      expect(mapper.isMapped('Zhang2020')).toBe(true);
    });

    it('should cache mappings and not reload if file unchanged', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();
      const firstLoad = mapper.getAllMappings().size;

      // Load again without changing file
      await mapper.loadSourceMappings();
      const secondLoad = mapper.getAllMappings().size;

      expect(firstLoad).toBe(secondLoad);
      expect(firstLoad).toBe(1);
    });

    it('should invalidate cache when file is modified', async () => {
      const sourcesContent1 = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent1);

      await mapper.loadSourceMappings();
      expect(mapper.getAllMappings().size).toBe(1);

      // Wait a bit to ensure different mtime
      await new Promise(resolve => setTimeout(resolve, 10));

      // Modify file
      const sourcesContent2 = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
| 3 | Smith2015 | ABC123XY | Smith, John | 2015 | Third Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent2);

      await mapper.loadSourceMappings();
      expect(mapper.getAllMappings().size).toBe(3);
    });

    it('should handle empty sources.md', async () => {
      fs.writeFileSync(sourcesPath, '# Source Registry\n');

      await mapper.loadSourceMappings();

      expect(mapper.getAllMappings().size).toBe(0);
    });

    it('should handle sources.md with only headers', async () => {
      const sourcesContent = `# Source Registry

## Format

Each source has metadata.

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.getAllMappings().size).toBe(0);
    });
  });

  describe('getSourceMapping', () => {
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

    it('should return mapping for existing author-year', () => {
      const mapping = mapper.getSourceMapping('Johnson2007');
      expect(mapping).not.toBeNull();
      expect(mapping?.authorYear).toBe('Johnson2007');
    });

    it('should return null for non-existent author-year', () => {
      const mapping = mapper.getSourceMapping('Unknown2025');
      expect(mapping).toBeNull();
    });

    it('should be case-sensitive', async () => {
      const mapping = mapper.getSourceMapping('johnson2007');
      expect(mapping).toBeNull();
    });
  });

  describe('getExtractedTextPath', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
    });

    it('should return null for unmapped author-year', async () => {
      await mapper.loadSourceMappings();
      const path = mapper.getExtractedTextPath('Unknown2025');
      expect(path).toBeNull();
    });

    it('should find extracted text file matching author-year', async () => {
      // Create extracted text file
      fs.writeFileSync(path.join(extractedTextPath, 'Johnson2007.txt'), 'Sample text');

      await mapper.loadSourceMappings();
      const textPath = mapper.getExtractedTextPath('Johnson2007');

      expect(textPath).not.toBeNull();
      expect(textPath).toContain('Johnson2007.txt');
    });

    it('should find extracted text file with underscore format', async () => {
      // Create extracted text file with underscore
      fs.writeFileSync(path.join(extractedTextPath, 'Johnson_2007.txt'), 'Sample text');

      await mapper.loadSourceMappings();
      const textPath = mapper.getExtractedTextPath('Johnson2007');

      expect(textPath).not.toBeNull();
      expect(textPath).toContain('Johnson_2007.txt');
    });

    it('should return null when extracted text file does not exist', async () => {
      await mapper.loadSourceMappings();
      const textPath = mapper.getExtractedTextPath('Johnson2007');

      expect(textPath).toBeNull();
    });
  });

  describe('isMapped', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should return true for mapped author-year', () => {
      expect(mapper.isMapped('Johnson2007')).toBe(true);
    });

    it('should return false for unmapped author-year', () => {
      expect(mapper.isMapped('Unknown2025')).toBe(false);
    });
  });

  describe('getUnmappedAuthorYears', () => {
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

    it('should return empty array when all are mapped', () => {
      const unmapped = mapper.getUnmappedAuthorYears(['Johnson2007', 'Zhang2020']);
      expect(unmapped).toEqual([]);
    });

    it('should return unmapped author-years', () => {
      const unmapped = mapper.getUnmappedAuthorYears(['Johnson2007', 'Unknown2025', 'Zhang2020', 'Smith2015']);
      expect(unmapped).toContain('Unknown2025');
      expect(unmapped).toContain('Smith2015');
      expect(unmapped).not.toContain('Johnson2007');
      expect(unmapped).not.toContain('Zhang2020');
    });

    it('should handle empty input', () => {
      const unmapped = mapper.getUnmappedAuthorYears([]);
      expect(unmapped).toEqual([]);
    });
  });

  describe('getAllMappings', () => {
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

    it('should return all mappings', () => {
      const mappings = mapper.getAllMappings();
      expect(mappings.size).toBe(2);
      expect(mappings.has('Johnson2007')).toBe(true);
      expect(mappings.has('Zhang2020')).toBe(true);
    });

    it('should return a copy of mappings', () => {
      const mappings1 = mapper.getAllMappings();
      const mappings2 = mapper.getAllMappings();

      expect(mappings1).not.toBe(mappings2);
      expect(mappings1.size).toBe(mappings2.size);
    });
  });

  describe('clearCache', () => {
    beforeEach(async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);
      await mapper.loadSourceMappings();
    });

    it('should clear all mappings', () => {
      expect(mapper.getAllMappings().size).toBe(1);

      mapper.clearCache();

      expect(mapper.getAllMappings().size).toBe(0);
      expect(mapper.isMapped('Johnson2007')).toBe(false);
    });

    it('should force reload on next loadSourceMappings', async () => {
      mapper.clearCache();

      // Modify file
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.getAllMappings().size).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle author-years with special characters', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | O'Brien2007 | LM86I2Q4 | O'Brien, W. Evan | 2007 | Test Paper | Test |
| 2 | van-der-Waals2020 | SY5YRHHX | van der Waals, Y. | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.isMapped("O'Brien2007")).toBe(true);
      expect(mapper.isMapped('van-der-Waals2020')).toBe(true);
    });

    it('should handle very large source IDs', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 999999 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      const mapping = mapper.getSourceMapping('Johnson2007');
      expect(mapping?.sourceId).toBe(999999);
    });

    it('should handle empty zotero keys gracefully', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 |  | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      // Empty zotero key should not be mapped (validation requirement)
      expect(mapper.isMapped('Johnson2007')).toBe(false);
    });

    it('should handle rows with extra pipes', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test | Extra |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.isMapped('Johnson2007')).toBe(true);
    });

    it('should handle whitespace in cells', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
|   1   |   Johnson2007   |   LM86I2Q4   | Johnson, W. Evan | 2007 | Test Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      const mapping = mapper.getSourceMapping('Johnson2007');
      expect(mapping).not.toBeNull();
      expect(mapping?.sourceId).toBe(1);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle the actual sources.md format from the project', async () => {
      const sourcesContent = `# Source Registry

This document contains bibliographic information for all sources referenced in claims_and_evidence.md.

## Format

Each source has:
- **Source ID**: Numeric identifier used in claims
- **Author-Year ID**: Human-readable identifier (e.g., Johnson2007)
- **Zotero Key**: Unique key in Zotero library
- **Full Citation**: Authors, year, title
- **Notes**: Additional context (DOI, dataset info, etc.)

---

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan; Li, Cheng; Rabinovic, Ariel | 2007 | Adjusting batch effects in microarray expression data using empirical Bayes methods | Original ComBat paper |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing; Parmigiani, Giovanni; Johnson, W Evan | 2020 | ComBat-seq: batch effect adjustment for RNA-seq count data | ComBat-Seq paper |
| 3 | Soneson2014 | 4CFFLXQX | Soneson, Charlotte; Gerster, Sarah; Delorenzi, Mauro | 2014 | Batch Effect Confounding Leads to Strong Bias in Performance Estimates Obtained by Cross-Validation | Batch effect confounding paper |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      expect(mapper.getAllMappings().size).toBe(3);
      expect(mapper.isMapped('Johnson2007')).toBe(true);
      expect(mapper.isMapped('Zhang2020')).toBe(true);
      expect(mapper.isMapped('Soneson2014')).toBe(true);

      const mapping = mapper.getSourceMapping('Johnson2007');
      expect(mapping?.zoteroKey).toBe('LM86I2Q4');
      expect(mapping?.sourceId).toBe(1);
    });

    it('should handle multiple queries for unmapped sources', async () => {
      const sourcesContent = `# Source Registry

| Source ID | Author-Year | Zotero Key | Author(s) | Year | Title | Notes |
|-----------|-------------|------------|-----------|------|-------|-------|
| 1 | Johnson2007 | LM86I2Q4 | Johnson, W. Evan | 2007 | Test Paper | Test |
| 2 | Zhang2020 | SY5YRHHX | Zhang, Yuqing | 2020 | Another Paper | Test |
`;
      fs.writeFileSync(sourcesPath, sourcesContent);

      await mapper.loadSourceMappings();

      const citations = ['Johnson2007', 'Unknown2025', 'Zhang2020', 'Smith2015', 'Brown2010'];
      const unmapped = mapper.getUnmappedAuthorYears(citations);

      expect(unmapped.length).toBe(3);
      expect(unmapped).toContain('Unknown2025');
      expect(unmapped).toContain('Smith2015');
      expect(unmapped).toContain('Brown2010');
    });
  });
});
