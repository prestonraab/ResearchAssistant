import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { CachingService } from '../services/cachingService';
import { getBenchmark } from '../core/performanceBenchmark';
import { getImmersiveModeManager } from './immersiveModeManager';
import { ZoteroDirectService } from '../services/zoteroDirectService';
import { LiteratureIndexer } from '../services/literatureIndexer';
import { VerificationFeedbackLoop } from '../services/verificationFeedbackLoop';
import { getModeContextManager } from '../core/modeContextManager';
import { DataValidationService } from '../core/dataValidationService';
import { SentenceClaimMapper } from '../core/sentenceClaimMapper';
import { UnifiedQuoteSearch } from '../services/unifiedQuoteSearch';
import { getOperationTracker } from '../services/operationTracker';

/**
 * ClaimReviewProvider - Webview panel provider for claim review mode
 * Displays claim details with verification, validation, and manuscript usage in main editor area
 * Includes memory management and caching for performance
 * 
 * Supports non-blocking claim switching via AbortController-based cancellation.
 * When switching claims, ongoing operations are cancelled and partial progress is saved.
 */
export class ClaimReviewProvider {
  public static readonly viewType = 'researchAssistant.claimReview';
  private panel?: vscode.WebviewPanel;
  private panelDisposed: boolean = false;
  private currentClaimId?: string;
  private disposables: vscode.Disposable[] = [];
  private claimDetailsCache: CachingService<any>;
  private disposalManager = getWebviewDisposalManager();
  private benchmark = getBenchmark();
  private immersiveModeManager = getImmersiveModeManager();
  private zoteroService: ZoteroDirectService;
  private literatureIndexer: LiteratureIndexer;
  private verificationFeedbackLoop: VerificationFeedbackLoop;
  private scrollPosition: number = 0; // Track scroll position for restoration
  private sentenceClaimMapper: SentenceClaimMapper;
  private unifiedQuoteSearch: UnifiedQuoteSearch;
  
  // Cancellation support for non-blocking claim switching
  private currentAbortController?: AbortController;
  private operationInProgress: boolean = false;

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.claimDetailsCache = new CachingService(500, 1800000); // 500 items, 30 min TTL
    this.zoteroService = new ZoteroDirectService();
    
    // Use shared literature indexer and unified quote search from extension state
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.literatureIndexer = this.extensionState.literatureIndexer;
    this.unifiedQuoteSearch = this.extensionState.unifiedQuoteSearch;
    
    // Initialize verification feedback loop with workspace root for cache
    this.verificationFeedbackLoop = new VerificationFeedbackLoop(
      this.literatureIndexer,
      undefined,
      undefined,
      workspaceRoot
    );
    
    // Initialize sentence-claim mapper with persistence
    this.sentenceClaimMapper = new SentenceClaimMapper(this.extensionState.claimsManager, context.workspaceState);
  }

  /**
   * Create and show claim review panel
   */
  async show(claimId?: string): Promise<void> {
    this.currentClaimId = claimId;

    // Benchmark mode loading
    await this.benchmark.benchmarkModeLoad('review', async () => {
      await this._showInternal();
    });
  }

  private async _showInternal(): Promise<void> {
    // If panel already exists and is not disposed, reveal it
    if (this.panel && !this.panelDisposed) {
      this.panel.reveal(vscode.ViewColumn.One);
      if (this.currentClaimId) {
        await this.loadAndDisplayClaim(this.currentClaimId);
      }
      return;
    }

    // Clear stale reference if panel was disposed
    if (this.panelDisposed) {
      this.panel = undefined;
      this.panelDisposed = false;
    }

    // Create new panel
    this.panel = vscode.window.createWebviewPanel(
      ClaimReviewProvider.viewType,
      'Claim Review',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
        retainContextWhenHidden: true
      }
    );

    // Register with immersive mode manager (closes other immersive panels)
    this.immersiveModeManager.registerPanel(this.panel, ClaimReviewProvider.viewType);

    // Register with disposal manager
    this.disposalManager.registerWebview(ClaimReviewProvider.viewType, this.panel.webview);
    this.disposalManager.startMemoryMonitoring(ClaimReviewProvider.viewType, () => {
      this.handleHighMemory();
    });

    // Load HTML content
    this.panel.webview.html = await this.getHtmlContent(this.panel.webview);

    // Handle messages from webview
    const messageListener = this.panel.webview.onDidReceiveMessage(
      (message) => this.handleMessage(message),
      undefined,
      this.disposables
    );

    this.disposalManager.registerDisposable(ClaimReviewProvider.viewType, messageListener);

    // Handle webview disposal
    const disposalListener = this.panel.onDidDispose(() => {
      this.panelDisposed = true;
      this.dispose();
    });

    this.disposables.push(disposalListener);

    // If we have a current claim ID, load it
    if (this.currentClaimId) {
      await this.loadAndDisplayClaim(this.currentClaimId);
    }
  }

  /**
   * Open a claim in review mode (alias for show)
   */
  async openClaim(claimId: string): Promise<void> {
    await this.show(claimId);
  }

  /**
   * Load and display a claim
   * Supports cancellation via AbortController for non-blocking claim switching
   */
  private async loadAndDisplayClaim(claimId: string): Promise<void> {
    if (!this.panel) {
      return;
    }

    // Cancel any ongoing operations for the previous claim
    if (this.currentAbortController) {
      console.log('[ClaimReview] Cancelling previous claim operations');
      this.currentAbortController.abort();
      
      // Notify webview that previous operations were cancelled
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'operationsCancelled',
          reason: 'Switching to new claim'
        });
      }
    }
    
    // Create new abort controller for this claim
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;
    this.operationInProgress = true;

    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        this.panel.webview.postMessage({
          type: 'error',
          message: `Claim ${claimId} not found`
        });
        return;
      }

      // Auto-categorize the claim
      let suggestedCategory = claim.category;
      let availableCategories = [
        'Method', 'Result', 'Conclusion', 'Background', 'Challenge',
        'Data Source', 'Data Trend', 'Impact', 'Application', 'Phenomenon'
      ];
      
      // Note: Auto-categorization via MCP has been removed
      // The claim will use its existing category or default categories

      // Sanitize claim data for webview transmission
      const sanitizedClaim = DataValidationService.sanitizeClaimForWebview(claim);
      if (!sanitizedClaim) {
        this.panel.webview.postMessage({
          type: 'error',
          message: 'Invalid claim data'
        });
        return;
      }

      // Enhance with additional data
      const claimData: any = {
        ...sanitizedClaim,
        suggestedCategory,
        availableCategories
      };

      // Send initial claim data immediately (header + basic info)
      this.panel.webview.postMessage({
        type: 'loadClaim',
        claim: claimData,
        verificationResults: [],
        validationResult: null,
        usageLocations: [],
        scrollPosition: this.scrollPosition,
        isInitialLoad: true
      });

      // Store in mode context for potential return to editing mode
      // Preserve returnToSentenceId if it was already set
      const existingContext = getModeContextManager().getClaimReviewContext();
      getModeContextManager().setClaimReviewContext({
        claimId,
        claim: claimData,
        verificationResults: [],
        validationResult: undefined,
        usageLocations: [],
        returnToSentenceId: existingContext?.returnToSentenceId || undefined
      });
      
      console.log('[ClaimReview] Initial claim loaded, starting background operations');

      // Check if cancelled before starting heavy operations
      if (signal.aborted) {
        console.log('[ClaimReview] Operation cancelled before background work started');
        return;
      }

      // Check if claim has any quotes
      const hasQuotes = !!(
        (claim.primaryQuote && (typeof claim.primaryQuote === 'string' ? claim.primaryQuote : claim.primaryQuote.text)) ||
        (claim.supportingQuotes && claim.supportingQuotes.length > 0 && claim.supportingQuotes.some(q => q && q.text))
      );

      if (hasQuotes) {
        // WORKFLOW: Claim WITH quotes
        // 1. Check for cached validation and send if available
        // 2. Start quote verification immediately (with progress bar)
        // 3. Start usage locations (low cost, useful context)
        // 4. Validation runs on-demand if not cached
        
        console.log('[ClaimReview] Claim has quotes - starting verification workflow');

        // Check for cached validation result
        const cachedValidation = this.verificationFeedbackLoop.getCachedValidation(claim.text);
        if (cachedValidation) {
          console.log('[ClaimReview] Found cached validation result');
          cachedValidation.claimId = claimId;
          this.panel.webview.postMessage({
            type: 'updateValidationResult',
            validationResult: cachedValidation,
            isCached: true
          });
        } else {
          // No cached validation - tell webview to show "Validate Support" button
          this.panel.webview.postMessage({
            type: 'validationNotCached'
          });
        }

        // Run operations with cancellation support
        const verificationPromise = this.verifyAllQuotes(claim, signal).then(results => {
          if (signal.aborted) return [];
          console.log('[ClaimReview] Quote verification complete');
          
          // Fire verification events to update tree view
          this.fireVerificationEvents(claim, results);
          
          this.panel?.webview.postMessage({
            type: 'updateVerificationResults',
            verificationResults: results
          });
          return results;
        }).catch(err => {
          if (err.name === 'AbortError' || signal.aborted) {
            console.log('[ClaimReview] Quote verification cancelled');
            return [];
          }
          throw err;
        });

        const usagePromise = this.getManuscriptUsageLocations(claimId).then(locations => {
          if (signal.aborted) return [];
          console.log('[ClaimReview] Manuscript usage locations loaded');
          this.panel?.webview.postMessage({
            type: 'updateUsageLocations',
            usageLocations: locations
          });
          return locations;
        });

        // Load orphan citations
        const orphanPromise = this.getOrphanCitationsForClaim(claimId).then(orphans => {
          if (signal.aborted) return [];
          console.log('[ClaimReview] Orphan citations loaded:', orphans.length);
          this.panel?.webview.postMessage({
            type: 'displayOrphanCitations',
            orphanCitations: orphans
          });
          return orphans;
        });

        // Wait for verification, usage, and orphan citations (skip validation)
        const [verificationResults, usageLocations, orphanCitations] = await Promise.all([
          verificationPromise,
          usagePromise,
          orphanPromise
        ]);

        // Only update context if not cancelled
        if (!signal.aborted) {
          getModeContextManager().setClaimReviewContext({
            claimId,
            claim: claimData,
            verificationResults,
            validationResult: cachedValidation ? {
              supported: cachedValidation.supported,
              similarity: cachedValidation.similarity,
              suggestedQuotes: cachedValidation.suggestedQuotes || [],
              analysis: cachedValidation.analysis || ''
            } : undefined,
            usageLocations,
            returnToSentenceId: existingContext?.returnToSentenceId || undefined
          });
        }

      } else {
        // WORKFLOW: Claim WITHOUT quotes
        // 1. Auto-trigger "Find Quotes" action with progress bars
        // 2. Delay usage locations
        // 3. Load orphan citations
        // 4. Skip validation entirely
        
        console.log('[ClaimReview] Claim has no quotes - auto-triggering find quotes');

        // Notify webview that we're auto-searching
        this.panel.webview.postMessage({
          type: 'autoFindQuotesStarted'
        });

        // Auto-trigger find quotes search with cancellation support
        this.handleFindNewQuotes(claimId, claim.text, signal);

        // Delay usage locations and orphan citations by 500ms to reduce initial load
        setTimeout(async () => {
          if (signal.aborted) return;
          
          const locations = await this.getManuscriptUsageLocations(claimId);
          const orphans = await this.getOrphanCitationsForClaim(claimId);
          
          if (signal.aborted) return;
          
          console.log('[ClaimReview] Manuscript usage locations and orphan citations loaded (delayed)');
          this.panel?.webview.postMessage({
            type: 'updateUsageLocations',
            usageLocations: locations
          });
          this.panel?.webview.postMessage({
            type: 'displayOrphanCitations',
            orphanCitations: orphans
          });

          getModeContextManager().setClaimReviewContext({
            claimId,
            claim: claimData,
            verificationResults: [],
            validationResult: undefined,
            usageLocations: locations,
            returnToSentenceId: existingContext?.returnToSentenceId || undefined
          });
        }, 500);
      }
      
      console.log('[ClaimReview] Stored context:', {
        claimId,
        returnToSentenceId: existingContext?.returnToSentenceId
      });
    } catch (error) {
      // Don't show error if operation was cancelled
      if (this.currentAbortController?.signal.aborted) {
        console.log('[ClaimReview] Operation cancelled, suppressing error');
        return;
      }
      
      vscode.window.showErrorMessage(
        'Unable to load the claim. It may have been deleted or the data may be corrupted.',
        'Refresh Claims'
      ).then(action => {
        if (action === 'Refresh Claims') {
          vscode.commands.executeCommand('researchAssistant.refreshClaims');
        }
      });
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Verify all quotes for a claim
   * Supports cancellation via AbortSignal
   */
  private async verifyAllQuotes(claim: any, signal?: AbortSignal): Promise<any[]> {
    const tracker = getOperationTracker();
    const operationId = `verify-${claim.id}-${Date.now()}`;
    tracker.startOperation('ClaimReview', operationId, `Verifying quotes for ${claim.id}`);
    
    try {
      const results: any[] = [];
      let totalQuotes = 0;
      let verifiedQuotes = 0;

      // Count total quotes
      if (claim.primaryQuote && (claim.primaryQuote.text || typeof claim.primaryQuote === 'string')) {
        totalQuotes++;
      }
      if (claim.supportingQuotes && Array.isArray(claim.supportingQuotes)) {
        totalQuotes += claim.supportingQuotes.filter((q: any) => q && q.text).length;
      }

      // Helper to send progress update
      const sendProgress = () => {
        if (this.panel && totalQuotes > 0) {
          this.panel.webview.postMessage({
            type: 'verificationProgress',
            current: verifiedQuotes,
            total: totalQuotes
          });
        }
      };
      
      // Helper to check cancellation
      const checkCancelled = () => {
        if (signal?.aborted) {
          throw new DOMException('Operation cancelled', 'AbortError');
        }
      };

      // Verify primary quote
      if (claim.primaryQuote) {
        checkCancelled();
        
        // Handle both string and object formats
        const quoteText = typeof claim.primaryQuote === 'string' ? claim.primaryQuote : (claim.primaryQuote.text || '');
        const quoteSource = typeof claim.primaryQuote === 'string' ? '' : (claim.primaryQuote.source || '');
        
        if (quoteText) {
          const primaryResult = await this.extensionState.quoteVerificationService.verifyQuote(
            quoteText,
            quoteSource
          );

          checkCancelled();

          console.log('[ClaimReview] Primary quote verification result:', {
            verified: primaryResult.verified,
            similarity: primaryResult.similarity
          });

          // Search to get/update metadata using unified quote search (faster, already optimized)
          let alternativeSources: any[] = [];
          let searchStatus: 'not_searched' | 'searching' | 'found' | 'not_found' = 'searching';
          
          try {
            checkCancelled();
            
            // Use unified quote search - combines n-gram pre-filtering + fuzzy matching
            // Much faster than running embedding search separately
            console.log('[ClaimReview] Running unified quote search...');
            const searchResults = await this.unifiedQuoteSearch.search(quoteText, 5, signal);
            
            checkCancelled();
            
            if (searchResults.length > 0) {
              alternativeSources = searchResults.map(result => ({
                source: result.sourceFile.replace(/\.txt$/, '').replace(/ - /g, ' '),
                similarity: result.similarity,
                matchedText: result.matchedText,
                context: `Lines ${result.startLine}-${result.endLine}`,
                metadata: {
                  sourceFile: result.sourceFile,
                  startLine: result.startLine,
                  endLine: result.endLine
                }
              }));
              console.log('[ClaimReview] Quote search found', alternativeSources.length, 'matches, top similarity:', 
                alternativeSources[0]?.similarity.toFixed(3), 'in', alternativeSources[0]?.metadata.sourceFile);
            }
            
            checkCancelled();
            
            // Auto-update metadata, source, and verification status if we found a match
            const existingMetadata = claim.primaryQuote.metadata;
            if (alternativeSources.length > 0) {
              const topMatch = alternativeSources[0];
              const needsUpdate = !existingMetadata || 
                                  existingMetadata.sourceFile !== topMatch.metadata.sourceFile ||
                                  existingMetadata.startLine !== topMatch.metadata.startLine ||
                                  existingMetadata.endLine !== topMatch.metadata.endLine;
              
              // Determine if verified based on similarity threshold
              const isVerified = topMatch.similarity >= 0.9;
              const verificationChanged = claim.primaryQuote.verified !== isVerified;
              
              if (needsUpdate || verificationChanged) {
                claim.primaryQuote.metadata = topMatch.metadata;
                claim.primaryQuote.verified = isVerified;
                
                // Update source to match actual file
                const sourceFileName = topMatch.metadata.sourceFile.replace(/\.txt$/, '');
                const authorYearMatch = sourceFileName.match(/^([^-]+)\s*-\s*(\d{4})/);
                if (authorYearMatch) {
                  const authorYear = `${authorYearMatch[1].trim().split(' ')[0]}${authorYearMatch[2]}`;
                  claim.primaryQuote.source = authorYear;
                }
                
                await this.extensionState.claimsManager.updateClaim(claim.id, claim);
                console.log('[ClaimReview] Auto-updated primary quote metadata, source, and verification:', {
                  metadata: topMatch.metadata,
                  source: claim.primaryQuote.source,
                  similarity: topMatch.similarity.toFixed(3),
                  verified: isVerified
                });
              }
            }
            
            searchStatus = alternativeSources.length > 0 ? 'found' : 'not_found';
          } catch (error: any) {
            if (error.name === 'AbortError') throw error;
            console.error('[ClaimReview] Failed to search for quote:', error);
            searchStatus = 'not_found';
          }

          results.push({
            quote: quoteText,
            type: 'primary',
            verified: primaryResult.verified,
            similarity: primaryResult.similarity,
            closestMatch: primaryResult.closestMatch,
            confidence: claim.primaryQuote.confidence,
            alternativeSources: alternativeSources.length > 0 ? alternativeSources : undefined,
            searchStatus
          });

          // Update progress
          verifiedQuotes++;
          sendProgress();
        }
      }

      // Verify supporting quotes
      if (claim.supportingQuotes && Array.isArray(claim.supportingQuotes)) {
        for (let i = 0; i < claim.supportingQuotes.length; i++) {
          checkCancelled();
          
          const quoteObj = claim.supportingQuotes[i];
          // Handle both string and object formats
          const quoteText = typeof quoteObj === 'string' ? quoteObj : (quoteObj.text || '');
          const quoteSource = typeof quoteObj === 'string' ? '' : (quoteObj.source || '');
          
          if (!quoteText) continue;
          
          const result = await this.extensionState.quoteVerificationService.verifyQuote(
            quoteText,
            quoteSource
          );

          checkCancelled();

          // Search to get/update metadata using unified quote search (faster, already optimized)
          let alternativeSources: any[] = [];
          let searchStatus: 'not_searched' | 'searching' | 'found' | 'not_found' = 'searching';
          
          try {
            checkCancelled();
            
            // Use unified quote search - combines n-gram pre-filtering + fuzzy matching
            const searchResults = await this.unifiedQuoteSearch.search(quoteText, 5, signal);
            
            checkCancelled();
            
            if (searchResults.length > 0) {
              alternativeSources = searchResults.map(matchResult => ({
                source: matchResult.sourceFile.replace(/\.txt$/, '').replace(/ - /g, ' '),
                similarity: matchResult.similarity,
                matchedText: matchResult.matchedText,
                context: `Lines ${matchResult.startLine}-${matchResult.endLine}`,
                metadata: {
                  sourceFile: matchResult.sourceFile,
                  startLine: matchResult.startLine,
                  endLine: matchResult.endLine
                }
              }));
            }
            
            checkCancelled();
            
            // Auto-update metadata, source, and verification status if we found a match
            const existingMetadata = quoteObj.metadata;
            if (alternativeSources.length > 0) {
              const topMatch = alternativeSources[0];
              const needsUpdate = !existingMetadata || 
                                  existingMetadata.sourceFile !== topMatch.metadata.sourceFile ||
                                  existingMetadata.startLine !== topMatch.metadata.startLine ||
                                  existingMetadata.endLine !== topMatch.metadata.endLine;
              
              // Determine if verified based on similarity threshold
              const isVerified = topMatch.similarity >= 0.9;
              const verificationChanged = claim.supportingQuotes[i].verified !== isVerified;
              
              if (needsUpdate || verificationChanged) {
                claim.supportingQuotes[i].metadata = topMatch.metadata;
                claim.supportingQuotes[i].verified = isVerified;
                
                // Update source to match actual file
                const sourceFileName = topMatch.metadata.sourceFile.replace(/\.txt$/, '');
                const authorYearMatch = sourceFileName.match(/^([^-]+)\s*-\s*(\d{4})/);
                if (authorYearMatch) {
                  const authorYear = `${authorYearMatch[1].trim().split(' ')[0]}${authorYearMatch[2]}`;
                  claim.supportingQuotes[i].source = authorYear;
                }
                
                await this.extensionState.claimsManager.updateClaim(claim.id, claim);
                console.log('[ClaimReview] Auto-updated supporting quote metadata, source, and verification:', {
                  metadata: topMatch.metadata,
                  source: claim.supportingQuotes[i].source,
                  verified: isVerified
                });
              }
            }
            
            searchStatus = alternativeSources.length > 0 ? 'found' : 'not_found';
          } catch (error: any) {
            if (error.name === 'AbortError') throw error;
            console.error('[ClaimReview] Failed to search for supporting quote:', error);
            searchStatus = 'not_found';
          }

          results.push({
            quote: quoteText,
            type: 'supporting',
            verified: result.verified,
            similarity: result.similarity,
            closestMatch: result.closestMatch,
            confidence: quoteObj.confidence,
            alternativeSources: alternativeSources.length > 0 ? alternativeSources : undefined,
            searchStatus
          });

          // Update progress
          verifiedQuotes++;
          sendProgress();
        }
      }

      tracker.endOperation('ClaimReview', operationId);
      return results;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[ClaimReview] Quote verification cancelled');
        throw error;
      }
      console.error('Failed to verify quotes:', error);
      tracker.endOperation('ClaimReview', operationId);
      return [];
    }
  }

  /**
   * Fire verification events to update tree view
   * Called after quotes are verified to propagate status to Claims Tree
   */
  private fireVerificationEvents(claim: any, results: any[]): void {
    // Fire event for the claim itself if all quotes are verified
    const allVerified = results.every(r => r.verified);
    if (allVerified && results.length > 0) {
      console.log('[ClaimReview] All quotes verified for', claim.id, '- firing verification event');
      this.extensionState.autoQuoteVerifier.fireVerificationEvent(claim.id, true);
    }
  }

  /**
   * Validate claim support
   */
  private async validateClaim(claim: any): Promise<any> {
    try {
      const validation = await this.extensionState.verificationFeedbackLoop.validateSupport(claim);

      return {
        supported: validation.supported,
        similarity: validation.similarity,
        suggestedQuotes: validation.suggestedQuotes || [],
        analysis: validation.analysis
      };
    } catch (error) {
      console.error('Failed to validate claim:', error);
      return {
        supported: false,
        similarity: 0,
        suggestedQuotes: [],
        analysis: 'Validation failed'
      };
    }
  }

  /**
   * Get manuscript usage locations for a claim
   */
  private async getManuscriptUsageLocations(claimId: string): Promise<any[]> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return [];
      }

      // Get manuscript path
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');
      if (!fs.existsSync(manuscriptPath)) {
        return [];
      }

      // Read manuscript
      const content = fs.readFileSync(manuscriptPath, 'utf-8');
      const lines = content.split('\n');

      // Find sections where this claim is used
      const usageLocations: any[] = [];
      let currentSection = 'Introduction';
      let lineNumber = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track section headers
        if (line.startsWith('#')) {
          currentSection = line.replace(/^#+\s*/, '').trim();
        }

        // Look for claim references in the text
        if (line.includes(claim.id) || line.includes(claim.text.substring(0, 50))) {
          const context = line.substring(0, 100).trim();
          usageLocations.push({
            section: currentSection,
            context: context || '(empty line)',
            lineNumber: i + 1
          });
        }

        lineNumber++;
      }

      return usageLocations;
    } catch (error) {
      console.error('Failed to get manuscript usage locations:', error);
      return [];
    }
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'verifyQuote':
        await this.handleVerifyQuote(message.quote, message.source);
        break;

      case 'acceptQuote':
        await this.handleAcceptQuote(message.claimId, message.quote, message.newQuote, message.newSource, message.metadata);
        break;

      case 'deleteQuote':
        await this.handleDeleteQuote(message.claimId, message.quote);
        break;

      case 'findNewQuotes':
        await this.handleFindNewQuotes(message.claimId, message.query, this.currentAbortController?.signal);
        break;

      case 'loadSnippetText':
        await this.handleLoadSnippetText(message.snippetId, message.filePath, message.confidence);
        break;

      case 'addSupportingQuote':
        await this.handleAddSupportingQuote(message.claimId, message.quote, message.source, message.lineRange, message.confidence);
        break;

      case 'searchInternet':
        await this.handleSearchInternet(message.query);
        break;

      case 'validateSupport':
        await this.handleValidateSupport(message.claimId);
        break;

      case 'navigateToManuscript':
        await this.handleNavigateToManuscript(message.lineNumber);
        break;

      case 'updateCategory':
        await this.handleUpdateCategory(message.claimId, message.category);
        break;

      case 'getExpandedContext':
        await this.handleGetExpandedContext(message.sourceFile, message.startLine, message.endLine, message.expandLines);
        break;

      case 'switchToEditingMode':
        // Get the sentence ID - either from stored context or from sentence-claim mapper
        let sentenceIdToReturn = undefined;
        
        // First check if we have a stored returnToSentenceId from when we opened the claim
        const claimReviewContext = getModeContextManager().getClaimReviewContext();
        if (claimReviewContext?.returnToSentenceId) {
          sentenceIdToReturn = claimReviewContext.returnToSentenceId;
          console.log('[ClaimReview] Using stored returnToSentenceId:', sentenceIdToReturn);
        } else {
          // Fall back to looking up the sentence-claim link
          const sentencesForClaim = this.sentenceClaimMapper.getSentencesForClaim(this.currentClaimId || '');
          console.log('[ClaimReview] Switching to editing mode:', {
            currentClaimId: this.currentClaimId,
            sentencesForClaim: sentencesForClaim
          });
          if (sentencesForClaim.length > 0) {
            sentenceIdToReturn = sentencesForClaim[0];
            console.log('[ClaimReview] Found sentence from mapper:', sentenceIdToReturn);
          } else {
            console.warn('[ClaimReview] No sentences found for claim:', this.currentClaimId);
          }
        }
        
        // Store the sentence ID for editing mode to use
        if (sentenceIdToReturn) {
          getModeContextManager().setClaimReviewContext({
            returnToSentenceId: sentenceIdToReturn
          });
        }
        
        await vscode.commands.executeCommand('researchAssistant.openEditingMode');
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      case 'findQuotesFromPaper':
        await this.handleFindQuotesFromPaper(message.claimId, message.authorYear);
        break;

      case 'attachQuoteToClaim':
        await this.handleAttachQuoteToClaim(message.claimId, message.quote, message.authorYear);
        break;

      case 'removeOrphanCitation':
        await this.handleRemoveOrphanCitation(message.claimId, message.authorYear);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Handle verify quote message
   */
  private async handleVerifyQuote(quote: string, source: string): Promise<void> {
    try {
      const result = await this.extensionState.quoteVerificationService.verifyQuote(quote, source);

      // If we have a current claim, persist the verification status
      if (this.currentClaimId) {
        try {
          // Determine if this is the primary quote or a supporting quote
          const claim = this.extensionState.claimsManager.getClaim(this.currentClaimId);
          if (claim) {
            if (claim.primaryQuote && claim.primaryQuote.text === quote) {
              // Update primary quote verification status
              await this.extensionState.quoteVerificationService.updatePrimaryQuoteVerificationStatus(
                this.currentClaimId,
                result.verified
              );
            } else if (claim.supportingQuotes) {
              // Find and update supporting quote verification status
              const quoteIndex = claim.supportingQuotes.findIndex((q: any) => 
                (typeof q === 'string' ? q : q.text) === quote
              );
              if (quoteIndex >= 0) {
                await this.extensionState.quoteVerificationService.updateSupportingQuoteVerificationStatus(
                  this.currentClaimId,
                  quoteIndex,
                  result.verified
                );
              }
            }
          }
        } catch (error) {
          console.warn('[ClaimReview] Failed to persist verification status:', error);
          // Don't fail the verification display if persistence fails
        }
      }

      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'quoteVerified',
          quote,
          verified: result.verified,
          similarity: result.similarity,
          closestMatch: result.closestMatch
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to verify the quote. Please check that the source document is available.',
        'Retry'
      );
    }
  }

  /**
   * Handle accept quote message
   */
  private async handleAcceptQuote(claimId: string, oldQuote: string, newQuote: string, newSource?: string, metadata?: any): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage(
          'Could not find this claim. It may have been deleted.',
          'Refresh Claims'
        ).then(action => {
          if (action === 'Refresh Claims') {
            vscode.commands.executeCommand('researchAssistant.refreshClaims');
          }
        });
        return;
      }

      // Replace quote in claim
      if (claim.primaryQuote && claim.primaryQuote.text === oldQuote) {
        claim.primaryQuote.text = newQuote;
        // Update source if provided
        if (newSource) {
          claim.primaryQuote.source = newSource;
        }
        // Update or preserve metadata
        if (metadata) {
          claim.primaryQuote.metadata = metadata;
        } else if (!claim.primaryQuote.metadata) {
          claim.primaryQuote.metadata = {};
        }
      } else if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
        const index = claim.supportingQuotes.findIndex((q: any) => q.text === oldQuote);
        if (index >= 0) {
          claim.supportingQuotes[index].text = newQuote;
          // Update source if provided
          if (newSource) {
            claim.supportingQuotes[index].source = newSource;
          }
          // Update or preserve metadata
          if (metadata) {
            claim.supportingQuotes[index].metadata = metadata;
          } else if (!claim.supportingQuotes[index].metadata) {
            claim.supportingQuotes[index].metadata = {};
          }
        }
      }

      // Update claim
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Reload claim display
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage('Quote updated successfully');
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to update the quote. Please try again.',
        'Retry'
      );
    }
  }

  /**
   * Handle delete quote message
   */
  private async handleDeleteQuote(claimId: string, quote: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage(
          'Could not find this claim. It may have been deleted.',
          'Refresh Claims'
        ).then(action => {
          if (action === 'Refresh Claims') {
            vscode.commands.executeCommand('researchAssistant.refreshClaims');
          }
        });
        return;
      }

      // Remove quote from claim
      if (claim.primaryQuote && claim.primaryQuote.text === quote) {
        claim.primaryQuote = { text: '', source: '', verified: false };
      } else if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
        claim.supportingQuotes = claim.supportingQuotes.filter((q: any) => q.text !== quote);
      }

      // Update claim
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Reload claim display
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage('Quote deleted successfully');
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to delete the quote. Please try again.',
        'Retry'
      );
    }
  }

  /**
   * Handle load snippet text message
   */
  private async handleLoadSnippetText(snippetId: string, filePath: string, confidence: number = 0): Promise<void> {
    try {
      // Get snippet from embedding store
      const allSnippets = await this.literatureIndexer.getSnippets();
      const snippet = allSnippets.find(s => s.id === snippetId);

      if (!snippet) {
        console.warn('[ClaimReview] Snippet not found:', snippetId);
        if (this.panel) {
          this.panel.webview.postMessage({
            type: 'error',
            message: 'Snippet not found'
          });
        }
        return;
      }

      // Send full text to webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'snippetTextLoaded',
          snippetId: snippetId,
          text: snippet.text,
          source: snippet.fileName,
          lineRange: `${snippet.startLine}-${snippet.endLine}`,
          confidence: confidence
        });
      }
    } catch (error) {
      console.error('[ClaimReview] Failed to load snippet text:', error);
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'error',
          message: `Failed to load snippet: ${error}`
        });
      }
    }
  }

  /**
   * Handle add supporting quote message
   */
  private async handleAddSupportingQuote(claimId: string, quote: string, source: string, lineRange: string, confidence: number = 0): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage(
          'Could not find this claim. It may have been deleted.',
          'Refresh Claims'
        ).then(action => {
          if (action === 'Refresh Claims') {
            vscode.commands.executeCommand('researchAssistant.refreshClaims');
          }
        });
        return;
      }

      // Extract author-year from source filename (format: "Author et al. - YYYY - Title.txt")
      // We need just the "Author et al. - YYYY" part for verification
      const authorYearMatch = source.match(/^([^-]+\s*-\s*\d{4})/);
      const authorYear = authorYearMatch ? authorYearMatch[1].trim() : source;

      // If primary quote is empty, add to primary quote instead of supporting
      if (!claim.primaryQuote || !claim.primaryQuote.text || claim.primaryQuote.text.trim() === '') {
        claim.primaryQuote = {
          text: quote,
          source: authorYear,
          verified: false,
          confidence: confidence > 0 ? confidence : undefined
        };
      } else {
        // Initialize supporting quotes array if needed
        if (!claim.supportingQuotes) {
          claim.supportingQuotes = [];
        }

        // Check if quote already exists
        const quoteExists = claim.supportingQuotes.some((q: any) => q.text === quote);
        if (quoteExists) {
          vscode.window.showWarningMessage('This quote is already in supporting quotes');
          return;
        }

        // Add quote to supporting quotes
        claim.supportingQuotes.push({
          text: quote,
          source: authorYear,
          verified: false,
          confidence: confidence > 0 ? confidence : undefined
        });
      }

      // Update claim
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Ensure the claim is still linked to its original sentence(s)
      const linkedSentences = this.sentenceClaimMapper.getSentencesForClaim(claimId);
      console.log('[ClaimReview] Checking sentence links:', {
        claimId,
        linkedSentences,
        mapperState: this.sentenceClaimMapper
      });
      if (linkedSentences.length === 0) {
        console.warn('[ClaimReview] Claim has no linked sentences');
        // If no sentences are linked, this might be a new claim - user will need to link it manually
      }

      // Reload claim display
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage('Quote added successfully');
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to add the quote. Please try again.',
        'Retry'
      );
    }
  }

  private async handleFindNewQuotes(claimId: string, query: string, signal?: AbortSignal): Promise<void> {
    try {
      console.log('[ClaimReview] Find quotes requested:', { claimId, query: query.substring(0, 50) + '...' });

      // Check cancellation early
      if (signal?.aborted) {
        console.log('[ClaimReview] Find quotes cancelled before starting');
        return;
      }
      
      vscode.window.showInformationMessage('Searching literature with verification feedback loop...');

      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        console.warn('[ClaimReview] Claim not found:', claimId);
        return;
      }

      // Run verification feedback loop with streaming callbacks
      console.log('[ClaimReview] Starting verification feedback loop');
      
      let totalRounds = 0;
      let totalSnippetsSearched = 0;
      let totalSupportingFound = 0;

      const rounds = await this.verificationFeedbackLoop.findSupportingEvidence(
        query,
        (round) => {
          // Check cancellation before processing round
          if (signal?.aborted) {
            console.log('[ClaimReview] Find quotes cancelled during round processing');
            return;
          }
          
          // Stream results as each round completes
          console.log(`[ClaimReview] Round ${round.round} complete:`, {
            snippetsSearched: round.snippets.length,
            supportingFound: round.supportingSnippets.length
          });

          totalRounds = round.round;
          totalSnippetsSearched += round.snippets.length;
          totalSupportingFound += round.supportingSnippets.length;

          // Send supporting quotes for this round
          if (this.panel && round.supportingSnippets.length > 0 && !signal?.aborted) {
            this.panel.webview.postMessage({
              type: 'newQuotesRound',
              round: round.round,
              quotes: round.supportingSnippets.map((snippet) => {
                const verification = round.verifications.find(v => v.snippet.id === snippet.id);
                const confidence = verification?.confidence || 0;
                
                return {
                  id: snippet.id,
                  summary: snippet.text,
                  source: snippet.fileName,
                  lineRange: `${snippet.startLine}-${snippet.endLine}`,
                  filePath: snippet.filePath,
                  confidence: confidence
                };
              })
            });
          }
        },
        {
          // Stream candidates as soon as search completes (before verification)
          onCandidatesFound: (round, candidates) => {
            if (signal?.aborted) return;
            
            console.log(`[ClaimReview] Round ${round}: Found ${candidates.length} candidates`);
            if (this.panel) {
              this.panel.webview.postMessage({
                type: 'searchCandidatesFound',
                round,
                candidates: candidates.map(snippet => ({
                  id: snippet.id,
                  text: snippet.text,
                  source: snippet.fileName,
                  lineRange: `${snippet.startLine}-${snippet.endLine}`,
                  filePath: snippet.filePath,
                  status: 'verifying' // Will be updated as verification completes
                }))
              });
            }
          },
          // Stream individual verification results
          onVerificationUpdate: (round, snippetId, result) => {
            if (signal?.aborted) return;
            
            console.log(`[ClaimReview] Round ${round}: Verified snippet ${snippetId} - supports: ${result.supports}`);
            if (this.panel) {
              this.panel.webview.postMessage({
                type: 'verificationUpdate',
                round,
                snippetId,
                supports: result.supports,
                confidence: result.confidence,
                reasoning: result.reasoning
              });
            }
          }
        },
        signal  // Pass the abort signal to enable cancellation
      );
      
      // Check cancellation before sending completion
      if (signal?.aborted) {
        console.log('[ClaimReview] Find quotes cancelled, not sending completion');
        return;
      }
      
      console.log('[ClaimReview] Verification loop complete:', {
        rounds: totalRounds,
        totalSnippets: totalSnippetsSearched,
        supportingSnippets: totalSupportingFound
      });

      // Send completion message with metadata
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'newQuotesComplete',
          metadata: {
            roundsCompleted: totalRounds,
            totalSearched: totalSnippetsSearched,
            supportingFound: totalSupportingFound
          }
        });
      }
    } catch (error) {
      // Don't show error if cancelled
      if (signal?.aborted) {
        console.log('[ClaimReview] Find quotes cancelled');
        return;
      }
      
      console.error('[ClaimReview] Find quotes error:', error);
      vscode.window.showErrorMessage(
        'Unable to search for quotes. Please check your literature files and try again.',
        'Retry'
      );
      
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'error',
          message: 'Unable to search literature. Please try again.'
        });
      }
    }
  }

  /**
   * Handle search internet message
   */
  private async handleSearchInternet(query: string): Promise<void> {
    try {
      // First, try local Zotero search
      vscode.window.showInformationMessage('Searching Zotero library...');

      let localResults: any[] = [];
      try {
        localResults = await this.zoteroService.semanticSearch(query, 10);
      } catch (error) {
        console.warn('Local Zotero search failed:', error);
      }

      // If we have good local results, show them first
      if (localResults.length > 0) {
        if (this.panel) {
          this.panel.webview.postMessage({
            type: 'internetSearchResults',
            results: localResults.map((result: any) => ({
              title: result.title || '',
              authors: result.creators?.map((c: any) => c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).join(', ') || '',
              year: result.date ? new Date(result.date).getFullYear() : '',
              abstract: result.abstractNote || '',
              doi: result.doi || '',
              url: result.url || '',
              venue: '',
              source: 'zotero-local'
            }))
          });
        }

        // Ask if user wants to search external sources too
        const action = await vscode.window.showInformationMessage(
          `Found ${localResults.length} paper${localResults.length !== 1 ? 's' : ''} in your Zotero library. Search external sources too?`,
          'Search External',
          'Done'
        );

        if (action !== 'Search External') {
          return;
        }
      }

      // Search external sources
      vscode.window.showInformationMessage('Searching external sources...');

      const { InternetPaperSearcher } = await import('../core/internetPaperSearcher');
      const searcher = new InternetPaperSearcher(this.extensionState.getWorkspaceRoot());

      const papers = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Searching academic databases...',
          cancellable: false,
        },
        async () => {
          return await searcher.searchExternal(query);
        }
      );

      // Send external results to webview
      if (this.panel && papers.length > 0) {
        this.panel.webview.postMessage({
          type: 'internetSearchResults',
          results: papers.map(paper => ({
            title: paper.title,
            authors: paper.authors.join(', '),
            year: paper.year,
            abstract: paper.abstract,
            doi: paper.doi || '',
            url: paper.url || '',
            venue: paper.venue || '',
            source: paper.source
          }))
        });
      }

      // If external results found, offer to import
      if (papers.length > 0) {
        const action = await vscode.window.showInformationMessage(
          `Found ${papers.length} external paper${papers.length !== 1 ? 's' : ''}. Import to Zotero?`,
          'Select Papers',
          'Cancel'
        );

        if (action === 'Select Papers') {
          const selected = await searcher.displayExternalResults(papers);
          if (selected) {
            await searcher.importToZotero(selected);
          }
        }
      } else if (localResults.length === 0) {
        vscode.window.showInformationMessage('No papers found in Zotero or external sources.');
      } else {
        vscode.window.showInformationMessage('No additional papers found from external sources.');
      }
    } catch (error) {
      console.error('Search failed:', error);
      vscode.window.showErrorMessage(
        'Unable to complete the search. Please check your internet connection and try again.',
        'Retry'
      );
      
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'internetSearchResults',
          results: []
        });
      }
    }
  }

  /**
   * Handle validate support message
   */
  private async handleValidateSupport(claimId: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage(
          'Could not find this claim. It may have been deleted.',
          'Refresh Claims'
        ).then(action => {
          if (action === 'Refresh Claims') {
            vscode.commands.executeCommand('researchAssistant.refreshClaims');
          }
        });
        return;
      }

      vscode.window.showInformationMessage('Validating claim support...');

      const validation = await this.extensionState.verificationFeedbackLoop.validateSupport(claim);

      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'supportValidated',
          supported: validation.supported,
          similarity: validation.similarity,
          suggestedQuotes: validation.suggestedQuotes || [],
          analysis: validation.analysis
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to validate claim support. Please try again.',
        'Retry'
      );
    }
  }

  /**
   * Handle navigate to manuscript message
   */
  private async handleNavigateToManuscript(lineNumber: number): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      if (!fs.existsSync(manuscriptPath)) {
        vscode.window.showErrorMessage(
          'Could not find the manuscript file. Please ensure your workspace is properly configured.',
          'Open Settings'
        ).then(action => {
          if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant');
          }
        });
        return;
      }

      const doc = await vscode.workspace.openTextDocument(manuscriptPath);
      const editor = await vscode.window.showTextDocument(doc);

      // Navigate to line
      const line = Math.max(0, lineNumber - 1);
      const range = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(range.start, range.start);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to open the manuscript. Please try again.',
        'Retry'
      );
    }
  }

  /**
   * Show help overlay
   */
  private showHelpOverlay(): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'showHelp'
      });
    }
  }

  /**
   * Handle update category message
   */
  private async handleUpdateCategory(claimId: string, newCategory: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage(
          'Could not find this claim. It may have been deleted.',
          'Refresh Claims'
        ).then(action => {
          if (action === 'Refresh Claims') {
            vscode.commands.executeCommand('researchAssistant.refreshClaims');
          }
        });
        return;
      }

      // Update the claim with new category
      await this.extensionState.claimsManager.updateClaim(claimId, {
        category: newCategory
      });

      // Show success message
      vscode.window.showInformationMessage(`Claim category updated to ${newCategory}`);

      // Refresh the claims tree
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'categoryUpdated',
          claimId,
          category: newCategory
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        'Unable to update the category. Please try again.',
        'Retry'
      );
    }
  }

  /**
   * Handle get expanded context message
   */
  private async handleGetExpandedContext(sourceFile: string, startLine: number, endLine: number, expandLines: number): Promise<void> {
    try {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const filePath = path.join(workspaceRoot, 'literature/ExtractedText', sourceFile);

      if (!fs.existsSync(filePath)) {
        console.warn('[ClaimReview] Source file not found:', filePath);
        if (this.panel) {
          this.panel.webview.postMessage({
            type: 'expandedContext',
            error: 'Source file not found'
          });
        }
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Use the provided range directly (frontend has already calculated it)
      const newStartLine = Math.max(0, Math.min(startLine, lines.length - 1));
      const newEndLine = Math.max(0, Math.min(endLine, lines.length - 1));

      // Get the expanded text
      const expandedText = lines.slice(newStartLine, newEndLine + 1).join('\n');

      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'expandedContext',
          text: expandedText,
          startLine: newStartLine,
          endLine: newEndLine
        });
      }
    } catch (error) {
      console.error('[ClaimReview] Failed to get expanded context:', error);
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'expandedContext',
          error: 'Failed to load context'
        });
      }
    }
  }

  /**
   * Get orphan citations for a claim
   * Returns array of orphan citation info with source mappings
   * Requirements: 3.1
   */
  async getOrphanCitationsForClaim(claimId: string): Promise<any[]> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return [];
      }

      // Get orphan citations from validator
      const validationResults = await this.extensionState.orphanCitationValidator.validateClaimCitations(claimId);
      const orphanResults = validationResults.filter(r => r.status === 'orphan-citation');

      // Build orphan citation info with source mappings
      const orphanCitations = orphanResults.map(result => {
        const sourceMapping = this.extensionState.citationSourceMapper.getSourceMapping(result.authorYear);
        return {
          authorYear: result.authorYear,
          sourceMapping: sourceMapping,
          hasExtractedText: sourceMapping ? !!sourceMapping.extractedTextFile : false
        };
      });

      return orphanCitations;
    } catch (error) {
      console.error('[ClaimReview] Failed to get orphan citations:', error);
      return [];
    }
  }

  /**
   * Find quotes from a specific paper for a claim
   * Uses semantic search against extracted text
   * Requirements: 3.2
   */
  async findQuotesFromPaper(claimId: string, authorYear: string): Promise<any[]> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return [];
      }

      // Get source mapping for the author-year
      const sourceMapping = this.extensionState.citationSourceMapper.getSourceMapping(authorYear);
      if (!sourceMapping || !sourceMapping.extractedTextFile) {
        console.warn(`[ClaimReview] No extracted text available for ${authorYear}`);
        return [];
      }

      // Use LiteratureIndexer to search the extracted text
      const searchResults = await this.literatureIndexer.searchSnippetsWithSimilarity(claim.text, 10);

      // Filter results to only include matches from the target paper
      const targetFileName = sourceMapping.extractedTextFile.split('/').pop() || '';
      const filteredResults = searchResults.filter(result => 
        result.fileName === targetFileName || result.fileName.includes(authorYear)
      );

      // Convert to QuoteSearchResult format
      const quoteResults = filteredResults.map(result => ({
        text: result.text,
        sourceFile: result.fileName,
        startLine: result.startLine,
        endLine: result.endLine,
        similarity: result.similarity
      }));

      // Sort by similarity descending
      quoteResults.sort((a, b) => b.similarity - a.similarity);

      return quoteResults;
    } catch (error) {
      console.error('[ClaimReview] Failed to find quotes from paper:', error);
      return [];
    }
  }

  /**
   * Attach a found quote to a claim
   * Updates claim's supportingQuotes and resolves the orphan citation
   * Requirements: 3.3
   */
  async attachQuoteToClaim(claimId: string, quote: any, authorYear: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        throw new Error(`Claim ${claimId} not found`);
      }

      // Create supporting quote object
      const newQuote = {
        text: quote.text,
        source: authorYear,
        confidence: quote.similarity || 0.8,
        metadata: {
          sourceFile: quote.sourceFile,
          startLine: quote.startLine,
          endLine: quote.endLine
        },
        verified: quote.similarity >= 0.9
      };

      // Add to supporting quotes
      if (!claim.supportingQuotes) {
        claim.supportingQuotes = [];
      }
      claim.supportingQuotes.push(newQuote);

      // Update claim in manager
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Notify webview of successful attachment
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'quoteAttached',
          claimId,
          quote: newQuote,
          authorYear
        });
      }

      console.log('[ClaimReview] Quote attached to claim:', {
        claimId,
        authorYear,
        similarity: quote.similarity
      });
    } catch (error) {
      console.error('[ClaimReview] Failed to attach quote:', error);
      throw error;
    }
  }

  /**
   * Remove an orphan citation from a claim
   * Updates both the claim and manuscript.md
   * Requirements: 3.4
   */
  async removeOrphanCitation(claimId: string, authorYear: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        throw new Error(`Claim ${claimId} not found`);
      }

      // Remove all quotes from this source
      if (claim.supportingQuotes) {
        claim.supportingQuotes = claim.supportingQuotes.filter(q => q.source !== authorYear);
      }
      if (claim.primaryQuote && claim.primaryQuote.source === authorYear) {
        claim.primaryQuote = null as any;
      }

      // Update claim in manager
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Notify webview of successful removal
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'orphanCitationRemoved',
          claimId,
          authorYear
        });
      }

      console.log('[ClaimReview] Orphan citation removed:', {
        claimId,
        authorYear
      });
    } catch (error) {
      console.error('[ClaimReview] Failed to remove orphan citation:', error);
      throw error;
    }
  }

  /**
   * Handle find quotes from paper message
   */
  private async handleFindQuotesFromPaper(claimId: string, authorYear: string): Promise<void> {
    try {
      console.log('[ClaimReview] Finding quotes from paper:', { claimId, authorYear });

      const results = await this.findQuotesFromPaper(claimId, authorYear);

      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'quotesFromPaper',
          results,
          authorYear
        });
      }

      if (results.length === 0) {
        vscode.window.showWarningMessage(`No quotes found in ${authorYear}`);
      }
    } catch (error) {
      console.error('[ClaimReview] Failed to find quotes from paper:', error);
      vscode.window.showErrorMessage('Failed to search for quotes in this paper');
    }
  }

  /**
   * Handle attach quote to claim message
   */
  private async handleAttachQuoteToClaim(claimId: string, quote: any, authorYear: string): Promise<void> {
    try {
      console.log('[ClaimReview] Attaching quote to claim:', { claimId, authorYear });

      await this.attachQuoteToClaim(claimId, quote, authorYear);

      // Reload and display the updated claim
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage(`Quote from ${authorYear} attached successfully`);
    } catch (error) {
      console.error('[ClaimReview] Failed to attach quote:', error);
      vscode.window.showErrorMessage('Failed to attach quote to claim');
    }
  }

  /**
   * Handle remove orphan citation message
   */
  private async handleRemoveOrphanCitation(claimId: string, authorYear: string): Promise<void> {
    try {
      console.log('[ClaimReview] Removing orphan citation:', { claimId, authorYear });

      await this.removeOrphanCitation(claimId, authorYear);

      // Reload and display the updated claim
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage(`Citation to ${authorYear} removed`);
    } catch (error) {
      console.error('[ClaimReview] Failed to remove orphan citation:', error);
      vscode.window.showErrorMessage('Failed to remove orphan citation');
    }
  }

  /**
   * Get HTML content for webview
   */
  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'claimReview.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'claimReview.js')
    );

    const nonce = this.getNonce();
    const helpOverlayHtml = generateHelpOverlayHtml('review');
    const helpOverlayCss = getHelpOverlayCss();
    const breadcrumbCss = getBreadcrumbCss();
    const modeSwitchingJs = getModeSwitchingJs();
    const helpOverlayJs = getHelpOverlayJs();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Claim Review</title>
  <link rel="stylesheet" href="${styleUri}">
  <style nonce="${nonce}">
    ${helpOverlayCss}
    ${breadcrumbCss}
  </style>
</head>
<body>
  <div class="claim-review-container">
    <!-- Header -->
    <div class="header">
      <div class="title">Research Assistant | Claim Review</div>
      <div class="controls">
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="editBtn" class="icon-btn" title="Edit Mode (Shift+E)">✎</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="content">
      <!-- Manuscript sidebar (20%) -->
      <div class="manuscript-sidebar">
        <div class="sidebar-header">
          <span>MANUSCRIPT USAGE</span>
          <button id="toggleSidebar" class="toggle-btn" title="Toggle sidebar (Shift+M)">◀</button>
        </div>
        <div id="usageList" class="usage-list"></div>
      </div>

      <!-- Main panel (80%) -->
      <div class="main-panel">
        <!-- Claim header -->
        <div id="claimHeader" class="claim-header">
          <div class="claim-id"></div>
          <div class="claim-text"></div>
          <div class="claim-meta">
            <span class="category"></span>
          </div>
        </div>

        <!-- Search box (positioned below title) -->
        <div id="newQuotesContainer" class="new-quotes-container" style="display: none;">
          <div class="new-quotes-header">
            <h3>Searching for Quotes...</h3>
            <div class="header-controls">
              <button class="minimize-btn" id="minimizeSearchBtn" title="Minimize">−</button>
              <button class="close-btn" id="closeSearchBtn" title="Close">✕</button>
            </div>
          </div>
          <div class="new-quotes-list"></div>
          <div class="new-quotes-status">Initializing search...</div>
        </div>

        <!-- Quotes section -->
        <div id="quotesSection" class="quotes-section">
          <h2>QUOTES</h2>
          
          <!-- Primary quote -->
          <div id="primaryQuoteContainer" class="quote-container">
            <div class="quote-header">
              <span class="quote-type">PRIMARY QUOTE</span>
              <span id="primaryStatus" class="status-icon">○</span>
            </div>
            <div id="primaryQuote" class="quote-text"></div>
            <div id="primaryVerification" class="verification-info"></div>
            <div class="quote-actions">
              <button class="btn btn-primary" data-action="acceptQuote">Accept</button>
              <button class="btn btn-danger" data-action="deleteQuote">Delete</button>
              <button class="btn btn-secondary" data-action="findNewQuotes">Find New</button>
            </div>
          </div>

          <!-- Supporting quotes -->
          <div id="supportingQuotesContainer" class="supporting-quotes"></div>
        </div>

        <!-- Action buttons -->
        <div class="action-buttons">
          <button id="searchInternetBtn" class="btn btn-secondary" data-action="searchInternet">
            <span class="icon">🌐</span> Search Internet
          </button>
          <button id="switchEditBtn" class="btn btn-secondary" data-action="switchToEditingMode">
            <span class="icon">✎</span> Back to Editing
          </button>
        </div>
      </div>
    </div>

    ${helpOverlayHtml}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    ${modeSwitchingJs}
    ${helpOverlayJs}
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  /**
   * Generate nonce for CSP
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Handle high memory usage
   */
  private handleHighMemory(): void {
    const stats = this.disposalManager.getMemoryStats();
    console.warn(`High memory usage in claim review mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

    // Aggressively trim caches when memory is high
    this.claimDetailsCache.trim(25); // Reduce to 25 items instead of 50

    // Force garbage collection if available
    this.disposalManager.forceGarbageCollection();

    // Only notify user if memory is very high (over 1GB)
    if (this.panel && stats.heapUsedMB > 1024) {
      this.panel.webview.postMessage({
        type: 'memoryWarning',
        message: 'Memory usage is high. Some cached data has been cleared.'
      });
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    // Cancel any ongoing operations
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = undefined;
    }
    
    // Stop memory monitoring
    this.disposalManager.stopMemoryMonitoring(ClaimReviewProvider.viewType);

    // Dispose all registered disposables
    this.disposables.forEach(d => {
      try {
        d.dispose();
      } catch (error) {
        console.error('Error disposing resource:', error);
      }
    });
    this.disposables = [];

    // Clear caches
    this.claimDetailsCache.dispose();

    // Clear state
    this.currentClaimId = undefined;
    this.operationInProgress = false;

    // Clear view reference
    this.panel = undefined;

    console.log('Claim review mode disposed');
  }
}
