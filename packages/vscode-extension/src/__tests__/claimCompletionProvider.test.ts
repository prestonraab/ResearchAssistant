import * as vscode from 'vscode';
import { ClaimCompletionProvider } from '../ui/claimCompletionProvider';
import { ExtensionState } from '../core/state';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import type { Claim, OutlineSection } from '@research-assistant/core';
import { OutlineParser } from '../core/outlineParserWrapper';

describe('ClaimCompletionProvider', () => {
  let provider: ClaimCompletionProvider;
  let mockState: jest.Mocked<ExtensionState>;
  let mockClaimsManager: jest.Mocked<ClaimsManager>;
  let mockOutlineParser: jest.Mocked<OutlineParser>;
  let mockDocument: any;
  let mockPosition: vscode.Position;

  const mockClaims: Claim[] = [
    {
      id: 'C_01',
      text: 'Machine learning improves accuracy',
      category: 'Result',
      source: 'Smith2020',
      sourceId: 1,
      context: 'Study on ML algorithms',
      primaryQuote: 'ML algorithms showed 95% accuracy',
      supportingQuotes: [],
      sections: ['section-1'],
      verified: true,
      createdAt: new Date(),
      modifiedAt: new Date()
    },
    {
      id: 'C_02',
      text: 'Data preprocessing is essential',
      category: 'Method',
      source: 'Jones2021',
      sourceId: 2,
      context: 'Best practices for data preparation',
      primaryQuote: 'Preprocessing significantly impacts model performance',
      supportingQuotes: [],
      sections: ['section-2'],
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    },
    {
      id: 'C_03',
      text: 'Neural networks require large datasets',
      category: 'Challenge',
      source: 'Brown2019',
      sourceId: 3,
      context: 'Limitations of deep learning',
      primaryQuote: 'Deep learning models need thousands of examples',
      supportingQuotes: [],
      sections: ['section-1'],
      verified: true,
      createdAt: new Date(),
      modifiedAt: new Date()
    }
  ];

  const mockSections: OutlineSection[] = [
    {
      id: 'section-1',
      level: 2,
      title: 'Machine Learning Methods',
      content: ['How do ML algorithms work?', 'What are the benefits?'],
      lineStart: 1,
      lineEnd: 10
    },
    {
      id: 'section-2',
      level: 2,
      title: 'Data Preparation',
      content: ['What preprocessing steps are needed?'],
      lineStart: 11,
      lineEnd: 20
    }
  ];

  beforeEach(() => {
    // Create mock claims manager
    mockClaimsManager = {
      getClaims: jest.fn().mockReturnValue(mockClaims),
      getClaim: jest.fn((id: string) => mockClaims.find(c => c.id === id) || null),
      loadClaims: jest.fn().mockResolvedValue(mockClaims)
    } as any;

    // Create mock outline parser
    mockOutlineParser = {
      parse: jest.fn().mockResolvedValue(mockSections)
    } as any;

    // Create mock extension state
    mockState = {
      claimsManager: mockClaimsManager,
      outlineParser: mockOutlineParser,
      embeddingService: {
        generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        cosineSimilarity: jest.fn().mockReturnValue(0.8)
      },
      getAbsolutePath: jest.fn((path: string) => `/test/workspace/${path}`),
      getConfig: jest.fn().mockReturnValue({
        outlinePath: '03_Drafting/outline.md'
      })
    } as any;

    provider = new ClaimCompletionProvider(mockState);

    // Create mock document
    mockDocument = {
      uri: { fsPath: '/test/workspace/03_Drafting/manuscript.md' },
      lineAt: jest.fn().mockReturnValue({ text: 'Some text C_' })
    } as any;

    mockPosition = new vscode.Position(5, 12);
  });

  describe('provideCompletionItems', () => {
    it('should return undefined if line does not end with "C_"', async () => {
      mockDocument.lineAt = jest.fn().mockReturnValue({ text: 'Some text' });

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined if no claims exist', async () => {
      mockClaimsManager.getClaims.mockReturnValue([]);

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });

    it('should return completion items for all claims', async () => {
      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      expect(result).toBeDefined();
      expect((result as any).items).toHaveLength(3);
      expect((result as any).items[0].label).toBe('C_01');
      expect((result as any).items[1].label).toBe('C_02');
      expect((result as any).items[2].label).toBe('C_03');
    });

    it('should set correct details for completion items', async () => {
      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      expect(items[0].detail).toBe('Result - Smith2020');
      expect(items[1].detail).toBe('Method - Jones2021');
      expect(items[2].detail).toBe('Challenge - Brown2019');
    });

    it('should prioritize claims from current section', async () => {
      // Mock document is in outline file at line 5 (within section-1)
      mockDocument = {
        uri: { fsPath: '/test/workspace/03_Drafting/outline.md' },
        lineAt: jest.fn().mockReturnValue({ text: 'Some text C_' })
      };

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      
      // Claims from section-1 (C_01, C_03) should have sortText starting with "0"
      // Claims from other sections (C_02) should have sortText starting with "1"
      const c01 = items.find((item: any) => item.label === 'C_01');
      const c02 = items.find((item: any) => item.label === 'C_02');
      const c03 = items.find((item: any) => item.label === 'C_03');

      expect(c01.sortText).toMatch(/^0_/);
      expect(c02.sortText).toMatch(/^1_/);
      expect(c03.sortText).toMatch(/^0_/);
    });

    it('should include claim preview in documentation', async () => {
      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      const c01Doc = items[0].documentation.value;

      expect(c01Doc).toContain('C_01');
      expect(c01Doc).toContain('Machine learning improves accuracy');
      expect(c01Doc).toContain('Result');
      expect(c01Doc).toContain('Smith2020');
      expect(c01Doc).toContain('ML algorithms showed 95% accuracy');
    });

    it('should truncate long quotes in preview', async () => {
      const longQuoteClaim: Claim = {
        ...mockClaims[0],
        id: 'C_04',
        primaryQuote: 'A'.repeat(200)
      };
      mockClaimsManager.getClaims.mockReturnValue([longQuoteClaim]);

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      const doc = items[0].documentation.value;

      expect(doc).toContain('...');
      expect(doc.length).toBeLessThan(500);
    });

    it('should set insert text to claim ID', async () => {
      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      expect(items[0].insertText).toBe('C_01');
      expect(items[1].insertText).toBe('C_02');
      expect(items[2].insertText).toBe('C_03');
    });

    it('should include command for inserting full claim text', async () => {
      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      expect(items[0].command).toEqual({
        command: 'researchAssistant.insertClaimReference',
        title: 'Insert Claim Reference',
        arguments: ['C_01']
      });
    });

    it('should handle section detection from non-outline files', async () => {
      // Mock a draft file with a header matching an outline section
      const position = new vscode.Position(5, 12);
      
      mockDocument = {
        uri: { fsPath: '/test/workspace/03_Drafting/chapter.md' },
        lineAt: jest.fn((lineOrPosition: any) => {
          const line = typeof lineOrPosition === 'number' ? lineOrPosition : lineOrPosition.line;
          if (line === 3) {
            return { text: '## Machine Learning Methods' };
          }
          if (line === 5) {
            return { text: 'Some text C_' };
          }
          return { text: '' };
        })
      };
      
      const result = await provider.provideCompletionItems(
        mockDocument,
        position,
        {} as any,
        {} as any
      );

      expect(result).toBeDefined();
      const items = (result as any).items;
      
      // Should prioritize claims from the detected section
      const c01 = items.find((item: any) => item.label === 'C_01');
      expect(c01.sortText).toMatch(/^0_/);
    });

    it('should fall back to ID sorting when no section context', async () => {
      mockDocument = {
        uri: { fsPath: '/test/workspace/03_Drafting/notes.md' },
        lineAt: jest.fn().mockReturnValue({ text: 'Some text C_' })
      };

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      const items = (result as any).items;
      
      // All claims should have sortText starting with "1" (no section priority)
      items.forEach((item: any) => {
        expect(item.sortText).toMatch(/^1_/);
      });
    });

    it('should handle embedding service errors gracefully', async () => {
      mockState.embeddingService.generateEmbedding = jest.fn().mockRejectedValue(
        new Error('Embedding service unavailable')
      );

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      // Should still return results, just without semantic ranking
      expect(result).toBeDefined();
      expect((result as any).items).toHaveLength(3);
    });
  });

  describe('resolveCompletionItem', () => {
    it('should return the item unchanged', async () => {
      const item = new vscode.CompletionItem('C_01', vscode.CompletionItemKind.Reference);
      
      const result = await provider.resolveCompletionItem(item, {} as any);
      
      expect(result).toBe(item);
    });
  });
});
