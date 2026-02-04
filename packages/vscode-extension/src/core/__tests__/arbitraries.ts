/**
 * Fast-check arbitraries (generators) for property-based testing
 * These generate random domain objects for testing correctness properties
 */

import * as fc from 'fast-check';
import type { OutlineSection, Claim } from '@research-assistant/core';

/**
 * Generate random markdown header levels (2, 3, or 4)
 */
export const headerLevelArbitrary = () => fc.integer({ min: 2, max: 4 });

/**
 * Generate random section titles
 */
export const sectionTitleArbitrary = () => 
  fc.oneof(
    fc.constant('Introduction'),
    fc.constant('Methods'),
    fc.constant('Results'),
    fc.constant('Discussion'),
    fc.constant('Background'),
    fc.constant('Data Sources'),
    fc.constant('Statistical Analysis'),
    fc.constant('Limitations'),
    fc.string({ minLength: 5, maxLength: 50 })
  );

/**
 * Generate random section content (questions/bullets)
 */
export const sectionContentArbitrary = () =>
  fc.array(
    fc.oneof(
      fc.string({ minLength: 10, maxLength: 100 }),
      fc.constant('What are the key findings?'),
      fc.constant('How does this relate to previous work?'),
      fc.constant('What are the limitations?')
    ),
    { minLength: 0, maxLength: 5 }
  );

/**
 * Generate a random outline section
 */
export const sectionArbitrary = (): fc.Arbitrary<OutlineSection> =>
  fc.record({
    id: fc.hexaString({ minLength: 8, maxLength: 16 }),
    level: headerLevelArbitrary(),
    title: sectionTitleArbitrary(),
    content: sectionContentArbitrary(),
    parent: fc.oneof(fc.constant(null), fc.hexaString({ minLength: 8, maxLength: 16 })),
    children: fc.array(fc.hexaString({ minLength: 8, maxLength: 16 }), { maxLength: 5 }),
    lineStart: fc.integer({ min: 0, max: 1000 }),
    lineEnd: fc.integer({ min: 0, max: 1000 })
  }).map(section => ({
    ...section,
    lineEnd: Math.max(section.lineStart, section.lineEnd) // Ensure lineEnd >= lineStart
  }));

/**
 * Generate a hierarchical outline structure
 */
export const outlineArbitrary = (): fc.Arbitrary<OutlineSection[]> =>
  fc.array(sectionArbitrary(), { minLength: 1, maxLength: 20 })
    .map(sections => {
      // Fix hierarchy: ensure parent IDs reference actual sections
      const ids = sections.map(s => s.id);
      return sections.map((section, idx) => {
        // Top-level sections have no parent
        if (section.level === 2) {
          return { ...section, parent: null, children: [] };
        }
        // Find a valid parent (previous section with lower level)
        let parentIdx = idx - 1;
        while (parentIdx >= 0 && sections[parentIdx].level >= section.level) {
          parentIdx--;
        }
        const parent = parentIdx >= 0 ? sections[parentIdx].id : null;
        return { ...section, parent, children: [] };
      });
    })
    .map(sections => {
      // Build children arrays
      const childMap = new Map<string, string[]>();
      sections.forEach(section => {
        if (section.parent) {
          if (!childMap.has(section.parent)) {
            childMap.set(section.parent, []);
          }
          childMap.get(section.parent)!.push(section.id);
        }
      });
      return sections.map(section => ({
        ...section,
        children: childMap.get(section.id) || []
      }));
    });

/**
 * Generate random claim categories
 */
export const claimCategoryArbitrary = () =>
  fc.oneof(
    fc.constant('Method'),
    fc.constant('Result'),
    fc.constant('Challenge'),
    fc.constant('Background'),
    fc.constant('Application'),
    fc.constant('Impact'),
    fc.constant('Data Source'),
    fc.constant('Phenomenon')
  );

/**
 * Generate random source citations (AuthorYear format)
 */
export const sourceArbitrary = () =>
  fc.record({
    author: fc.oneof(
      fc.constant('Johnson'),
      fc.constant('Smith'),
      fc.constant('Anderson'),
      fc.constant('Chen'),
      fc.constant('Garcia'),
      fc.string({ minLength: 3, maxLength: 15 })
    ),
    year: fc.integer({ min: 1990, max: 2025 })
  }).map(({ author, year }) => `${author}${year}`);

/**
 * Generate random claim IDs (C_XX format)
 */
export const claimIdArbitrary = () =>
  fc.integer({ min: 1, max: 999 })
    .map(n => `C_${n.toString().padStart(2, '0')}`);

/**
 * Generate random claim text
 */
export const claimTextArbitrary = () =>
  fc.oneof(
    fc.constant('Batch effects significantly impact classification accuracy'),
    fc.constant('ComBat normalization improves cross-study prediction'),
    fc.constant('Random forests outperform other classifiers on gene expression data'),
    fc.constant('Sample size affects the reliability of biomarker discovery'),
    fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length > 0)
  );

/**
 * Generate random quotes
 */
export const quoteArbitrary = () =>
  fc.record({
    text: fc.string({ minLength: 30, maxLength: 300 }),
    source: sourceArbitrary(),
    verified: fc.boolean()
  });

/**
 * Generate a random claim
 */
export const claimArbitrary = (): fc.Arbitrary<Claim> =>
  fc.record({
    id: claimIdArbitrary(),
    text: claimTextArbitrary(),
    category: claimCategoryArbitrary(),
    context: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: '' }),
    primaryQuote: quoteArbitrary(),
    supportingQuotes: fc.array(quoteArbitrary(), { maxLength: 3 }),
    sections: fc.array(fc.hexaString({ minLength: 8, maxLength: 16 }), { maxLength: 5 }),
    verified: fc.boolean(),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
    modifiedAt: fc.date({ min: new Date('2020-01-01'), max: new Date() })
  }).map(claim => ({
    ...claim,
    context: claim.context || '',
    modifiedAt: new Date(Math.max(claim.createdAt.getTime(), claim.modifiedAt.getTime()))
  }));

/**
 * Generate an array of claims
 */
export const claimsArrayArbitrary = (minLength = 0, maxLength = 50): fc.Arbitrary<Claim[]> =>
  fc.array(claimArbitrary(), { minLength, maxLength })
    .map(claims => {
      // Ensure unique IDs
      const uniqueIds = new Set<string>();
      return claims.map((claim, idx) => {
        let id = claim.id;
        while (uniqueIds.has(id)) {
          id = `C_${(idx + 1).toString().padStart(2, '0')}`;
        }
        uniqueIds.add(id);
        return { ...claim, id };
      });
    });

/**
 * Generate random paper metadata
 */
export const paperArbitrary = () =>
  fc.record({
    itemKey: fc.hexaString({ minLength: 8, maxLength: 16 }),
    title: fc.string({ minLength: 20, maxLength: 150 }),
    authors: fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
    year: fc.integer({ min: 1990, max: 2025 }),
    abstract: fc.string({ minLength: 100, maxLength: 500 }),
    doi: fc.option(fc.string({ minLength: 10, maxLength: 50 })),
    url: fc.option(fc.webUrl()),
    citationCount: fc.option(fc.integer({ min: 0, max: 1000 })),
    venue: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
    extractedTextPath: fc.option(fc.string({ minLength: 10, maxLength: 100 })),
    readingStatus: fc.oneof(
      fc.constant('to-read' as const),
      fc.constant('reading' as const),
      fc.constant('read' as const)
    ),
    readingStarted: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
    readingCompleted: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date() })),
    tags: fc.array(fc.string({ minLength: 3, maxLength: 20 }), { maxLength: 10 })
  });

/**
 * Generate random text content (for papers, paragraphs, etc.)
 */
export const textArbitrary = (minLength = 100, maxLength = 5000) =>
  fc.string({ minLength, maxLength });

/**
 * Generate markdown content with headers
 */
export const markdownArbitrary = () =>
  fc.array(
    fc.record({
      level: headerLevelArbitrary(),
      title: sectionTitleArbitrary(),
      content: fc.array(fc.string({ minLength: 10, maxLength: 100 }), { maxLength: 3 })
    }),
    { minLength: 1, maxLength: 10 }
  ).map(sections =>
    sections.map(s => {
      const header = '#'.repeat(s.level) + ' ' + s.title;
      const content = s.content.map(c => '- ' + c).join('\n');
      return header + '\n\n' + content;
    }).join('\n\n')
  );
