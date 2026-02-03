/**
 * QuestionAnswerParser - Parses manuscript with embedded questions/answers
 * Extracts question-answer pairs with status and associated claims
 * 
 * Supports two formats:
 * 1. Legacy format: **Question?** <!-- [STATUS] --> Answer <!-- Source: C_01 -->
 * 2. Obsidian format: > [!question]- Question? (status:: STATUS)
 *                     > Answer [source:: C_01]
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
  status: 'ANSWERED' | 'RESEARCH NEEDED' | 'PARTIAL' | 'DRAFT';
  answer: string;
  claims: string[]; // Claim IDs from source inline fields
  section: string; // Section header this belongs to
  position: number; // Line number in manuscript
  linkedSources?: LinkedSource[]; // Linked sources with quotes for citation
  format?: 'legacy' | 'obsidian'; // Track which format this pair uses
}

export class QuestionAnswerParser {
  /**
   * Parse manuscript into question-answer pairs
   * Supports both legacy and Obsidian callout formats
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
      
      // Try Obsidian callout format first: > [!question]- Question text? (status:: STATUS)
      const calloutMatch = line.match(/^>\s*\[!question\][-+]?\s*(.+?)(?:\s*\(status::\s*([^)]+)\))?$/);
      
      if (calloutMatch) {
        const question = calloutMatch[1].trim();
        const status = this.parseStatus(calloutMatch[2]?.trim() || 'UNKNOWN');
        
        // Collect answer from following callout lines
        const { answer, claims, endLine } = this.collectCalloutAnswer(lines, i + 1);
        
        pairs.push({
          id: `QA_${pairIndex}`,
          question,
          status,
          answer,
          claims,
          section: currentSection,
          position: i,
          format: 'obsidian'
        });
        
        pairIndex++;
        i = endLine;
        continue;
      }
      
      // Fall back to legacy format: **Question text?** <!-- [STATUS] -->
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
          position: i,
          format: 'legacy'
        });
        
        pairIndex++;
        i = endLine; // Skip to end of this Q&A pair
      }
    }
    
    return pairs;
  }
  
  /**
   * Parse status from comment or inline field
   * Default status is DRAFT if not specified
   */
  private parseStatus(statusText: string): 'ANSWERED' | 'RESEARCH NEEDED' | 'PARTIAL' | 'DRAFT' {
    if (!statusText) return 'DRAFT';
    const upper = statusText.toUpperCase();
    if (upper.includes('ANSWERED')) return 'ANSWERED';
    if (upper.includes('RESEARCH NEEDED') || upper.includes('RESEARCH_NEEDED')) return 'RESEARCH NEEDED';
    if (upper.includes('PARTIAL')) return 'PARTIAL';
    if (upper.includes('DRAFT')) return 'DRAFT';
    return 'DRAFT';
  }
  
  /**
   * Collect answer from Obsidian callout lines (lines starting with >)
   * Extracts claims from [source:: C_XX] inline fields
   */
  private collectCalloutAnswer(lines: string[], startLine: number): { answer: string; claims: string[]; endLine: number } {
    let answer = '';
    const claims: string[] = [];
    let i = startLine;
    
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Stop if we hit a non-callout line (doesn't start with >)
      if (!trimmed.startsWith('>')) {
        break;
      }
      
      // Remove the > prefix and any leading space
      let content = trimmed.replace(/^>\s*/, '');
      
      // Skip empty callout lines
      if (content.length === 0) {
        i++;
        continue;
      }
      
      // Extract claims from [source:: C_XX] inline fields
      const sourceMatches = content.matchAll(/\[source::\s*([^\]]+)\]/g);
      for (const match of sourceMatches) {
        const claimIds = this.extractClaimIds(match[1]);
        claims.push(...claimIds);
      }
      
      // Remove inline fields from display text but keep for storage
      // Store original with inline fields
      if (answer) {
        answer += ' ';
      }
      answer += content;
      
      i++;
    }
    
    return { answer: answer.trim(), claims, endLine: i - 1 };
  }
  
  /**
   * Collect answer text and claims from following lines (legacy format)
   * Keeps Source comments in answer text for sentence-level parsing
   */
  private collectAnswer(lines: string[], startLine: number, initialText: string = ''): { answer: string; claims: string[]; endLine: number } {
    let answer = initialText; // Start with text from the same line as the question
    const claims: string[] = [];
    let i = startLine + 1; // Start from next line
    
    // Extract claims from initial text (both legacy and new format)
    const initialLegacyMatch = initialText.match(/<!--\s*Source:\s*([^-]+?)-->/);
    if (initialLegacyMatch) {
      const claimIds = this.extractClaimIds(initialLegacyMatch[1]);
      claims.push(...claimIds);
      answer = initialText.trim();
    }
    
    // Also check for new inline field format
    const initialInlineMatches = initialText.matchAll(/\[source::\s*([^\]]+)\]/g);
    for (const match of initialInlineMatches) {
      const claimIds = this.extractClaimIds(match[1]);
      claims.push(...claimIds);
    }
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Stop at next question (either format), section header, or callout
      if (line.match(/^\*\*(.+?)\*\*\s*<!--/) || 
          line.match(/^>\s*\[!question\]/) ||
          line.startsWith('#') || 
          line === '---') {
        break;
      }
      
      // Skip empty lines
      if (line.length === 0) {
        i++;
        continue;
      }
      
      // Extract claims from legacy Source comments
      const sourceMatch = line.match(/<!--\s*Source:\s*([^-]+?)-->/);
      if (sourceMatch) {
        const claimIds = this.extractClaimIds(sourceMatch[1]);
        claims.push(...claimIds);
      }
      
      // Extract claims from new inline field format
      const inlineMatches = line.matchAll(/\[source::\s*([^\]]+)\]/g);
      for (const match of inlineMatches) {
        const claimIds = this.extractClaimIds(match[1]);
        claims.push(...claimIds);
      }
      
      // Keep line with Source comments/inline fields for sentence parsing
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
   * Uses Obsidian callout format with inline fields
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
      
      // Use Obsidian callout format
      // > [!question]- Question text? (status:: STATUS)
      output += `> [!question]- ${trimmedQuestion} (status:: ${pair.status})\n`;
      
      // Convert answer to callout lines
      // Split answer into sentences/lines and prefix with >
      const answerLines = this.formatAnswerAsCallout(trimmedAnswer);
      output += answerLines;
      
      output += '\n\n';
    }
    
    return output;
  }
  
  /**
   * Format answer text as callout lines (prefixed with >)
   * Converts legacy <!-- Source: --> to [source:: ] inline fields
   */
  private formatAnswerAsCallout(answer: string): string {
    // Convert legacy Source comments to inline fields
    let converted = answer.replace(/<!--\s*Source:\s*([^-]+?)-->/g, '[source:: $1]');
    
    // Split into reasonable line lengths for readability
    // Keep sentences together when possible
    const sentences = converted.split(/(?<=[.!?])\s+/);
    const lines: string[] = [];
    let currentLine = '';
    
    for (const sentence of sentences) {
      if (currentLine.length + sentence.length > 100 && currentLine.length > 0) {
        lines.push('> ' + currentLine.trim());
        currentLine = sentence;
      } else {
        currentLine += (currentLine ? ' ' : '') + sentence;
      }
    }
    
    if (currentLine.trim()) {
      lines.push('> ' + currentLine.trim());
    }
    
    return lines.join('\n');
  }
  
  /**
   * Reconstruct manuscript in legacy format (for backward compatibility)
   */
  reconstructManuscriptLegacy(pairs: QuestionAnswerPair[]): string {
    let output = '';
    let currentSection = '';
    
    for (const pair of pairs) {
      const trimmedQuestion = pair.question.trim();
      const trimmedAnswer = pair.answer.trim();

      if (pair.section !== currentSection) {
        if (output) output += '\n\n';
        output += `## ${pair.section}\n\n`;
        currentSection = pair.section;
      }
      
      // Legacy format
      output += `**${trimmedQuestion}** <!-- [${pair.status}] --> `;
      output += trimmedAnswer;
      output += '\n\n';
    }
    
    return output;
  }

  /**
   * Detect if manuscript uses old format (legacy HTML comments) vs new format (Obsidian callouts)
   */
  isOldFormat(text: string): boolean {
    // Check for legacy format markers
    const hasLegacyQuestions = /\*\*[^*]+\*\*\s*<!--\s*\[[^\]]+\]\s*-->/.test(text);
    const hasLegacySources = /<!--\s*Source:\s*[^-]+?-->/.test(text);
    const hasCallouts = /^>\s*\[!question\]/m.test(text);
    
    // If it has callouts, it's new format
    if (hasCallouts) {
      return false;
    }
    
    // If it has legacy markers, it's old format
    return hasLegacyQuestions || hasLegacySources;
  }

  /**
   * Migrate manuscript from legacy format to Obsidian callout format
   * Legacy: **Question?** <!-- [STATUS] --> Answer <!-- Source: C_01 -->
   * New: > [!question]- Question? (status:: STATUS)
   *      > Answer [source:: C_01]
   */
  migrateToNewFormat(text: string): string {
    // Parse the manuscript (handles both formats)
    const pairs = this.parseManuscript(text);
    
    // Reconstruct using new Obsidian format
    return this.reconstructManuscript(pairs);
  }
  
  /**
   * Migrate a single Q&A pair's answer from legacy to new format
   * Converts <!-- Source: C_XX --> to [source:: C_XX]
   */
  migrateAnswerFormat(answer: string): string {
    return answer.replace(/<!--\s*Source:\s*([^-]+?)-->/g, '[source:: $1]');
  }
}
