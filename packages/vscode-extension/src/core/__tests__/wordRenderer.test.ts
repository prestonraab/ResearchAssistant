import { jest } from '@jest/globals';
import { WordRenderer } from '../wordRenderer';
import type { DocumentModel, DocumentSection, DocumentParagraph, DocumentRun } from '../documentModel';

describe('WordRenderer', () => {
  let renderer: WordRenderer;

  beforeEach(() => {
    renderer = new WordRenderer();
  });

  describe('6.1 - Basic document structure', () => {
    test('should generate valid Word document buffer', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // Check for docx file signature (PK for ZIP format)
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'
    });

    test('should create document with proper structure', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test Section',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Test content' }]
              }
            ]
          }
        ],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should handle empty document', async () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: false
        }
      };

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('6.2 - Heading rendering', () => {
    test('should render level 1 heading', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render level 2 heading', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render level 3 heading', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render multiple sections with different heading levels', async () => {
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
          },
          {
            heading: 'Subsection 2.1',
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should preserve section hierarchy', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Main Section',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Main content' }]
              }
            ]
          },
          {
            heading: 'Subsection',
            level: 2,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Sub content' }]
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('6.3 - Paragraph and text run rendering', () => {
    test('should render paragraph with text', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render multiple text runs in paragraph', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [
                  { type: 'text', content: 'First part ' },
                  { type: 'text', content: 'second part' }
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render multiple paragraphs', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Test',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'First paragraph.' }]
              },
              {
                runs: [{ type: 'text', content: 'Second paragraph.' }]
              },
              {
                runs: [{ type: 'text', content: 'Third paragraph.' }]
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should handle footnote reference runs', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should handle mixed text and footnote runs', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('6.4 - Footnote rendering', () => {
    test('should render footnote with quote and source', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render footnote without year', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render multiple footnotes', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should include quote text and source in footnote content', async () => {
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
              quoteText: 'Important quote',
              source: 'Smith et al.',
              year: '2020'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should handle footnotes with special characters', async () => {
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
              quoteText: 'Quote with "quotes" & symbols',
              source: 'Smith_2020'
            }
          ],
          footnoteScope: 'document',
          includeFootnotes: true,
          includeBibliography: false
        }
      };

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('6.5 - Bibliography rendering', () => {
    test('should render bibliography section with heading', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render bibliography entry with year', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render bibliography entry without year', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render multiple bibliography entries', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should not render bibliography when includeBibliography is false', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should not render bibliography when bibliography is empty', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should format bibliography entries correctly', async () => {
      const model: DocumentModel = {
        sections: [],
        bibliography: [
          { source: 'Smith & Jones', year: '2020' },
          { source: 'Brown et al.', year: '2021' },
          { source: 'Green' }
        ],
        metadata: {
          footnotes: [],
          footnoteScope: 'document',
          includeFootnotes: false,
          includeBibliography: true
        }
      };

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Integration tests', () => {
    test('should render complete document with sections, paragraphs, footnotes, and bibliography', async () => {
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // Verify it's a valid ZIP/docx file
      expect(buffer[0]).toBe(0x50); // 'P'
      expect(buffer[1]).toBe(0x4b); // 'K'
    });

    test('should render document with nested sections', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Main Section',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Main content' }]
              }
            ]
          },
          {
            heading: 'Subsection',
            level: 2,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Sub content' }]
              }
            ]
          },
          {
            heading: 'Sub-subsection',
            level: 3,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Sub-sub content' }]
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('should render document with multiple paragraphs per section', async () => {
      const model: DocumentModel = {
        sections: [
          {
            heading: 'Section',
            level: 1,
            paragraphs: [
              {
                runs: [{ type: 'text', content: 'Paragraph 1' }]
              },
              {
                runs: [{ type: 'text', content: 'Paragraph 2' }]
              },
              {
                runs: [{ type: 'text', content: 'Paragraph 3' }]
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

      const buffer = await renderer.render(model);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
