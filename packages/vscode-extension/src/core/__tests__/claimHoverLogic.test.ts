import { renderClaimHover, extractClaimId } from '../claimHoverLogic';
import { aClaim } from '../../__tests__/helpers';

describe('claimHoverLogic', () => {
  describe('extractClaimId', () => {
    test('should extract claim ID at position', () => {
      const text = 'This is C_01 in text';
      const position = 10; // Inside C_01
      
      expect(extractClaimId(text, position)).toBe('C_01');
    });

    test('should extract claim ID at start of pattern', () => {
      const text = 'C_99 is at start';
      const position = 0;
      
      expect(extractClaimId(text, position)).toBe('C_99');
    });

    test('should extract claim ID at end of pattern', () => {
      const text = 'End with C_42';
      const position = 12; // Last char of C_42
      
      expect(extractClaimId(text, position)).toBe('C_42');
    });

    test('should return null when position is outside claim ID', () => {
      const text = 'This is C_01 in text';
      const position = 0; // Before C_01
      
      expect(extractClaimId(text, position)).toBeNull();
    });

    test('should return null when no claim ID in text', () => {
      const text = 'No claim here';
      const position = 5;
      
      expect(extractClaimId(text, position)).toBeNull();
    });

    test('should extract correct ID when multiple IDs present', () => {
      const text = 'C_01 and C_02 and C_03';
      const position = 13; // Inside C_02
      
      expect(extractClaimId(text, position)).toBe('C_02');
    });
  });

  describe('renderClaimHover', () => {
    test('should render claim with all fields', () => {
      const claim = aClaim()
        .withId('C_01')
        .withText('Test claim text')
        .withCategory('Method')
        .withPrimaryQuote('This is a test quote', 'Smith2023')
        .withContext('Test context')
        .verified()
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('### C_01: Test claim text');
      expect(result).toContain('**Category**: Method');
      expect(result).toContain('**Source**: Smith2023');
      expect(result).toContain('✅ Verified');
      expect(result).toContain('**Primary Quote**:');
      expect(result).toContain('> "This is a test quote"');
      expect(result).toContain('*Context: Test context*');
    });

    test('should render unverified claim', () => {
      const claim = aClaim()
        .withId('C_02')
        .withText('Unverified claim')
        .unverified()
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('⚪ Not verified');
      expect(result).not.toContain('✅ Verified');
    });

    test('should render claim without optional fields', () => {
      const claim = aClaim()
        .withId('C_03')
        .withText('Minimal claim')
        .withCategory('') // Clear default category
        .build();
      
      // Clear optional fields
      claim.primaryQuote = { text: '', source: '', verified: false };
      claim.context = '';
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('### C_03: Minimal claim');
      expect(result).not.toContain('**Primary Quote**:');
      expect(result).not.toContain('*Context:');
    });

    test('should show supporting quotes count and first 2', () => {
      const claim = aClaim()
        .withId('C_04')
        .withText('Claim with quotes')
        .withSupportingQuotes([
          { text: 'Quote 1', source: 'Source1', verified: false },
          { text: 'Quote 2', source: 'Source2', verified: false },
          { text: 'Quote 3', source: 'Source3', verified: false },
          { text: 'Quote 4', source: 'Source4', verified: false }
        ])
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('**Supporting Quotes** (4)');
      expect(result).toContain('- "Quote 1"');
      expect(result).toContain('- "Quote 2"');
      expect(result).toContain('*...and 2 more*');
      expect(result).not.toContain('Quote 3');
      expect(result).not.toContain('Quote 4');
    });

    test('should include go to source link when source exists', () => {
      const claim = aClaim()
        .withId('C_05')
        .withText('Claim with source')
        .withPrimaryQuote('Quote text', 'Smith2023')
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('📄 Go to source');
      expect(result).toContain('researchAssistant.goToSource');
      expect(result).toContain('Smith2023');
    });

    test('should include view all quotes link when supporting quotes exist', () => {
      const claim = aClaim()
        .withId('C_06')
        .withText('Claim with supporting quotes')
        .withSupportingQuotes([
          { text: 'Quote 1', source: 'Source1', verified: false }
        ])
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('📋 View all quotes');
      expect(result).toContain('researchAssistant.viewAllQuotes');
    });

    test('should not include view all quotes link when no supporting quotes', () => {
      const claim = aClaim()
        .withId('C_07')
        .withText('Claim without supporting quotes')
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).not.toContain('📋 View all quotes');
    });

    test('should include find similar claims link', () => {
      const claim = aClaim()
        .withId('C_08')
        .withText('Any claim')
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('🔍 Find similar claims');
      expect(result).toContain('researchAssistant.findSimilarClaims');
    });

    test('should include show sections link when sections exist', () => {
      const claim = aClaim()
        .withId('C_09')
        .withText('Claim with sections')
        .withSections(['section-1', 'section-2', 'section-3'])
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('📑 Show sections (3)');
      expect(result).toContain('researchAssistant.showClaimSections');
    });

    test('should not include show sections link when no sections', () => {
      const claim = aClaim()
        .withId('C_10')
        .withText('Claim without sections')
        .build();
      
      const result = renderClaimHover(claim);
      
      expect(result).not.toContain('📑 Show sections');
    });

    test('should handle claim with source ID', () => {
      const claim = aClaim()
        .withId('C_11')
        .withText('Claim with source ID')
        .build();
      
      claim.primaryQuote = {
        text: 'Quote',
        source: 'Smith2023',
        sourceId: 42,
        verified: true
      };
      
      const result = renderClaimHover(claim);
      
      expect(result).toContain('**Source**: Smith2023 (Source ID: 42)');
    });
  });
});
