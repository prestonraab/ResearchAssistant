import * as fs from 'fs/promises';
import * as path from 'path';
import type { Claim } from '@research-assistant/core';
import { PersistenceUtils } from './persistenceUtils';
import { ClaimsParser } from './claimsParser';

interface ClaimFileMapping {
  [claimId: string]: string; // Maps claim ID to category file path
}

/**
 * Handles persistence of claims to disk.
 * Responsible for writing claims to files with atomic operations and error handling.
 */
export class ClaimsPersistence {
  private writeQueue: Promise<void> = Promise.resolve();
  private isWriting: boolean = false;

  /**
   * Queue a persistence operation to prevent race conditions
   * All writes are serialized through this queue
   */
  async queuePersist(
    persistFn: () => Promise<void>
  ): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(() => persistFn())
      .catch(error => {
        console.error('Error in write queue:', error);
        throw error;
      });
    
    return this.writeQueue;
  }

  /**
   * Persist claims to disk, grouped by file
   */
  async persistClaims(
    claims: Claim[],
    claimToFileMap: ClaimFileMapping,
    getDefaultFileForClaim: (claim: Claim) => string
  ): Promise<void> {
    this.isWriting = true;
    try {
      // Group claims by their source file
      const claimsByFile = new Map<string, Claim[]>();
      
      for (const claim of claims) {
        const filePath = claimToFileMap[claim.id] || getDefaultFileForClaim(claim);
        
        if (!claimsByFile.has(filePath)) {
          claimsByFile.set(filePath, []);
        }
        claimsByFile.get(filePath)!.push(claim);
      }
      
      // Write each file with atomic writes and retry logic
      const writeResults: Array<{ filePath: string; success: boolean; error?: Error }> = [];
      for (const [filePath, fileClaims] of claimsByFile.entries()) {
        try {
          const content = ClaimsParser.buildClaimsFileContent(filePath, fileClaims);
          
          const result = await PersistenceUtils.writeFileAtomic(filePath, content, {
            maxRetries: 3,
            initialDelayMs: 100
          });
          
          if (!result.success) {
            writeResults.push({ filePath, success: false, error: result.error });
            console.error(`Failed to persist claims to ${filePath}:`, result.error);
          } else {
            writeResults.push({ filePath, success: true });
          }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          writeResults.push({ filePath, success: false, error: err });
          console.error(`Error persisting claims to ${filePath}:`, err);
        }
      }
      
      // Check if all writes succeeded
      const failedWrites = writeResults.filter(r => !r.success);
      if (failedWrites.length > 0) {
        const errorMessage = failedWrites.map(w => `${w.filePath}: ${w.error?.message}`).join('\n');
        console.error('Some claims failed to persist:', errorMessage);
        
        // Show error to user with retry option
        await PersistenceUtils.showPersistenceError(
          new Error(`Failed to save ${failedWrites.length} file(s)`),
          'save claims',
          failedWrites[0].filePath,
          () => this.persistClaims(claims, claimToFileMap, getDefaultFileForClaim)
        );
        
        throw new Error(`Failed to persist ${failedWrites.length} file(s)`);
      }
      
      console.log(`Persisted ${claims.length} claims across ${claimsByFile.size} file(s)`);
    } catch (error) {
      console.error('Error persisting claims:', error);
      throw error;
    } finally {
      this.isWriting = false;
    }
  }

  /**
   * Write file content with incremental checking
   */
  async writeFileIncremental(filePath: string, newContent: string): Promise<void> {
    try {
      // Check if file exists and read current content
      let existingContent = '';
      try {
        existingContent = await fs.readFile(filePath, 'utf-8');
      } catch {
        // File doesn't exist, will create new
      }

      // Only write if content has changed
      if (existingContent !== newContent) {
        // Use atomic write
        const result = await PersistenceUtils.writeFileAtomic(filePath, newContent);
        if (!result.success) {
          throw result.error || new Error('Unknown write error');
        }
      }
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Remove a claim from a file
   */
  async removeClaimFromFile(filePath: string, claimId: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const claimHeaderRegex = new RegExp(`## ${claimId}:.*?(?=##|$)`, 'gs');
      const newContent = fileContent.replace(claimHeaderRegex, '').trim();
      
      if (newContent) {
        await fs.writeFile(filePath, newContent + '\n', 'utf-8');
      } else {
        // If file is now empty, delete it
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.warn(`Could not remove claim from file ${filePath}:`, error);
    }
  }

  /**
   * Check if currently writing
   */
  isCurrentlyWriting(): boolean {
    return this.isWriting;
  }
}
