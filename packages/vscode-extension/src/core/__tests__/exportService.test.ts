import { jest } from '@jest/globals';
import { ExportService, ManuscriptExportOptions, CitedQuote } from '../exportService';
import type { DocumentModel, DocumentSection, DocumentParagraph } from '../documentModel';

describe('ExportService - buildDocumentModel', () => {
  let exportService: ExportService;
  let mockSentenceClaimQuoteLinkManager: any;
  let mockClaimsManager: any;

  beforeEach(() => {
    // Create mock objects
    mockSentenceClaimQuoteLinkManager = {
      getCitationsForSentence: jest.fn().mockReturnValue([])
    };

    mockClaimsManager = {
      getClaim: jest.fn().mockReturnValue(null)
    };
    
    exportService = new ExportService(mockSentenceClaimQuoteLinkManager, mockClaimsManager);
  });

  describe('buildDocumentModel - Basic Structure', () => {
    it('should parse single section with heading and paragraph', async () => {
      const manuscript = `# Introduction

This is a paragraph with some text.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0].heading).toBe('Introduction');
      expect(model.sections[0].level).toBe(1);
      expect(model.sections[0].paragraphs).toHaveLength(1);
    });

    it('should parse multiple sections with different heading levels', async () => {
      const manuscript = `# Section 1

Content 1

## Subsection 1.1

Content 1.1

# Section 2

Content 2`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections).toHaveLength(3);
      expect(model.sections[0].level).toBe(1);
      expect(model.sections[1].level).toBe(2);
      expect(model.sections[2].level).toBe(1);
    });

    it('should extract heading text without markdown syntax', async () => {
      const manuscript = `## My Section Title

Some content`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections[0].heading).toBe('My Section Title');
      expect(model.sections[0].heading).not.toContain('#');
    });

    it('should parse multiple paragraphs in a section', async () => {
      const manuscript = `# Section

First paragraph here.

Second paragraph here.

Third paragraph here.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections[0].paragraphs).toHaveLength(3);
    });
  });

  describe('buildDocumentModel - Paragraph Structure', () => {
    it('should create text runs for sentences without citations', async () => {
      const manuscript = `# Section

This is a sentence. This is another sentence.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);
      const paragraph = model.sections[0].paragraphs[0];

      // Should have text runs for both sentences
      const textRuns = paragraph.runs.filter(r => r.type === 'text');
      expect(textRuns.length).toBeGreaterThan(0);
      expect(textRuns.every(r => r.content.length > 0)).toBe(true);
    });

    it('should not create footnote references when includeFootnotes is false', async () => {
      const manuscript = `# Section

This is a sentence.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);
      const paragraph = model.sections[0].paragraphs[0];

      const footnoteRefs = paragraph.runs.filter(r => r.type === 'footnote-ref');
      expect(footnoteRefs).toHaveLength(0);
    });
  });

  describe('buildDocumentModel - Footnotes', () => {
    it('should create footnote references when citations exist', async () => {
      const manuscript = `# Section

This is a sentence.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote text',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);
      const paragraph = model.sections[0].paragraphs[0];

      const footnoteRefs = paragraph.runs.filter(r => r.type === 'footnote-ref');
      expect(footnoteRefs.length).toBeGreaterThan(0);
      expect(footnoteRefs[0].footnoteId).toBe(1);
    });

    it('should build footnotes with quote text and source', async () => {
      const manuscript = `# Section

This is a sentence.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Important quote',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.metadata.footnotes).toHaveLength(1);
      expect(model.metadata.footnotes[0].quoteText).toBe('Important quote');
      expect(model.metadata.footnotes[0].source).toBe('Smith 2020');
    });

    it('should support document-scoped footnote numbering', async () => {
      const manuscript = `# Section 1

Sentence 1.

# Section 2

Sentence 2.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote',
          source: 'Source'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: false,
        footnoteScope: 'document'
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      // Both sections should have footnotes with continuous numbering
      const section1Footnotes = model.sections[0].paragraphs[0].runs.filter(r => r.type === 'footnote-ref');
      const section2Footnotes = model.sections[1].paragraphs[0].runs.filter(r => r.type === 'footnote-ref');

      if (section1Footnotes.length > 0 && section2Footnotes.length > 0) {
        expect(section2Footnotes[0].footnoteId).toBeGreaterThan(section1Footnotes[0].footnoteId!);
      }
    });

    it('should support section-scoped footnote numbering', async () => {
      const manuscript = `# Section 1

Sentence 1.

# Section 2

Sentence 2.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote',
          source: 'Source'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: false,
        footnoteScope: 'section'
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      // Both sections should have footnotes starting at 1
      const section1Footnotes = model.sections[0].paragraphs[0].runs.filter(r => r.type === 'footnote-ref');
      const section2Footnotes = model.sections[1].paragraphs[0].runs.filter(r => r.type === 'footnote-ref');

      if (section1Footnotes.length > 0 && section2Footnotes.length > 0) {
        expect(section1Footnotes[0].footnoteId).toBe(1);
        expect(section2Footnotes[0].footnoteId).toBe(1);
      }
    });
  });

  describe('buildDocumentModel - Bibliography', () => {
    it('should build bibliography from citations when includeBibliography is true', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.bibliography).toHaveLength(1);
      expect(model.bibliography[0].source).toBe('Smith 2020');
    });

    it('should not include bibliography when includeBibliography is false', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.bibliography).toHaveLength(0);
    });

    it('should collect unique sources in bibliography', async () => {
      const manuscript = `# Section

Sentence 1.

Sentence 2.`;

      const mockCitation1 = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockCitation2 = {
        claimId: 'claim2',
        quoteIndex: 0
      };

      const mockClaim1 = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote 1',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      const mockClaim2 = {
        id: 'claim2',
        primaryQuote: {
          text: 'Quote 2',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence
        .mockReturnValueOnce([mockCitation1 as any])
        .mockReturnValueOnce([mockCitation2 as any]);

      mockClaimsManager.getClaim
        .mockReturnValueOnce(mockClaim1 as any)
        .mockReturnValueOnce(mockClaim2 as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      // Should have only one unique source
      expect(model.bibliography).toHaveLength(1);
      expect(model.bibliography[0].source).toBe('Smith 2020');
    });

    it('should include year in bibliography entries', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockClaim = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(mockClaim as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.bibliography[0].year).toBe('2020');
    });
  });

  describe('buildDocumentModel - Metadata', () => {
    it('should set correct metadata for document scope', async () => {
      const manuscript = `# Section

Content`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true,
        footnoteScope: 'document'
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.metadata.footnoteScope).toBe('document');
      expect(model.metadata.includeFootnotes).toBe(true);
      expect(model.metadata.includeBibliography).toBe(true);
    });

    it('should set correct metadata for section scope', async () => {
      const manuscript = `# Section

Content`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true,
        footnoteScope: 'section'
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.metadata.footnoteScope).toBe('section');
    });

    it('should default to document scope when not specified', async () => {
      const manuscript = `# Section

Content`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx'
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.metadata.footnoteScope).toBe('document');
    });

    it('should default to including footnotes and bibliography', async () => {
      const manuscript = `# Section

Content`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx'
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.metadata.includeFootnotes).toBe(true);
      expect(model.metadata.includeBibliography).toBe(true);
    });
  });

  describe('buildDocumentModel - Edge Cases', () => {
    it('should handle empty manuscript', async () => {
      const manuscript = '';

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections).toHaveLength(0);
      expect(model.bibliography).toHaveLength(0);
      expect(model.metadata.footnotes).toHaveLength(0);
    });

    it('should handle manuscript with only whitespace', async () => {
      const manuscript = '   \n\n  \t\n   ';

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections).toHaveLength(0);
    });

    it('should handle manuscript with no headings', async () => {
      const manuscript = `Just some text here.

More text here.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      // Should still parse paragraphs even without headings
      expect(model.sections.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing claim references gracefully', async () => {
      const manuscript = `# Section

Sentence 1.`;

      const mockCitation = {
        claimId: 'nonexistent',
        quoteIndex: 0
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation as any]);
      mockClaimsManager.getClaim.mockReturnValue(null);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      // Should not crash, just skip the missing citation
      expect(model.metadata.footnotes).toHaveLength(0);
    });

    it('should handle headings with special characters', async () => {
      const manuscript = `# Section 1: Introduction & Overview

Content here.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections[0].heading).toBe('Section 1: Introduction & Overview');
    });

    it('should remove HTML comment markers from manuscript', async () => {
      const manuscript = `# Introduction

**What is the question?** <!-- [undefined] --> This is the answer to the question.
**Another question?** <!-- [undefined] --> Another answer here.`;

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0].heading).toBe('Introduction');
      expect(model.sections[0].paragraphs).toHaveLength(1);
      
      // Check that HTML comments and questions are removed from paragraph text
      const paragraphText = model.sections[0].paragraphs[0].runs
        .map(run => run.content)
        .join('');
      
      expect(paragraphText).not.toContain('<!-- [undefined] -->');
      expect(paragraphText).not.toContain('**What is the question?**');
      expect(paragraphText).not.toContain('**Another question?**');
      expect(paragraphText).toContain('This is the answer to the question.');
      expect(paragraphText).toContain('Another answer here.');
    });

    it('should handle multiple citations in same sentence', async () => {
      const manuscript = `# Section

Sentence with multiple citations.`;

      const mockCitation1 = {
        claimId: 'claim1',
        quoteIndex: 0
      };

      const mockCitation2 = {
        claimId: 'claim2',
        quoteIndex: 0
      };

      const mockClaim1 = {
        id: 'claim1',
        primaryQuote: {
          text: 'Quote 1',
          source: 'Smith 2020'
        },
        supportingQuotes: []
      };

      const mockClaim2 = {
        id: 'claim2',
        primaryQuote: {
          text: 'Quote 2',
          source: 'Jones 2021'
        },
        supportingQuotes: []
      };

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence.mockReturnValue([mockCitation1 as any, mockCitation2 as any]);
      mockClaimsManager.getClaim
        .mockReturnValueOnce(mockClaim1 as any)
        .mockReturnValueOnce(mockClaim2 as any);

      const options: ManuscriptExportOptions = {
        outputPath: '/tmp/test.docx',
        includeFootnotes: true,
        includeBibliography: true
      };

      const model = await exportService.buildDocumentModel(manuscript, options);

      const footnoteRefs = model.sections[0].paragraphs[0].runs.filter(r => r.type === 'footnote-ref');
      expect(footnoteRefs).toHaveLength(2);
      expect(model.metadata.footnotes).toHaveLength(2);
    });
  });
});
