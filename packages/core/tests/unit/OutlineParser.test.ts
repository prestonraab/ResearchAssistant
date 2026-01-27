import { OutlineParser } from '../../src/parsers/OutlineParser.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('OutlineParser', () => {
  let parser: OutlineParser;
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    parser = new OutlineParser();
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outline-parser-test-'));
    testFilePath = path.join(tempDir, 'test-outline.md');
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('parse()', () => {
    it('should parse a simple outline with multiple sections', async () => {
      const content = `## Introduction
This is the introduction.

## Background
This is the background.

### Subsection
This is a subsection.

## Conclusion
This is the conclusion.`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(4);
      expect(sections[0].title).toBe('Introduction');
      expect(sections[0].level).toBe(2);
      expect(sections[1].title).toBe('Background');
      expect(sections[2].title).toBe('Subsection');
      expect(sections[2].level).toBe(3);
      expect(sections[3].title).toBe('Conclusion');
    });

    it('should extract section content correctly', async () => {
      const content = `## Section 1
Line 1
Line 2

## Section 2
Line 3`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections[0].content).toEqual(['Line 1', 'Line 2', '']);
      expect(sections[1].content).toEqual(['Line 3']);
    });

    it('should handle numbered section IDs', async () => {
      const content = `## 1. Introduction
Content

## 2.1 Background
Content

## 2.2 Methods
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections[0].id).toBe('1');
      expect(sections[1].id).toBe('2.1');
      expect(sections[2].id).toBe('2.2');
    });

    it('should generate slugified IDs for non-numbered sections', async () => {
      const content = `## Introduction and Background
Content

## Methods & Results
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections[0].id).toBe('introduction-and-background');
      expect(sections[1].id).toBe('methods-results');
    });

    it('should track line numbers correctly', async () => {
      const content = `## Section 1
Line 1
Line 2

## Section 2
Line 3
Line 4`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections[0].lineStart).toBe(0);
      expect(sections[0].lineEnd).toBe(3);
      expect(sections[1].lineStart).toBe(4);
      expect(sections[1].lineEnd).toBe(6);
    });

    it('should handle empty sections', async () => {
      const content = `## Section 1

## Section 2
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections[0].content).toEqual(['']);
      expect(sections[1].content).toEqual(['Content']);
    });

    it('should handle files with no sections', async () => {
      const content = `Just some text
No headers here`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(0);
    });

    it('should handle different header levels', async () => {
      const content = `## Level 2
Content

### Level 3
Content

#### Level 4
Content

##### Level 5
Content

###### Level 6
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(5);
      expect(sections[0].level).toBe(2);
      expect(sections[1].level).toBe(3);
      expect(sections[2].level).toBe(4);
      expect(sections[3].level).toBe(5);
      expect(sections[4].level).toBe(6);
    });

    it('should ignore single # headers (level 1)', async () => {
      const content = `# Title
Should be ignored

## Section 1
Should be included`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Section 1');
    });

    it('should handle duplicate section titles', async () => {
      const content = `## Background
First background

## Background
Second background`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(2);
      expect(sections[0].id).toBe('background');
      expect(sections[1].id).toBe('background-3'); // Line 3 is where second Background starts
    });
  });

  describe('getSectionAtPosition()', () => {
    beforeEach(async () => {
      const content = `## Section 1
Line 1
Line 2

## Section 2
Line 3
Line 4`;

      await fs.writeFile(testFilePath, content);
      await parser.parse(testFilePath);
    });

    it('should return the correct section for a position within it', () => {
      const section = parser.getSectionAtPosition(1);
      expect(section).not.toBeNull();
      expect(section!.title).toBe('Section 1');
    });

    it('should return the correct section for the header line', () => {
      const section = parser.getSectionAtPosition(0);
      expect(section).not.toBeNull();
      expect(section!.title).toBe('Section 1');
    });

    it('should return the correct section for the last line', () => {
      const section = parser.getSectionAtPosition(6);
      expect(section).not.toBeNull();
      expect(section!.title).toBe('Section 2');
    });

    it('should return null for positions outside any section', () => {
      const section = parser.getSectionAtPosition(100);
      expect(section).toBeNull();
    });

    it('should return null for negative positions', () => {
      const section = parser.getSectionAtPosition(-1);
      expect(section).toBeNull();
    });
  });

  describe('getSectionById()', () => {
    beforeEach(async () => {
      const content = `## 1. Introduction
Content

## 2.1 Background
Content

## Methods and Results
Content`;

      await fs.writeFile(testFilePath, content);
      await parser.parse(testFilePath);
    });

    it('should return the correct section for a numbered ID', () => {
      const section = parser.getSectionById('1');
      expect(section).not.toBeNull();
      expect(section!.title).toBe('1. Introduction');
    });

    it('should return the correct section for a decimal numbered ID', () => {
      const section = parser.getSectionById('2.1');
      expect(section).not.toBeNull();
      expect(section!.title).toBe('2.1 Background');
    });

    it('should return the correct section for a slugified ID', () => {
      const section = parser.getSectionById('methods-and-results');
      expect(section).not.toBeNull();
      expect(section!.title).toBe('Methods and Results');
    });

    it('should return null for non-existent IDs', () => {
      const section = parser.getSectionById('non-existent');
      expect(section).toBeNull();
    });
  });

  describe('getSections()', () => {
    it('should return all parsed sections', async () => {
      const content = `## Section 1
Content

## Section 2
Content`;

      await fs.writeFile(testFilePath, content);
      await parser.parse(testFilePath);

      const sections = parser.getSections();
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Section 1');
      expect(sections[1].title).toBe('Section 2');
    });

    it('should return empty array before parsing', () => {
      const sections = parser.getSections();
      expect(sections).toHaveLength(0);
    });
  });

  describe('getFilePath()', () => {
    it('should return null before parsing', () => {
      expect(parser.getFilePath()).toBeNull();
    });

    it('should return the file path after parsing', async () => {
      const content = `## Section 1
Content`;

      await fs.writeFile(testFilePath, content);
      await parser.parse(testFilePath);

      expect(parser.getFilePath()).toBe(testFilePath);
    });
  });

  describe('edge cases', () => {
    it('should handle empty files', async () => {
      await fs.writeFile(testFilePath, '');
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(0);
    });

    it('should handle files with only whitespace', async () => {
      await fs.writeFile(testFilePath, '   \n\n   \n');
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(0);
    });

    it('should handle headers with extra whitespace', async () => {
      const content = `##    Section with spaces   
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Section with spaces');
    });

    it('should handle sections with special characters in titles', async () => {
      const content = `## Section: With (Special) Characters!
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Section: With (Special) Characters!');
      expect(sections[0].id).toBe('section-with-special-characters');
    });

    it('should handle very long section titles', async () => {
      const longTitle = 'A'.repeat(200);
      const content = `## ${longTitle}
Content`;

      await fs.writeFile(testFilePath, content);
      const sections = await parser.parse(testFilePath);

      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe(longTitle);
    });
  });
});
