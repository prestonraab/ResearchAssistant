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

/**
 * ClaimReviewProvider - Webview panel provider for claim review mode
 * Displays claim details with verification, validation, and manuscript usage in main editor area
 * Includes memory management and caching for performance
 */
export class ClaimReviewProvider {
  public static readonly viewType = 'researchAssistant.claimReview';
  private panel?: vscode.WebviewPanel;
  private panelDisposed: boolean = false;
  private currentClaimId?: string;
  private disposables: vscode.Disposable[] = [];
  private claimDetailsCache: CachingService<any>;
  private disposalManager = getWebviewDisposalManager();
  private quoteCitationStatus: Map<string, boolean> = new Map(); // Track citation status for quotes
  private benchmark = getBenchmark();
  private immersiveModeManager = getImmersiveModeManager();
  private zoteroService: ZoteroDirectService;
  private literatureIndexer: LiteratureIndexer;
  private verificationFeedbackLoop: VerificationFeedbackLoop;
  private scrollPosition: number = 0; // Track scroll position for restoration
  private sentenceClaimMapper: SentenceClaimMapper;

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.claimDetailsCache = new CachingService(500, 1800000); // 500 items, 30 min TTL
    this.zoteroService = new ZoteroDirectService();
    
    // Initialize literature indexer with workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.literatureIndexer = new LiteratureIndexer(workspaceRoot);
    
    // Initialize verification feedback loop
    this.verificationFeedbackLoop = new VerificationFeedbackLoop(this.literatureIndexer);
    
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
   */
  private async loadAndDisplayClaim(claimId: string): Promise<void> {
    if (!this.panel) {
      return;
    }

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
      
      try {
        const categorization = await this.extensionState.mcpClient.categorizeClaim(claim.text);
        suggestedCategory = categorization.displayCategory;
        availableCategories = categorization.availableCategories;
      } catch (error) {
        console.warn('Failed to auto-categorize claim:', error);
        // Fall back to existing category
      }

      // Auto-verify quotes on load
      const verificationResults = await this.verifyAllQuotes(claim);

      // Get validation status
      const validationResult = await this.validateClaim(claim);

      // Get manuscript usage locations
      const usageLocations = await this.getManuscriptUsageLocations(claimId);

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
      const claimData = {
        ...sanitizedClaim,
        suggestedCategory,
        availableCategories
      };

      // Send claim data to webview
      this.panel.webview.postMessage({
        type: 'loadClaim',
        claim: claimData,
        verificationResults,
        validationResult,
        usageLocations,
        scrollPosition: this.scrollPosition
      });

      // Store in mode context for potential return to editing mode
      // Preserve returnToSentenceId if it was already set
      const existingContext = getModeContextManager().getClaimReviewContext();
      getModeContextManager().setClaimReviewContext({
        claimId,
        claim: claimData,
        verificationResults,
        validationResult,
        usageLocations,
        returnToSentenceId: existingContext?.returnToSentenceId || undefined
      });
      
      console.log('[ClaimReview] Stored context:', {
        claimId,
        returnToSentenceId: existingContext?.returnToSentenceId
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load claim: ${error}`);
    }
  }

  /**
   * Verify all quotes for a claim
   */
  private async verifyAllQuotes(claim: any): Promise<any[]> {
    try {
      const results: any[] = [];

      // Verify primary quote
      if (claim.primaryQuote) {
        // Handle both string and object formats
        const quoteText = typeof claim.primaryQuote === 'string' ? claim.primaryQuote : (claim.primaryQuote.text || '');
        const quoteSource = typeof claim.primaryQuote === 'string' ? '' : (claim.primaryQuote.source || '');
        
        if (quoteText) {
          const primaryResult = await this.extensionState.quoteVerificationService.verifyQuote(
            quoteText,
            quoteSource
          );

          results.push({
            quote: quoteText,
            type: 'primary',
            verified: primaryResult.verified,
            similarity: primaryResult.similarity,
            closestMatch: primaryResult.closestMatch,
            confidence: claim.primaryQuote.confidence
          });
        }
      }

      // Verify supporting quotes
      if (claim.supportingQuotes && Array.isArray(claim.supportingQuotes)) {
        for (const quoteObj of claim.supportingQuotes) {
          // Handle both string and object formats
          const quoteText = typeof quoteObj === 'string' ? quoteObj : (quoteObj.text || '');
          const quoteSource = typeof quoteObj === 'string' ? '' : (quoteObj.source || '');
          
          if (!quoteText) continue;
          
          const result = await this.extensionState.quoteVerificationService.verifyQuote(
            quoteText,
            quoteSource
          );

          results.push({
            quote: quoteText,
            type: 'supporting',
            verified: result.verified,
            similarity: result.similarity,
            closestMatch: result.closestMatch,
            confidence: quoteObj.confidence
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to verify quotes:', error);
      return [];
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
        await this.handleAcceptQuote(message.claimId, message.quote, message.newQuote);
        break;

      case 'deleteQuote':
        await this.handleDeleteQuote(message.claimId, message.quote);
        break;

      case 'toggleQuoteCitation':
        await this.handleToggleQuoteCitation(message.claimId, message.quote);
        break;

      case 'findNewQuotes':
        await this.handleFindNewQuotes(message.claimId, message.query);
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
      vscode.window.showErrorMessage(`Failed to verify quote: ${error}`);
    }
  }

  /**
   * Handle accept quote message
   */
  private async handleAcceptQuote(claimId: string, oldQuote: string, newQuote: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage('Claim not found');
        return;
      }

      // Replace quote in claim
      if (claim.primaryQuote && claim.primaryQuote.text === oldQuote) {
        claim.primaryQuote.text = newQuote;
      } else if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
        const index = claim.supportingQuotes.findIndex((q: any) => q.text === oldQuote);
        if (index >= 0) {
          claim.supportingQuotes[index].text = newQuote;
        }
      }

      // Update claim
      await this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Reload claim display
      await this.loadAndDisplayClaim(claimId);

      vscode.window.showInformationMessage('Quote updated successfully');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to accept quote: ${error}`);
    }
  }

  /**
   * Handle delete quote message
   */
  private async handleDeleteQuote(claimId: string, quote: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage('Claim not found');
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
      vscode.window.showErrorMessage(`Failed to delete quote: ${error}`);
    }
  }

  /**
   * Handle toggle quote citation message
   */
  private async handleToggleQuoteCitation(claimId: string, quote: string): Promise<void> {
    try {
      // For now, we'll store citation status in memory
      // In the future, this will use SentenceClaimQuoteLinkManager
      const key = `${claimId}:${quote}`;
      
      if (!this.quoteCitationStatus) {
        this.quoteCitationStatus = new Map();
      }

      const currentStatus = this.quoteCitationStatus.get(key) || false;
      const newStatus = !currentStatus;
      this.quoteCitationStatus.set(key, newStatus);

      // Reload claim display to show updated citation status
      await this.loadAndDisplayClaim(claimId);

      // Show feedback
      vscode.window.showInformationMessage(
        newStatus 
          ? 'Quote marked for citation' 
          : 'Quote unmarked for citation'
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to toggle citation: ${error}`);
    }
  }

  /**
   * Handle load snippet text message
   */
  private async handleLoadSnippetText(snippetId: string, filePath: string, confidence: number = 0): Promise<void> {
    try {
      // Get snippet from embedding store
      const allSnippets = this.literatureIndexer.getSnippets();
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
        vscode.window.showErrorMessage('Claim not found');
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
      vscode.window.showErrorMessage(`Failed to add quote: ${error}`);
    }
  }

  private async handleFindNewQuotes(claimId: string, query: string): Promise<void> {
    try {
      console.log('[ClaimReview] Find quotes requested:', { claimId, query: query.substring(0, 50) + '...' });

      
      vscode.window.showInformationMessage('Searching literature with verification feedback loop...');

      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        console.warn('[ClaimReview] Claim not found:', claimId);
        return;
      }

      // Run verification feedback loop with streaming callback
      console.log('[ClaimReview] Starting verification feedback loop');
      
      let totalRounds = 0;
      let totalSnippetsSearched = 0;
      let totalSupportingFound = 0;

      const rounds = await this.verificationFeedbackLoop.findSupportingEvidence(
        query,
        (round) => {
          // Stream results as each round completes
          console.log(`[ClaimReview] Round ${round.round} complete:`, {
            snippetsSearched: round.snippets.length,
            supportingFound: round.supportingSnippets.length
          });

          totalRounds = round.round;
          totalSnippetsSearched += round.snippets.length;
          totalSupportingFound += round.supportingSnippets.length;

          // Send minimal data to webview (ID, summary, source, line range, and confidence)
          if (this.panel && round.supportingSnippets.length > 0) {
            this.panel.webview.postMessage({
              type: 'newQuotesRound',
              round: round.round,
              quotes: round.supportingSnippets.map((snippet) => {
                // Find the verification result for this snippet to get confidence
                const verification = round.verifications.find(v => v.snippet.id === snippet.id);
                const confidence = verification?.confidence || 0;
                
                return {
                  id: snippet.id,
                  summary: snippet.text, // Send full text, not truncated
                  source: snippet.fileName,
                  lineRange: `${snippet.startLine}-${snippet.endLine}`,
                  filePath: snippet.filePath,
                  confidence: confidence // Add confidence score (0-1)
                };
              })
            });
          }
        }
      );
      
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
      console.error('[ClaimReview] Find quotes error:', error);
      vscode.window.showErrorMessage(`Failed to find quotes: ${error}`);
      
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'error',
          message: `Failed to search literature: ${error}`
        });
      }
    }
  }

  /**
   * Handle search internet message
   */
  private async handleSearchInternet(query: string): Promise<void> {
    try {
      // Check if Zotero is configured (check both settings and environment)
      const config = vscode.workspace.getConfiguration('researchAssistant');
      const zoteroUserId = config.get<string>('zoteroUserId') || process.env.ZOTERO_USER_ID;
      
      if (!zoteroUserId) {
        const selection = await vscode.window.showErrorMessage(
          'Zotero User ID not configured. Add it in Extension Settings.',
          'Open Settings',
          'Zotero API Page'
        );
        
        if (selection === 'Open Settings') {
          await vscode.commands.executeCommand('workbench.action.openSettings', 'researchAssistant.zoteroUserId');
        } else if (selection === 'Zotero API Page') {
          vscode.env.openExternal(vscode.Uri.parse('https://www.zotero.org/settings/keys'));
        }
        
        if (this.panel) {
          this.panel.webview.postMessage({
            type: 'error',
            message: 'Zotero User ID not configured. Cannot search internet.'
          });
        }
        return;
      }

      vscode.window.showInformationMessage('Searching for related papers...');

      // Search using direct Zotero API
      try {
        const searchResults = await this.zoteroService.semanticSearch(query, 5);
        
        if (this.panel) {
          this.panel.webview.postMessage({
            type: 'internetSearchResults',
            results: searchResults.map((result: any) => ({
              title: result.title || '',
              url: result.url || result.doi || '',
              snippet: result.abstract || ''
            }))
          });
        }
      } catch (searchError) {
        console.error('Search failed:', searchError);
        if (this.panel) {
          this.panel.webview.postMessage({
            type: 'internetSearchResults',
            results: []
          });
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to search: ${error}`);
    }
  }

  /**
   * Handle validate support message
   */
  private async handleValidateSupport(claimId: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);

      if (!claim) {
        vscode.window.showErrorMessage('Claim not found');
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
      vscode.window.showErrorMessage(`Failed to validate support: ${error}`);
    }
  }

  /**
   * Handle navigate to manuscript message
   */
  private async handleNavigateToManuscript(lineNumber: number): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      if (!fs.existsSync(manuscriptPath)) {
        vscode.window.showErrorMessage('Manuscript file not found');
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
      vscode.window.showErrorMessage(`Failed to navigate to manuscript: ${error}`);
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
        vscode.window.showErrorMessage('Claim not found');
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
      vscode.window.showErrorMessage(`Failed to update category: ${error}`);
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
            <span class="source"></span>
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
    this.quoteCitationStatus.clear(); // Clear citation status map

    // Force garbage collection if available
    this.disposalManager.forceGarbageCollection();

    // Notify webview to clear non-essential data
    if (this.panel) {
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

    // Clear view reference
    this.panel = undefined;

    console.log('Claim review mode disposed');
  }
}
