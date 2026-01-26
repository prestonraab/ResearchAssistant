import { OutlineParser } from '../core/OutlineParser.js';
import type { OutlineSection } from '@research-assistant/core';

/**
 * SearchQueryGenerator generates targeted search queries for outline sections.
 * 
 * This service analyzes section content to create 2-5 unique search queries that:
 * - Extract key terms and domain-specific terminology
 * - Convert questions to search queries
 * - Ensure uniqueness across all generated queries
 * 
 * Requirements: 11.1, 11.3, 11.4
 */
export class SearchQueryGenerator {
  private outlineParser: OutlineParser;

  // Common stop words to filter out
  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'should', 'could', 'may', 'might', 'can', 'this', 'that', 'these',
    'those', 'it', 'its', 'they', 'them', 'their', 'what', 'which', 'who',
    'when', 'where', 'why', 'how'
  ]);

  // Domain-specific terminology indicators (words that suggest technical terms)
  private readonly DOMAIN_INDICATORS = [
    'method', 'approach', 'technique', 'algorithm', 'model', 'framework',
    'system', 'process', 'analysis', 'evaluation', 'measurement', 'metric',
    'performance', 'efficiency', 'accuracy', 'precision', 'recall',
    'optimization', 'implementation', 'architecture', 'design', 'protocol'
  ];

  constructor(outlineParser: OutlineParser) {
    this.outlineParser = outlineParser;
  }

  /**
   * Generate 2-5 unique search queries for a section.
   * 
   * Strategy:
   * 1. Extract questions from section content and convert to queries
   * 2. Extract key terms from section title
   * 3. Extract domain-specific terminology from content
   * 4. Combine terms into meaningful queries
   * 5. Ensure all queries are unique
   * 6. Return 2-5 queries ordered by relevance
   * 
   * Requirement 11.1: Generate 2-5 queries based on section title and content
   * Requirement 11.3: Convert questions to search queries
   * Requirement 11.4: Ensure query uniqueness
   * 
   * @param sectionId The section ID to generate queries for
   * @returns Array of 2-5 unique search queries
   */
  async generateQueriesForSection(sectionId: string): Promise<string[]> {
    // Get the section
    const section = this.outlineParser.getSectionById(sectionId);
    if (!section) {
      throw new Error(`Section not found: ${sectionId}`);
    }

    const queries = new Set<string>();

    // 1. Extract questions and convert to queries
    const questionQueries = this.extractQuestionsAsQueries(section);
    questionQueries.forEach(q => queries.add(q));

    // 2. Extract key terms from title
    const titleQuery = this.extractKeyTermsFromTitle(section.title);
    if (titleQuery) {
      queries.add(titleQuery);
    }

    // 3. Extract domain-specific terminology
    const domainQueries = this.extractDomainSpecificQueries(section);
    domainQueries.forEach(q => queries.add(q));

    // 4. Extract key phrases from content
    const contentQueries = this.extractKeyPhrasesFromContent(section);
    contentQueries.forEach(q => queries.add(q));

    // Convert to array and ensure we have 2-5 queries
    const queryArray = Array.from(queries);

    // If we have too few queries, add more general queries
    if (queryArray.length < 2) {
      const generalQuery = this.createGeneralQuery(section);
      if (generalQuery && !queries.has(generalQuery)) {
        queryArray.push(generalQuery);
      }
    }

    // If we still have less than 2, add title-based queries as fallback
    if (queryArray.length < 2) {
      const titleWords = this.extractWords(section.title);
      
      // Try full title words first (even if they're stop words at this point)
      if (titleWords.length > 0) {
        const fullTitleQuery = titleWords.slice(0, 5).join(' ');
        if (fullTitleQuery && !queries.has(fullTitleQuery)) {
          queryArray.push(fullTitleQuery);
        }
      }
      
      // If still need more, try shorter title query
      if (queryArray.length < 2 && titleWords.length >= 2) {
        const shortTitleQuery = titleWords.slice(0, 3).join(' ');
        if (shortTitleQuery && !queries.has(shortTitleQuery) && shortTitleQuery !== queryArray[queryArray.length - 1]) {
          queryArray.push(shortTitleQuery);
        }
      }
      
      // If still need more and we have at least 2 words, use them
      if (queryArray.length < 2 && titleWords.length >= 2) {
        const twoWordQuery = titleWords.slice(0, 2).join(' ');
        if (twoWordQuery && !queries.has(twoWordQuery) && !queryArray.includes(twoWordQuery)) {
          queryArray.push(twoWordQuery);
        }
      }
    }

    // Limit to 5 queries maximum
    const finalQueries = queryArray.slice(0, 5);

    // Ensure we have at least 2 queries - last resort fallback
    if (finalQueries.length < 2) {
      // Combine all available text
      const allText = section.title + ' ' + section.content.join(' ');
      const words = this.extractWords(allText);
      
      // Add progressively shorter queries until we have 2
      if (words.length >= 3) {
        const lastResort1 = words.slice(0, 3).join(' ');
        if (lastResort1 && !finalQueries.includes(lastResort1)) {
          finalQueries.push(lastResort1);
        }
      }
      
      if (finalQueries.length < 2 && words.length >= 2) {
        const lastResort2 = words.slice(0, 2).join(' ');
        if (lastResort2 && !finalQueries.includes(lastResort2)) {
          finalQueries.push(lastResort2);
        }
      }
      
      // Absolute last resort: use single words if we have them
      if (finalQueries.length < 2 && words.length >= 1) {
        for (let i = 0; i < words.length && finalQueries.length < 2; i++) {
          if (words[i] && !finalQueries.includes(words[i])) {
            finalQueries.push(words[i]);
          }
        }
      }
    }

    return finalQueries;
  }

  /**
   * Extract questions from section content and convert them to search queries.
   * 
   * Questions are identified by:
   * - Ending with a question mark
   * - Starting with question words (what, how, why, when, where, which, who)
   * 
   * Conversion strategy:
   * - Remove question mark
   * - Extract key terms (remove stop words)
   * - Keep domain-specific terms
   * 
   * Requirement 11.3: Convert questions to search queries
   * 
   * @param section The section to extract questions from
   * @returns Array of search queries derived from questions
   */
  private extractQuestionsAsQueries(section: OutlineSection): string[] {
    const queries: string[] = [];
    const content = section.content.join(' ');

    // Split into sentences and find questions
    const sentences = content.split(/[.!?]+/).map(s => s.trim());

    for (const sentence of sentences) {
      // Check if it's a question (ends with ? or starts with question word)
      const isQuestion = sentence.endsWith('?') || 
                        /^(what|how|why|when|where|which|who)\b/i.test(sentence);

      if (isQuestion && sentence.length > 10) {
        // Remove question mark and extract key terms
        const cleaned = sentence.replace(/\?/g, '').trim();
        const keyTerms = this.extractKeyTerms(cleaned);
        
        if (keyTerms.length >= 2) {
          queries.push(keyTerms.join(' '));
        }
      }
    }

    return queries;
  }

  /**
   * Extract key terms from section title.
   * 
   * Strategy:
   * - Remove section numbers (e.g., "2.1")
   * - Remove stop words
   * - Keep meaningful terms
   * 
   * Requirement 11.2: Extract key terms from section title
   * 
   * @param title The section title
   * @returns A search query based on the title, or empty string if no terms found
   */
  private extractKeyTermsFromTitle(title: string): string {
    // Remove section numbers like "2.1" or "2.1.3"
    const cleaned = title.replace(/^\d+(\.\d+)*\s*/, '').trim();
    
    // Extract key terms
    const keyTerms = this.extractKeyTerms(cleaned);
    
    return keyTerms.length > 0 ? keyTerms.join(' ') : '';
  }

  /**
   * Extract domain-specific terminology from section content.
   * 
   * Strategy:
   * - Look for technical terms (capitalized words, hyphenated terms)
   * - Look for phrases containing domain indicators
   * - Extract noun phrases
   * 
   * Requirement 11.2: Extract domain-specific terminology
   * 
   * @param section The section to extract terminology from
   * @returns Array of search queries based on domain terminology
   */
  private extractDomainSpecificQueries(section: OutlineSection): string[] {
    const queries: string[] = [];
    const content = section.content.join(' ');

    // Find capitalized terms (potential technical terms)
    const capitalizedTerms = content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    
    // Find hyphenated terms (often technical)
    const hyphenatedTerms = content.match(/\b[a-z]+-[a-z]+(?:-[a-z]+)*\b/gi) || [];

    // Find phrases with domain indicators
    const domainPhrases: string[] = [];
    for (const indicator of this.DOMAIN_INDICATORS) {
      const regex = new RegExp(`\\b\\w+\\s+${indicator}\\b|\\b${indicator}\\s+\\w+\\b`, 'gi');
      const matches = content.match(regex) || [];
      domainPhrases.push(...matches);
    }

    // Combine all domain-specific terms
    const allTerms = [...capitalizedTerms, ...hyphenatedTerms, ...domainPhrases];

    // Create queries from the most relevant terms
    for (const term of allTerms.slice(0, 3)) {
      const cleaned = term.trim().toLowerCase();
      if (cleaned.length > 5) {
        queries.push(cleaned);
      }
    }

    return queries;
  }

  /**
   * Extract key phrases from section content.
   * 
   * Strategy:
   * - Look for noun phrases (sequences of meaningful words)
   * - Extract phrases around domain indicators
   * - Prioritize longer, more specific phrases
   * 
   * @param section The section to extract phrases from
   * @returns Array of search queries based on key phrases
   */
  private extractKeyPhrasesFromContent(section: OutlineSection): string[] {
    const queries: string[] = [];
    const content = section.content.join(' ');

    // Split into sentences
    const sentences = content.split(/[.!?]+/).map(s => s.trim());

    for (const sentence of sentences) {
      // Skip very short sentences
      if (sentence.length < 20) continue;

      // Extract key terms from the sentence
      const keyTerms = this.extractKeyTerms(sentence);

      // Create a query from the first 3-5 key terms
      if (keyTerms.length >= 3) {
        const query = keyTerms.slice(0, 5).join(' ');
        queries.push(query);
      }

      // Only take the first 2 sentences to avoid too many queries
      if (queries.length >= 2) break;
    }

    return queries;
  }

  /**
   * Create a general query from section title and content.
   * 
   * This is used as a fallback when specific queries cannot be generated.
   * 
   * @param section The section to create a query for
   * @returns A general search query
   */
  private createGeneralQuery(section: OutlineSection): string {
    // Combine title and first sentence of content
    const titleTerms = this.extractKeyTerms(section.title);
    const firstSentence = section.content.find(line => line.trim().length > 20) || '';
    const contentTerms = this.extractKeyTerms(firstSentence).slice(0, 3);

    const allTerms = [...titleTerms, ...contentTerms];
    const query = allTerms.slice(0, 5).join(' ');
    
    // If we still don't have a query, use the title words directly
    if (!query && section.title) {
      const titleWords = this.extractWords(section.title);
      return titleWords.slice(0, 5).join(' ');
    }
    
    return query;
  }

  /**
   * Extract key terms from text by removing stop words and keeping meaningful terms.
   * 
   * Strategy:
   * - Convert to lowercase
   * - Extract words (alphanumeric sequences)
   * - Remove stop words
   * - Remove very short words (< 3 chars)
   * - Keep words that appear to be domain-specific
   * 
   * @param text The text to extract terms from
   * @returns Array of key terms
   */
  private extractKeyTerms(text: string): string[] {
    const words = this.extractWords(text);
    
    // Filter out stop words and short words
    const keyTerms = words.filter(word => {
      const lower = word.toLowerCase();
      return !this.STOP_WORDS.has(lower) && word.length >= 3;
    });

    return keyTerms;
  }

  /**
   * Extract words from text.
   * 
   * @param text The text to extract words from
   * @returns Array of words
   */
  private extractWords(text: string): string[] {
    // Extract alphanumeric sequences, including hyphenated words
    const words = text.match(/\b[a-z0-9]+(?:-[a-z0-9]+)*\b/gi) || [];
    return words.map(w => w.toLowerCase());
  }
}
