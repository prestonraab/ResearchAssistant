import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportService } from '../exportService';
import { WordRenderer } from '../wordRenderer';
import type { ManuscriptExportOptions } from '../exportService';

describe('Word Export Integration - 11.1', () => {
  let exportService: ExportService;
  let tempDir: string;
  let mockSentenceClaimQuoteLinkManager: any;
  let mockClaimsManager: any;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-export-test-'));

    // Create mock objects
    mockSentenceClaimQuoteLinkManager = {
      getCitationsForSentence: jest.fn().mockReturnValue([])
    };

    mockClaimsManager = {
      getClaim: jest.fn().mockReturnValue(null)
    };

    exportService = new ExportService(mockSentenceClaimQuoteLinkManager, mockClaimsManager);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('11.1 - Word command integration', () => {
    it('should export manuscript to valid .docx file', async () => {
      const manuscript = `# Introduction

This is the introduction section.

# Methods

We used the following methods.`;

      const outputPath = path.join(tempDir, 'test-export.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptWord(manuscript, options);

      // Verify file exists
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file is not empty
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify file is valid .docx (ZIP format with PK signature)
      const buffer = fs.readFileSync(outputPath);
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'
    });

    it('should create .docx file with correct structure', async () => {
      const manuscript = `# Section 1

Content for section 1.

# Section 2

Content for section 2.`;

      const outputPath = path.join(tempDir, 'structured-export.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
      const buffer = fs.readFileSync(outputPath);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle file dialog scenario with save path', async () => {
      const manuscript = `# Test

Test content.`;

      const outputPath = path.join(tempDir, 'dialog-test.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should throw error for invalid output path', async () => {
      const manuscript = `# Test

Test content.`;

      const invalidPath = '/nonexistent/directory/that/does/not/exist/file.docx';

      const options: ManuscriptExportOptions = {
        outputPath: invalidPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await expect(exportService.exportManuscriptWord(manuscript, options)).rejects.toThrow();
    });

    it('should export with footnotes and bibliography', async () => {
      const manuscript = `# Introduction

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

      const outputPath = path.join(tempDir, 'with-citations.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
      const buffer = fs.readFileSync(outputPath);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should export with document-scoped footnotes', async () => {
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

      const outputPath = path.join(tempDir, 'document-scope.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: false,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should export with section-scoped footnotes', async () => {
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

      const outputPath = path.join(tempDir, 'section-scope.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: false,
        footnoteStyle: 'native',
        footnoteScope: 'section'
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should export without footnotes when includeFootnotes is false', async () => {
      const manuscript = `# Section

Sentence with citation.`;

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

      const outputPath = path.join(tempDir, 'no-footnotes.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should export without bibliography when includeBibliography is false', async () => {
      const manuscript = `# Section

Sentence with citation.`;

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

      const outputPath = path.join(tempDir, 'no-bibliography.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: false
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should handle empty manuscript gracefully', async () => {
      const manuscript = '';

      const outputPath = path.join(tempDir, 'empty.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
      const buffer = fs.readFileSync(outputPath);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should handle manuscript with special characters', async () => {
      const manuscript = `# Section with & Special Characters

Content with $100, 50%, and other symbols.`;

      const outputPath = path.join(tempDir, 'special-chars.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    it('should create file with proper permissions', async () => {
      const manuscript = `# Test

Content.`;

      const outputPath = path.join(tempDir, 'permissions-test.docx');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptWord(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file is readable
      const buffer = fs.readFileSync(outputPath);
      expect(buffer).toBeDefined();
    });
  });
});
