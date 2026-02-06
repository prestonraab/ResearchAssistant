/**
 * Extracts meaningful snippets from text for embedding.
 * Uses sentence-level chunking with a sliding window overlap so that
 * ideas spanning chunk boundaries are captured in at least one snippet.
 */
export class SnippetExtractor {
  private readonly MIN_SNIPPET_LENGTH = 100;  // Minimum characters per snippet
  private readonly MAX_SNIPPET_LENGTH = 1000; // Target maximum characters per snippet
  private readonly OVERLAP_RATIO = 0.5;       // 50% overlap between consecutive windows

  /**
   * Extract overlapping snippets from text using a sliding window over sentences.
   * Each window advances by ~50% of the target size, so boundary content
   * appears in two adjacent snippets.
   */
  extractSnippets(text: string, _fileName: string): Array<{ text: string; startLine: number; endLine: number }> {
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) {
      return [];
    }

    // Build sentence-level windows
    const snippets: Array<{ text: string; startLine: number; endLine: number }> = [];
    const stepChars = Math.round(this.MAX_SNIPPET_LENGTH * (1 - this.OVERLAP_RATIO));

    let windowStart = 0;

    while (windowStart < sentences.length) {
      // Grow window until we hit MAX_SNIPPET_LENGTH or run out of sentences
      let windowEnd = windowStart;
      let windowText = sentences[windowStart];

      // If a single sentence exceeds max length, truncate it
      if (windowText.length > this.MAX_SNIPPET_LENGTH) {
        windowText = windowText.substring(0, this.MAX_SNIPPET_LENGTH);
      }

      while (windowEnd + 1 < sentences.length) {
        const next = windowText + ' ' + sentences[windowEnd + 1];
        if (next.length > this.MAX_SNIPPET_LENGTH) {
          break;
        }
        windowEnd++;
        windowText = next;
      }

      // Only keep snippets that meet minimum length
      if (windowText.length >= this.MIN_SNIPPET_LENGTH) {
        const { startLine, endLine } = this.getLineNumbers(text, windowText);
        snippets.push({ text: windowText.trim(), startLine, endLine });
      }

      // Advance the window start by ~stepChars worth of sentences
      let advancedChars = 0;
      const prevStart = windowStart;
      while (windowStart < sentences.length && advancedChars < stepChars) {
        advancedChars += sentences[windowStart].length;
        windowStart++;
      }

      // Safety: always advance at least one sentence to avoid infinite loops
      if (windowStart === prevStart) {
        windowStart++;
      }
    }

    return snippets;
  }

  /**
   * Split text into sentences.
   * First splits on paragraph/section boundaries (blank lines, markdown headers),
   * then splits paragraphs into sentences.
   */
  private splitIntoSentences(text: string): string[] {
    // Step 1: Split on structural boundaries (blank lines, markdown headers, list items)
    const blocks = text.split(/\n\s*\n|(?=^#{1,6}\s)/m)
      .map(b => b.trim())
      .filter(b => b.length > 0);

    const sentences: string[] = [];

    for (const block of blocks) {
      // Normalize hard line wraps by intelligently joining lines
      // This fixes broken words from hard-wrapped text files (e.g., "repositori\nes" -> "repositories")
      const lines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      let normalized = '';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // If this is not the first line, decide whether to add a space
        if (i > 0) {
          const prevLine = lines[i - 1];
          // Don't add space if previous line ends with incomplete word (no punctuation/space at end)
          // or if current line starts with lowercase (continuation of word)
          const prevEndsWithPunctuation = /[.!?,;:\)\]\}]$/.test(prevLine);
          const currentStartsLowercase = /^[a-z]/.test(line);
          
          if (!prevEndsWithPunctuation && currentStartsLowercase) {
            // Likely a broken word, join without space
            normalized += line;
          } else {
            // Normal line break, add space
            normalized += ' ' + line;
          }
        } else {
          normalized += line;
        }
      }
      
      // Final whitespace collapse
      normalized = normalized.replace(/\s+/g, ' ').trim();
      if (normalized.length === 0) continue;

      // Step 2: Split block into sentences
      const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s+(?=\d)|(?<=[.!?])\s+$/g;
      let blockSentences = normalized.split(sentenceRegex)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Fallback: simple period split if regex didn't split
      if (blockSentences.length === 1 && normalized.length > this.MAX_SNIPPET_LENGTH) {
        blockSentences = normalized.split(/[.!?]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);
      }

      sentences.push(...blockSentences);
    }

    return sentences;
  }

  /**
   * Get approximate line numbers for a snippet
   */
  private getLineNumbers(fullText: string, snippet: string): { startLine: number; endLine: number } {
    const snippetIndex = fullText.indexOf(snippet);
    if (snippetIndex === -1) {
      return { startLine: 0, endLine: 0 };
    }

    const beforeSnippet = fullText.substring(0, snippetIndex);
    const startLine = beforeSnippet.split('\n').length - 1;
    const endLine = startLine + snippet.split('\n').length - 1;

    return { startLine, endLine };
  }

  /**
   * Extract key terms from text for keyword-guided retrieval
   */
  extractKeyTerms(text: string, limit: number = 10): string[] {
    // Simple keyword extraction: split into words, filter stopwords, get most common
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
      'when', 'where', 'why', 'how', 'as', 'if', 'so', 'than', 'then'
    ]);

    const words = text.toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    // Count word frequencies
    const frequencies = new Map<string, number>();
    words.forEach(word => {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    });

    // Return top terms by frequency
    return Array.from(frequencies.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }
}
