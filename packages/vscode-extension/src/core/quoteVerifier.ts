/**
 * Core quote verification logic - shared between extension and MCP server
 */

import * as fs from 'fs';
import * as path from 'path';

export interface VerificationResult {
  verified: boolean;
  similarity: number;
  sourceFile?: string;
  matchedText?: string;
  nearestMatch?: string;
  contextBefore?: string;
  contextAfter?: string;
  searchedDirectory?: string;
  error?: string;
}

/**
 * Normalize text for matching (handles Unicode characters)
 */
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s\d]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Flexible author-year matching for filenames
 * Handles formats like "Buus et al. - 2021 - Title.txt" matching "Buus2021"
 */
function matchesAuthorYear(filename: string, authorYear: string): boolean {
  const normalizedFilename = normalizeForMatching(filename);
  const normalizedAuthorYear = normalizeForMatching(authorYear);
  
  // Direct match
  if (normalizedFilename.includes(normalizedAuthorYear)) {
    return true;
  }
  
  // Extract year from authorYear (last 4 digits)
  const yearMatch = authorYear.match(/(\d{4})/);
  if (!yearMatch) {
    return false;
  }
  const year = yearMatch[1];
  
  // Extract author part (everything before the year)
  const authorPart = authorYear.replace(/\d{4}/, '').trim();
  const normalizedAuthorPart = normalizeForMatching(authorPart);
  
  // Must have the year
  const hasYear = normalizedFilename.includes(year);
  if (!hasYear) {
    return false;
  }
  
  // Check if author part matches (handling "et al." variations)
  const authorWords = normalizedAuthorPart.split(/\s+/).filter(w => w.length > 2);
  
  // If we have author words, at least one significant word must match
  if (authorWords.length > 0) {
    for (const word of authorWords) {
      if (normalizedFilename.includes(word)) {
        return true;
      }
    }
  }
  
  // Fallback: if the author part is very short (like "Du"), be more lenient
  // Check if it appears as a word boundary in the filename
  if (authorPart.length <= 4) {
    const authorRegex = new RegExp(`\\b${normalizedAuthorPart}\\b`, 'i');
    if (authorRegex.test(normalizedFilename)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate string similarity using Dice coefficient
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length < 2 || str2.length < 2) return 0.0;

  const bigrams1 = new Set<string>();
  for (let i = 0; i < str1.length - 1; i++) {
    bigrams1.add(str1.substring(i, i + 2));
  }

  const bigrams2 = new Set<string>();
  for (let i = 0; i < str2.length - 1; i++) {
    bigrams2.add(str2.substring(i, i + 2));
  }

  let intersection = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
}

/**
 * Verify a quote exists in a source file
 */
export function verifyQuote(
  quote: string,
  authorYear: string,
  extractedTextDir: string
): VerificationResult {
  if (!quote || !authorYear) {
    return {
      verified: false,
      similarity: 0,
      error: 'Quote and author_year are required'
    };
  }

  // Find source file using flexible matching
  const files = fs.readdirSync(extractedTextDir);
  const sourceFile = files.find(f => matchesAuthorYear(f, authorYear));

  if (!sourceFile) {
    return {
      verified: false,
      similarity: 0,
      searchedDirectory: extractedTextDir,
      error: `No source file found for ${authorYear}`
    };
  }

  // Read source content
  const sourcePath = path.join(extractedTextDir, sourceFile);
  const content = fs.readFileSync(sourcePath, 'utf-8');

  // Normalize text for comparison
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  };

  const normalizedQuote = normalizeText(quote);
  const normalizedContent = normalizeText(content);

  // Check for exact match
  if (normalizedContent.includes(normalizedQuote)) {
    // Find the actual text in the original content
    const quoteWords = quote.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const contentLines = content.split('\n');
    
    let bestMatch = '';
    let bestContext = { before: '', after: '' };
    
    for (let i = 0; i < contentLines.length; i++) {
      const line = contentLines[i];
      const normalizedLine = normalizeText(line);
      
      if (normalizedLine.includes(normalizedQuote)) {
        bestMatch = line.trim();
        bestContext.before = contentLines.slice(Math.max(0, i - 2), i).join('\n');
        bestContext.after = contentLines.slice(i + 1, Math.min(contentLines.length, i + 3)).join('\n');
        break;
      }
    }

    return {
      verified: true,
      similarity: 1.0,
      sourceFile,
      matchedText: bestMatch || quote,
      contextBefore: bestContext.before,
      contextAfter: bestContext.after,
      searchedDirectory: extractedTextDir
    };
  }

  // Find closest match using sliding window
  const quoteLength = normalizedQuote.length;
  let bestSimilarity = 0;
  let bestMatchText = '';
  let bestMatchContext = { before: '', after: '' };

  const contentLines = content.split('\n');
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const normalizedLine = normalizeText(line);
    
    // Try different window sizes around the quote length
    for (const windowSize of [quoteLength, quoteLength * 0.8, quoteLength * 1.2]) {
      for (let j = 0; j < normalizedLine.length - windowSize; j++) {
        const window = normalizedLine.substring(j, j + windowSize);
        const similarity = stringSimilarity(normalizedQuote, window);
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          // Find corresponding text in original content
          const startIdx = line.toLowerCase().indexOf(window.substring(0, 20));
          if (startIdx >= 0) {
            bestMatchText = line.substring(startIdx, startIdx + windowSize).trim();
            bestMatchContext.before = contentLines.slice(Math.max(0, i - 2), i).join('\n');
            bestMatchContext.after = contentLines.slice(i + 1, Math.min(contentLines.length, i + 3)).join('\n');
          }
        }
      }
    }
  }

  const verified = bestSimilarity >= 0.8;

  return {
    verified,
    similarity: bestSimilarity,
    sourceFile,
    matchedText: verified ? bestMatchText : undefined,
    nearestMatch: !verified ? bestMatchText : undefined,
    contextBefore: bestMatchContext.before,
    contextAfter: bestMatchContext.after,
    searchedDirectory: extractedTextDir
  };
}
