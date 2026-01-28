import * as vscode from 'vscode';
import { ClaimsManager } from './claimsManagerWrapper';
import { ReadingStatusManager } from './readingStatusManager';
import { QuoteVerificationService } from './quoteVerificationService';

export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: string }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}

export interface BatchProgress {
  current: number;
  total: number;
  currentItem: string;
  percentage: number;
}

export class BatchOperationHandler {
  constructor(
    private readonly claimsManager: ClaimsManager,
    private readonly readingStatusManager: ReadingStatusManager,
    private readonly quoteVerificationService: QuoteVerificationService
  ) {}

  /**
   * Mark multiple papers as read
   */
  public async markPapersAsRead(
    paperIds: string[],
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0
    };

    for (let i = 0; i < paperIds.length; i++) {
      const paperId = paperIds[i];
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: paperIds.length,
          currentItem: paperId,
          percentage: Math.round(((i + 1) / paperIds.length) * 100)
        });
      }

      try {
        this.readingStatusManager.setStatus(paperId, 'read');
        result.successful.push(paperId);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          item: paperId,
          error: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }

      result.totalProcessed++;
    }

    return result;
  }

  /**
   * Verify quotes for multiple claims
   */
  public async verifyClaimQuotes(
    claimIds: string[],
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0
    };

    const claims = await this.claimsManager.loadClaims();

    for (let i = 0; i < claimIds.length; i++) {
      const claimId = claimIds[i];
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: claimIds.length,
          currentItem: claimId,
          percentage: Math.round(((i + 1) / claimIds.length) * 100)
        });
      }

      try {
        const claim = claims.find(c => c.id === claimId);
        if (!claim) {
          throw new Error(`Claim ${claimId} not found`);
        }

        const verificationResult = await this.quoteVerificationService.verifyQuote(
          claim.primaryQuote.text,
          claim.primaryQuote.source
        );

        if (verificationResult.verified) {
          await this.claimsManager.updateClaim(claimId, { verified: true });
          result.successful.push(claimId);
          result.successCount++;
        } else {
          throw new Error(`Quote verification failed: similarity ${verificationResult.similarity}`);
        }
      } catch (error) {
        result.failed.push({
          item: claimId,
          error: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }

      result.totalProcessed++;
    }

    return result;
  }

  /**
   * Reassign multiple claims to new sections
   */
  public async reassignClaims(
    claimIds: string[],
    newSectionIds: string[],
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0
    };

    for (let i = 0; i < claimIds.length; i++) {
      const claimId = claimIds[i];
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: claimIds.length,
          currentItem: claimId,
          percentage: Math.round(((i + 1) / claimIds.length) * 100)
        });
      }

      try {
        await this.claimsManager.updateClaim(claimId, {
          sections: newSectionIds
        });
        result.successful.push(claimId);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          item: claimId,
          error: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }

      result.totalProcessed++;
    }

    return result;
  }

  /**
   * Delete multiple claims
   */
  public async deleteClaims(
    claimIds: string[],
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0
    };

    for (let i = 0; i < claimIds.length; i++) {
      const claimId = claimIds[i];
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: claimIds.length,
          currentItem: claimId,
          percentage: Math.round(((i + 1) / claimIds.length) * 100)
        });
      }

      try {
        await this.claimsManager.deleteClaim(claimId);
        result.successful.push(claimId);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          item: claimId,
          error: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }

      result.totalProcessed++;
    }

    return result;
  }

  /**
   * Update category for multiple claims
   */
  public async updateClaimCategories(
    claimIds: string[],
    newCategory: string,
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0
    };

    for (let i = 0; i < claimIds.length; i++) {
      const claimId = claimIds[i];
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: claimIds.length,
          currentItem: claimId,
          percentage: Math.round(((i + 1) / claimIds.length) * 100)
        });
      }

      try {
        await this.claimsManager.updateClaim(claimId, {
          category: newCategory
        });
        result.successful.push(claimId);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          item: claimId,
          error: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }

      result.totalProcessed++;
    }

    return result;
  }

  /**
   * Extract claims from multiple papers
   */
  public async extractClaimsFromPapers(
    paperPaths: string[],
    extractorCallback: (paperPath: string) => Promise<any[]>,
    progressCallback?: (progress: BatchProgress) => void
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failureCount: 0
    };

    for (let i = 0; i < paperPaths.length; i++) {
      const paperPath = paperPaths[i];
      
      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total: paperPaths.length,
          currentItem: paperPath,
          percentage: Math.round(((i + 1) / paperPaths.length) * 100)
        });
      }

      try {
        const extractedClaims = await extractorCallback(paperPath);
        
        // Save each extracted claim
        for (const claim of extractedClaims) {
          await this.claimsManager.saveClaim(claim);
        }

        result.successful.push(paperPath);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          item: paperPath,
          error: error instanceof Error ? error.message : String(error)
        });
        result.failureCount++;
      }

      result.totalProcessed++;
    }

    return result;
  }

  /**
   * Show progress in VS Code with cancellation support
   */
  public async withProgress<T>(
    title: string,
    operation: (
      progress: vscode.Progress<{ message?: string; increment?: number }>,
      token: vscode.CancellationToken
    ) => Promise<T>
  ): Promise<T> {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: true
      },
      operation
    );
  }

  /**
   * Format batch operation result for display
   */
  public formatResult<T>(result: BatchOperationResult<T>): string {
    const lines: string[] = [];
    
    lines.push(`Batch Operation Complete`);
    lines.push(`Total Processed: ${result.totalProcessed}`);
    lines.push(`Successful: ${result.successCount}`);
    lines.push(`Failed: ${result.failureCount}`);

    if (result.failed.length > 0) {
      lines.push('');
      lines.push('Failures:');
      result.failed.forEach(({ item, error }) => {
        lines.push(`  - ${item}: ${error}`);
      });
    }

    return lines.join('\n');
  }
}
