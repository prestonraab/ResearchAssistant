import { jest } from '@jest/globals';
import { LaTeXRenderer } from '../latexRenderer';
import type { DocumentModel, DocumentSection, DocumentParagraph, DocumentRun } from '../documentModel';

describe('LaTeXRenderer', () => {
  let renderer: LaTeXRenderer;

  beforeEach(() => {
    renderer = new LaTeXRenderer();
  });

  describe('4.1 - Basic structure and preamble', () => {
    test('should generate valid LaTeX document with preamble', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);

      expect(output).toContain('\\documentclass[12pt]{article}');
      expect(output).toContain('\\usepackage[utf8]{inputenc}');
      expect(output).toContain('\\usepackage[T1]{fontenc}');
      expect(output).toContain('\\usepackage{times}');
      expect(output).toContain('\\usepackage[margin=1in]{geometry}');
      expect(output).toContain('\\begin{document}');
      expect(output).toContain('\\end{document}');
    });

    test('should have proper document structure', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);
      const beginIndex = output.indexOf('\\begin{document}');
      const endIndex = output.indexOf('\\end{document}');

      expect(beginIndex).toBeGreaterThan(0);
      expect(endIndex).toBeGreaterThan(beginIndex);
    });
  });

  describe('4.2 - LaTeX character escaping', () => {
    test('should escape backslash', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Text with \\ backslash' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\textbackslash{}');
    });

    test('should escape percent sign', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Text with % percent' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\%');
    });

    test('should escape dollar sign', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Price is $100' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\$');
    });

    test('should escape ampersand', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Smith & Jones' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\&');
    });

    test('should escape hash', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Item #1' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\#');
    });

    test('should escape underscore', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'variable_name' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\_');
    });

    test('should escape braces', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Text {with} braces' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\{');
      expect(output).toContain('\\}');
    });

    test('should escape tilde', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Text~with~tilde' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\textasciitilde{}');
    });

    test('should escape caret', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Text^with^caret' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\textasciicircum{}');
    });

    test('should escape all special characters together', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: '%$&#_{~^\\}' }]
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

      const output = renderer.render(model);
      expect(output).toContain('\\%');
      expect(output).toContain('\\$');
      expect(output).toContain('\\&');
      expect(output).toContain('\\#');
      expect(output).toContain('\\_');
      expect(output).toContain('\\{');
      expect(output).toContain('\\}');
      expect(output).toContain('\\textasciitilde{}');
      expect(output).toContain('\\textasciicircum{}');
      expect(output).toContain('\\textbackslash{}');
    });
  });

  describe('4.3 - Section rendering', () => {
    test('should render level 1 heading as \\section', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Introduction',
            level: 1,
            paragraphs: []
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

      const output = renderer.render(model);
      expect(output).toContain('\\section{Introduction}');
    });

    test('should render level 2 heading as \\subsection', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Subsection',
            level: 2,
            paragraphs: []
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

      const output = renderer.render(model);
      expect(output).toContain('\\subsection{Subsection}');
    });

    test('should render level 3 heading as \\subsubsection', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Subsubsection',
            level: 3,
            paragraphs: []
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

      const output = renderer.render(model);
      expect(output).toContain('\\subsubsection{Subsubsection}');
    });

    test('should escape special characters in heading', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Section with $100 & 50%',
            level: 1,
            paragraphs: []
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

      const output = renderer.render(model);
      expect(output).toContain('\\section{Section with \\$100 \\& 50\\%}');
    });

    test('should render multiple sections', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Section 1',
            level: 1,
            paragraphs: []
          },
          {
            heading: 'Section 2',
            level: 1,
            paragraphs: []
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

      const output = renderer.render(model);
      expect(output).toContain('\\section{Section 1}');
      expect(output).toContain('\\section{Section 2}');
    });
  });

  describe('4.4 - Paragraph and footnote rendering', () => {
    test('should render paragraph with text', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'This is a paragraph.' }]
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

      const output = renderer.render(model);
      expect(output).toContain('This is a paragraph.');
    });

    test('should render footnote with quote and source', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'Some text' },
                  { type: 'footnote-ref', content: '', footnoteId: 1 }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [
            {
              id: 1,
              quoteText: 'This is a quote',
              source: 'Smith 2020',
              year: '2020'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\footnote{This is a quote --- Smith 2020, 2020}');
    });

    test('should render footnote without year', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'Some text' },
                  { type: 'footnote-ref', content: '', footnoteId: 1 }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [
            {
              id: 1,
              quoteText: 'This is a quote',
              source: 'Smith'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\footnote{This is a quote --- Smith}');
    });

    test('should render multiple footnotes in paragraph', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'Text' },
                  { type: 'footnote-ref', content: '', footnoteId: 1 },
                  { type: 'text', content: ' and more' },
                  { type: 'footnote-ref', content: '', footnoteId: 2 }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [
            {
              id: 1,
              quoteText: 'Quote 1',
              source: 'Source 1'
            },
            {
              id: 2,
              quoteText: 'Quote 2',
              source: 'Source 2'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\footnote{Quote 1 --- Source 1}');
      expect(output).toContain('\\footnote{Quote 2 --- Source 2}');
    });

    test('should escape special characters in footnote content', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'Text' },
                  { type: 'footnote-ref', content: '', footnoteId: 1 }
                ]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [
            {
              id: 1,
              quoteText: 'Quote with $100 & 50%',
              source: 'Smith_2020'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\footnote{Quote with \\$100 \\& 50\\% --- Smith\\_2020}');
    });
  });

  describe('4.5 - Bibliography rendering', () => {
    test('should render bibliography with BibTeX commands', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [
          { source: 'Smith', year: '2020' }
        ],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: true
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\bibliographystyle{apalike}');
      expect(output).toContain('\\bibliography{references}');
    });

    test('should render bibliography entry with year', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [
          { source: 'Smith', year: '2020' }
        ],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: true
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\bibliographystyle{apalike}');
      expect(output).toContain('\\bibliography{references}');
    });

    test('should render bibliography entry without year', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [
          { source: 'Smith' }
        ],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: true
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\bibliographystyle{apalike}');
      expect(output).toContain('\\bibliography{references}');
    });

    test('should render multiple bibliography entries', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [
          { source: 'Smith', year: '2020' },
          { source: 'Jones', year: '2021' },
          { source: 'Brown' }
        ],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: true
        }
      };

      const output = renderer.render(model);
      expect(output).toContain('\\bibliographystyle{apalike}');
      expect(output).toContain('\\bibliography{references}');
    });

    test('should not render bibliography when includeBibliography is false', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [
          { source: 'Smith', year: '2020' }
        ],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: false
        }
      };

      const output = renderer.render(model);
      expect(output).not.toContain('\\bibliographystyle{apalike}');
      expect(output).not.toContain('\\bibliography{references}');
    });

    test('should not render bibliography when bibliography is empty', () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: true
        }
      };

      const output = renderer.render(model);
      expect(output).not.toContain('\\bibliographystyle{apalike}');
      expect(output).not.toContain('\\bibliography{references}');
    });
  });

  describe('Integration tests', () => {
    test('should render complete document with sections, paragraphs, footnotes, and bibliography', () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Introduction',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'This is the introduction.' },
                  { type: 'footnote-ref', content: '', footnoteId: 1 }
                ]
              }
            ]
          },
          {
            heading: 'Methods',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'We used method X.' },
                  { type: 'footnote-ref', content: '', footnoteId: 2 }
                ]
              }
            ]
          }
        ],
        bibliography: [
          { source: 'Smith', year: '2020' },
          { source: 'Jones', year: '2021' }
        ],
        metadata: {
          footnotes: [
            {
              id: 1,
              quoteText: 'Introduction quote',
              source: 'Smith',
              year: '2020'
            },
            {
              id: 2,
              quoteText: 'Methods quote',
              source: 'Jones',
              year: '2021'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: true
        }
      };

      const output = renderer.render(model);

      // Check structure
      expect(output).toContain('\\documentclass[12pt]{article}');
      expect(output).toContain('\\begin{document}');
      expect(output).toContain('\\end{document}');

      // Check sections
      expect(output).toContain('\\section{Introduction}');
      expect(output).toContain('\\section{Methods}');

      // Check content
      expect(output).toContain('This is the introduction.');
      expect(output).toContain('We used method X.');

      // Check footnotes
      expect(output).toContain('\\footnote{Introduction quote --- Smith, 2020}');
      expect(output).toContain('\\footnote{Methods quote --- Jones, 2021}');

      // Check bibliography uses BibTeX
      expect(output).toContain('\\bibliographystyle{apalike}');
      expect(output).toContain('\\bibliography{references}');
    });
  });
});
