import {
  shouldTriggerCompletion,
  sortClaimsBySection,
  generateCompletionData,
  formatCompletionDetail,
  formatCompletionPreview,
  findSectionAtLine,
  extractHeaderFromLine,
  findSectionByTitle,
} from '../claimCompletionLogic';
import { aClaim, anOutlineSection } from '../../__tests__/helpers';
import type { OutlineSection } from '@research-assistant/core';

describe('claimCompletionLogic', () => {
  describe('shouldTriggerCompletion', () => {
    test('should trigger when line ends with C_', () => {
      expect(shouldTriggerCompletion('This is C_')).toBe(true);
    });

    test('should trigger when only C_ is present', () => {
      expect(shouldTriggerCompletion('C_')).toBe(true);
    });

    test('should not trigger when C_ is in middle', () => {
      expect(shouldTriggerCompletion('C_ is here')).toBe(false);
    });

    test('should not trigger when no C_ present', () => {
      expect(shouldTriggerCompletion('Some text')).toBe(false);
    });

    test('should not trigger for empty string', () => {
      expect(shouldTriggerCompletion('')).toBe(false);
    });
  });

  describe('sortClaimsBySection', () => {
    test('should sort by ID when no current section', () => {
      const claims = [
        aClaim().withId('C_03').build(),
        aClaim().withId('C_01').build(),
        aClaim().withId('C_02').build(),
      ];

      const sorted = sortClaimsBySection(claims, null);

      expect(sorted.map(c => c.id)).toEqual(['C_01', 'C_02', 'C_03']);
    });

    test('should prioritize claims in current section', () => {
      const claims = [
        aClaim().withId('C_03').withSections(['section-2']).build(),
        aClaim().withId('C_01').withSections(['section-1']).build(),
        aClaim().withId('C_02').withSections(['section-1']).build(),
      ];

      const sorted = sortClaimsBySection(claims, 'section-1');

      expect(sorted.map(c => c.id)).toEqual(['C_01', 'C_02', 'C_03']);
    });

    test('should sort each group by ID', () => {
      const claims = [
        aClaim().withId('C_05').withSections(['section-2']).build(),
        aClaim().withId('C_02').withSections(['section-1']).build(),
        aClaim().withId('C_04').withSections(['section-2']).build(),
        aClaim().withId('C_01').withSections(['section-1']).build(),
        aClaim().withId('C_03').withSections(['section-1']).build(),
      ];

      const sorted = sortClaimsBySection(claims, 'section-1');

      // Section-1 claims first (sorted), then section-2 claims (sorted)
      expect(sorted.map(c => c.id)).toEqual(['C_01', 'C_02', 'C_03', 'C_04', 'C_05']);
    });

    test('should handle claims with multiple sections', () => {
      const claims = [
        aClaim().withId('C_02').withSections(['section-1', 'section-2']).build(),
        aClaim().withId('C_01').withSections(['section-3']).build(),
      ];

      const sorted = sortClaimsBySection(claims, 'section-1');

      expect(sorted.map(c => c.id)).toEqual(['C_02', 'C_01']);
    });

    test('should handle empty claims array', () => {
      const sorted = sortClaimsBySection([], 'section-1');
      expect(sorted).toEqual([]);
    });

    test('should not mutate original array', () => {
      const claims = [
        aClaim().withId('C_02').build(),
        aClaim().withId('C_01').build(),
      ];
      const original = [...claims];

      sortClaimsBySection(claims, null);

      expect(claims).toEqual(original);
    });
  });

  describe('formatCompletionDetail', () => {
    test('should format with category and source', () => {
      const claim = aClaim()
        .withCategory('Method')
        .withPrimaryQuote('Quote text', 'Smith2023')
        .build();

      const detail = formatCompletionDetail(claim);

      expect(detail).toBe('Method - Smith2023');
    });

    test('should use Uncategorized when no category', () => {
      const claim = aClaim()
        .withCategory('')
        .withPrimaryQuote('Quote text', 'Smith2023')
        .build();

      const detail = formatCompletionDetail(claim);

      expect(detail).toBe('Uncategorized - Smith2023');
    });

    test('should use Unknown when no source', () => {
      const claim = aClaim()
        .withCategory('Result')
        .build();
      claim.primaryQuote = { text: '', source: '', verified: false };

      const detail = formatCompletionDetail(claim);

      expect(detail).toBe('Result - Unknown');
    });

    test('should handle both missing category and source', () => {
      const claim = aClaim().build();
      claim.category = '';
      claim.primaryQuote = { text: '', source: '', verified: false };

      const detail = formatCompletionDetail(claim);

      expect(detail).toBe('Uncategorized - Unknown');
    });
  });

  describe('formatCompletionPreview', () => {
    test('should format complete claim preview', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim text')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Smith2023')
        .withSections(['section-1', 'section-2'])
        .build();

      const preview = formatCompletionPreview(claim);

      expect(preview).toContain('**C_01**: Test claim text');
      expect(preview).toContain('**Category**: Method');
      expect(preview).toContain('**Source**: Smith2023');
      expect(preview).toContain('**Quote**: "This is a test quote"');
      expect(preview).toContain('**Used in**: 2 sections');
    });

    test('should use Uncategorized when no category', () => {
      const claim = aClaim()
        .withId('C_02')
        .withText('Test')
        .build();
      claim.category = '';

      const preview = formatCompletionPreview(claim);

      expect(preview).toContain('**Category**: Uncategorized');
    });

    test('should omit source when not present', () => {
      const claim = aClaim()
        .withId('C_03')
        .withText('Test')
        .build();
      claim.primaryQuote = { text: '', source: '', verified: false };

      const preview = formatCompletionPreview(claim);

      expect(preview).not.toContain('**Source**:');
    });

    test('should omit quote when not present', () => {
      const claim = aClaim()
        .withId('C_04')
        .withText('Test')
        .withPrimaryQuote('', 'Smith2023')
        .build();

      const preview = formatCompletionPreview(claim);

      expect(preview).not.toContain('**Quote**:');
    });

    test('should truncate long quotes', () => {
      const longQuote = 'a'.repeat(200);
      const claim = aClaim()
        .withId('C_05')
        .withText('Test')
        .withPrimaryQuote(longQuote, 'Smith2023')
        .build();

      const preview = formatCompletionPreview(claim);

      expect(preview).toContain('**Quote**: "' + 'a'.repeat(150) + '..."');
      expect(preview).not.toContain('a'.repeat(151));
    });

    test('should not truncate quotes under 150 chars', () => {
      const shortQuote = 'a'.repeat(100);
      const claim = aClaim()
        .withId('C_06')
        .withText('Test')
        .withPrimaryQuote(shortQuote, 'Smith2023')
        .build();

      const preview = formatCompletionPreview(claim);

      expect(preview).toContain('**Quote**: "' + shortQuote + '"');
      expect(preview).not.toContain('...');
    });

    test('should show singular section when only one', () => {
      const claim = aClaim()
        .withId('C_07')
        .withText('Test')
        .withSections(['section-1'])
        .build();

      const preview = formatCompletionPreview(claim);

      expect(preview).toContain('**Used in**: 1 section');
      expect(preview).not.toContain('sections');
    });

    test('should omit sections when none present', () => {
      const claim = aClaim()
        .withId('C_08')
        .withText('Test')
        .withSections([])
        .build();

      const preview = formatCompletionPreview(claim);

      expect(preview).not.toContain('**Used in**:');
    });
  });

  describe('generateCompletionData', () => {
    test('should generate completion data for claim in current section', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Quote', 'Smith2023')
        .withSections(['section-1'])
        .build();

      const data = generateCompletionData(claim, 'section-1');

      expect(data.claimId).toBe('C_01');
      expect(data.label).toBe('C_01');
      expect(data.detail).toBe('Method - Smith2023');
      expect(data.sortText).toBe('0_C_01'); // Prioritized
      expect(data.insertText).toBe('C_01');
      expect(data.documentation).toContain('**C_01**: Test claim');
    });

    test('should generate completion data for claim not in current section', () => {
      const claim = aClaim()
        .withId('C_02')
        .withText('Test claim')
        .withCategory('Result')
        .withSections(['section-2'])
        .build();

      const data = generateCompletionData(claim, 'section-1');

      expect(data.sortText).toBe('1_C_02'); // Not prioritized
    });

    test('should handle no current section', () => {
      const claim = aClaim()
        .withId('C_03')
        .withText('Test claim')
        .withSections(['section-1'])
        .build();

      const data = generateCompletionData(claim, null);

      expect(data.sortText).toBe('1_C_03'); // Not prioritized
    });

    test('should generate data for claim with multiple sections', () => {
      const claim = aClaim()
        .withId('C_04')
        .withText('Test claim')
        .withSections(['section-1', 'section-2', 'section-3'])
        .build();

      const data = generateCompletionData(claim, 'section-2');

      expect(data.sortText).toBe('0_C_04'); // Prioritized (in section-2)
    });
  });

  describe('findSectionAtLine', () => {
    test('should find section at line within range', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withTitle('Introduction')
          .withLineRange(1, 10)
          .build(),
        anOutlineSection()
          .withId('section-2')
          .withTitle('Methods')
          .withLineRange(11, 20)
          .build(),
      ];

      const section = findSectionAtLine(sections, 5);

      expect(section?.id).toBe('section-1');
    });

    test('should find section at start line', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withLineRange(1, 10)
          .build(),
      ];

      const section = findSectionAtLine(sections, 0); // Line 1 in 0-indexed

      expect(section?.id).toBe('section-1');
    });

    test('should find section at end line', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withLineRange(1, 10)
          .build(),
      ];

      const section = findSectionAtLine(sections, 9); // Line 10 in 0-indexed

      expect(section?.id).toBe('section-1');
    });

    test('should return null when line is before all sections', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withLineRange(10, 20)
          .build(),
      ];

      const section = findSectionAtLine(sections, 5);

      expect(section).toBeNull();
    });

    test('should return null when line is after all sections', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withLineRange(1, 10)
          .build(),
      ];

      const section = findSectionAtLine(sections, 15);

      expect(section).toBeNull();
    });

    test('should return null for empty sections array', () => {
      const section = findSectionAtLine([], 5);

      expect(section).toBeNull();
    });

    test('should find correct section when multiple sections exist', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withLineRange(1, 10)
          .build(),
        anOutlineSection()
          .withId('section-2')
          .withLineRange(11, 20)
          .build(),
        anOutlineSection()
          .withId('section-3')
          .withLineRange(21, 30)
          .build(),
      ];

      const section = findSectionAtLine(sections, 15);

      expect(section?.id).toBe('section-2');
    });
  });

  describe('extractHeaderFromLine', () => {
    test('should extract level 1 header', () => {
      const result = extractHeaderFromLine('# Introduction');

      expect(result).toEqual({ level: 1, title: 'Introduction' });
    });

    test('should extract level 2 header', () => {
      const result = extractHeaderFromLine('## Methods');

      expect(result).toEqual({ level: 2, title: 'Methods' });
    });

    test('should extract level 3 header', () => {
      const result = extractHeaderFromLine('### Results');

      expect(result).toEqual({ level: 3, title: 'Results' });
    });

    test('should extract level 4 header', () => {
      const result = extractHeaderFromLine('#### Discussion');

      expect(result).toEqual({ level: 4, title: 'Discussion' });
    });

    test('should trim whitespace from title', () => {
      const result = extractHeaderFromLine('#   Title with spaces   ');

      expect(result).toEqual({ level: 1, title: 'Title with spaces' });
    });

    test('should return null for non-header line', () => {
      const result = extractHeaderFromLine('This is not a header');

      expect(result).toBeNull();
    });

    test('should return null for empty line', () => {
      const result = extractHeaderFromLine('');

      expect(result).toBeNull();
    });

    test('should return null for header without space', () => {
      const result = extractHeaderFromLine('#NoSpace');

      expect(result).toBeNull();
    });

    test('should return null for more than 4 hashes', () => {
      const result = extractHeaderFromLine('##### Level 5');

      expect(result).toBeNull();
    });

    test('should handle header with special characters', () => {
      const result = extractHeaderFromLine('## Methods & Results (2024)');

      expect(result).toEqual({ level: 2, title: 'Methods & Results (2024)' });
    });
  });

  describe('findSectionByTitle', () => {
    test('should find section by exact title', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withTitle('Introduction')
          .build(),
        anOutlineSection()
          .withId('section-2')
          .withTitle('Methods')
          .build(),
      ];

      const section = findSectionByTitle(sections, 'Methods');

      expect(section?.id).toBe('section-2');
    });

    test('should find section case-insensitively', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withTitle('Introduction')
          .build(),
      ];

      const section = findSectionByTitle(sections, 'INTRODUCTION');

      expect(section?.id).toBe('section-1');
    });

    test('should find section with mixed case', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withTitle('Methods and Results')
          .build(),
      ];

      const section = findSectionByTitle(sections, 'methods and results');

      expect(section?.id).toBe('section-1');
    });

    test('should return null when title not found', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withTitle('Introduction')
          .build(),
      ];

      const section = findSectionByTitle(sections, 'Conclusion');

      expect(section).toBeNull();
    });

    test('should return null for empty sections array', () => {
      const section = findSectionByTitle([], 'Introduction');

      expect(section).toBeNull();
    });

    test('should return first match when multiple sections have same title', () => {
      const sections: OutlineSection[] = [
        anOutlineSection()
          .withId('section-1')
          .withTitle('Methods')
          .build(),
        anOutlineSection()
          .withId('section-2')
          .withTitle('Methods')
          .build(),
      ];

      const section = findSectionByTitle(sections, 'Methods');

      expect(section?.id).toBe('section-1');
    });
  });
});
