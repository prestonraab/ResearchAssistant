import * as vscode from 'vscode';
import type { Claim, EmbeddingService } from '@research-assistant/core';
import { ClaimsManager } from './claimsManagerWrapper';
import { getLogger } from './loggingService';
import { UnifiedQuoteSearch } from '../services/unifiedQuoteSearch';
import { LiteratureIndexer } from '../services/literatureIndexer';

interface VerificationResult {
  verified: boolean;
  similarity: number;
  closestMatch?: string;
  context?: string;
}

interface VerificationQueueItem {
  claim: Claim;
  timestamp: number;
  retryCount: number;
}

/**
 * AutoQuoteVerifier automatically verifies quotes when claims are saved.
 * Implements Requirements 43.1, 43.2, 43.3, 43.4, 43.5
 */
export class AutoQuoteVerifier {
  private verificationQueue: VerificationQueueItem[] = [];
  private isProcessing = false;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 5000; // 5 seconds
  private readonly BATCH_SIZE = 3; // Process 3 verifications at a time
  private logger = getLogger();
  private onDidVerifyEmitter = new vscode.EventEmitter<{ claimId: string; verified: boolean }>();
  public readonly onDidVerify = this.onDidVerifyEmitter.event;
  private unifiedQuoteSearch: UnifiedQuoteSearch;

  constructor(
    private claimsManager: ClaimsManager,
    private embeddingService?: EmbeddingService
  ) {
    this.logger.info('AutoQuoteVerifier initialized');
    
    // Initialize unified quote search service with embedding service
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const literatureIndexer = new LiteratureIndexer(workspaceRoot, this.embeddingService || undefined);
    this.unifiedQuoteSearch = new UnifiedQuoteSearch(literatureIndexer, workspaceRoot);
  }

  /**
   * Verify a claim's quote on save (non-blocking)
   * Requirement 43.1: Hook into claim save operation
   */
  verifyOnSave(claim: Claim): void {
    // Only verify if claim has a quote and source
    if (!claim.primaryQuote || !claim.primaryQuote.text || !claim.primaryQuote.source) {
      this.logger.debug(`Skipping verification for ${claim.id}: no quote or source`);
      return;
    }

    // Add to queue
    this.addToQueue(claim);

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processVerificationQueue();
    }
  }

  /**
   * Add a claim to the verification queue
   */
  private addToQueue(claim: Claim): void {
    // Check if already in queue
    const existingIndex = this.verificationQueue.findIndex(item => item.claim.id === claim.id);
    
    if (existingIndex >= 0) {
      // Update existing queue item
      this.verificationQueue[existingIndex] = {
        claim,
        timestamp: Date.now(),
        retryCount: 0
      };
      this.logger.debug(`Updated ${claim.id} in verification queue`);
    } else {
      // Add new item
      this.verificationQueue.push({
        claim,
        timestamp: Date.now(),
        retryCount: 0
      });
      this.logger.debug(`Added ${claim.id} to verification queue (queue size: ${this.verificationQueue.length})`);
    }
  }

  /**
   * Process the verification queue in background
   * Requirement 43.4: Queue verification in background to avoid blocking
   */
  async processVerificationQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.logger.info('Starting verification queue processing');

    try {
      while (this.verificationQueue.length > 0) {
        // Process in batches to avoid overwhelming the system
        const batch = this.verificationQueue.splice(0, this.BATCH_SIZE);
        
        this.logger.debug(`Processing batch of ${batch.length} verifications`);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(item => this.verifyClaimQuote(item))
        );

        // Handle results
        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const item = batch[i];

          if (result.status === 'rejected') {
            this.logger.error(`Verification failed for ${item.claim.id}:`, result.reason);
            
            // Retry if under limit
            if (item.retryCount < this.MAX_RETRIES) {
              item.retryCount++;
              this.logger.info(`Retrying ${item.claim.id} (attempt ${item.retryCount}/${this.MAX_RETRIES})`);
              
              // Add back to queue with delay
              setTimeout(() => {
                this.verificationQueue.push(item);
              }, this.RETRY_DELAY);
            } else {
              this.logger.warn(`Max retries reached for ${item.claim.id}`);
            }
          }
        }

        // Small delay between batches
        if (this.verificationQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.logger.info('Verification queue processing complete');
    } catch (error) {
      this.logger.error('Error processing verification queue:', error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Verify a single claim's quote using hybrid search strategy
   */
  private async verifyClaimQuote(item: VerificationQueueItem): Promise<void> {
    const { claim } = item;
    
    this.logger.debug(`Verifying quote for ${claim.id}`);

    try {
      const quoteText = claim.primaryQuote.text;
      
      // Use unified quote search to find best match
      const results = await this.unifiedQuoteSearch.search(quoteText, 5);
      
      // Auto-update metadata and source if we found a match
      const existingMetadata = claim.primaryQuote.metadata;
      if (results.length > 0) {
        const topMatch = results[0];
        const needsUpdate = !existingMetadata || 
                            existingMetadata.sourceFile !== topMatch.sourceFile ||
                            existingMetadata.startLine !== topMatch.startLine ||
                            existingMetadata.endLine !== topMatch.endLine;
        
        if (needsUpdate) {
          claim.primaryQuote.metadata = {
            sourceFile: topMatch.sourceFile,
            startLine: topMatch.startLine!,
            endLine: topMatch.endLine!
          };
          
          // Update source to match actual file
          const sourceFileName = topMatch.sourceFile.replace(/\.txt$/, '');
          const authorYearMatch = sourceFileName.match(/^([^-]+)\s*-\s*(\d{4})/);
          if (authorYearMatch) {
            const authorYear = `${authorYearMatch[1].trim().split(' ')[0]}${authorYearMatch[2]}`;
            claim.primaryQuote.source = authorYear;
          }
          
          await this.claimsManager.updateClaim(claim.id, claim);
          this.logger.info(`Auto-updated source for ${claim.id} to ${claim.primaryQuote.source}`);
        }
      }
      
      // Create verification result
      const verified = results.length > 0 && results[0].similarity >= 0.9;
      const result: VerificationResult = {
        verified,
        similarity: results.length > 0 ? results[0].similarity : 0,
        closestMatch: results.length > 0 ? results[0].matchedText : undefined
      };

      // Update verification status
      await this.updateVerificationStatus(claim.id, result);

    } catch (error) {
      this.logger.error(`Verification error for ${claim.id}:`, error instanceof Error ? error : new Error(String(error)));
      throw error; // Re-throw to trigger retry logic
    }
  }

  /**
   * Update claim verification status based on result
   * Requirement 43.2: Update claim verification status silently on success
   * Requirement 43.3: Show warning with closest match on failure
   */
  private async updateVerificationStatus(
    claimId: string,
    result: VerificationResult
  ): Promise<void> {
    try {
      // Update claim in database
      await this.claimsManager.updateClaim(claimId, {
        verified: result.verified
      });

      // Fire event for tree view update
      this.onDidVerifyEmitter.fire({
        claimId,
        verified: result.verified
      });

      if (result.verified) {
        // Requirement 43.2: Silent success
        this.logger.info(`✓ Quote verified for ${claimId} (similarity: ${(result.similarity * 100).toFixed(1)}%)`);
      } else {
        // Requirement 43.3: Show warning with closest match
        this.showVerificationWarning(claimId, result);
      }
    } catch (error) {
      this.logger.error(`Failed to update verification status for ${claimId}:`, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Show verification warning with closest match
   * Requirement 43.3: Show warning with closest match on failure
   */
  private showVerificationWarning(claimId: string, result: VerificationResult): void {
    const claim = this.claimsManager.getClaim(claimId);
    if (!claim) {
      return;
    }

    const similarityPercent = (result.similarity * 100).toFixed(1);
    
    let message = `⚠️ Quote verification failed for ${claimId}\n\n`;
    message += `**Similarity:** ${similarityPercent}%\n\n`;
    
    if (result.closestMatch) {
      const quoteText = claim.primaryQuote?.text || '';
      const quotePreview = quoteText.substring(0, 150);
      const quoteSuffix = quoteText.length > 150 ? '...' : '';
      message += `**Your quote:**\n"${quotePreview}${quoteSuffix}"\n\n`;
      
      const matchPreview = result.closestMatch.substring(0, 150);
      const matchSuffix = result.closestMatch.length > 150 ? '...' : '';
      message += `**Closest match found:**\n"${matchPreview}${matchSuffix}"\n\n`;
    }

    if (result.context) {
      message += `**Context:**\n${result.context}\n\n`;
    }

    this.logger.warn(`Quote verification failed for ${claimId} (similarity: ${similarityPercent}%)`);

    // Show warning notification with actions
    vscode.window.showWarningMessage(
      `Quote verification failed for ${claimId} (${similarityPercent}% match)`,
      'View Details',
      'Edit Claim',
      'Ignore'
    ).then(async (selection) => {
      if (selection === 'View Details') {
        // Show detailed message in modal
        vscode.window.showInformationMessage(message, { modal: true });
      } else if (selection === 'Edit Claim') {
        // Open claim for editing
        vscode.commands.executeCommand('researchAssistant.showClaimDetails', claimId);
      }
      // 'Ignore' does nothing
    });
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.verificationQueue.length;
  }

  /**
   * Check if currently processing
   */
  isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  /**
   * Clear the verification queue
   */
  clearQueue(): void {
    this.verificationQueue = [];
    this.logger.info('Verification queue cleared');
  }

  /**
   * Manually trigger verification for a specific claim
   */
  async verifyClaimManually(claimId: string): Promise<VerificationResult | null> {
    const claim = this.claimsManager.getClaim(claimId);
    
    if (!claim) {
      this.logger.warn(`Cannot verify ${claimId}: claim not found`);
      return null;
    }

    if (!claim.primaryQuote || !claim.primaryQuote.text || !claim.primaryQuote.source) {
      this.logger.warn(`Cannot verify ${claimId}: missing quote or source`);
      return null;
    }

    try {
      this.logger.info(`Manual verification requested for ${claimId}`);
      
      // Use unified quote search to find best match
      const results = await this.unifiedQuoteSearch.search(claim.primaryQuote.text, 5);
      
      // Create verification result
      const verified = results.length > 0 && results[0].similarity >= 0.9;
      const result: VerificationResult = {
        verified,
        similarity: results.length > 0 ? results[0].similarity : 0,
        closestMatch: results.length > 0 ? results[0].matchedText : undefined
      };

      await this.updateVerificationStatus(claimId, result);
      
      return result;
    } catch (error) {
      this.logger.error(`Manual verification failed for ${claimId}:`, error instanceof Error ? error : new Error(String(error)));
      vscode.window.showErrorMessage(`Failed to verify ${claimId}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Batch verify all unverified claims
   * Also automatically finds and updates sources for quotes without metadata
   */
  async verifyAllUnverified(): Promise<void> {
    const claims = this.claimsManager.getClaims();
    const unverified = claims.filter(c => !c.verified && c.primaryQuote && c.primaryQuote.text);

    if (unverified.length === 0) {
      vscode.window.showInformationMessage('All claims with quotes are already verified');
      return;
    }

    const proceed = await vscode.window.showInformationMessage(
      `Verify ${unverified.length} unverified claim${unverified.length !== 1 ? 's' : ''}? This will also find and update sources automatically.`,
      'Yes',
      'No'
    );

    if (proceed !== 'Yes') {
      return;
    }

    this.logger.info(`Batch verification started for ${unverified.length} claims`);

    // Add all to queue
    for (const claim of unverified) {
      this.addToQueue(claim);
    }

    // Show progress
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Verifying quotes and finding sources',
        cancellable: false
      },
      async (progress) => {
        const total = unverified.length;
        let completed = 0;

        // Listen for verification events
        const disposable = this.onDidVerify(() => {
          completed++;
          progress.report({
            message: `${completed}/${total} verified`,
            increment: (1 / total) * 100
          });
        });

        // Start processing
        await this.processVerificationQueue();

        disposable.dispose();

        return;
      }
    );

    vscode.window.showInformationMessage(`Batch verification complete`);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearQueue();
    this.onDidVerifyEmitter.dispose();
  }
}
