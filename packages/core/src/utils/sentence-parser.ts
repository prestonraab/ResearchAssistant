/**
 * SentenceParser - Parses manuscript text into sentences
 * Preserves sentence boundaries, line numbers, and handles edge cases
 */

export interface Sentence {
  id: string;
  text: string;
  originalText: string;
  position: number; // Line number in manuscript
  outlineSection?: string;
  claims: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SentenceParser {
  private sentenceCache: Map<string, Sentence[]> = new Map();

  /**
   * Parse manuscript text into sentences
   * Handles abbreviations, numbers, preserves formatting, and extracts claim associations from Source comments
   */
  parseSentences(text: string, manuscriptId: string = 'default'): Sentence[] {
    const sentences: Sentence[] = [];
    
    // Common abbreviations to avoid splitting on
    const abbreviations = new Set([
      'Dr', 'Mr', 'Mrs', 'Ms', 'Prof', 'Sr', 'Jr',
      'Inc', 'Ltd', 'Co', 'Corp', 'Dept',
      'e.g', 'i.e', 'etc', 'vs', 'vol', 'pp',
      'Fig', 'Eq', 'Ref', 'No', 'St', 'Ave', 'Blvd'
    ]);

    // First, remove all HTML comments except Source comments, and mark where Source comments appear
    // Replace Source comments with a unique marker that includes the claim IDs
    const textWithMarkers = text.replace(/<!--\s*Source:\s*([^-]+?)-->/g, (match, claimText) => {
      return `<<<SOURCE:${claimText.trim()}>>>`;
    }).replace(/<!--[^>]*?-->/g, ''); // Remove other comments

    console.log(`[SentenceParser] Processing text with ${(text.match(/<!--\s*Source:/g) || []).length} Source comments`);

    // Now split into sentences
    let currentSentence = '';
    let sentenceIndex = 0;
    let position = 0;

    for (let i = 0; i < textWithMarkers.length; i++) {
      const char = textWithMarkers[i];
      currentSentence += char;
      
      // Check for sentence-ending punctuation
      if (char === '.' || char === '!' || char === '?') {
        // Check for ellipsis
        if (char === '.' && textWithMarkers[i + 1] === '.' && textWithMarkers[i + 2] === '.') {
          currentSentence += textWithMarkers[i + 1] + textWithMarkers[i + 2];
          i += 2;
          continue;
        }
        
        // Check if this is an abbreviation
        const beforePunct = currentSentence.slice(0, -1).trim();
        const lastWord = beforePunct.split(/\s+/).pop() || '';
        
        if (char === '.' && abbreviations.has(lastWord)) {
          continue; // Don't split on abbreviation
        }
        
        // This is a sentence boundary
        // Look ahead to see if there's a Source marker immediately following
        let j = i + 1;
        while (j < textWithMarkers.length && /\s/.test(textWithMarkers[j])) {
          j++;
        }
        
        // If next non-whitespace is a Source marker, include it with this sentence
        if (textWithMarkers.substring(j, j + 11) === '<<<SOURCE:') {
          const markerEnd = textWithMarkers.indexOf('>>>', j);
          if (markerEnd !== -1) {
            // Include everything from current position to end of marker
            currentSentence += textWithMarkers.substring(i + 1, markerEnd + 3);
            i = markerEnd + 2; // Move past the marker
          }
        }
        
        // Create the sentence
        const sentenceText = currentSentence.trim();
        if (sentenceText.length > 0) {
          // Extract claims from Source markers in this sentence
          const claims: string[] = [];
          const sourceMatches = sentenceText.matchAll(/<<<SOURCE:([^>]+)>>>/g);
          for (const match of sourceMatches) {
            const claimIds = this.extractClaimIds(match[1]);
            claims.push(...claimIds);
          }
          
          // Remove Source markers from the text
          const cleanText = sentenceText.replace(/<<<SOURCE:[^>]+>>>/g, '').trim();
          
          if (cleanText.length > 0) {
            const sentence: Sentence = {
              id: `S_${manuscriptId}_${sentenceIndex}`,
              text: cleanText,
              originalText: cleanText,
              position: position,
              claims: claims,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            if (claims.length > 0) {
              console.log(`[SentenceParser] Sentence ${sentenceIndex} has ${claims.length} claims: ${claims.join(', ')}`);
            }
            
            sentences.push(sentence);
            sentenceIndex++;
          }
        }
        
        currentSentence = '';
      }
    }

    // Add any remaining text as final sentence
    if (currentSentence.trim().length > 0) {
      const sentenceText = currentSentence.trim();
      
      // Extract claims from Source markers
      const claims: string[] = [];
      const sourceMatches = sentenceText.matchAll(/<<<SOURCE:([^>]+)>>>/g);
      for (const match of sourceMatches) {
        const claimIds = this.extractClaimIds(match[1]);
        claims.push(...claimIds);
      }
      
      // Remove Source markers from the text
      const cleanText = sentenceText.replace(/<<<SOURCE:[^>]+>>>/g, '').trim();
      
      if (cleanText.length > 0) {
        const sentence: Sentence = {
          id: `S_${manuscriptId}_${sentenceIndex}`,
          text: cleanText,
          originalText: cleanText,
          position: position,
          claims: claims,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        if (claims.length > 0) {
          console.log(`[SentenceParser] Final sentence has ${claims.length} claims: ${claims.join(', ')}`);
        }
        
        sentences.push(sentence);
      }
    }

    console.log(`[SentenceParser] Parsed ${sentences.length} sentences, ${sentences.filter(s => s.claims.length > 0).length} with claims`);

    // Cache the result
    this.sentenceCache.set(manuscriptId, sentences);

    return sentences;
  }

  /**
   * Extract claim IDs from source text
   */
  private extractClaimIds(sourceText: string): string[] {
    const claims: string[] = [];
    
    // Match patterns like C_99, C_100, etc.
    const matches = sourceText.matchAll(/C_(\d+)/g);
    for (const match of matches) {
      claims.push(`C_${match[1]}`);
    }
    
    return claims;
  }

  /**
   * Split text by sentence-ending punctuation
   * Respects abbreviations and common patterns
   */
  private splitBySentenceEnding(text: string, abbreviations: Set<string>): string[] {
    const parts: string[] = [];
    let current = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      current += char;

      // Check for sentence-ending punctuation
      if (char === '.' || char === '!' || char === '?') {
        // Check for ellipsis (three dots)
        if (char === '.' && text[i + 1] === '.' && text[i + 2] === '.') {
          current += text[i + 1] + text[i + 2];
          i += 2; // Skip the next two dots
          parts.push(current);
          current = '';
          continue;
        }

        // Look ahead for abbreviations
        const beforePunct = current.slice(0, -1).trim();
        const lastWord = beforePunct.split(/\s+/).pop() || '';

        // Check if this is an abbreviation
        if (char === '.' && abbreviations.has(lastWord)) {
          continue; // Don't split on abbreviation
        }

        // Valid sentence ending
        parts.push(current);
        current = '';
      }
    }

    if (current.length > 0) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Check if text ends with sentence-ending punctuation
   */
  private endsWithSentencePunctuation(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?');
  }

  /**
   * Clear cache for a specific manuscript or all
   */
  clearCache(manuscriptId?: string): void {
    if (manuscriptId) {
      this.sentenceCache.delete(manuscriptId);
    } else {
      this.sentenceCache.clear();
    }
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.sentenceCache.size;
  }
}
