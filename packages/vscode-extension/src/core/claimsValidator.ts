import * as fs from 'fs/promises';
import * as path from 'path';
import type { Claim } from '@research-assistant/core';
import { PersistenceUtils } from './persistenceUtils';

/**
 * Handles validation and enrichment of claims.
 * Responsible for validating claim data and inferring missing information.
 */
export class ClaimsValidator {
  /**
   * Validate a claim before saving
   */
  static validateClaim(claim: Claim): { valid: boolean; errors: string[] } {
    return PersistenceUtils.validateClaim(claim);
  }

  /**
   * Infer source (author-year) from extracted text filenames for claims without sources.
   * Uses the primary quote to find matching files.
   */
  static async inferMissingSources(
    claims: Claim[],
    workspaceRoot: string
  ): Promise<void> {
    const extractedTextPath = path.join(
      workspaceRoot,
      'literature',
      'ExtractedText'
    );

    try {
      const files = await fs.readdir(extractedTextPath);
      const txtFiles = files.filter(f => f.endsWith('.txt'));

      for (const claim of claims) {
        // Skip if already has a source in primaryQuote
        if (claim.primaryQuote && claim.primaryQuote.source && 
            claim.primaryQuote.source !== 'Unknown' && claim.primaryQuote.source !== '') {
          continue;
        }

        // Skip if no primary quote to search with
        if (!claim.primaryQuote || !claim.primaryQuote.text) {
          continue;
        }

        // Search for the quote in all files
        const quoteWords = claim.primaryQuote.text
          .toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 10); // Use first 10 significant words

        for (const file of txtFiles) {
          try {
            const filePath = path.join(extractedTextPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const normalizedContent = content.toLowerCase();

            // Check if enough quote words appear in the file
            const matchCount = quoteWords.filter(word => 
              normalizedContent.includes(word)
            ).length;

            if (matchCount >= Math.min(5, quoteWords.length * 0.6)) {
              // Extract author-year from filename
              const authorYear = this.extractAuthorYearFromFilename(file);
              if (authorYear) {
                claim.primaryQuote.source = authorYear;
                break;
              }
            }
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }
      }
    } catch (error) {
      // ExtractedText directory doesn't exist or can't be read
      console.warn('Could not infer sources from extracted text:', error);
    }
  }

  /**
   * Extract author-year from filename.
   * Handles formats like "Buus et al. - 2021 - Title.txt" -> "Buus2021"
   */
  private static extractAuthorYearFromFilename(filename: string): string | null {
    // Remove extension
    const baseName = path.basename(filename, path.extname(filename));
    
    // Try to extract year (4 digits)
    const yearMatch = baseName.match(/\b(\d{4})\b/);
    if (!yearMatch) {
      return null;
    }
    const year = yearMatch[1];

    // Try to extract first author (text before " et al." or " - ")
    const authorMatch = baseName.match(/^([A-Z][a-z]+)/);
    if (!authorMatch) {
      return null;
    }
    const author = authorMatch[1];

    return `${author}${year}`;
  }

  /**
   * Restore verification status from cache for claims with quotes.
   * This ensures verification status persists across extension reloads.
   */
  static async restoreVerificationStatus(
    claims: Claim[],
    workspaceRoot: string
  ): Promise<void> {
    // Import the cache here to avoid circular dependencies
    const { QuoteVerificationCache } = await import('@research-assistant/core');
    
    try {
      const cache = new QuoteVerificationCache(workspaceRoot);
      await cache.initialize();
      
      let restoredCount = 0;
      
      for (const claim of claims) {
        // Skip claims without primary quotes
        if (!claim.primaryQuote || !claim.primaryQuote.text || !claim.primaryQuote.source) {
          continue;
        }
        
        // Check cache for this quote
        const cached = cache.get(claim.primaryQuote.text, claim.primaryQuote.source);
        if (cached) {
          claim.verified = cached.verified;
          claim.primaryQuote.verified = cached.verified;
          restoredCount++;
        }
      }
      
      if (restoredCount > 0) {
        console.log(`[ClaimsValidator] Restored verification status for ${restoredCount} claims from cache`);
      }
    } catch (error) {
      console.warn('[ClaimsValidator] Failed to restore verification status from cache:', error);
    }
  }
}
