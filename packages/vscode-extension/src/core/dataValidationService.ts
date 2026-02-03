/**
 * DataValidationService - Validates data structures before passing between modes
 * Ensures data integrity and prevents undefined/null propagation
 */

interface ClaimLike {
  id?: unknown;
  text?: unknown;
  [key: string]: unknown;
}

interface SentenceLike {
  id?: unknown;
  text?: unknown;
  claims?: unknown;
  [key: string]: unknown;
}

interface QAPairLike {
  id?: unknown;
  question?: unknown;
  answer?: unknown;
  [key: string]: unknown;
}

interface WebviewMessageLike {
  type?: unknown;
  [key: string]: unknown;
}

export class DataValidationService {
  /**
   * Validate claim object
   */
  static validateClaim(claim: unknown): claim is ClaimLike {
    if (!claim || typeof claim !== 'object') {
      console.warn('[DataValidation] Claim is not an object:', claim);
      return false;
    }

    const claimObj = claim as Record<string, unknown>;

    if (!claimObj.id || typeof claimObj.id !== 'string') {
      console.warn('[DataValidation] Claim missing or invalid id:', claimObj.id);
      return false;
    }

    if (!claimObj.text || typeof claimObj.text !== 'string') {
      console.warn('[DataValidation] Claim missing or invalid text:', claimObj.text);
      return false;
    }

    return true;
  }

  /**
   * Validate sentence object
   */
  static validateSentence(sentence: unknown): sentence is SentenceLike {
    if (!sentence || typeof sentence !== 'object') {
      console.warn('[DataValidation] Sentence is not an object:', sentence);
      return false;
    }

    const sentenceObj = sentence as Record<string, unknown>;

    if (!sentenceObj.id || typeof sentenceObj.id !== 'string') {
      console.warn('[DataValidation] Sentence missing or invalid id:', sentenceObj.id);
      return false;
    }

    if (!sentenceObj.text || typeof sentenceObj.text !== 'string') {
      console.warn('[DataValidation] Sentence missing or invalid text:', sentenceObj.text);
      return false;
    }

    if (!Array.isArray(sentenceObj.claims)) {
      console.warn('[DataValidation] Sentence claims is not an array:', sentenceObj.claims);
      return false;
    }

    return true;
  }

  /**
   * Validate sentences array
   */
  static validateSentencesArray(sentences: unknown): sentences is SentenceLike[] {
    if (!Array.isArray(sentences)) {
      console.warn('[DataValidation] Sentences is not an array:', sentences);
      return false;
    }

    if (sentences.length === 0) {
      console.warn('[DataValidation] Sentences array is empty');
      return false;
    }

    for (let i = 0; i < sentences.length; i++) {
      if (!this.validateSentence(sentences[i])) {
        console.warn(`[DataValidation] Invalid sentence at index ${i}:`, sentences[i]);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate Q&A pair object
   */
  static validateQAPair(pair: unknown): pair is QAPairLike {
    if (!pair || typeof pair !== 'object') {
      console.warn('[DataValidation] Q&A pair is not an object:', pair);
      return false;
    }

    const pairObj = pair as Record<string, unknown>;

    if (!pairObj.id || typeof pairObj.id !== 'string') {
      console.warn('[DataValidation] Q&A pair missing or invalid id:', pairObj.id);
      return false;
    }

    if (!pairObj.question || typeof pairObj.question !== 'string') {
      console.warn('[DataValidation] Q&A pair missing or invalid question:', pairObj.question);
      return false;
    }

    // Answer can be empty (user might still be drafting)
    if (typeof pairObj.answer !== 'string') {
      console.warn('[DataValidation] Q&A pair answer is not a string:', pairObj.answer);
      return false;
    }

    return true;
  }

  /**
   * Validate Q&A pairs array
   */
  static validateQAPairsArray(pairs: unknown): pairs is QAPairLike[] {
    if (!Array.isArray(pairs)) {
      console.warn('[DataValidation] Q&A pairs is not an array:', pairs);
      return false;
    }

    if (pairs.length === 0) {
      console.warn('[DataValidation] Q&A pairs array is empty');
      return false;
    }

    for (let i = 0; i < pairs.length; i++) {
      if (!this.validateQAPair(pairs[i])) {
        console.warn(`[DataValidation] Invalid Q&A pair at index ${i}:`, pairs[i]);
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize claim for webview transmission
   * Preserves full quote objects with metadata instead of flattening to strings
   */
  static sanitizeClaimForWebview(claim: unknown): ClaimLike | null {
    if (!this.validateClaim(claim)) {
      return null;
    }

    const claimObj = claim as Record<string, unknown>;
    const primaryQuote = claimObj.primaryQuote as Record<string, unknown> | undefined;
    const supportingQuotes = claimObj.supportingQuotes as unknown[] | undefined;

    return {
      id: claimObj.id || '',
      text: claimObj.text || '',
      category: claimObj.category || 'Uncategorized',
      source: primaryQuote?.source || 'Unknown',
      primaryQuote: primaryQuote ? {
        text: primaryQuote.text || '',
        source: primaryQuote.source || '',
        verified: primaryQuote.verified ?? false,
        confidence: primaryQuote.confidence,
        sourceId: primaryQuote.sourceId,
        pageNumber: primaryQuote.pageNumber
      } : null,
      supportingQuotes: Array.isArray(supportingQuotes) 
        ? supportingQuotes.map((q: unknown) => {
            const quoteObj = q as Record<string, unknown>;
            return {
              text: quoteObj.text || q,
              source: quoteObj.source || '',
              verified: quoteObj.verified ?? false,
              confidence: quoteObj.confidence,
              sourceId: quoteObj.sourceId,
              pageNumber: quoteObj.pageNumber
            };
          })
        : [],
      verified: claimObj.verified ?? false,
      context: claimObj.context || ''
    };
  }

  /**
   * Sanitize sentence for webview transmission
   */
  static sanitizeSentenceForWebview(sentence: unknown): SentenceLike | null {
    if (!this.validateSentence(sentence)) {
      return null;
    }

    const sentenceObj = sentence as Record<string, unknown>;
    const claims = sentenceObj.claims as unknown[] | undefined;

    return {
      id: sentenceObj.id || '',
      text: sentenceObj.text || '',
      originalText: sentenceObj.originalText || sentenceObj.text || '',
      position: sentenceObj.position ?? 0,
      outlineSection: sentenceObj.outlineSection || '',
      claims: Array.isArray(claims) ? claims : [],
      claimCount: Array.isArray(claims) ? claims.length : 0
    };
  }

  /**
   * Sanitize sentences array for webview transmission
   */
  static sanitizeSentencesForWebview(sentences: unknown): SentenceLike[] {
    if (!Array.isArray(sentences)) {
      console.warn('[DataValidation] Cannot sanitize non-array sentences');
      return [];
    }

    return sentences
      .map(s => this.sanitizeSentenceForWebview(s))
      .filter((s): s is SentenceLike => s !== null);
  }

  /**
   * Sanitize Q&A pair for webview transmission
   */
  static sanitizeQAPairForWebview(pair: unknown): QAPairLike | null {
    if (!this.validateQAPair(pair)) {
      return null;
    }

    const pairObj = pair as Record<string, unknown>;
    const linkedSources = pairObj.linkedSources as unknown[] | undefined;
    const pairClaims = pairObj.claims as unknown[] | undefined;

    return {
      id: pairObj.id || '',
      question: pairObj.question || '',
      answer: pairObj.answer || '',
      section: pairObj.section || '',
      linkedSources: Array.isArray(linkedSources) ? linkedSources : [],
      claims: Array.isArray(pairClaims) ? pairClaims : []
    };
  }

  /**
   * Sanitize Q&A pairs array for webview transmission
   */
  static sanitizeQAPairsForWebview(pairs: unknown): QAPairLike[] {
    if (!Array.isArray(pairs)) {
      console.warn('[DataValidation] Cannot sanitize non-array Q&A pairs');
      return [];
    }

    return pairs
      .map(p => this.sanitizeQAPairForWebview(p))
      .filter((p): p is QAPairLike => p !== null);
  }

  /**
   * Validate webview message
   */
  static validateWebviewMessage(message: unknown): message is WebviewMessageLike {
    if (!message || typeof message !== 'object') {
      console.warn('[DataValidation] Message is not an object:', message);
      return false;
    }

    const msgObj = message as Record<string, unknown>;
    if (!msgObj.type || typeof msgObj.type !== 'string') {
      console.warn('[DataValidation] Message missing or invalid type:', msgObj.type);
      return false;
    }

    return true;
  }
}
