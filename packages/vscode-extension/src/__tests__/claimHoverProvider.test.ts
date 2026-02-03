import * as vscode from 'vscode';
import { ClaimHoverProvider } from '../ui/claimHoverProvider';
import {
  createMockExtensionState,
  createMockDocument,
  createMockCancellationToken,
  createMockPosition,
  createMockRange,
  createMockClaim,
  setupTest,
  setupWordAtPosition,
  TEST_CLAIMS,
  aClaim
} from './helpers';

describe('ClaimHoverProvider', () => {
  setupTest();

  let hoverProvider: ClaimHoverProvider;
  let mockExtensionState: any;
  let mockDocument: any;
  let mockCancellationToken: any;

  beforeEach(() => {
    mockExtensionState = createMockExtensionState();
    hoverProvider = new ClaimHoverProvider(mockExtensionState);
    mockDocument = createMockDocument();
    mockCancellationToken = createMockCancellationToken();
  });

  describe('Claim Reference Detection', () => {
    test('should detect valid claim reference pattern C_01', async () => {
      const position = createMockPosition(0, 5);
      const { range } = setupWordAtPosition(mockDocument, 'C_01', 0, 3);
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim text')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Smith2023')
        .verified()
        .build();
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      expect(mockDocument.getWordRangeAtPosition).toHaveBeenCalledWith(position, /C_\d+/);
      expect(mockExtensionState.claimsManager.getClaim).toHaveBeenCalledWith('C_01');
    });

    test('should detect claim reference C_99', async () => {
      const position = createMockPosition(0, 5);
      setupWordAtPosition(mockDocument, 'C_99', 0, 3);
      
      const claim = aClaim()
        .withId('C_99')
        .withText('Another test claim')
        .withCategory('Result')
        .withPrimaryQuote('Another quote', 'Jones2024')
        .unverified()
        .build();
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      expect(mockExtensionState.claimsManager.getClaim).toHaveBeenCalledWith('C_99');
    });

    test('should return null when no claim reference pattern found', async () => {
      const position = createMockPosition(0, 5);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(undefined);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).toBeNull();
      expect(mockExtensionState.claimsManager.getClaim).not.toHaveBeenCalled();
    });

    test('should return null when claim not found in database', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
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
      const position = createMockPosition(0, 5);
      const { range } = setupWordAtPosition(mockDocument, 'C_01', 0, 3);
      
      // Use fixture with modifications
      const claim = {
        ...TEST_CLAIMS.method,
        supportingQuotes: ['Supporting quote 1', 'Supporting quote 2'],
        sections: ['section-1', 'section-2'],
        context: 'Test context'
      };
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(claim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      expect(hover!.range).toEqual(range);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents).toBeDefined();
      expect(contents.value).toBeDefined();
      
      const markdownText = contents.value;
      
      expect(markdownText).toContain('C_01');
      expect(markdownText).toContain('ComBat uses Empirical Bayes');
      expect(markdownText).toContain('Method');
      expect(markdownText).toContain('Johnson2007');
      expect(markdownText).toContain('✅ Verified');
      expect(markdownText).toContain('Supporting Quotes');
      expect(markdownText).toContain('Test context');
    });

    test('should render claim without optional fields', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_02');
      
      const mockClaim = createMockClaim({
        id: 'C_02',
        text: 'Minimal claim',
        category: '',
        primaryQuote: { text: '', source: '', verified: false },
        context: '',
        verified: false
      });
      
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
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_03');
      
      const verifiedClaim = createMockClaim({
        id: 'C_03',
        text: 'Verified claim',
        category: 'Result',
        primaryQuote: { text: 'Test quote', source: 'Test2023', sourceId: 1, verified: true },
        verified: true
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(verifiedClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain('✅ Verified');
    });

    test('should limit supporting quotes display to first 2', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_04');
      
      const mockClaim = createMockClaim({
        id: 'C_04',
        text: 'Claim with many quotes',
        category: 'Method',
        primaryQuote: { text: 'Primary quote', source: 'Test2023', sourceId: 1, verified: false },
        supportingQuotes: [
          { text: 'Quote 1', source: 'Test2023', verified: false },
          { text: 'Quote 2', source: 'Test2023', verified: false },
          { text: 'Quote 3', source: 'Test2023', verified: false },
          { text: 'Quote 4', source: 'Test2023', verified: false }
        ]
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
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
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        supportingQuotes: [{ text: 'Quote 1', source: 'Smith2023', verified: false }],
        sections: ['section-1'],
        verified: true
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).toContain('researchAssistant.goToSource');
      expect(markdownText).toContain('researchAssistant.viewAllQuotes');
      expect(markdownText).toContain('researchAssistant.findSimilarClaims');
      expect(markdownText).toContain('researchAssistant.showClaimSections');
      
      expect(markdownText).toContain('Go to source');
      expect(markdownText).toContain('View all quotes');
      expect(markdownText).toContain('Find similar claims');
      expect(markdownText).toContain('Show sections');
    });

    test('should not show "View all quotes" link when no supporting quotes', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        verified: true
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).not.toContain('View all quotes');
      expect(markdownText).toContain('Find similar claims');
    });

    test('should not show "Show sections" link when no sections', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        verified: true
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).not.toContain('Show sections');
    });

    test('should show section count in link when sections exist', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim = createMockClaim({
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        sections: ['section-1', 'section-2', 'section-3'],
        verified: true
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).toContain('Show sections (3)');
    });
  });

  describe('Edge Cases', () => {
    test('should handle claim with very long text', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const longText = 'A'.repeat(1000);
      const mockClaim = createMockClaim({
        id: 'C_01',
        text: longText,
        category: 'Method',
        primaryQuote: { text: 'Test quote', source: 'Smith2023', sourceId: 1, verified: true },
        verified: true
      });
      
      mockExtensionState.claimsManager.getClaim.mockReturnValue(mockClaim);
      
      const hover = await hoverProvider.provideHover(mockDocument, position, mockCancellationToken);
      
      expect(hover).not.toBeNull();
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain(longText);
    });

    test('should handle claim with special characters in text', async () => {
      const position = createMockPosition(0, 5);
      const range = createMockRange(0, 3, 0, 7);
      
      mockDocument.getWordRangeAtPosition.mockReturnValue(range);
      mockDocument.getText.mockReturnValue('C_01');
      
      const mockClaim = createMockClaim({
        id: 'C_01',
        text: 'Test with **bold** and *italic* and `code`',
        category: 'Method',
        primaryQuote: { text: 'Quote with "quotes" and \'apostrophes\'', source: 'Smith2023', sourceId: 1, verified: true },
        verified: true
      });
      
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
