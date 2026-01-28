/**
 * DataValidationService - Validates data structures before passing between modes
 * Ensures data integrity and prevents undefined/null propagation
 */
export class DataValidationService {
  /**
   * Validate claim object
   */
  static validateClaim(claim: any): boolean {
    if (!claim || typeof claim !== 'object') {
      console.warn('[DataValidation] Claim is not an object:', claim);
      return false;
    }

    if (!claim.id || typeof claim.id !== 'string') {
      console.warn('[DataValidation] Claim missing or invalid id:', claim.id);
      return false;
    }

    if (!claim.text || typeof claim.text !== 'string') {
      console.warn('[DataValidation] Claim missing or invalid text:', claim.text);
      return false;
    }

    return true;
  }

  /**
   * Validate sentence object
   */
  static validateSentence(sentence: any): boolean {
    if (!sentence || typeof sentence !== 'object') {
      console.warn('[DataValidation] Sentence is not an object:', sentence);
      return false;
    }

    if (!sentence.id || typeof sentence.id !== 'string') {
      console.warn('[DataValidation] Sentence missing or invalid id:', sentence.id);
      return false;
    }

    if (!sentence.text || typeof sentence.text !== 'string') {
      console.warn('[DataValidation] Sentence missing or invalid text:', sentence.text);
      return false;
    }

    if (!Array.isArray(sentence.claims)) {
      console.warn('[DataValidation] Sentence claims is not an array:', sentence.claims);
      return false;
    }

    return true;
  }

  /**
   * Validate sentences array
   */
  static validateSentencesArray(sentences: any): boolean {
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
  static validateQAPair(pair: any): boolean {
    if (!pair || typeof pair !== 'object') {
      console.warn('[DataValidation] Q&A pair is not an object:', pair);
      return false;
    }

    if (!pair.id || typeof pair.id !== 'string') {
      console.warn('[DataValidation] Q&A pair missing or invalid id:', pair.id);
      return false;
    }

    if (!pair.question || typeof pair.question !== 'string') {
      console.warn('[DataValidation] Q&A pair missing or invalid question:', pair.question);
      return false;
    }

    // Answer can be empty (user might still be drafting)
    if (typeof pair.answer !== 'string') {
      console.warn('[DataValidation] Q&A pair answer is not a string:', pair.answer);
      return false;
    }

    return true;
  }

  /**
   * Validate Q&A pairs array
   */
  static validateQAPairsArray(pairs: any): boolean {
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
  static sanitizeClaimForWebview(claim: any): any {
    if (!this.validateClaim(claim)) {
      return null;
    }

    return {
      id: claim.id || '',
      text: claim.text || '',
      category: claim.category || 'Uncategorized',
      source: claim.primaryQuote?.source || 'Unknown',
      primaryQuote: claim.primaryQuote ? {
        text: claim.primaryQuote.text || '',
        source: claim.primaryQuote.source || '',
        verified: claim.primaryQuote.verified ?? false,
        confidence: claim.primaryQuote.confidence,
        sourceId: claim.primaryQuote.sourceId,
        pageNumber: claim.primaryQuote.pageNumber
      } : null,
      supportingQuotes: Array.isArray(claim.supportingQuotes) 
        ? claim.supportingQuotes.map((q: any) => ({
            text: q.text || q,
            source: q.source || '',
            verified: q.verified ?? false,
            confidence: q.confidence,
            sourceId: q.sourceId,
            pageNumber: q.pageNumber
          }))
        : [],
      verified: claim.verified ?? false,
      context: claim.context || ''
    };
  }

  /**
   * Sanitize sentence for webview transmission
   */
  static sanitizeSentenceForWebview(sentence: any): any {
    if (!this.validateSentence(sentence)) {
      return null;
    }

    return {
      id: sentence.id || '',
      text: sentence.text || '',
      originalText: sentence.originalText || sentence.text || '',
      position: sentence.position ?? 0,
      outlineSection: sentence.outlineSection || '',
      claims: Array.isArray(sentence.claims) ? sentence.claims : [],
      claimCount: Array.isArray(sentence.claims) ? sentence.claims.length : 0
    };
  }

  /**
   * Sanitize sentences array for webview transmission
   */
  static sanitizeSentencesForWebview(sentences: any): any[] {
    if (!Array.isArray(sentences)) {
      console.warn('[DataValidation] Cannot sanitize non-array sentences');
      return [];
    }

    return sentences
      .map(s => this.sanitizeSentenceForWebview(s))
      .filter(s => s !== null);
  }

  /**
   * Sanitize Q&A pair for webview transmission
   */
  static sanitizeQAPairForWebview(pair: any): any {
    if (!this.validateQAPair(pair)) {
      return null;
    }

    return {
      id: pair.id || '',
      question: pair.question || '',
      answer: pair.answer || '',
      section: pair.section || '',
      linkedSources: Array.isArray(pair.linkedSources) ? pair.linkedSources : [],
      claims: Array.isArray(pair.claims) ? pair.claims : []
    };
  }

  /**
   * Sanitize Q&A pairs array for webview transmission
   */
  static sanitizeQAPairsForWebview(pairs: any): any[] {
    if (!Array.isArray(pairs)) {
      console.warn('[DataValidation] Cannot sanitize non-array Q&A pairs');
      return [];
    }

    return pairs
      .map(p => this.sanitizeQAPairForWebview(p))
      .filter(p => p !== null);
  }

  /**
   * Validate webview message
   */
  static validateWebviewMessage(message: any): boolean {
    if (!message || typeof message !== 'object') {
      console.warn('[DataValidation] Message is not an object:', message);
      return false;
    }

    if (!message.type || typeof message.type !== 'string') {
      console.warn('[DataValidation] Message missing or invalid type:', message.type);
      return false;
    }

    return true;
  }
}
