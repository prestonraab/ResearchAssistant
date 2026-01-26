/**
 * Direct API for calling citation MCP functions without stdio protocol
 * This allows the VS Code extension to call MCP functions directly
 */

import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_ROOT = process.env.CITATION_WORKSPACE_ROOT || process.cwd();
const EXTRACTED_TEXT_DIR = path.join(WORKSPACE_ROOT, 'literature', 'ExtractedText');

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
export function verifyQuote(quote: string, authorYear: string): VerificationResult {
  if (!quote || !authorYear) {
    return {
      verified: false,
      similarity: 0,
      error: 'Quote and author_year are required'
    };
  }

  // Find source file
  const files = fs.readdirSync(EXTRACTED_TEXT_DIR);
  const sourceFile = files.find(f => {
    const baseName = path.basename(f, path.extname(f));
    return baseName.includes(authorYear) || f.includes(authorYear);
  });

  if (!sourceFile) {
    return {
      verified: false,
      similarity: 0,
      searchedDirectory: EXTRACTED_TEXT_DIR,
      error: `No source file found for ${authorYear}`
    };
  }

  // Read source content
  const sourcePath = path.join(EXTRACTED_TEXT_DIR, sourceFile);
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
      searchedDirectory: EXTRACTED_TEXT_DIR
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
    searchedDirectory: EXTRACTED_TEXT_DIR
  };
}
