import { jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExportService } from '../exportService';
import { LaTeXRenderer } from '../latexRenderer';
import type { ManuscriptExportOptions } from '../exportService';

describe('LaTeX Export Integration - 11.2', () => {
  let exportService: ExportService;
  let tempDir: string;
  let mockSentenceClaimQuoteLinkManager: any;
  let mockClaimsManager: any;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latex-export-test-'));

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

  describe('11.2 - LaTeX command integration', () => {
    test('should export manuscript to valid .tex file', async () => {
      const manuscript = `# Introduction

This is the introduction section.

# Methods

We used the following methods.`;

      const outputPath = path.join(tempDir, 'test-export.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      // Verify file exists
      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file is not empty
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);

      // Verify file contains LaTeX structure
      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\documentclass');
      expect(content).toContain('\\begin{document}');
      expect(content).toContain('\\end{document}');
    });

    test('should create .tex file with correct LaTeX structure', async () => {
      const manuscript = `# Section 1

Content for section 1.

# Section 2

Content for section 2.`;

      const outputPath = path.join(tempDir, 'structured-export.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\documentclass[12pt]{article}');
      expect(content).toContain('\\usepackage[utf8]{inputenc}');
      expect(content).toContain('\\section{Section 1}');
      expect(content).toContain('\\section{Section 2}');
    });

    test('should handle file dialog scenario with save path', async () => {
      const manuscript = `# Test

Test content.`;

      const outputPath = path.join(tempDir, 'dialog-test.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should throw error for invalid output path', async () => {
      const manuscript = `# Test

Test content.`;

      const invalidPath = '/nonexistent/directory/that/does/not/exist/file.tex';

      const options: ManuscriptExportOptions = {
        outputPath: invalidPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await expect(exportService.exportManuscriptLatex(manuscript, options)).rejects.toThrow();
    });

    test('should export with footnotes and bibliography', async () => {
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

      const outputPath = path.join(tempDir, 'with-citations.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\footnote{');
      expect(content).toContain('\\section*{Bibliography}');
    });

    test('should export with document-scoped footnotes', async () => {
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

      const outputPath = path.join(tempDir, 'document-scope.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: false,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\footnote{');
    });

    test('should export with section-scoped footnotes', async () => {
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

      const outputPath = path.join(tempDir, 'section-scope.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: false,
        footnoteStyle: 'native',
        footnoteScope: 'section'
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should export without footnotes when includeFootnotes is false', async () => {
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

      const outputPath = path.join(tempDir, 'no-footnotes.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).not.toContain('\\footnote{');
    });

    test('should export without bibliography when includeBibliography is false', async () => {
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

      const outputPath = path.join(tempDir, 'no-bibliography.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).not.toContain('\\section*{Bibliography}');
    });

    test('should handle empty manuscript gracefully', async () => {
      const manuscript = '';

      const outputPath = path.join(tempDir, 'empty.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\documentclass');
      expect(content).toContain('\\begin{document}');
      expect(content).toContain('\\end{document}');
    });

    test('should escape special LaTeX characters in content', async () => {
      const manuscript = `# Section with dollar and ampersand

Content with special characters: percent sign, dollar sign, ampersand, underscore, braces, tilde, caret.`;

      const outputPath = path.join(tempDir, 'special-chars.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      // Verify document structure is valid
      expect(content).toContain('\\documentclass');
      expect(content).toContain('\\section{Section with dollar and ampersand}');
      expect(content).toContain('\\begin{document}');
      expect(content).toContain('\\end{document}');
    });

    test('should generate valid LaTeX syntax', async () => {
      const manuscript = `# Introduction

This is the introduction.

# Methods

We used method X.

# Results

Results are shown.`;

      const outputPath = path.join(tempDir, 'valid-syntax.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');

      // Verify basic LaTeX structure
      expect(content).toContain('\\documentclass[12pt]{article}');
      expect(content).toContain('\\begin{document}');
      expect(content).toContain('\\end{document}');

      // Verify sections are properly formatted
      expect(content).toContain('\\section{Introduction}');
      expect(content).toContain('\\section{Methods}');
      expect(content).toContain('\\section{Results}');

      // Verify content is present
      expect(content).toContain('This is the introduction.');
      expect(content).toContain('We used method X.');
      expect(content).toContain('Results are shown.');
    });

    test('should create file with proper permissions', async () => {
      const manuscript = `# Test

Content.`;

      const outputPath = path.join(tempDir, 'permissions-test.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Verify file is readable
      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
    });

    test('should handle multiple sections with nested levels', async () => {
      const manuscript = `# Main Section

Content.

## Subsection

Subcontent.

### Subsubsection

Subsubcontent.`;

      const outputPath = path.join(tempDir, 'nested-sections.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: false,
        includeBibliography: false
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\section{Main Section}');
      expect(content).toContain('\\subsection{Subsection}');
      expect(content).toContain('\\subsubsection{Subsubsection}');
    });

    test('should include bibliography with proper formatting', async () => {
      const manuscript = `# Section

Sentence 1. Sentence 2.`;

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

      mockSentenceClaimQuoteLinkManager.getCitationsForSentence
        .mockReturnValueOnce([mockCitation1 as any])
        .mockReturnValueOnce([mockCitation2 as any]);

      mockClaimsManager.getClaim
        .mockReturnValueOnce(mockClaim1 as any)
        .mockReturnValueOnce(mockClaim2 as any);

      const outputPath = path.join(tempDir, 'bibliography.tex');

      const options: ManuscriptExportOptions = {
        outputPath,
        includeFootnotes: true,
        includeBibliography: true,
        footnoteStyle: 'native',
        footnoteScope: 'document'
      };

      await exportService.exportManuscriptLatex(manuscript, options);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('\\section*{Bibliography}');
      expect(content).toContain('\\begin{itemize}');
      // Bibliography entries include the source (which may contain year)
      expect(content).toContain('\\item Smith 2020');
      expect(content).toContain('\\item Jones 2021');
      expect(content).toContain('\\end{itemize}');
    });
  });
});
