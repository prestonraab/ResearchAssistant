import * as fs from 'fs';
import * as path from 'path';

/**
 * Fuzzy quote matcher using sliding window approach
 * Fallback when embeddings don't find good matches
 */
export class FuzzyQuoteMatcher {
  private extractedTextPath: string;

  constructor(workspaceRoot: string, extractedTextPath: string = 'literature/ExtractedText') {
    this.extractedTextPath = path.join(workspaceRoot, extractedTextPath);
  }

  /**
   * Search for a quote across all literature files using fuzzy matching
   */
  async searchQuote(quote: string, limit: number = 5): Promise<Array<{
    fileName: string;
    similarity: number;
    matchedText: string;
    startLine: number;
    endLine: number;
  }>> {
    if (!fs.existsSync(this.extractedTextPath)) {
      console.warn('[FuzzyQuoteMatcher] Extracted text directory not found:', this.extractedTextPath);
      return [];
    }

    const files = fs.readdirSync(this.extractedTextPath)
      .filter(f => f.endsWith('.txt'))
      .map(f => path.join(this.extractedTextPath, f));

    const results: Array<{
      fileName: string;
      similarity: number;
      matchedText: string;
      startLine: number;
      endLine: number;
    }> = [];

    const normalizedQuote = this.normalizeText(quote);
    const quoteWords = normalizedQuote.split(' ').filter(w => w.length > 0);
    const windowSize = quoteWords.length;

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const normalizedContent = this.normalizeText(content);
        
        // Check for exact match first
        if (normalizedContent.includes(normalizedQuote)) {
          const match = this.findExactMatch(normalizedQuote, content, lines);
          if (match) {
            results.push({
              fileName: path.basename(filePath),
              similarity: 1.0,
              matchedText: match.text,
              startLine: match.startLine,
              endLine: match.endLine
            });
          }
          continue;
        }

        // Fuzzy match with sliding window
        const sourceWords = normalizedContent.split(' ').filter(w => w.length > 0);
        let bestSimilarity = 0;
        let bestMatchIndex = 0;

        for (let i = 0; i <= sourceWords.length - windowSize; i++) {
          const window = sourceWords.slice(i, i + windowSize).join(' ');
          const matchingWords = quoteWords.filter(word => window.includes(word)).length;
          const similarity = matchingWords / quoteWords.length;

          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMatchIndex = i;
          }

          if (similarity >= 0.95) {
            break;
          }
        }

        // Only include if similarity is above threshold
        if (bestSimilarity >= 0.7) {
          const match = this.findMatchLocation(bestMatchIndex, windowSize, content, lines);
          if (match) {
            results.push({
              fileName: path.basename(filePath),
              similarity: bestSimilarity,
              matchedText: match.text,
              startLine: match.startLine,
              endLine: match.endLine
            });
          }
        }
      } catch (error) {
        console.warn(`[FuzzyQuoteMatcher] Error processing file ${filePath}:`, error);
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Normalize text for comparison
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Find exact match location in original text
   */
  private findExactMatch(normalizedQuote: string, content: string, lines: string[]): {
    text: string;
    startLine: number;
    endLine: number;
  } | null {
    const normalizedContent = this.normalizeText(content);
    const quoteStart = normalizedContent.indexOf(normalizedQuote);
    
    if (quoteStart === -1) {
      return null;
    }

    const quoteEnd = quoteStart + normalizedQuote.length;

    // Find line numbers
    let charCount = 0;
    let startLine = 0;
    let endLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = this.normalizeText(lines[i]).length + 1;
      
      if (charCount <= quoteStart && charCount + lineLength > quoteStart) {
        startLine = i;
      }
      if (charCount <= quoteEnd && charCount + lineLength >= quoteEnd) {
        endLine = i;
        break;
      }
      
      charCount += lineLength;
    }

    return {
      text: lines.slice(startLine, endLine + 1).join('\n').trim(),
      startLine: startLine + 1,
      endLine: endLine + 1
    };
  }

  /**
   * Find match location by word index
   */
  private findMatchLocation(wordIndex: number, windowSize: number, content: string, lines: string[]): {
    text: string;
    startLine: number;
    endLine: number;
  } | null {
    const normalizedLines = lines.map(l => this.normalizeText(l));
    
    let wordCount = 0;
    let matchStartLine = 0;
    let matchEndLine = 0;

    for (let i = 0; i < normalizedLines.length; i++) {
      const lineWords = normalizedLines[i].split(' ').filter(w => w.length > 0);
      
      if (wordCount <= wordIndex && wordCount + lineWords.length > wordIndex) {
        matchStartLine = i;
      }
      if (wordCount <= wordIndex + windowSize && wordCount + lineWords.length >= wordIndex + windowSize) {
        matchEndLine = i;
        break;
      }
      
      wordCount += lineWords.length;
    }

    return {
      text: lines.slice(matchStartLine, matchEndLine + 1).join('\n').trim(),
      startLine: matchStartLine + 1,
      endLine: matchEndLine + 1
    };
  }
}
