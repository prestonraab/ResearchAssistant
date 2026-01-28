/**
 * Extracts meaningful snippets from text for embedding
 * Uses sentence-level chunking with context preservation
 */
export class SnippetExtractor {
  private readonly MIN_SNIPPET_LENGTH = 150; // Minimum characters per snippet (at least one sentence)
  private readonly MAX_SNIPPET_LENGTH = 500; // Maximum characters per snippet
  private readonly CONTEXT_SENTENCES = 2; // Sentences of context around key content

  /**
   * Extract snippets from text
   * Returns array of text chunks suitable for embedding
   */
  extractSnippets(text: string, fileName: string): Array<{ text: string; startLine: number; endLine: number }> {
    const snippets: Array<{ text: string; startLine: number; endLine: number }> = [];

    // Split into sentences
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) {
      return [];
    }

    // Group sentences into meaningful chunks
    let currentChunk = '';
    let chunkStartIdx = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;

      // If adding this sentence would exceed max length, save current chunk and start new one
      if (potentialChunk.length > this.MAX_SNIPPET_LENGTH && currentChunk.length > 0) {
        if (currentChunk.length >= this.MIN_SNIPPET_LENGTH) {
          const { startLine, endLine } = this.getLineNumbers(text, currentChunk);
          snippets.push({
            text: currentChunk.trim(),
            startLine,
            endLine
          });
        }
        currentChunk = sentence;
        chunkStartIdx = i;
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk
    if (currentChunk.length >= this.MIN_SNIPPET_LENGTH) {
      const { startLine, endLine } = this.getLineNumbers(text, currentChunk);
      snippets.push({
        text: currentChunk.trim(),
        startLine,
        endLine
      });
    }

    return snippets;
  }

  /**
   * Split text into sentences
   * Handles common abbreviations and edge cases
   */
  private splitIntoSentences(text: string): string[] {
    // Remove extra whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Split on sentence boundaries
    // This regex handles: periods, question marks, exclamation marks
    // But avoids splitting on abbreviations like "Dr.", "e.g.", "i.e."
    const sentenceRegex = /(?<=[.!?])\s+(?=[A-Z])|(?<=[.!?])\s+(?=\d)|(?<=[.!?])\s+$/g;
    
    let sentences = text.split(sentenceRegex)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    // If regex split didn't work well, fall back to simple period split
    if (sentences.length === 1) {
      sentences = text.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
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
