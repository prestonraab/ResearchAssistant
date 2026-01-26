import { OutlineParser } from '../../src/core/OutlineParser';
import * as path from 'path';

describe('OutlineParser Integration Tests', () => {
  let parser: OutlineParser;

  beforeEach(() => {
    parser = new OutlineParser();
  });

  it('should parse the actual outline.md file from the workspace', async () => {
    // This test uses the actual outline.md file from the workspace
    const outlinePath = path.join(process.cwd(), '..', '03_Drafting', 'outline.md');
    
    const sections = await parser.parse(outlinePath);

    // Verify we got sections
    expect(sections.length).toBeGreaterThan(0);

    // Verify some expected sections exist
    const abstractSection = parser.getSectionById('abstract');
    expect(abstractSection).not.toBeNull();
    expect(abstractSection!.title).toBe('Abstract');

    const backgroundSection = sections.find(s => s.title === 'Background and Significance');
    expect(backgroundSection).not.toBeNull();
    expect(backgroundSection!.level).toBe(2);

    // Verify position lookup works
    const sectionAtStart = parser.getSectionAtPosition(0);
    expect(sectionAtStart).not.toBeNull();

    // Verify all sections have required fields
    sections.forEach(section => {
      expect(section.id).toBeDefined();
      expect(section.title).toBeDefined();
      expect(section.level).toBeGreaterThanOrEqual(2);
      expect(section.level).toBeLessThanOrEqual(6);
      expect(section.lineStart).toBeGreaterThanOrEqual(0);
      expect(section.lineEnd).toBeGreaterThanOrEqual(section.lineStart);
      expect(Array.isArray(section.content)).toBe(true);
    });

    // Log some info for debugging
    console.log(`Parsed ${sections.length} sections from outline.md`);
    console.log('First 5 sections:');
    sections.slice(0, 5).forEach(s => {
      console.log(`  - ${s.id}: ${s.title} (level ${s.level}, lines ${s.lineStart}-${s.lineEnd})`);
    });
  });

  it('should handle position-based lookups correctly', async () => {
    const outlinePath = path.join(process.cwd(), '..', '03_Drafting', 'outline.md');
    await parser.parse(outlinePath);

    // Test that we can find sections at various positions
    const sections = parser.getSections();
    
    for (const section of sections) {
      // Test the start line
      const foundAtStart = parser.getSectionAtPosition(section.lineStart);
      expect(foundAtStart).not.toBeNull();
      expect(foundAtStart!.id).toBe(section.id);

      // Test the end line
      const foundAtEnd = parser.getSectionAtPosition(section.lineEnd);
      expect(foundAtEnd).not.toBeNull();
      expect(foundAtEnd!.id).toBe(section.id);

      // Test a middle line (if section has more than 2 lines)
      if (section.lineEnd - section.lineStart > 1) {
        const middleLine = Math.floor((section.lineStart + section.lineEnd) / 2);
        const foundAtMiddle = parser.getSectionAtPosition(middleLine);
        expect(foundAtMiddle).not.toBeNull();
        expect(foundAtMiddle!.id).toBe(section.id);
      }
    }
  });

  it('should extract content correctly from real sections', async () => {
    const outlinePath = path.join(process.cwd(), '..', '03_Drafting', 'outline.md');
    await parser.parse(outlinePath);

    const sections = parser.getSections();
    
    // Verify that sections with content have non-empty content arrays
    const sectionsWithContent = sections.filter(s => s.content.length > 0);
    expect(sectionsWithContent.length).toBeGreaterThan(0);

    // Verify that content doesn't include the header line itself
    sections.forEach(section => {
      section.content.forEach(line => {
        // Content lines should not start with ## (the header marker)
        expect(line.startsWith('##')).toBe(false);
      });
    });
  });
});
