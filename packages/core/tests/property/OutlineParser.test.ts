import { OutlineParser } from '../../src/parsers/OutlineParser.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import fc from 'fast-check';

/**
 * Property-based tests for OutlineParser
 * 
 * **Validates: Requirements 1.2, 5.1, 5.2**
 * 
 * These tests verify that the OutlineParser maintains important invariants
 * across a wide range of inputs, ensuring deterministic and correct behavior.
 */
describe('OutlineParser Property-Based Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outline-parser-pbt-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /**
   * Property 1: Parsing is deterministic
   * 
   * If we parse the same file twice, we should get identical results.
   * This ensures that the parser doesn't have any non-deterministic behavior.
   */
  it('should parse the same file identically on multiple runs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 10 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file with the generated sections
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          // Parse twice
          const parser1 = new OutlineParser();
          const result1 = await parser1.parse(testFilePath);

          const parser2 = new OutlineParser();
          const result2 = await parser2.parse(testFilePath);

          // Results should be identical
          expect(result1).toEqual(result2);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2: All sections are findable by ID
   * 
   * After parsing, every section should be retrievable by its ID.
   * This ensures that the ID generation and lookup mechanisms work correctly.
   */
  it('should make all parsed sections findable by ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // Every parsed section should be findable by its ID
          for (const section of parsed) {
            const found = parser.getSectionById(section.id);
            expect(found).not.toBeNull();
            expect(found).toEqual(section);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 3: All sections are findable by position
   * 
   * For any line within a section's range, getSectionAtPosition should return that section.
   * This ensures position-based lookups work correctly.
   */
  it('should make all sections findable by position within their range', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { minLength: 1, maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // For each section, every line in its range should return that section
          for (const section of parsed) {
            for (let line = section.lineStart; line <= section.lineEnd; line++) {
              const found = parser.getSectionAtPosition(line);
              expect(found).not.toBeNull();
              expect(found!.id).toBe(section.id);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4: Section boundaries don't overlap
   * 
   * No two sections should have overlapping line ranges.
   * This ensures the parser correctly partitions the file.
   */
  it('should not create overlapping section boundaries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // Check that sections are in order and don't overlap
          for (let i = 0; i < parsed.length - 1; i++) {
            const current = parsed[i];
            const next = parsed[i + 1];

            // Current section should end before next section starts
            expect(current.lineEnd).toBeLessThan(next.lineStart);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5: Section content doesn't include headers
   * 
   * The content array of a section should not include the header line itself.
   * This ensures proper separation of headers and content.
   */
  it('should not include header lines in section content', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // Check that no content line starts with ##
          for (const section of parsed) {
            for (const line of section.content) {
              expect(line.startsWith('##')).toBe(false);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6: Section IDs are unique
   * 
   * No two sections should have the same ID.
   * This ensures IDs can be used as unique identifiers.
   */
  it('should generate unique section IDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // Check that all IDs are unique
          const ids = parsed.map(s => s.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7: Line ranges are valid
   * 
   * For each section, lineStart should be <= lineEnd, and both should be non-negative.
   * This ensures line ranges are always valid.
   */
  it('should maintain valid line ranges for all sections', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // Check that all line ranges are valid
          for (const section of parsed) {
            expect(section.lineStart).toBeGreaterThanOrEqual(0);
            expect(section.lineEnd).toBeGreaterThanOrEqual(section.lineStart);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 8: Header levels are valid
   * 
   * All sections should have header levels between 2 and 6 (## to ######).
   * This ensures only valid markdown headers are parsed.
   */
  it('should only parse valid header levels (2-6)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.array(fc.string({ maxLength: 200 }), { maxLength: 5 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (sections) => {
          // Create a markdown file
          const lines: string[] = [];
          sections.forEach((section, index) => {
            lines.push(`## ${section.title}`);
            lines.push(...section.content);
            if (index < sections.length - 1) {
              lines.push('');
            }
          });
          const content = lines.join('\n');

          const testFilePath = path.join(tempDir, `test-${Date.now()}-${Math.random()}.md`);
          await fs.writeFile(testFilePath, content);

          const parser = new OutlineParser();
          const parsed = await parser.parse(testFilePath);

          // Check that all levels are valid
          for (const section of parsed) {
            expect(section.level).toBeGreaterThanOrEqual(2);
            expect(section.level).toBeLessThanOrEqual(6);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
