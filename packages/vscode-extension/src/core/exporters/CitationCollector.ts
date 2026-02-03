import type { CitedQuote } from '../exportService';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';

/**
 * Handles citation collection and bibliography building
 */
export class CitationCollector {
  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager
  ) {}

  /**
   * Collect all marked citations for a sentence
   */
  public async collectCitationsForSentence(sentenceId: string): Promise<CitedQuote[]> {
    if (!this.sentenceClaimQuoteLinkManager || !this.claimsManager) {
      return [];
    }

    const citations = this.sentenceClaimQuoteLinkManager.getCitationsForSentence(sentenceId);
    const citedQuotes: CitedQuote[] = [];

    for (const citation of citations) {
      const claim = this.claimsManager.getClaim(citation.claimId);
      if (!claim) {
        continue;
      }

      // Get the quote text based on quote index
      let quoteText = '';
      if (citation.quoteIndex === 0) {
        quoteText = claim.primaryQuote?.text || '';
      } else if (citation.quoteIndex - 1 < claim.supportingQuotes.length) {
        quoteText = claim.supportingQuotes[citation.quoteIndex - 1]?.text || '';
      }

      if (quoteText) {
        citedQuotes.push({
          quoteText,
          source: claim.primaryQuote?.source || 'Unknown',
          year: this.extractYear(claim.primaryQuote?.source || ''),
          claimId: claim.id,
          sentenceId,
          quoteIndex: citation.quoteIndex
        });
      }
    }

    return citedQuotes;
  }

  /**
   * Build bibliography entries from citations
   * Collects unique sources and formats them as BibliographyEntry objects
   */
  public buildBibliographyFromCitations(citations: CitedQuote[]) {
    const sourceMap = new Map<string, CitedQuote>();

    // Collect unique sources (keyed by source name)
    for (const citation of citations) {
      const key = citation.source;
      if (!sourceMap.has(key)) {
        sourceMap.set(key, citation);
      }
    }

    // Convert to BibliographyEntry array and sort
    const entries = Array.from(sourceMap.values())
      .map(citation => ({
        source: citation.source,
        year: citation.year
      }))
      .sort((a, b) => a.source.localeCompare(b.source));

    return entries;
  }

  /**
   * Extract year from source string (e.g., "Smith2020" -> "2020")
   */
  private extractYear(source: string): string | undefined {
    const match = source.match(/(\d{4})/);
    return match ? match[1] : undefined;
  }
}
