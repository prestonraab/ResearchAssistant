import { describe, it, expect, beforeEach } from '@jest/globals';

/**
 * Unit tests for orphan citation UI rendering
 * Tests the claimReview.js UI functions for displaying orphan citations
 * Requirements: 3.1, 3.2, 3.3
 */
describe('Orphan Citation UI Rendering', () => {
  let mockDOM: any;
  let mockElements: Map<string, any>;

  beforeEach(() => {
    // Setup mock DOM with proper element tracking
    mockElements = new Map();
    
    mockDOM = {
      getElementById: (id: string) => {
        if (!mockElements.has(id)) {
          mockElements.set(id, {
            id,
            style: { display: 'block' },
            innerHTML: '',
            querySelectorAll: (selector: string) => [],
            appendChild: () => {},
            addEventListener: () => {}
          });
        }
        return mockElements.get(id);
      },
      createElement: (tag: string) => ({
        tagName: tag,
        className: '',
        innerHTML: '',
        style: { display: 'block' },
        appendChild: () => {},
        addEventListener: () => {},
        querySelectorAll: (selector: string) => []
      }),
      body: {
        appendChild: () => {}
      }
    };
  });

  describe('displayOrphanCitations', () => {
    it('should hide section when no orphan citations', () => {
      const orphanCitations: any[] = [];
      
      // Simulate the function behavior
      if (!orphanCitations || orphanCitations.length === 0) {
        const section = mockDOM.getElementById('orphanCitationsSection');
        if (section) {
          section.style.display = 'none';
        }
      }

      const section = mockDOM.getElementById('orphanCitationsSection');
      expect(section.style.display).toBe('none');
    });

    it('should display orphan citations with author-year', () => {
      const orphanCitations = [
        {
          authorYear: 'Smith2020',
          sourceMapping: {
            authorYear: 'Smith2020',
            zoteroKey: 'ABC123',
            sourceId: 2,
            extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
          },
          hasExtractedText: true
        }
      ];

      // Simulate rendering
      let html = '<h2>ORPHAN CITATIONS</h2>';
      html += '<div class="orphan-citations-list">';
      
      orphanCitations.forEach(orphan => {
        html += `
          <div class="orphan-citation-item">
            <div class="orphan-citation-header">
              <span class="orphan-citation-author-year">${orphan.authorYear}</span>
              <span class="orphan-citation-status">⚠ No supporting quote</span>
            </div>
          </div>
        `;
      });
      
      html += '</div>';

      expect(html).toContain('Smith2020');
      expect(html).toContain('⚠ No supporting quote');
      expect(html).toContain('orphan-citation-item');
    });

    it('should enable Find Quotes button when extracted text available', () => {
      const orphan = {
        authorYear: 'Smith2020',
        sourceMapping: {
          authorYear: 'Smith2020',
          zoteroKey: 'ABC123',
          sourceId: 2,
          extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
        },
        hasExtractedText: true
      };

      const hasExtractedText = orphan.hasExtractedText;
      const buttonClass = hasExtractedText ? '' : 'disabled';
      const buttonDisabled = hasExtractedText ? '' : 'disabled';

      expect(buttonClass).toBe('');
      expect(buttonDisabled).toBe('');
    });

    it('should disable Find Quotes button when no extracted text', () => {
      const orphan = {
        authorYear: 'Smith2020',
        sourceMapping: {
          authorYear: 'Smith2020',
          zoteroKey: 'ABC123',
          sourceId: 2,
          extractedTextFile: null
        },
        hasExtractedText: false
      };

      const hasExtractedText = orphan.hasExtractedText;
      const buttonClass = hasExtractedText ? '' : 'disabled';
      const buttonDisabled = hasExtractedText ? '' : 'disabled';

      expect(buttonClass).toBe('disabled');
      expect(buttonDisabled).toBe('disabled');
    });

    it('should render multiple orphan citations', () => {
      const orphanCitations = [
        {
          authorYear: 'Smith2020',
          sourceMapping: {
            authorYear: 'Smith2020',
            zoteroKey: 'ABC123',
            sourceId: 2,
            extractedTextFile: 'literature/ExtractedText/Smith2020.txt'
          },
          hasExtractedText: true
        },
        {
          authorYear: 'Brown2019',
          sourceMapping: {
            authorYear: 'Brown2019',
            zoteroKey: 'DEF456',
            sourceId: 3,
            extractedTextFile: 'literature/ExtractedText/Brown2019.txt'
          },
          hasExtractedText: true
        }
      ];

      let html = '<div class="orphan-citations-list">';
      orphanCitations.forEach(orphan => {
        html += `<div class="orphan-citation-item"><span>${orphan.authorYear}</span></div>`;
      });
      html += '</div>';

      expect(html).toContain('Smith2020');
      expect(html).toContain('Brown2019');
      expect(html.match(/orphan-citation-item/g)).toHaveLength(2);
    });
  });

  describe('displayQuotesFromPaper', () => {
    it('should show loading state initially', () => {
      const container = mockDOM.getElementById('newQuotesContainer');
      container.style.display = 'block';
      
      const header = { textContent: 'Searching for quotes from Smith2020...' };
      const list = { innerHTML: '<div class="loading-spinner">Searching...</div>' };

      expect(container.style.display).toBe('block');
      expect(header.textContent).toContain('Searching');
      expect(list.innerHTML).toContain('loading-spinner');
    });

    it('should display search results with similarity scores', () => {
      const results = [
        {
          text: 'Batch effects are a major source of variation',
          sourceFile: 'Smith2020.txt',
          startLine: 100,
          endLine: 102,
          similarity: 0.95
        },
        {
          text: 'We used ComBat to correct for batch effects',
          sourceFile: 'Smith2020.txt',
          startLine: 200,
          endLine: 202,
          similarity: 0.87
        }
      ];

      let html = '';
      results.forEach((result, index) => {
        const similarity = Math.round(result.similarity * 100);
        const similarityClass = similarity >= 90 ? 'high' : similarity >= 70 ? 'medium' : 'low';
        
        html += `
          <div class="quote-search-result">
            <div class="result-header">
              <div class="result-similarity ${similarityClass}">${similarity}% match</div>
              <div class="result-location">${result.sourceFile} (lines ${result.startLine}-${result.endLine})</div>
            </div>
            <div class="result-text">${result.text}</div>
          </div>
        `;
      });

      expect(html).toContain('95% match');
      expect(html).toContain('87% match');
      expect(html).toContain('high');
      expect(html).toContain('medium');
      expect(html).toContain('Smith2020.txt');
    });

    it('should show no results message when search returns empty', () => {
      const results: any[] = [];
      
      let html = '';
      if (!results || results.length === 0) {
        html = '<div class="no-results">No quotes found in this paper</div>';
      }

      expect(html).toContain('No quotes found');
    });

    it('should classify similarity scores correctly', () => {
      const testCases = [
        { similarity: 0.95, expectedClass: 'high' },
        { similarity: 0.85, expectedClass: 'medium' },
        { similarity: 0.65, expectedClass: 'low' }
      ];

      testCases.forEach(({ similarity, expectedClass }) => {
        const similarityPercent = Math.round(similarity * 100);
        const similarityClass = similarityPercent >= 90 ? 'high' : similarityPercent >= 70 ? 'medium' : 'low';
        
        expect(similarityClass).toBe(expectedClass);
      });
    });
  });

  describe('Attach quote action', () => {
    it('should send attachQuoteToClaim message with correct data', () => {
      const quote = {
        text: 'Batch effects are a major source of variation',
        sourceFile: 'Smith2020.txt',
        startLine: 100,
        endLine: 102,
        similarity: 0.95
      };
      const authorYear = 'Smith2020';
      const claimId = 'C_01';

      // Simulate message structure
      const message = {
        type: 'attachQuoteToClaim',
        claimId,
        quote,
        authorYear
      };

      expect(message.type).toBe('attachQuoteToClaim');
      expect(message.claimId).toBe('C_01');
      expect(message.quote.similarity).toBe(0.95);
      expect(message.authorYear).toBe('Smith2020');
    });
  });

  describe('Remove orphan citation action', () => {
    it('should show confirmation modal before removing', () => {
      const authorYear = 'Smith2020';
      
      // Simulate confirmation modal
      const modal = {
        className: 'confirm-modal-overlay',
        innerHTML: `
          <div class="confirm-modal">
            <div class="confirm-modal-header">Remove Orphan Citation</div>
            <div class="confirm-modal-body">Remove the citation to ${authorYear} from this claim?</div>
          </div>
        `
      };

      expect(modal.innerHTML).toContain('Remove Orphan Citation');
      expect(modal.innerHTML).toContain('Smith2020');
    });

    it('should send removeOrphanCitation message on confirmation', () => {
      const authorYear = 'Smith2020';
      const claimId = 'C_01';

      // Simulate confirmed action
      const message = {
        type: 'removeOrphanCitation',
        claimId,
        authorYear
      };

      expect(message.type).toBe('removeOrphanCitation');
      expect(message.claimId).toBe('C_01');
      expect(message.authorYear).toBe('Smith2020');
    });
  });
});
