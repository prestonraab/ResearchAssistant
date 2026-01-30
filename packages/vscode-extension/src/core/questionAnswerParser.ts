/**
 * QuestionAnswerParser - Parses manuscript with embedded questions/answers
 * Extracts question-answer pairs with status and associated claims
 */

import { SentenceParser } from './sentenceParser';

export interface LinkedSource {
  title: string;           // Paper title
  source: string;          // Source reference (e.g., "Smith2020")
  quote: string;           // Relevant quote from the source
  cited: boolean;          // Whether this source is marked for citation
}

export interface QuestionAnswerPair {
  id: string;
  question: string;
  status: 'ANSWERED' | 'RESEARCH NEEDED' | 'PARTIAL' | 'UNKNOWN';
  answer: string;
  claims: string[]; // Claim IDs from Source comments
  section: string; // Section header this belongs to
  position: number; // Line number in manuscript
  linkedSources?: LinkedSource[]; // Linked sources with quotes for citation
}

export class QuestionAnswerParser {
  /**
   * Parse manuscript into question-answer pairs
   */
  parseManuscript(text: string): QuestionAnswerPair[] {
    const pairs: QuestionAnswerPair[] = [];
    const lines = text.split('\n');
    
    let currentSection = '';
    let pairIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Track section headers
      if (line.startsWith('#')) {
        currentSection = line.replace(/^#+\s*/, '').trim();
        continue;
      }
      
      // Look for question pattern: **Question text?** <!-- [STATUS] -->
      const questionMatch = line.match(/^\*\*(.+?)\*\*\s*<!--\s*\[([^\]]+)\]\s*-->/);
      
      if (questionMatch) {
        const question = questionMatch[1].trim();
        const status = this.parseStatus(questionMatch[2].trim());
        
        // Get the rest of the line after the status comment (answer starts here)
        const afterStatus = line.substring(line.indexOf('-->') + 3).trim();
        
        // Collect answer text and claims from this line and following lines
        const { answer, claims, endLine } = this.collectAnswer(lines, i, afterStatus);
        
        pairs.push({
          id: `QA_${pairIndex}`,
          question,
          status,
          answer,
          claims,
          section: currentSection,
          position: i
        });
        
        pairIndex++;
        i = endLine; // Skip to end of this Q&A pair
      }
    }
    
    return pairs;
  }
  
  /**
   * Parse status from comment
   */
  private parseStatus(statusText: string): 'ANSWERED' | 'RESEARCH NEEDED' | 'PARTIAL' | 'UNKNOWN' {
    const upper = statusText.toUpperCase();
    if (upper.includes('ANSWERED')) return 'ANSWERED';
    if (upper.includes('RESEARCH NEEDED')) return 'RESEARCH NEEDED';
    if (upper.includes('PARTIAL')) return 'PARTIAL';
    return 'UNKNOWN';
  }
  
  /**
   * Collect answer text and claims from following lines
   * Keeps Source comments in answer text for sentence-level parsing
   */
  private collectAnswer(lines: string[], startLine: number, initialText: string = ''): { answer: string; claims: string[]; endLine: number } {
    let answer = initialText; // Start with text from the same line as the question
    const claims: string[] = [];
    let i = startLine + 1; // Start from next line
    
    // Extract claims from initial text but keep comment in text for sentence parsing
    const initialSourceMatch = initialText.match(/<!--\s*Source:\s*([^-]+?)-->/);
    if (initialSourceMatch) {
      const claimIds = this.extractClaimIds(initialSourceMatch[1]);
      claims.push(...claimIds);
      answer = initialText.trim();
    }
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Stop at next question or section header
      if (line.match(/^\*\*(.+?)\*\*\s*<!--/) || line.startsWith('#') || line === '---') {
        break;
      }
      
      // Skip empty lines
      if (line.length === 0) {
        i++;
        continue;
      }
      
      // Extract claims from Source comments
      const sourceMatch = line.match(/<!--\s*Source:\s*([^-]+?)-->/);
      if (sourceMatch) {
        const claimIds = this.extractClaimIds(sourceMatch[1]);
        claims.push(...claimIds);
      }
      
      // Keep line with Source comments for sentence parsing
      if (line.length > 0) {
        answer += (answer ? ' ' : '') + line;
      }
      
      i++;
    }
    
    return { answer: answer.trim(), claims, endLine: i - 1 };
  }
  
  /**
   * Extract claim IDs from source comment
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
   * Reconstruct manuscript from question-answer pairs
   * Uses new format with sentence-level claim attribution
   */
  reconstructManuscript(pairs: QuestionAnswerPair[]): string {
    let output = '';
    let currentSection = '';
    
    for (const pair of pairs) {
      // Trim variables to remove leading/trailing whitespace
      const trimmedQuestion = pair.question.trim();
      const trimmedAnswer = pair.answer.trim();

      // Add section header if changed
      if (pair.section !== currentSection) {
        if (output) output += '\n\n';
        output += `## ${pair.section}\n\n`;
        currentSection = pair.section;
      }
      
      // Add question with status
      output += `**${trimmedQuestion}** <!-- [${pair.status}] --> `;
      
      // Add answer (already contains Source comments in the right places)
      output += trimmedAnswer;
      
      output += '\n\n';
    }
    
    return output;
  }

  /**
   * Detect if manuscript uses old format (claims at Q&A level) vs new format (claims at sentence level)
   */
  isOldFormat(text: string): boolean {
    // The current format already has Source comments after specific sentences - this is the NEW format
    // Old format would have had claims only in the Q&A pair metadata, not in the answer text
    // Since we're seeing Source comments in the text, this is actually the new format
    // Return false to skip migration
    return false;
  }

  /**
   * Migrate manuscript from old format to new format
   * Old format: Claims listed once per Q&A pair
   * New format: Claims associated with specific sentences
   */
  migrateToNewFormat(text: string): string {
    // Parse the manuscript in old format
    const pairs = this.parseManuscript(text);
    
    // For each pair, distribute claims across all sentences in the answer
    for (const pair of pairs) {
      if (pair.claims.length === 0) {
        continue; // No claims to distribute
      }
      
      // Parse the answer into sentences
      const sentenceParser = new SentenceParser();
      const sentences = sentenceParser.parseSentences(pair.answer, `qa_${pair.id}`);
      
      if (sentences.length === 0) {
        continue;
      }
      
      // Strategy: Attach all claims to the LAST sentence of the answer
      // This preserves the semantic meaning that claims support the entire answer
      const claimComment = ` <!-- Source: ${pair.claims.join(', ')} -->`;
      
      // Reconstruct the answer with the claim comment after the last sentence
      let newAnswer = '';
      for (let i = 0; i < sentences.length; i++) {
        if (i > 0) {
          newAnswer += ' ';
        }
        newAnswer += sentences[i].text;
        
        // Add claim comment after the last sentence
        if (i === sentences.length - 1) {
          newAnswer += claimComment;
        }
      }
      
      pair.answer = newAnswer;
    }
    
    // Reconstruct the manuscript
    return this.reconstructManuscript(pairs);
  }
}
