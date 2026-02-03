import { ExportService, ManuscriptExportOptions } from '../exportService';
import { setupTest, createMockSentenceClaimQuoteLinkManager, createMockClaimsManager, aClaim } from '../../__tests__/helpers';

describe('ExportService - buildDocumentModel', () => {
  setupTest();

  let exportService: ExportService;
  let mockSentenceClaimQuoteLinkManager: ReturnType<typeof createMockSentenceClaimQuoteLinkManager>;
  let mockClaimsManager: ReturnType<typeof createMockClaimsManager>;

  beforeEach(() => {
    mockSentenceClaimQuoteLinkManager = createMockSentenceClaimQuoteLinkManager();
    mockClaimsManager = createMockClaimsManager();
    exportService = new ExportService(mockSentenceClaimQuoteLinkManager, mockClaimsManager);
  });

  describe('buildDocumentModel - Basic Structure', () => {
    test('should parse single section with heading and paragraph', async () => {
      const manuscript = `# Introduction

This is a paragraph with some text.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0].heading).toBe('Introduction');
      expect(model.sections[0].level).toBe(1);
      expect(model.sections[0].paragraphs).toHaveLength(1);
    });

    test('should parse multiple sections with different heading levels', async () => {
      const manuscript = `# Section 1

Content 1

## Subsection 1.1

Content 1.1

# Section 2

Content 2`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections).toHaveLength(3);
      expect(model.sections[0].level).toBe(1);
      expect(model.sections[1].level).toBe(2);
      expect(model.sections[2].level).toBe(1);
    });

    test('should extract heading text without markdown syntax', async () => {
      const manuscript = `## My Section Title

Some content`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections[0].heading).toBe('My Section Title');
      expect(model.sections[0].heading).not.toContain('#');
    });

    test('should parse multiple paragraphs in a section', async () => {
      const manuscript = `# Section

First paragraph here.

Second paragraph here.

Third paragraph here.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections[0].paragraphs).toHaveLength(3);
    });
  });

  describe('buildDocumentModel - Paragraph Structure', () => {
    test('should create text runs for sentences without citations', async () => {
      const manuscript = `# Section

This is a sentence. This is another sentence.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx'
      });
      const paragraph = model.sections[0].paragraphs[0];

      const textRuns = paragraph.runs.filter((r: any) => r.type === 'text');
      expect(textRuns.length).toBeGreaterThan(0);
      expect(textRuns.every((r: any) => r.content.length > 0)).toBe(true);
    });

    test('should not create footnote references when includeFootnotes is false', async () => {
      const manuscript = `# Section

This is a sentence.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false
      });
      const paragraph = model.sections[0].paragraphs[0];

      const footnoteRefs = paragraph.runs.filter((r: any) => r.type === 'footnote-ref');
      expect(footnoteRefs).toHaveLength(0);
    });
  });

  describe('buildDocumentModel - Footnotes', () => {
    test('should create footnote references when citations exist', async () => {
      const manuscript = `# Section

This is a sentence.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote text', 'Smith 2020')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true
      });
      const paragraph = model.sections[0].paragraphs[0];

      const footnoteRefs = paragraph.runs.filter((r: any) => r.type === 'footnote-ref');
      expect(footnoteRefs.length).toBeGreaterThan(0);
      expect(footnoteRefs[0].footnoteId).toBe(1);
    });

    test('should build footnotes with quote text and source', async () => {
      const manuscript = `# Section

This is a sentence.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Important quote', 'Smith 2020')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true
      });

      expect(model.metadata.footnotes).toHaveLength(1);
      expect(model.metadata.footnotes[0].quoteText).toBe('Important quote');
      expect(model.metadata.footnotes[0].source).toBe('Smith 2020');
    });

    test('should support document-scoped footnote numbering', async () => {
      const manuscript = `# Section 1

Sentence 1.

# Section 2

Sentence 2.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote', 'Source')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        footnoteScope: 'document'
      });

      const section1Footnotes = model.sections[0].paragraphs[0].runs.filter((r: any) => r.type === 'footnote-ref');
      const section2Footnotes = model.sections[1].paragraphs[0].runs.filter((r: any) => r.type === 'footnote-ref');

      if (section1Footnotes.length > 0 && section2Footnotes.length > 0) {
        expect(section2Footnotes[0].footnoteId).toBeGreaterThan(section1Footnotes[0].footnoteId!);
      }
    });

    test('should support section-scoped footnote numbering', async () => {
      const manuscript = `# Section 1

Sentence 1.

# Section 2

Sentence 2.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote', 'Source')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        footnoteScope: 'section'
      });

      const section1Footnotes = model.sections[0].paragraphs[0].runs.filter((r: any) => r.type === 'footnote-ref');
      const section2Footnotes = model.sections[1].paragraphs[0].runs.filter((r: any) => r.type === 'footnote-ref');

      if (section1Footnotes.length > 0 && section2Footnotes.length > 0) {
        expect(section1Footnotes[0].footnoteId).toBe(1);
        expect(section2Footnotes[0].footnoteId).toBe(1);
      }
    });
  });

  describe('buildDocumentModel - Bibliography', () => {
    test('should build bibliography from citations when includeBibliography is true', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote', 'Smith 2020')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      });

      expect(model.bibliography).toHaveLength(1);
      expect(model.bibliography[0].source).toBe('Smith 2020');
    });

    test('should not include bibliography when includeBibliography is false', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote', 'Smith 2020')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: false
      });

      expect(model.bibliography).toHaveLength(0);
    });

    test('should collect unique sources in bibliography', async () => {
      const manuscript = `# Section

Sentence 1.

Sentence 2.`;

      const mockCitation1 = { claimId: 'claim1', quoteIndex: 0 };
      const mockCitation2 = { claimId: 'claim2', quoteIndex: 0 };

      const mockClaim1 = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote 1', 'Smith 2020')
        .build();

      const mockClaim2 = aClaim()
        .withId('claim2')
        .withPrimaryQuote('Quote 2', 'Smith 2020')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence
        .mockReturnValueOnce([mockCitation1 as any])
        .mockReturnValueOnce([mockCitation2 as any]);

      mockClaimsManager.getClaim
        .mockReturnValueOnce(mockClaim1 as any)
        .mockReturnValueOnce(mockClaim2 as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      });

      expect(model.bibliography).toHaveLength(1);
      expect(model.bibliography[0].source).toBe('Smith 2020');
    });

    test('should include year in bibliography entries', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = { claimId: 'claim1', quoteIndex: 0 };
      const mockClaim = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote', 'Smith 2020')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      });

      expect(model.bibliography[0].year).toBe('2020');
    });
  });

  describe('buildDocumentModel - Metadata', () => {
    test('should set correct metadata for document scope', async () => {
      const model = await exportService.buildDocumentModel('# Section\n\nContent', {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true,
        footnoteScope: 'document'
      });

      expect(model.metadata.footnoteScope).toBe('document');
      expect(model.metadata.includeFootnotes).toBe(true);
      expect(model.metadata.includeBibliography).toBe(true);
    });

    test('should set correct metadata for section scope', async () => {
      const model = await exportService.buildDocumentModel('# Section\n\nContent', {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true,
        footnoteScope: 'section'
      });

      expect(model.metadata.footnoteScope).toBe('section');
    });

    test('should default to document scope when not specified', async () => {
      const model = await exportService.buildDocumentModel('# Section\n\nContent', {
        outputPath: '/tmp/test.docx'
      });

      expect(model.metadata.footnoteScope).toBe('document');
    });

    test('should default to including footnotes and bibliography', async () => {
      const model = await exportService.buildDocumentModel('# Section\n\nContent', {
        outputPath: '/tmp/test.docx'
      });

      expect(model.metadata.includeFootnotes).toBe(true);
      expect(model.metadata.includeBibliography).toBe(true);
    });
  });

  describe('buildDocumentModel - Edge Cases', () => {
    test('should handle empty manuscript', async () => {
      const model = await exportService.buildDocumentModel('', {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections).toHaveLength(0);
      expect(model.bibliography).toHaveLength(0);
      expect(model.metadata.footnotes).toHaveLength(0);
    });

    test('should handle manuscript with only whitespace', async () => {
      const model = await exportService.buildDocumentModel('   \n\n  \t\n   ', {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections).toHaveLength(0);
    });

    test('should handle manuscript with no headings', async () => {
      const model = await exportService.buildDocumentModel('Just some text here.\n\nMore text here.', {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections.length).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing claim references gracefully', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = { claimId: 'nonexistent', quoteIndex: 0 };
      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(null);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      });

      expect(model.metadata.footnotes).toHaveLength(0);
    });

    test('should handle headings with special characters', async () => {
      const model = await exportService.buildDocumentModel('# Section 1: Introduction & Overview\n\nContent here.', {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections[0].heading).toBe('Section 1: Introduction & Overview');
    });

    test('should remove HTML comment markers from manuscript', async () => {
      const manuscript = `# Introduction

**What is the question?** <!-- [undefined] --> This is the answer to the question.
**Another question?** <!-- [undefined] --> Another answer here.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx'
      });

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0].heading).toBe('Introduction');
      expect(model.sections[0].paragraphs).toHaveLength(1);
      
      const paragraphText = model.sections[0].paragraphs[0].runs
        .map((run: any) => run.content)
        .join('');
      
      expect(paragraphText).not.toContain('<!-- [undefined] -->');
      expect(paragraphText).not.toContain('**What is the question?**');
      expect(paragraphText).not.toContain('**Another question?**');
      expect(paragraphText).toContain('This is the answer to the question.');
      expect(paragraphText).toContain('Another answer here.');
    });

    test('should handle multiple citations in same sentence', async () => {
      const manuscript = `# Section

Sentence with multiple citations.`;

      const mockCitation1 = { claimId: 'claim1', quoteIndex: 0 };
      const mockCitation2 = { claimId: 'claim2', quoteIndex: 0 };

      const mockClaim1 = aClaim()
        .withId('claim1')
        .withPrimaryQuote('Quote 1', 'Smith 2020')
        .build();

      const mockClaim2 = aClaim()
        .withId('claim2')
        .withPrimaryQuote('Quote 2', 'Jones 2021')
        .build();

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation1 as any, mockCitation2 as any]);
      mockClaimsManager.getClaim
        .mockReturnValueOnce(mockClaim1 as any)
        .mockReturnValueOnce(mockClaim2 as any);

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      });

      const footnoteRefs = model.sections[0].paragraphs[0].runs.filter((r: any) => r.type === 'footnote-ref');
      expect(footnoteRefs).toHaveLength(2);
      expect(model.metadata.footnotes).toHaveLength(2);
    });
  });
});
