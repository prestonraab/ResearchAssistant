import { MarkdownExporter } from '../MarkdownExporter';

describe('MarkdownExporter', () => {
  let exporter: MarkdownExporter;

  beforeEach(() => {
    exporter = new MarkdownExporter();
  });

  describe('exportManuscriptMarkdown', () => {
    describe('legacy \\cite{} format', () => {
      test('should convert single \\cite{} to Pandoc format', async () => {
        const manuscript = `# Introduction

This is important research. \\cite{GNFV76AH}`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('[@GNFV76AH]');
        expect(result).not.toContain('\\cite{GNFV76AH}');
      });

      test('should convert multiple citations in same \\cite{}', async () => {
        const manuscript = `# Methods

We used several methods. \\cite{KEY1,KEY2,KEY3}`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('[@KEY1; @KEY2; @KEY3]');
      });
    });

    describe('new [source:: ...] format', () => {
      test('should convert single source tag with AuthorYear to Pandoc format', async () => {
        const manuscript = `# Methods

The elastic net combines L1 and L2 penalties. [source:: C_79(Zou 2005)]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('[@Zou2005]');
        expect(result).not.toContain('[source::');
        expect(result).not.toContain('C_79');
      });

      test('should convert source tag with multiple AuthorYears', async () => {
        const manuscript = `Random forests provide robust classification. [source:: C_84(Díaz-Uriarte 2006), C_83(Breiman 2001)]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('[@DiazUriarte2006; @Breiman2001]');
      });

      test('should remove source tags without AuthorYear citations', async () => {
        const manuscript = `Some claim without external citation. [source:: C_01, C_02]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).not.toContain('[source::');
        expect(result).not.toContain('C_01');
        expect(result).toContain('Some claim without external citation.');
      });

      test('should handle mixed claims with and without AuthorYear', async () => {
        const manuscript = `Deep learning shows promise. [source:: C_86(Hanczar 2022), C_87, C_88]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        // Only Hanczar 2022 should be cited
        expect(result).toContain('[@Hanczar2022]');
        expect(result).not.toContain('C_87');
        expect(result).not.toContain('C_88');
      });

      test('should normalize AuthorYear with special characters', async () => {
        const manuscript = `Method description. [source:: C_84(Díaz-Uriarte 2006)]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        // Diacritics should be removed
        expect(result).toContain('[@DiazUriarte2006]');
      });
    });

    describe('Obsidian callout removal', () => {
      test('should remove Obsidian callout syntax', async () => {
        const manuscript = `## Section

> [!question]- What is the answer? (status:: undefined)
> This is the content of the callout.
> It spans multiple lines.`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).not.toContain('[!question]');
        expect(result).not.toContain('(status::');
        expect(result).toContain('This is the content of the callout.');
      });

      test('should handle callouts with source tags', async () => {
        const manuscript = `> [!question]- Question title (status:: done)
> The answer with citation. [source:: C_01(Author 2020)]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).not.toContain('[!question]');
        expect(result).toContain('[@Author2020]');
        expect(result).toContain('The answer with citation.');
      });
    });

    describe('YAML front matter', () => {
      test('should add YAML front matter with bibliography reference', async () => {
        const manuscript = `# Test

Some text. \\cite{TEST123}`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/output.md'
        });

        expect(result).toContain('---');
        expect(result).toContain('bibliography: output.bib');
        expect(result).toContain('link-citations: true');
      });
    });

    describe('HTML comments', () => {
      test('should remove HTML comment markers', async () => {
        const manuscript = `# Section

**Question?** <!-- [ANSWERED] --> This is the answer. <!-- Source: C_01 -->`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).not.toContain('<!-- [ANSWERED] -->');
        expect(result).not.toContain('<!-- Source: C_01 -->');
        expect(result).toContain('This is the answer.');
      });
    });

    describe('edge cases', () => {
      test('should handle manuscript without citations', async () => {
        const manuscript = `# Introduction

This is plain text without any citations.`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('This is plain text without any citations.');
        expect(result).toContain('---'); // Still has YAML header
      });

      test('should preserve markdown formatting', async () => {
        const manuscript = `# Main Title

## Subsection

**Bold text** and *italic text*.

- List item 1
- List item 2

Some citation here. \\cite{REF123}`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('# Main Title');
        expect(result).toContain('## Subsection');
        expect(result).toContain('**Bold text**');
        expect(result).toContain('*italic text*');
        expect(result).toContain('- List item 1');
        expect(result).toContain('[@REF123]');
      });

      test('should handle real manuscript format', async () => {
        const manuscript = `## Classifiers

> [!question]- Explain elastic net (status:: done)
> The L2 penalty encourages a grouping effect where correlated genes tend to be selected together.
> This dual regularization is effective at ignoring technical noise from batch effects.
> [source:: C_79(Zou 2005), C_80]

> [!question]- Explain random forests (status:: done)
> Random forests aggregate votes across all trees, providing robustness to noise.
> [source:: C_84(Díaz-Uriarte 2006), C_83]`;

        const result = await exporter.exportManuscriptMarkdown(manuscript, {
          outputPath: '/tmp/test.md'
        });

        expect(result).toContain('[@Zou2005]');
        expect(result).toContain('[@DiazUriarte2006]');
        expect(result).not.toContain('[source::');
        expect(result).not.toContain('[!question]');
        expect(result).not.toContain('(status::');
      });
    });
  });
});
