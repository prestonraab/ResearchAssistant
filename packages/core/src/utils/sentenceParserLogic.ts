/**
 * Pure logic for sentence parsing - no VSCode dependencies
 * Extracted from SentenceParser for testability
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

/**
 * Split text into sentences with claim associations
 * Handles abbreviations, numbers, preserves formatting, and extracts claim associations from Source comments
 * 
 * @param text - The text to parse into sentences
 * @param manuscriptId - Identifier for the manuscript (used in sentence IDs)
 * @returns Array of parsed sentences with claim associations
 */
export function splitIntoSentences(text: string, manuscriptId: string = 'default'): Sentence[] {
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

  // Now split into sentences
  let currentSentence = '';
  let sentenceIndex = 0;
  let position = 0;

  for (let i = 0; i < textWithMarkers.length; i++) {
    const char = textWithMarkers[i];
    
    // Track line numbers
    if (char === '\n') {
      position++;
    }
    
    currentSentence += char;
    
    // Check for sentence-ending punctuation
    if (char === '.' || char === '!' || char === '?') {
      let isSentenceEnding = true;
      
      // Check for ellipsis (three dots in a row) - this IS a sentence ending
      if (char === '.' && textWithMarkers[i + 1] === '.' && textWithMarkers[i + 2] === '.') {
        currentSentence += textWithMarkers[i + 1] + textWithMarkers[i + 2];
        i += 2;
        isSentenceEnding = true;
      } else if (char === '.') {
        // Check if this is an abbreviation
        const beforePunct = currentSentence.slice(0, -1).trim();
        const lastWord = beforePunct.split(/\s+/).pop() || '';
        
        if (abbreviations.has(lastWord)) {
          isSentenceEnding = false; // Don't split on abbreviation
        }
      }
      
      if (!isSentenceEnding) {
        continue;
      }
      
      // This is a sentence boundary
      // Look ahead to see if there's a Source marker immediately following
      let j = i + 1;
      while (j < textWithMarkers.length && /\s/.test(textWithMarkers[j])) {
        j++;
      }
      
      // If next non-whitespace is a Source marker, include it with this sentence
      if (textWithMarkers.substring(j, j + 10) === '<<<SOURCE:') {
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
        const claims = extractClaimIds(sentenceText);
        
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
    const claims = extractClaimIds(sentenceText);
    
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
      
      sentences.push(sentence);
    }
  }

  return sentences;
}

/**
 * Extract claim IDs from source text
 * Matches patterns like C_99, C_100, etc.
 * 
 * @param sourceText - Text containing claim references
 * @returns Array of claim IDs found in the text
 */
function extractClaimIds(sourceText: string): string[] {
  const claims: string[] = [];
  
  // Match patterns like C_99, C_100, etc.
  const matches = sourceText.matchAll(/C_(\d+)/g);
  for (const match of matches) {
    claims.push(`C_${match[1]}`);
  }
  
  return claims;
}

/**
 * Find the sentence at a specific position (line number)
 * 
 * @param sentences - Array of sentences to search
 * @param position - Line number to find
 * @returns The sentence at that position, or null if not found
 */
export function findSentenceAtPosition(sentences: Sentence[], position: number): Sentence | null {
  return sentences.find(s => s.position === position) || null;
}
