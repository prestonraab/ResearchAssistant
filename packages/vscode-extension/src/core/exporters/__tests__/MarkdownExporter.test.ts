import { MarkdownExporter } from '../MarkdownExporter';

describe('MarkdownExporter', () => {
  let exporter: MarkdownExporter;

  beforeEach(() => {
    exporter = new MarkdownExporter();
  });

  describe('exportManuscriptMarkdown', () => {
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
  });
});
