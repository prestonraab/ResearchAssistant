import * as vscode from 'vscode';
import { ClaimCompletionProvider } from '../ui/claimCompletionProvider';
import { ExtensionState } from '../core/state';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import type { Claim, OutlineSection } from '@research-assistant/core';
import { OutlineParser } from '../core/outlineParserWrapper';
import { setupTest, aClaim, aZoteroItem, createMockEmbeddingService } from './helpers';

// Type definitions for mocks
type MockClaimsManager = {
  getClaims: jest.Mock;
  getClaim: jest.Mock;
  loadClaims: jest.Mock;
};

type MockOutlineParser = {
  parse: jest.Mock;
};

type MockExtensionState = {
  claimsManager: MockClaimsManager;
  outlineParser: MockOutlineParser;
  embeddingService: ReturnType<typeof createMockEmbeddingService>;
  getAbsolutePath: jest.Mock;
  getConfig: jest.Mock;
};

describe('ClaimCompletionProvider', () => {
  setupTest();

  let provider: ClaimCompletionProvider;
  let mockState: MockExtensionState;
  let mockClaimsManager: MockClaimsManager;
  let mockOutlineParser: MockOutlineParser;
  let mockDocument: vscode.TextDocument;
  let mockPosition: vscode.Position;

  const mockClaims: Claim[] = [
    aClaim()
      .withId('C_01')
      .withText('Machine learning improves accuracy')
      .withCategory('Result')
      .withContext('Study on ML algorithms')
      .withPrimaryQuote('ML algorithms showed 95% accuracy', 'Smith2020')
      .verified()
      .build(),
    aClaim()
      .withId('C_02')
      .withText('Data preprocessing is essential')
      .withCategory('Method')
      .withContext('Best practices for data preparation')
      .withPrimaryQuote('Preprocessing significantly impacts model performance', 'Jones2021')
      .build(),
    aClaim()
      .withId('C_03')
      .withText('Neural networks require large datasets')
      .withCategory('Challenge')
      .withContext('Limitations of deep learning')
      .withPrimaryQuote('Deep learning models need thousands of examples', 'Brown2019')
      .verified()
      .build()
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
    // Create mock claims manager with typed methods
    mockClaimsManager = {
      getClaims: jest.fn<() => Claim[]>().mockReturnValue(mockClaims),
      getClaim: jest.fn<(id: string) => Claim | null>((id: string) => mockClaims.find(c => c.id === id) || null),
      loadClaims: jest.fn<() => Promise<Claim[]>>().mockResolvedValue(mockClaims)
    };

    // Create mock outline parser
    mockOutlineParser = {
      parse: jest.fn<() => Promise<OutlineSection[]>>().mockResolvedValue(mockSections)
    };

    // Create mock extension state using factory for embedding service
    const mockEmbeddingService = createMockEmbeddingService();
    mockState = {
      claimsManager: mockClaimsManager,
      outlineParser: mockOutlineParser,
      embeddingService: mockEmbeddingService,
      getAbsolutePath: jest.fn<(path: string) => string>((path: string) => `/test/workspace/${path}`),
      getConfig: jest.fn().mockReturnValue({
        outlinePath: '03_Drafting/outline.md'
      })
    };

    provider = new ClaimCompletionProvider(mockState as any);

    // Create mock document with proper typing
    mockDocument = {
      uri: { fsPath: '/test/workspace/03_Drafting/manuscript.md' },
      lineAt: jest.fn().mockReturnValue({ text: 'Some text C_' })
    } as unknown as vscode.TextDocument;

    mockPosition = new vscode.Position(5, 12);
  });

  describe('provideCompletionItems', () => {
    test('should return undefined if line does not end with "C_"', async () => {
      mockDocument.lineAt = jest.fn().mockReturnValue({ text: 'Some text' });

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });

    test('should return undefined if no claims exist', async () => {
      mockClaimsManager.getClaims.mockReturnValue([]);

      const result = await provider.provideCompletionItems(
        mockDocument,
        mockPosition,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });

    test('should return completion items for all claims', async () => {
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

    test('should set correct details for completion items', async () => {
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

    test('should prioritize claims from current section', async () => {
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

    test('should include claim preview in documentation', async () => {
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

    test('should truncate long quotes in preview', async () => {
      const longQuoteClaim: Claim = {
        ...mockClaims[0],
        id: 'C_04',
        primaryQuote: { text: 'A'.repeat(200), source: 'Test2024', verified: false }
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

    test('should set insert text to claim ID', async () => {
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

    test('should include command for inserting full claim text', async () => {
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

    test('should handle section detection from non-outline files', async () => {
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

    test('should fall back to ID sorting when no section context', async () => {
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

    test('should handle embedding service errors gracefully', async () => {
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
    test('should return the item unchanged', async () => {
      const item = new vscode.CompletionItem('C_01', vscode.CompletionItemKind.Reference);
      
      const result = await provider.resolveCompletionItem(item, {} as any);
      
      expect(result).toBe(item);
    });
  });
});
