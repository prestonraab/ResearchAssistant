import * as vscode from 'vscode';
import { ClaimHoverProvider } from '../ui/claimHoverProvider';
import { ExtensionState } from '../core/state';
import type { Claim } from '@research-assistant/core';

describe('ClaimHoverProvider', () => {
  let hoverProvider: ClaimHoverProvider;
  let mockExtensionState: any;
  let mockDocument: jest.Mocked<vscode.TextDocument>;
  let mockCancellationToken: jest.Mocked<vscode.CancellationToken>;

  beforeEach(() => {
    // Create mock extension state
    mockExtensionState = {
      claimsManager: {
        getClaim: jest.fn(),
      },
    };

    // Create hover provider
    hoverProvider = new ClaimHoverProvider(mockExtensionState);

    // Create mock document
    mockDocument = {
      getText: jest.fn(),
      getWordRangeAtPosition: jest.fn(),
      lineAt: jest.fn(),
      uri: { fsPath: '/test/document.md' },
    } as any;

    // Create mock cancellation token
    mockCancellationToken = {
      isCancellationRequested: false,
      onCancellationRequested: jest.fn(),
    } as any;
  });

  describe('Claim Reference Detection', () => {
    test('should detect valid claim reference pattern C_01', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test claim text',
        category: 'Method',
        primaryQuote: { text: 'This is a test quote', source: 'Smith2023', verified: true },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      expect(mockDocument.getWordRangeAtPosition).toHaveBeenCalledWith(position, /C_\d+/);
      expect(mockExtensionState.claimsManager.getClaim).toHaveBeenCalledWith('C_01');
    });

    test('should detect claim reference C_99', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_99');
      
      const mockClaim: Claim = {
        id: 'C_99',
        text: 'Another test claim',
        category: 'Result',
        primaryQuote: { text: 'Another quote', source: 'Jones2024', verified: false },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      expect(mockExtensionState.claimsManager.getClaim).toHaveBeenCalledWith('C_99');
    });

    test('should return null when no claim reference pattern found', async () => {
      const position = new vscode.Position(0, 5);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(undefined);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).toBeNull();
      expect(mockExtensionState.claimsManager.getClaim).not.toHaveBeenCalled();
    });

    test('should return null when claim not found in database', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_99');
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(null);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).toBeNull();
      expect(mockExtensionState.claimsManager.getClaim).toHaveBeenCalledWith('C_99');
    });
  });

  describe('Hover Content Rendering', () => {
    test('should render claim with all fields', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test claim text',
        category: 'Method',
        primaryQuote: { text: 'This is a test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [
          { text: 'Supporting quote 1', source: 'Smith2023', verified: false },
          { text: 'Supporting quote 2', source: 'Smith2023', verified: false }
        ],
        sections: ['section-1', 'section-2'],
        context: 'Test context',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      expect(hover!.range).toEqual(range);
      
      // Check that hover contents is a MarkdownString
      const contents = hover!.contents[0] as vscode.MarkdownString;
      // Skip instanceof check since it's mocked
      expect(contents).toBeDefined();
      expect(contents.value).toBeDefined();
      
      const markdownText = contents.value;
      
      // Verify content includes key elements
      expect(markdownText).toContain('C_01');
      expect(markdownText).toContain('Test claim text');
      expect(markdownText).toContain('Method');
      expect(markdownText).toContain('Smith2023');
      expect(markdownText).toContain('Source ID: 1');
      expect(markdownText).toContain('✅ Verified');
      expect(markdownText).toContain('This is a test quote');
      expect(markdownText).toContain('Supporting Quotes');
      expect(markdownText).toContain('Test context');
    });

    test('should render claim without optional fields', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_02');
      
      const mockClaim: Claim = {
        id: 'C_02',
        text: 'Minimal claim',
        category: '',
        primaryQuote: { text: '', source: '', verified: false },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).toContain('C_02');
      expect(markdownText).toContain('Minimal claim');
      expect(markdownText).toContain('⚪ Not verified');
    });

    test('should show verification status correctly', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_03');
      
      const verifiedClaim: Claim = {
        id: 'C_03',
        text: 'Verified claim',
        category: 'Result',
        primaryQuote: { text: 'Test quote', source: 'Test2023', sourceId: 1, verified: true },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(verifiedClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain('✅ Verified');
    });

    test('should limit supporting quotes display to first 2', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_04');
      
      const mockClaim: Claim = {
        id: 'C_04',
        text: 'Claim with many quotes',
        category: 'Method',
        primaryQuote: { text: 'Primary quote', source: 'Test2023', sourceId: 1, verified: false },
        supportingQuotes: [
          { text: 'Quote 1', source: 'Test2023', verified: false },
          { text: 'Quote 2', source: 'Test2023', verified: false },
          { text: 'Quote 3', source: 'Test2023', verified: false },
          { text: 'Quote 4', source: 'Test2023', verified: false }
        ],
        sections: [],
        context: '',
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      // The markdown uses ** for bold, not parentheses
      expect(markdownText).toContain('**Supporting Quotes** (4)');
      expect(markdownText).toContain('Quote 1');
      expect(markdownText).toContain('Quote 2');
      expect(markdownText).toContain('...and 2 more');
      expect(markdownText).not.toContain('Quote 3');
      expect(markdownText).not.toContain('Quote 4');
    });
  });

  describe('Quick Action Links', () => {
    test('should include quick action links', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [{ text: 'Quote 1', source: 'Smith2023', verified: false }],
        sections: ['section-1'],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      // Check for command links
      expect(markdownText).toContain('researchAssistant.goToSource');
      expect(markdownText).toContain('researchAssistant.viewAllQuotes');
      expect(markdownText).toContain('researchAssistant.findSimilarClaims');
      expect(markdownText).toContain('researchAssistant.showClaimSections');
      
      // Check for link text
      expect(markdownText).toContain('Go to source');
      expect(markdownText).toContain('View all quotes');
      expect(markdownText).toContain('Find similar claims');
      expect(markdownText).toContain('Show sections');
    });

    test('should not show "View all quotes" link when no supporting quotes', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).not.toContain('View all quotes');
      expect(markdownText).toContain('Find similar claims');
    });

    test('should not show "Show sections" link when no sections', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).not.toContain('Show sections');
    });

    test('should show section count in link when sections exist', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [],
        sections: ['section-1', 'section-2', 'section-3'],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).toContain('Show sections (3)');
    });
  });

  describe('Edge Cases', () => {
    test('should handle claim with very long text', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const longText = 'A'.repeat(1000);
      const mockClaim: Claim = {
        id: 'C_01',
        text: longText,
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain(longText);
    });

    test('should handle claim with special characters in text', async () => {
      const position = new vscode.Position(0, 5);
      const range = new vscode.Range(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim: Claim = {
        id: 'C_01',
        text: 'Test with **bold** and *italic* and `code`',
        category: 'Method',
        primaryQuote: { text: 'Quote with "quotes" and \'apostrophes\'', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [],
        sections: [],
        context: '',
        verified: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain('**bold**');
      expect(contents.value).toContain('*italic*');
      expect(contents.value).toContain('`code`');
    });
  });
});
