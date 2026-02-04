import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { ClaimHoverProvider } from '../ui/claimHoverProvider';
import { ClaimsManager } from '../core/claimsManagerWrapper';
import { setupTest, TEST_CLAIMS, aClaim } from './helpers';
import {
  createMinimalDocument,
  createMinimalPosition,
  createMinimalCancellationToken
} from './helpers/minimalMocks';

describe('ClaimHoverProvider', () => {
  setupTest();

  let hoverProvider: ClaimHoverProvider;
  let claimsManager: ClaimsManager;

  beforeEach(() => {
    // Use real ClaimsManager in in-memory mode
    claimsManager = new ClaimsManager('', { inMemory: true });
    
    // Create provider with real extension state
    hoverProvider = new ClaimHoverProvider({
      claimsManager: claimsManager
    } as any);
  });

  describe('Claim Reference Detection', () => {
    test('should detect valid claim reference pattern C_01', async () => {
      // Create minimal document with claim reference
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim text')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Smith2023')
        .verified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claim);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).not.toBeNull();
    });

    test('should detect claim reference C_99', async () => {
      const document = createMinimalDocument({
        text: 'See C_99 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claim = aClaim()
        .withId('C_99')
        .withText('Another test claim')
        .withCategory('Result')
        .withPrimaryQuote('Another quote', 'Jones2024')
        .unverified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claim);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).not.toBeNull();
    });

    test('should return null when no claim reference pattern found', async () => {
      const document = createMinimalDocument({
        text: 'No claim reference here',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).toBeNull();
    });

    test('should return null when claim not found in database', async () => {
      const document = createMinimalDocument({
        text: 'See C_99 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      // Don't add C_99 to the manager - it won't be found
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).toBeNull();
    });
  });

  describe('Hover Content Rendering', () => {
    test('should render claim with all fields', async () => {
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claim = aClaim()
        .withId('C_01')
        .withText('ComBat uses Empirical Bayes')
        .withCategory('Method')
        .withPrimaryQuote('ComBat quote', 'Johnson2007')
        .verified()
        .withSupportingQuotes([
          { text: 'Supporting quote 1', source: 'Johnson2007', verified: false },
          { text: 'Supporting quote 2', source: 'Johnson2007', verified: false }
        ])
        .withSections(['section-1', 'section-2'])
        .withContext('Test context')
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claim);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).not.toBeNull();
      expect(hover!.range).toBeDefined();
      
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
      const document = createMinimalDocument({
        text: 'See C_02 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const minimalClaim = aClaim()
        .withId('C_02')
        .withText('Minimal claim')
        .unverified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(minimalClaim);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).not.toBeNull();
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).toContain('C_02');
      expect(markdownText).toContain('Minimal claim');
      expect(markdownText).toContain('⚪ Not verified');
    });

    test('should show verification status correctly', async () => {
      const document = createMinimalDocument({
        text: 'See C_03 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const verifiedClaim = aClaim()
        .withId('C_03')
        .withText('Verified claim')
        .withCategory('Result')
        .withPrimaryQuote('Test quote', 'Test2023')
        .verified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(verifiedClaim);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain('✅ Verified');
    });

    test('should limit supporting quotes display to first 2', async () => {
      const document = createMinimalDocument({
        text: 'See C_04 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claimWithManyQuotes = aClaim()
        .withId('C_04')
        .withText('Claim with many quotes')
        .withCategory('Method')
        .withPrimaryQuote('Primary quote', 'Test2023')
        .build();
      
      // Add supporting quotes manually
      claimWithManyQuotes.supportingQuotes = [
        { text: 'Quote 1', source: 'Test2023', verified: false },
        { text: 'Quote 2', source: 'Test2023', verified: false },
        { text: 'Quote 3', source: 'Test2023', verified: false },
        { text: 'Quote 4', source: 'Test2023', verified: false }
      ];
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithManyQuotes);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
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
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claimWithLinks = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Smith2023')
        .verified()
        .build();
      
      // Add supporting quotes and sections
      claimWithLinks.supportingQuotes = [{ text: 'Quote 1', source: 'Smith2023', verified: false }];
      claimWithLinks.sections = ['section-1'];
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithLinks);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
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
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claimWithoutQuotes = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Smith2023')
        .verified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithoutQuotes);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).not.toContain('View all quotes');
      expect(markdownText).toContain('Find similar claims');
    });

    test('should not show "Show sections" link when no sections', async () => {
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claimWithoutSections = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Smith2023')
        .verified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithoutSections);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).not.toContain('Show sections');
    });

    test('should show section count in link when sections exist', async () => {
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claimWithSections = aClaim()
        .withId('C_01')
        .withText('Test claim')
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Smith2023')
        .verified()
        .build();
      
      // Add sections
      claimWithSections.sections = ['section-1', 'section-2', 'section-3'];
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithSections);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      const contents = hover!.contents[0] as vscode.MarkdownString;
      const markdownText = contents.value;
      
      expect(markdownText).toContain('Show sections (3)');
    });
  });

  describe('Edge Cases', () => {
    test('should handle claim with very long text', async () => {
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const longText = 'A'.repeat(1000);
      const claimWithLongText = aClaim()
        .withId('C_01')
        .withText(longText)
        .withCategory('Method')
        .withPrimaryQuote('Test quote', 'Smith2023')
        .verified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithLongText);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).not.toBeNull();
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain(longText);
    });

    test('should handle claim with special characters in text', async () => {
      const document = createMinimalDocument({
        text: 'See C_01 for details',
        languageId: 'markdown'
      });
      
      const position = createMinimalPosition(0, 5);
      const token = createMinimalCancellationToken();
      
      const claimWithSpecialChars = aClaim()
        .withId('C_01')
        .withText('Test with **bold** and *italic* and `code`')
        .withCategory('Method')
        .withPrimaryQuote('Quote with "quotes" and \'apostrophes\'', 'Smith2023')
        .verified()
        .build();
      
      // Add claim to real ClaimsManager
      claimsManager.addClaim(claimWithSpecialChars);
      
      const hover = await hoverProvider.provideHover(document as any, position as any, token as any);
      
      expect(hover).not.toBeNull();
      const contents = hover!.contents[0] as vscode.MarkdownString;
      expect(contents.value).toContain('**bold**');
      expect(contents.value).toContain('*italic*');
      expect(contents.value).toContain('`code`');
    });
  });
});
