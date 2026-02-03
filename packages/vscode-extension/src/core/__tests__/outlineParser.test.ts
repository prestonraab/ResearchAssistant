import { jest } from '@jest/globals';
import { setupFsMock } from '../helpers';
import { OutlineParser } from '../outlineParserWrapper';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('OutlineParser', () => {
  let parser: OutlineParser;
  const testFilePath = '/test/outline.md';

  beforeEach(() => {
    setupFsMock();
    parser = new OutlineParser(testFilePath);
    jest.clearAllMocks();
  });

  describe('parse', () => {
    test('should parse empty file', async () => {
      mockFs.readFile.mockResolvedValue('');
      
      const sections = await parser.parse();
      
      expect(sections).toEqual([]);
    });

    test('should parse single section', async () => {
      const content = '## Introduction\n\nSome content here.';
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Introduction');
      expect(sections[0].level).toBe(2);
      expect(sections[0].content).toContain('Some content here.');
    });

    test('should parse nested sections', async () => {
      const content = `## Section 1
### Subsection 1.1
#### Subsubsection 1.1.1
## Section 2`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(4);
      expect(sections[0].level).toBe(2);
      expect(sections[1].level).toBe(3);
      expect(sections[2].level).toBe(4);
      expect(sections[3].level).toBe(2);
    });

    test('should handle malformed headers gracefully', async () => {
      const content = `## Valid Header
# Invalid (only one hash)
### Another Valid
Not a header at all`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Valid Header');
      expect(sections[1].title).toBe('Another Valid');
    });

    test('should track line numbers correctly', async () => {
      const content = `## Section 1
Content line 1
Content line 2
## Section 2
Content line 3`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections[0].lineStart).toBe(1);
      expect(sections[0].lineEnd).toBe(3);
      expect(sections[1].lineStart).toBe(4);
      expect(sections[1].lineEnd).toBe(5);
    });
  });

  describe('getSectionById', () => {
    test('should return section by id', async () => {
      const content = '## Test Section';
      mockFs.readFile.mockResolvedValue(content);
      
      await parser.parse();
      const sections = parser.getSections();
      const section = parser.getSectionById(sections[0].id);
      
      expect(section).not.toBeNull();
      expect(section?.title).toBe('Test Section');
    });

    test('should return null for non-existent id', async () => {
      mockFs.readFile.mockResolvedValue('');
      await parser.parse();
      
      const section = parser.getSectionById('non-existent-id');
      
      expect(section).toBeNull();
    });
  });

  describe('getHierarchy', () => {
    test('should return only root sections', async () => {
      const content = `## Root 1
### Child 1.1
## Root 2`;
      mockFs.readFile.mockResolvedValue(content);
      
      await parser.parse();
      const hierarchy = parser.getHierarchy();
      
      expect(hierarchy).toHaveLength(2);
      expect(hierarchy[0].title).toBe('Root 1');
      expect(hierarchy[1].title).toBe('Root 2');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty file', async () => {
      mockFs.readFile.mockResolvedValue('');
      
      const sections = await parser.parse();
      
      expect(sections).toEqual([]);
      expect(parser.getSections()).toEqual([]);
      expect(parser.getHierarchy()).toEqual([]);
    });

    test('should handle file with only whitespace', async () => {
      mockFs.readFile.mockResolvedValue('   \n\n  \t\n   ');
      
      const sections = await parser.parse();
      
      expect(sections).toEqual([]);
    });

    test('should handle file with no headers', async () => {
      const content = `This is just text
No headers here
Just plain content`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toEqual([]);
    });

    test('should handle malformed headers with extra spaces', async () => {
      const content = `##    Title With Extra Spaces   
###   Another   Title  `;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Title With Extra Spaces');
      expect(sections[1].title).toBe('Another   Title');
    });

    test('should handle headers with special characters', async () => {
      const content = `## Section 1: Introduction & Overview
### Sub-section (Part A)
#### Item #1 - Details`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(3);
      expect(sections[0].title).toBe('Section 1: Introduction & Overview');
      expect(sections[1].title).toBe('Sub-section (Part A)');
      expect(sections[2].title).toBe('Item #1 - Details');
    });

    test('should handle deeply nested structures', async () => {
      const content = `## Level 2
### Level 3
#### Level 4
### Another Level 3
#### Another Level 4
## Another Level 2`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(6);
      
      // Verify hierarchy
      const level2_1 = sections[0];
      const level3_1 = sections[1];
      const level4_1 = sections[2];
      const level3_2 = sections[3];
      const level4_2 = sections[4];
      const level2_2 = sections[5];
      
      // Verify hierarchy by checking levels
      expect(level3_1.level).toBe(3);
      expect(level4_1.level).toBe(4);
      expect(level3_2.level).toBe(3);
      expect(level4_2.level).toBe(4);
      expect(level2_2.level).toBe(2);
    });

    test('should handle missing content between headers', async () => {
      const content = `## Section 1
## Section 2
## Section 3`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(3);
      expect(sections[0].content).toEqual([]);
      expect(sections[1].content).toEqual([]);
      expect(sections[2].content).toEqual([]);
    });

    test('should handle multiple content items under section', async () => {
      const content = `## Research Questions
- What is the impact of X?
- How does Y affect Z?
- Question 1: Details here
- Question 2: More details

Some additional notes
Another line of content`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(1);
      expect(sections[0].content).toHaveLength(6);
      expect(sections[0].content[0]).toBe('- What is the impact of X?');
      expect(sections[0].content[5]).toBe('Another line of content');
    });

    test('should handle empty lines between content', async () => {
      const content = `## Section
Content line 1

Content line 2

Content line 3`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(1);
      // Empty lines should not be included in content
      expect(sections[0].content).toHaveLength(3);
      expect(sections[0].content).toEqual([
        'Content line 1',
        'Content line 2',
        'Content line 3'
      ]);
    });

    test('should handle level jumps (skip from ## to ####)', async () => {
      const content = `## Section 1
#### Subsection (skipped level 3)
## Section 2`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(3);
      // Verify levels are parsed correctly
      expect(sections[0].level).toBe(2);
      expect(sections[1].level).toBe(4);
      expect(sections[2].level).toBe(2);
    });

    test('should handle headers at end of file', async () => {
      const content = `## Section 1
Content here
## Section 2`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(2);
      expect(sections[1].lineEnd).toBe(3);
    });

    test('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      const sections = await parser.parse();
      
      expect(sections).toEqual([]);
      expect(parser.getSections()).toEqual([]);
    });

    test('should ignore single # headers (H1)', async () => {
      const content = `# Title (H1 - should be ignored)
## Section 1 (H2 - should be parsed)
### Subsection (H3 - should be parsed)`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Section 1 (H2 - should be parsed)');
      expect(sections[1].title).toBe('Subsection (H3 - should be parsed)');
    });

    test('should ignore headers with more than 4 hashes', async () => {
      const content = `## Valid H2
##### Invalid H5
###### Invalid H6
### Valid H3`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Valid H2');
      expect(sections[1].title).toBe('Valid H3');
    });

    test('should handle headers without space after hashes', async () => {
      const content = `##No Space Header
## Proper Header`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      // The regex requires a space, so the first one should not match
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Proper Header');
    });

    test('should generate unique IDs for sections with same title', async () => {
      const content = `## Introduction
### Details
## Introduction
### Details`;
      mockFs.readFile.mockResolvedValue(content);
      
      const sections = await parser.parse();
      
      expect(sections).toHaveLength(4);
      // IDs should be unique due to line number in ID generation
      const ids = sections.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);
    });
  });

  describe('getSectionAtPosition', () => {
    test('should return section at given position', async () => {
      const content = `## Section 1
Content line 1
Content line 2
## Section 2
Content line 3`;
      mockFs.readFile.mockResolvedValue(content);
      
      await parser.parse();
      
      // Position is 0-based, line 1 (0-indexed) is "Content line 1"
      const section = parser.getSectionAtPosition({ line: 1, character: 0 } as any);
      
      expect(section).not.toBeNull();
      expect(section?.title).toBe('Section 1');
    });

    test('should return null for position outside any section', async () => {
      const content = `Some text before headers
## Section 1`;
      mockFs.readFile.mockResolvedValue(content);
      
      await parser.parse();
      
      // Line 0 is before any section
      const section = parser.getSectionAtPosition({ line: 0, character: 0 } as any);
      
      expect(section).toBeNull();
    });
  });
});
