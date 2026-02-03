import { ExportService } from '../exportService';
import { WordRenderer } from '../wordRenderer';
import { LaTeXRenderer } from '../latexRenderer';
import type { DocumentModel, DocumentImage, DocumentTable } from '../documentModel';

describe('Image and Table Export', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  describe('Document Model - Images', () => {
    it('should parse markdown images', async () => {
      const manuscript = `# Introduction

This is text with an image: ![Test Image](./test.png)

More text after.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      });

      expect(model.sections).toHaveLength(1);
      expect(model.sections[0].paragraphs).toHaveLength(1);
      
      const runs = model.sections[0].paragraphs[0].runs;
      const imageRun = runs.find(r => r.type === 'image');
      
      expect(imageRun).toBeDefined();
      expect(imageRun?.image?.path).toBe('./test.png');
      expect(imageRun?.image?.altText).toBe('Test Image');
    });

    it('should handle multiple images in one paragraph', async () => {
      const manuscript = `# Section

Text ![Image 1](./img1.png) middle ![Image 2](./img2.png) end.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      });

      const runs = model.sections[0].paragraphs[0].runs;
      const imageRuns = runs.filter(r => r.type === 'image');
      
      expect(imageRuns).toHaveLength(2);
      expect(imageRuns[0].image?.path).toBe('./img1.png');
      expect(imageRuns[1].image?.path).toBe('./img2.png');
    });
  });

  describe('Document Model - Tables', () => {
    it('should parse markdown tables', async () => {
      const manuscript = `# Results

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

Text after table.`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      });

      expect(model.sections).toHaveLength(1);
      
      // Find table paragraph
      const tableParagraph = model.sections[0].paragraphs.find(
        p => p.runs.length === 1 && p.runs[0].type === 'table'
      );
      
      expect(tableParagraph).toBeDefined();
      expect(tableParagraph?.runs[0].table?.rows).toHaveLength(3);
      expect(tableParagraph?.runs[0].table?.hasHeader).toBe(true);
      expect(tableParagraph?.runs[0].table?.rows[0]).toEqual(['Column 1', 'Column 2', 'Column 3']);
    });

    it('should handle tables without headers', async () => {
      const manuscript = `# Data

| A | B |
| C | D |`;

      const model = await exportService.buildDocumentModel(manuscript, {
        outputPath: '/tmp/test.docx',
        includeFootnotes: false,
        includeBibliography: false
      });

      const tableParagraph = model.sections[0].paragraphs.find(
        p => p.runs.length === 1 && p.runs[0].type === 'table'
      );
      
      expect(tableParagraph?.runs[0].table?.rows).toHaveLength(2);
    });
  });

  describe('LaTeX Renderer - Images', () => {
    it('should render images with figure environment', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  {
                    type: 'image',
                    content: '',
                    image: {
                      path: './test.png',
                      altText: 'Test',
                      caption: 'Test Figure'
                    }
                  }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: false
        }
      };

      const renderer = new LaTeXRenderer(model);
      const output = renderer.render(model);

      expect(output).toContain('\\begin{figure}');
      expect(output).toContain('\\includegraphics');
      expect(output).toContain('\\caption{Test Figure}');
      expect(output).toContain('\\end{figure}');
    });
  });

  describe('LaTeX Renderer - Tables', () => {
    it('should render tables with tabular environment', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  {
                    type: 'table',
                    content: '',
                    table: {
                      rows: [
                        ['Header 1', 'Header 2'],
                        ['Data 1', 'Data 2']
                      ],
                      hasHeader: true
                    }
                  }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: false
        }
      };

      const renderer = new LaTeXRenderer(model);
      const output = renderer.render(model);

      expect(output).toContain('\\begin{table}');
      expect(output).toContain('\\begin{tabular}');
      expect(output).toContain('\\toprule');
      expect(output).toContain('\\midrule');
      expect(output).toContain('\\bottomrule');
      expect(output).toContain('Header 1 & Header 2');
      expect(output).toContain('Data 1 & Data 2');
      expect(output).toContain('\\end{tabular}');
      expect(output).toContain('\\end{table}');
    });
  });

  describe('Word Renderer - Tables', () => {
    it('should render tables', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  {
                    type: 'table',
                    content: '',
                    table: {
                      rows: [
                        ['A', 'B'],
                        ['C', 'D']
                      ],
                      hasHeader: true
                    }
                  }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: false
        }
      };

      const renderer = new WordRenderer(model);
      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
