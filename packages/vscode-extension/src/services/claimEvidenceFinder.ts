import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingService } from './embeddingService';

/**
 * Evidence types distinguish between abstract leads and verified full-text quotes
 */
export type EvidenceType = 'abstract_lead' | 'verified_text';

/**
 * Evidence structure for claim support
 */
export interface Evidence {
  type: EvidenceType;
  content: string;
  confidence: number;
  sourceId: string; // DOI or Zotero key
  location?: string; // e.g., "Methods, paragraph 3"
  context?: string; // Surrounding text for context
}

/**
 * Result from semantic search in full text
 */
export interface SemanticMatch {
  text: string;
  score: number;
  location: string;
  context: string;
}

/**
 * Service for finding evidence in full-text papers using semantic search
 * Implements the "two-speed" approach: fast for open access, slow for paywalled
 */
export class ClaimEvidenceFinder {
  private embeddingService: EmbeddingService;
  private readonly SIMILARITY_THRESHOLD = 0.75; // Minimum score to consider a match
  private readonly CONTEXT_SENTENCES = 2; // Sentences before/after for context
  private readonly TOP_K_MATCHES = 3; // Return top 3 matches

  constructor(
    private workspaceRoot: string,
    embeddingService?: EmbeddingService
  ) {
    this.embeddingService = embeddingService || new EmbeddingService();
  }

  /**
   * Find evidence for a claim in extracted full text
   * This is the core "RAG" logic for upgrading abstract leads to verified quotes
   */
  async findEvidenceInFullText(
    claimText: string,
    extractedTextPath: string,
    sourceId: string
  ): Promise<Evidence | null> {
    try {
      // Read extracted text
      if (!fs.existsSync(extractedTextPath)) {
        console.warn(`[ClaimEvidenceFinder] Extracted text not found: ${extractedTextPath}`);
        return null;
      }

      const fullText = fs.readFileSync(extractedTextPath, 'utf-8');
      
      // Find best semantic matches
      const matches = await this.findSemanticMatches(claimText, fullText);
      
      if (matches.length === 0 || matches[0].score < this.SIMILARITY_THRESHOLD) {
        console.log(`[ClaimEvidenceFinder] No strong matches found (best: ${matches[0]?.score || 0})`);
        return null;
      }

      const bestMatch = matches[0];
      
      return {
        type: 'verified_text',
        content: bestMatch.text,
        confidence: bestMatch.score,
        sourceId,
        location: bestMatch.location,
        context: bestMatch.context
      };
    } catch (error) {
      console.error('[ClaimEvidenceFinder] Error finding evidence:', error);
      return null;
    }
  }

  /**
   * Perform semantic search on full text to find relevant passages
   * Uses embeddings + cosine similarity for matching
   */
  private async findSemanticMatches(
    claimText: string,
    fullText: string
  ): Promise<SemanticMatch[]> {
    // 1. Split text into chunks (paragraphs or sentence groups)
    const chunks = this.chunkText(fullText);
    
    if (chunks.length === 0) {
      return [];
    }

    // 2. Generate embedding for claim
    const claimEmbedding = await this.embeddingService.embed(claimText);
    if (!claimEmbedding) {
      console.warn('[ClaimEvidenceFinder] Failed to generate claim embedding');
      return [];
    }

    // 3. Generate embeddings for all chunks and calculate similarities
    const matches: SemanticMatch[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkEmbedding = await this.embeddingService.embed(chunk.text);
      
      if (!chunkEmbedding) {
        continue;
      }

      // Calculate cosine similarity
      const similarity = this.cosineSimilarity(claimEmbedding, chunkEmbedding);
      
      if (similarity >= this.SIMILARITY_THRESHOLD) {
        matches.push({
          text: chunk.text,
          score: similarity,
          location: chunk.location,
          context: this.extractContext(chunks, i)
        });
      }
    }

    // 4. Sort by similarity and return top K
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, this.TOP_K_MATCHES);
  }

  /**
   * Chunk text into searchable segments
   * Uses paragraph-based chunking with section detection
   */
  private chunkText(text: string): Array<{ text: string; location: string }> {
    const chunks: Array<{ text: string; location: string }> = [];
    
    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 50);
    
    let currentSection = 'Introduction';
    const sectionHeaders = /^#+\s+(.*?)$/gm; // Markdown headers
    
    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i].trim();
      
      // Check if this is a section header
      const headerMatch = para.match(/^#+\s+(.*?)$/);
      if (headerMatch) {
        currentSection = headerMatch[1];
        continue;
      }
      
      // Skip very short paragraphs
      if (para.length < 50) {
        continue;
      }
      
      chunks.push({
        text: para,
        location: `${currentSection}, paragraph ${chunks.filter(c => c.location.startsWith(currentSection)).length + 1}`
      });
    }
    
    return chunks;
  }

  /**
   * Extract context around a chunk (surrounding text)
   */
  private extractContext(
    chunks: Array<{ text: string; location: string }>,
    index: number
  ): string {
    const start = Math.max(0, index - this.CONTEXT_SENTENCES);
    const end = Math.min(chunks.length, index + this.CONTEXT_SENTENCES + 1);
    
    return chunks
      .slice(start, end)
      .map(c => c.text)
      .join(' ... ');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Create an abstract lead (fallback when full text not available)
   */
  createAbstractLead(
    abstractText: string,
    sourceId: string
  ): Evidence {
    return {
      type: 'abstract_lead',
      content: abstractText,
      confidence: 0.5, // Low confidence for abstracts
      sourceId,
      location: 'Abstract'
    };
  }

  /**
   * Upgrade an abstract lead to verified text if full text becomes available
   * This is used in the "backfill" workflow when Zotero PDFs are added
   */
  async upgradeLeadToVerified(
    lead: Evidence,
    claimText: string,
    extractedTextPath: string
  ): Promise<Evidence | null> {
    if (lead.type !== 'abstract_lead') {
      return lead; // Already verified
    }

    return this.findEvidenceInFullText(claimText, extractedTextPath, lead.sourceId);
  }
}
