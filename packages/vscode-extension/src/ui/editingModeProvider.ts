import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ExtensionState } from '../core/state';
import { EditingModeManager } from '../core/editingModeManager';
import { SentenceParser, Sentence, OrphanCitationValidator, CitationSourceMapper } from '@research-assistant/core';
import { SentenceClaimMapper } from '../core/sentenceClaimMapper';
import { QuestionAnswerParser, QuestionAnswerPair } from '../core/questionAnswerParser';
import { generateHelpOverlayHtml, getHelpOverlayCss, getHelpOverlayJs } from './keyboardShortcuts';
import { generateBreadcrumb, getBreadcrumbCss, getModeSwitchingJs, modeStateManager } from './modeSwitching';
import { getWebviewDisposalManager } from './webviewDisposalManager';
import { SentenceParsingCache } from '../services/cachingService';
import { getBenchmark } from '../core/performanceBenchmark';
import { getImmersiveModeManager } from './immersiveModeManager';
import { PersistenceUtils } from '../core/persistenceUtils';
import { getModeContextManager } from '../core/modeContextManager';
import { DataValidationService } from '../core/dataValidationService';
import type { Claim } from '@research-assistant/core';

/**
 * Orphan citation suggestion for a sentence
 */
export interface OrphanCitationSuggestion {
  sentenceId: string;
  orphanAuthorYears: string[];
  existingClaimId?: string;
  suggestionText: string;
}

/**
 * EditingModeProvider - Webview panel provider for editing mode
 * Displays sentences from manuscript answers with nested claims in main editor area
 * Includes virtual scrolling and lazy loading for memory efficiency
 */
export class EditingModeProvider {
  public static readonly viewType = 'researchAssistant.editingMode';
  private panel?: vscode.WebviewPanel;
  private panelDisposed: boolean = false;
  private editingModeManager: EditingModeManager;
  private sentenceParser: SentenceParser;
  private sentenceClaimMapper: SentenceClaimMapper;
  private questionAnswerParser: QuestionAnswerParser;
  private disposables: vscode.Disposable[] = [];
  private sentences: Sentence[] = [];
  private questionAnswerPairs: QuestionAnswerPair[] = []; // Store original pairs for saving
  private sentenceParsingCache: SentenceParsingCache;
  private disposalManager = getWebviewDisposalManager();
  private benchmark = getBenchmark();
  private immersiveModeManager = getImmersiveModeManager();
  
  // Orphan citation services
  private orphanCitationValidator?: OrphanCitationValidator;
  private citationSourceMapper?: CitationSourceMapper;
  private dismissedSuggestions: Set<string> = new Set(); // Track dismissed suggestions in session
  
  // Write queue to prevent race conditions on manuscript saves
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private extensionState: ExtensionState,
    private context: vscode.ExtensionContext
  ) {
    this.editingModeManager = new EditingModeManager();
    this.sentenceParser = new SentenceParser();
    this.sentenceClaimMapper = new SentenceClaimMapper(extensionState.claimsManager, context.workspaceState);
    this.questionAnswerParser = new QuestionAnswerParser();
    this.sentenceParsingCache = new SentenceParsingCache(100);
    
    // Initialize orphan citation services
    const workspaceRoot = extensionState.getWorkspaceRoot();
    this.citationSourceMapper = new CitationSourceMapper(workspaceRoot);
    this.orphanCitationValidator = new OrphanCitationValidator(
      this.citationSourceMapper,
      extensionState.claimsManager
    );
  }

  /**
   * Get inline suggestions for sentences with orphan citations
   * Detects sentences with orphan citations and generates suggestion text
   * Requirements: 2.1
   */
  async getOrphanCitationSuggestions(): Promise<OrphanCitationSuggestion[]> {
    try {
      // Load source mappings
      if (!this.citationSourceMapper) {
        return [];
      }
      
      await this.citationSourceMapper.loadSourceMappings();

      const suggestions: OrphanCitationSuggestion[] = [];

      // Check each sentence for orphan citations
      for (const sentence of this.sentences) {
        // Skip if suggestion was dismissed in this session
        if (this.dismissedSuggestions.has(sentence.id)) {
          continue;
        }

        // Get claim IDs for this sentence
        const claimIds = sentence.claims || [];
        const orphanAuthorYears: string[] = [];
        let existingClaimId: string | undefined;

        // Check each claim for orphan citations
        for (const claimId of claimIds) {
          if (!this.orphanCitationValidator) {
            continue;
          }

          const validationResults = await this.orphanCitationValidator.validateClaimCitations(claimId);
          
          // Collect orphan citations
          for (const result of validationResults) {
            if (result.status === 'orphan-citation') {
              orphanAuthorYears.push(result.authorYear);
              if (!existingClaimId) {
                existingClaimId = claimId;
              }
            }
          }
        }

        // If we found orphan citations, create a suggestion
        if (orphanAuthorYears.length > 0) {
          const uniqueOrphans = Array.from(new Set(orphanAuthorYears));
          const suggestionText = this.generateSuggestionText(sentence.text, uniqueOrphans);
          
          suggestions.push({
            sentenceId: sentence.id,
            orphanAuthorYears: uniqueOrphans,
            existingClaimId,
            suggestionText
          });
        }
      }

      return suggestions;
    } catch (error) {
      console.error('[EditingMode] Failed to get orphan citation suggestions:', error);
      return [];
    }
  }

  /**
   * Generate suggestion text for orphan citations
   * @param sentenceText - The sentence text
   * @param orphanAuthorYears - List of orphan author-years
   * @returns Suggestion text
   * @private
   */
  private generateSuggestionText(sentenceText: string, orphanAuthorYears: string[]): string {
    const authorYearList = orphanAuthorYears.join(', ');
    
    if (orphanAuthorYears.length === 1) {
      return `This sentence cites ${authorYearList} but has no supporting quote. Add a claim to find evidence.`;
    } else {
      return `This sentence cites ${authorYearList} but has no supporting quotes. Add a claim to find evidence.`;
    }
  }

  /**
   * Create and show editing mode panel
   */
  async show(): Promise<void> {
    // Benchmark mode loading
    await this.benchmark.benchmarkModeLoad('editing', async () => {
      await this._showInternal();
    });
  }

  private async _showInternal(): Promise<void> {
    // If panel already exists and is not disposed, reveal it and reload data
    if (this.panel && !this.panelDisposed) {
      this.panel.reveal(vscode.ViewColumn.One);
      
      // Always reinitialize to pick up changes from Writing Mode
      console.log('[EditingMode] Reloading data from manuscript...');
      await this.initializeEditingMode();
      
      // Check if we need to navigate to a specific sentence (e.g., returning from claim review)
      const claimReviewContext = getModeContextManager().getClaimReviewContext();
      if (claimReviewContext?.returnToSentenceId) {
        console.log('[EditingMode] Navigating to sentence from existing panel:', claimReviewContext.returnToSentenceId);
        this.panel.webview.postMessage({
          type: 'scrollToItem',
          itemId: claimReviewContext.returnToSentenceId
        });
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
      EditingModeProvider.viewType,
      'Editing Mode',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
        retainContextWhenHidden: true
      }
    );

    // Register with immersive mode manager (closes other immersive panels)
    this.immersiveModeManager.registerPanel(this.panel, EditingModeProvider.viewType);

    // Register with disposal manager
    this.disposalManager.registerWebview(EditingModeProvider.viewType, this.panel.webview);
    this.disposalManager.startMemoryMonitoring(EditingModeProvider.viewType, () => {
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

    this.disposalManager.registerDisposable(EditingModeProvider.viewType, messageListener);

    // Listen for claim changes to refresh display
    const claimChangeListener = this.extensionState.claimsManager.onDidChange(() => {
      this.refreshSentencesDisplay();
    });
    this.disposables.push(claimChangeListener);

    // Handle panel disposal
    const disposalListener = this.panel.onDidDispose(() => {
      this.panelDisposed = true;
      this.dispose();
    });

    this.disposables.push(disposalListener);

    // Initialize editing mode
    await this.initializeEditingMode();
  }

  /**
   * Initialize editing mode with answers and claims
   */
  private async initializeEditingMode(): Promise<void> {
    if (!this.panel) {
      return;
    }

    try {
      // Initialize state
      this.editingModeManager.initializeState();

      // Load manuscript
      const manuscript = await this.loadManuscript();

      // Parse manuscript into question-answer pairs
      const questionAnswerPairs = this.questionAnswerParser.parseManuscript(manuscript);

      // Store original pairs for saving (preserves Source comments)
      this.questionAnswerPairs = questionAnswerPairs;

      // Store pairs as "sentences" for compatibility with existing code
      // Each Q&A pair becomes one item in the list
      this.sentences = [];
      let itemIndex = 0;

      for (const pair of questionAnswerPairs) {
        // Clean the answer text (remove Source comments for display only)
        const cleanAnswer = pair.answer.replace(/<!--\s*Source:[^>]+?-->/g, '').trim();
        
        const item = {
          id: `S_${itemIndex}`,
          text: cleanAnswer,
          originalText: pair.answer, // Keep original with Source comments
          position: pair.position,
          outlineSection: pair.section,
          claims: pair.claims || [],
          question: pair.question,
          pairId: pair.id,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        this.sentences.push(item as any);
        itemIndex++;
      }

      // Load full claim details for each answer
      const itemsWithClaims = await this.loadClaimsForSentences();
      console.log(`[EditingMode] Sending ${itemsWithClaims.length} items to webview`);

      // Check if we should restore from cross-mode context
      let centerItemId = this.editingModeManager.getCenterItemId();
      const writingContext = getModeContextManager().getWritingModeContext();
      const claimReviewContext = getModeContextManager().getClaimReviewContext();
      
      console.log('[EditingMode] Context check:', {
        savedCenterItemId: centerItemId,
        claimReviewContext: claimReviewContext,
        writingContext: writingContext
      });
      
      // If returning from claim review, navigate to the item
      if (claimReviewContext?.returnToSentenceId) {
        centerItemId = claimReviewContext.returnToSentenceId;
        console.log(`[EditingMode] Returning to item from claim review: ${centerItemId}`);
      }
      // If no saved position in editing mode but writing mode has one, find matching item by position
      else if (!centerItemId && writingContext.centerItemPosition !== undefined) {
        const targetPosition = writingContext.centerItemPosition;
        
        // First try exact match
        let matchingItem = itemsWithClaims.find(s => s.position === targetPosition);
        
        // If no exact match, find the closest sentence
        if (!matchingItem && itemsWithClaims.length > 0) {
          matchingItem = itemsWithClaims[0];
          let minDistance = Math.abs(itemsWithClaims[0].position - targetPosition);
          
          for (const item of itemsWithClaims) {
            const distance = Math.abs(item.position - targetPosition);
            if (distance < minDistance) {
              minDistance = distance;
              matchingItem = item;
            }
          }
          console.log(`[EditingMode] Using closest item at position ${matchingItem.position} for target ${targetPosition}`);
        }
        
        if (matchingItem) {
          centerItemId = matchingItem.id;
          console.log(`[EditingMode] Found matching item at position ${writingContext.centerItemPosition}: ${centerItemId}`);
        }
      }
      
      console.log('[EditingMode] Final centerItemId:', centerItemId);

      // Send initial data to webview with virtual scrolling enabled
      this.panel.webview.postMessage({
        type: 'initialize',
        sentences: itemsWithClaims,
        centerItemId: centerItemId,
        virtualScrollingEnabled: true,
        itemHeight: 120
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize editing mode: ${error}`);
      console.error('[EditingMode] Initialization error:', error);
    }
  }

  /**
   * Load manuscript content
   */
  private async loadManuscript(): Promise<string> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      console.log(`[EditingMode] ${manuscriptPath} exists: ${fs.existsSync(manuscriptPath)}`);

      if (fs.existsSync(manuscriptPath)) {
        const content = fs.readFileSync(manuscriptPath, 'utf-8');
        return content;
      }

      console.log(`[EditingMode] File not found, returning empty string`);
      return '';
    } catch (error) {
      console.error('[EditingMode] Failed to load manuscript:', error);
      return '';
    }
  }

  /**
   * Load claims for all sentences
   */
  private async loadClaimsForSentences(): Promise<any[]> {
    const sentencesWithClaims = [];

    for (const sentence of this.sentences) {
      // Validate sentence before processing
      if (!DataValidationService.validateSentence(sentence)) {
        console.warn('[EditingMode] Skipping invalid sentence:', sentence);
        continue;
      }

      const claims = [];

      // Get claim IDs from both Q&A pair claims AND sentence-claim mapper
      // This ensures claims added in Claim Review mode are also shown
      const qaClaimIds = sentence.claims || [];
      const mapperClaimIds = this.sentenceClaimMapper.getClaimsForSentence(sentence.id) || [];
      
      // Merge and deduplicate claim IDs
      const allClaimIds = Array.from(new Set([...qaClaimIds, ...mapperClaimIds]));

      // Load claim details from Knowledge Base for each claim ID
      for (const claimId of allClaimIds) {
        try {
          const claim = this.extensionState.claimsManager.getClaim(claimId);
          if (claim && DataValidationService.validateClaim(claim)) {
            claims.push({
              id: claim.id,
              text: claim.text,
              originalText: claim.text,
              category: claim.category,
              source: claim.primaryQuote?.source || 'Unknown',
              verified: claim.verified
            });
          } else {
            console.warn(`[EditingMode] Claim ${claimId} not found or invalid in Knowledge Base`);
          }
        } catch (error) {
          console.error(`[EditingMode] Failed to load claim ${claimId}:`, error);
        }
      }

      sentencesWithClaims.push({
        id: sentence.id,
        text: sentence.text,
        originalText: sentence.originalText,
        position: sentence.position,
        outlineSection: sentence.outlineSection,
        claims: claims,
        claimCount: claims.length
      });
    }

    // Validate the entire array before returning
    if (!DataValidationService.validateSentencesArray(sentencesWithClaims)) {
      console.warn('[EditingMode] Sentences array validation failed, returning empty array');
      return [];
    }

    return sentencesWithClaims;
  }

  /**
   * Refresh sentences display when claims change
   */
  private async refreshSentencesDisplay(): Promise<void> {
    if (!this.panel || this.panelDisposed) {
      return;
    }

    try {
      const sentencesWithClaims = await this.loadClaimsForSentences();
      
      // Sanitize for webview transmission
      const sanitizedSentences = DataValidationService.sanitizeSentencesForWebview(sentencesWithClaims);
      
      // Send updated sentences to webview
      this.panel.webview.postMessage({
        type: 'sentencesUpdated',
        sentences: sanitizedSentences
      });

      // Store in mode context
      getModeContextManager().setEditingModeContext({
        sentences: sanitizedSentences
      });
    } catch (error) {
      console.error('[EditingMode] Failed to refresh sentences display:', error);
    }
  }

  /**
   * Get status color for sentence based on claims
   */
  private getStatusColor(claims: any[]): string {
    if (claims.length === 0) {
      return 'red'; // No claims
    }

    const hasVerified = claims.some(c => c.verified === true);
    const hasUnverified = claims.some(c => c.verified !== true);

    if (hasVerified && !hasUnverified) {
      return 'green'; // All verified
    } else if (hasVerified && hasUnverified) {
      return 'blue'; // Mixed
    } else if (hasUnverified) {
      return 'orange'; // Unverified claims
    }

    return 'grey'; // Unknown status
  }

  /**
   * Handle messages from webview
   */
  private async handleMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'editSentence':
        await this.editSentence(message.sentenceId, message.newText);
        break;

      case 'deleteSentence':
        await this.deleteSentence(message.sentenceId);
        break;

      case 'createClaim':
        await this.createClaimFromSentence(message.sentenceId);
        break;

      case 'editClaim':
        await this.editClaim(message.claimId, message.newText);
        break;

      case 'deleteClaim':
        await this.deleteClaimFromSentence(message.sentenceId, message.claimId);
        break;

      case 'matchClaims':
        // Find the sentence text from the stored sentences
        const sentence = this.sentences.find(s => s.id === message.sentenceId);
        const sentenceText = sentence ? sentence.text : '';
        console.log(`[EditingMode] Match claims for sentence ${message.sentenceId}: "${sentenceText}"`);
        await vscode.commands.executeCommand('researchAssistant.openClaimMatching', message.sentenceId, sentenceText);
        break;

      case 'openClaim':
        // Store the sentence ID so we can return to it from claim review
        const sentenceId = message.sentenceId || message.sentenceId;
        if (sentenceId) {
          getModeContextManager().setClaimReviewContext({
            returnToSentenceId: sentenceId
          });
        }
        await vscode.commands.executeCommand('researchAssistant.openClaimReview', message.claimId);
        break;

      case 'switchToWritingMode':
        await vscode.commands.executeCommand('researchAssistant.openWritingMode');
        break;

      case 'switchToClaimReview':
        await vscode.commands.executeCommand('researchAssistant.openClaimReview');
        break;

      case 'saveCenterItem':
        this.editingModeManager.saveCenterItemId(message.itemId, message.position);
        // Also update global context for cross-mode navigation
        getModeContextManager().setEditingModeContext({
          centerItemId: message.itemId,
          centerItemPosition: message.position
        });
        break;

      case 'showHelp':
        this.showHelpOverlay();
        break;

      case 'acceptOrphanSuggestion':
        await this.acceptOrphanSuggestion(message.suggestion);
        break;

      case 'dismissOrphanSuggestion':
        await this.dismissOrphanSuggestion(message.suggestionId);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Edit sentence text
   */
  private async editSentence(sentenceId: string, newText: string): Promise<void> {
    try {
      const sentence = this.sentences.find(s => s.id === sentenceId);
      if (!sentence) {
        return;
      }

      // Update sentence
      sentence.text = newText;
      sentence.updatedAt = new Date();

      // Save to manuscript
      await this.saveManuscript();

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'sentenceUpdated',
          sentenceId,
          text: newText
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to edit sentence: ${error}`);
    }
  }

  /**
   * Delete sentence (preserve claims)
   */
  private async deleteSentence(sentenceId: string): Promise<void> {
    try {
      const confirmed = await vscode.window.showWarningMessage(
        'Delete sentence? Claims will be preserved.',
        'Delete',
        'Cancel'
      );

      if (confirmed !== 'Delete') {
        return;
      }

      // Remove sentence from list
      this.sentences = this.sentences.filter(s => s.id !== sentenceId);

      // Delete mapping (preserves claims)
      await this.sentenceClaimMapper.deleteSentence(sentenceId);

      // Save to manuscript
      await this.saveManuscript();

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'sentenceDeleted',
          sentenceId
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete sentence: ${error}`);
    }
  }

  /**
   * Create claim from sentence
   */
  private async createClaimFromSentence(sentenceId: string): Promise<void> {
    try {
      const sentence = this.sentences.find(s => s.id === sentenceId);
      if (!sentence) {
        return;
      }

      // Show input for claim text (defaults to sentence text, but editable)
      const claimText = await vscode.window.showInputBox({
        prompt: 'Claim text (edit if needed)',
        value: sentence.text,
        validateInput: (value) => {
          return value.trim().length === 0 ? 'Claim text cannot be empty' : null;
        }
      });

      if (!claimText) {
        return;
      }

      // Create claim with minimal defaults
      const claimId = `C_${Date.now()}`;
      const claim: Claim = {
        id: claimId,
        text: claimText.trim(),
        category: 'Uncategorized',
        context: sentence.text,
        primaryQuote: {
          text: '',
          source: '',
          verified: false
        },
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      // Add to claims manager and ensure it's saved
      await this.extensionState.claimsManager.saveClaim(claim);

      // Link sentence to claim
      await this.sentenceClaimMapper.linkSentenceToClaim(sentenceId, claimId);

      // Update the local sentence object to include the new claim
      if (!sentence.claims) {
        sentence.claims = [];
      }
      if (!sentence.claims.includes(claimId)) {
        sentence.claims.push(claimId);
      }

      // Notify webview of new claim
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'claimCreated',
          sentenceId,
          claim: {
            id: claimId,
            text: claim.text,
            category: claim.category,
            source: claim.primaryQuote?.source || 'Unknown',
            verified: claim.verified
          }
        });
      }

      // Small delay to ensure claim is persisted before opening review
      await new Promise(resolve => setTimeout(resolve, 50));

      // Open claim review interface to search for supporting quotes
      await vscode.commands.executeCommand('researchAssistant.openClaimReview', claimId);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create claim: ${error}`);
    }
  }

  /**
   * Edit claim text
   */
  private async editClaim(claimId: string, newText: string): Promise<void> {
    try {
      const claim = this.extensionState.claimsManager.getClaim(claimId);
      if (!claim) {
        return;
      }

      // Update claim
      claim.text = newText;
      claim.modifiedAt = new Date();

      this.extensionState.claimsManager.updateClaim(claimId, claim);

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'claimUpdated',
          claimId,
          text: newText
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to edit claim: ${error}`);
    }
  }

  /**
   * Delete claim from sentence
   */
  private async deleteClaimFromSentence(sentenceId: string, claimId: string): Promise<void> {
    try {
      const confirmed = await vscode.window.showWarningMessage(
        'Remove claim from answer?',
        'Remove',
        'Cancel'
      );

      if (confirmed !== 'Remove') {
        return;
      }

      // Unlink claim from sentence in memory
      await this.sentenceClaimMapper.unlinkSentenceFromClaim(sentenceId, claimId);

      // Persist removal to manuscript.md
      await this.removeClaimFromManuscript(sentenceId, claimId);

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'claimDeleted',
          sentenceId,
          claimId
        });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete claim: ${error}`);
    }
  }

  /**
   * Accept orphan citation suggestion
   * Creates a claim if needed, links citation to it, opens Claim Review
   * Requirements: 2.2
   */
  async acceptOrphanSuggestion(suggestion: OrphanCitationSuggestion): Promise<void> {
    try {
      let claimId = suggestion.existingClaimId;

      // If no existing claim, create one
      if (!claimId) {
        claimId = `C_${Date.now()}`;
        const claim: Claim = {
          id: claimId,
          text: suggestion.suggestionText,
          category: 'Uncategorized',
          context: '',
          primaryQuote: {
            text: '',
            source: '',
            verified: false
          },
          supportingQuotes: [],
          sections: [],
          verified: false,
          createdAt: new Date(),
          modifiedAt: new Date()
        };

        await this.extensionState.claimsManager.saveClaim(claim);
        await this.sentenceClaimMapper.linkSentenceToClaim(suggestion.sentenceId, claimId);

        // Update local sentence
        const sentence = this.sentences.find(s => s.id === suggestion.sentenceId);
        if (sentence) {
          if (!sentence.claims) {
            sentence.claims = [];
          }
          if (!sentence.claims.includes(claimId)) {
            sentence.claims.push(claimId);
          }
        }
      }

      // Navigate to Claim Review with the claim ID
      await vscode.commands.executeCommand('researchAssistant.openClaimReview', claimId);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to accept suggestion: ${error}`);
      console.error('[EditingMode] Failed to accept orphan suggestion:', error);
    }
  }

  /**
   * Dismiss orphan citation suggestion
   * Tracks dismissed suggestions in session, preserves underlying data
   * Requirements: 2.3
   */
  async dismissOrphanSuggestion(suggestionId: string): Promise<void> {
    try {
      // Track dismissed suggestion in session
      this.dismissedSuggestions.add(suggestionId);

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'suggestionDismissed',
          suggestionId
        });
      }

      console.log(`[EditingMode] Dismissed suggestion for sentence ${suggestionId}`);
    } catch (error) {
      console.error('[EditingMode] Failed to dismiss suggestion:', error);
    }
  }

  /**
   * Remove claim link from manuscript.md
   */
  private async removeClaimFromManuscript(sentenceId: string, claimId: string): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');
      
      if (!fs.existsSync(manuscriptPath)) {
        console.error('[EditingMode] Manuscript not found');
        return;
      }
      
      let content = fs.readFileSync(manuscriptPath, 'utf-8');
      
      // Parse to find the Q&A pair
      const pairs = this.questionAnswerParser.parseManuscript(content);
      
      // Find the pair by sentence ID (S_0 -> QA_0, etc.)
      const pairIndex = parseInt(sentenceId.replace('S_', ''));
      if (isNaN(pairIndex) || pairIndex >= pairs.length) {
        console.error(`[EditingMode] Invalid sentence ID: ${sentenceId}`);
        return;
      }
      
      const pair = pairs[pairIndex];
      
      // Remove claim from the pair's claims array
      pair.claims = pair.claims.filter(c => c !== claimId);
      
      // Update the Source comment in the answer text (handle both formats)
      // Legacy format: <!-- Source: C_01, C_02 -->
      const legacySourceMatch = pair.answer.match(/<!--\s*Source:\s*([^-]+?)-->/);
      if (legacySourceMatch) {
        const existingClaims = legacySourceMatch[1].trim();
        // Remove the claim ID from the list
        const claimList = existingClaims.split(/,\s*/).filter(c => c.trim() !== claimId);
        
        if (claimList.length > 0) {
          // Update with remaining claims
          const newSourceComment = `<!-- Source: ${claimList.join(', ')} -->`;
          pair.answer = pair.answer.replace(/<!--\s*Source:[^>]+?-->/, newSourceComment);
        } else {
          // Remove the Source comment entirely
          pair.answer = pair.answer.replace(/\s*<!--\s*Source:[^>]+?-->/, '').trim();
        }
      }
      
      // New format: [source:: C_01(Author Year), C_02]
      const inlineSourceMatch = pair.answer.match(/\[source::\s*([^\]]+)\]/);
      if (inlineSourceMatch) {
        const sourceSpec = inlineSourceMatch[1];
        // Parse claim specs and remove the one matching claimId
        const claimSpecs = sourceSpec.split(',').map(s => s.trim());
        const filteredSpecs = claimSpecs.filter(spec => {
          const claimMatch = spec.match(/^(C_\d+)/);
          return claimMatch && claimMatch[1] !== claimId;
        });
        
        if (filteredSpecs.length > 0) {
          // Update with remaining claims
          const newSourceSpec = `[source:: ${filteredSpecs.join(', ')}]`;
          pair.answer = pair.answer.replace(/\[source::\s*[^\]]+\]/, newSourceSpec);
        } else {
          // Remove the source spec entirely
          pair.answer = pair.answer.replace(/\s*\[source::\s*[^\]]+\]/, '').trim();
        }
      }
      
      // Reconstruct and save manuscript
      const newContent = this.questionAnswerParser.reconstructManuscript(pairs);
      fs.writeFileSync(manuscriptPath, newContent, 'utf-8');
      
      console.log(`[EditingMode] Removed claim ${claimId} from manuscript for answer ${pairIndex}`);
    } catch (error) {
      console.error('[EditingMode] Failed to remove claim from manuscript:', error);
      throw error;
    }
  }

  /**
   * Save manuscript
   * Queues the save operation to prevent race conditions
   */
  private async saveManuscript(): Promise<void> {
    // Queue the save operation to prevent race conditions with file watchers
    this.writeQueue = this.writeQueue.then(() => this._performManuscriptSave()).catch(error => {
      console.error('Error in manuscript write queue:', error);
      vscode.window.showErrorMessage(`Failed to save manuscript: ${error}`);
    });
    
    return this.writeQueue;
  }

  private async _performManuscriptSave(): Promise<void> {
    try {
      const manuscriptPath = this.extensionState.getAbsolutePath('03_Drafting/manuscript.md');

      // Sync any edits from sentences back to questionAnswerPairs
      for (let i = 0; i < this.sentences.length && i < this.questionAnswerPairs.length; i++) {
        const sentence = this.sentences[i];
        const pair = this.questionAnswerPairs[i];
        
        // If the display text was edited, update the pair's answer
        // Preserve Source comments from originalText if they exist
        if (sentence.text !== sentence.originalText.replace(/<!--\s*Source:[^>]+?-->/g, '').trim()) {
          // Text was edited - need to reconstruct with Source comments
          const sourceMatch = sentence.originalText.match(/<!--\s*Source:[^>]+?-->/g);
          if (sourceMatch && sourceMatch.length > 0) {
            // Append Source comments to the edited text
            pair.answer = sentence.text + ' ' + sourceMatch.join(' ');
          } else {
            pair.answer = sentence.text;
          }
        }
        // Otherwise keep pair.answer as-is (preserves Source comments)
      }

      // Reconstruct manuscript using the parser (preserves structure and Source comments)
      const content = this.questionAnswerParser.reconstructManuscript(this.questionAnswerPairs);

      // Validate content
      if (!content || typeof content !== 'string') {
        throw new Error('Invalid manuscript content generated');
      }

      // Use atomic write with retry logic
      const result = await PersistenceUtils.writeFileAtomic(manuscriptPath, content, {
        maxRetries: 3,
        initialDelayMs: 100
      });

      if (!result.success) {
        throw result.error || new Error('Unknown write error');
      }

      // Notify webview
      if (this.panel) {
        this.panel.webview.postMessage({
          type: 'saved',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to save manuscript:', err);
      
      // Show error to user with retry option
      await PersistenceUtils.showPersistenceError(
        err,
        'save manuscript',
        this.extensionState.getAbsolutePath('03_Drafting/manuscript.md'),
        () => this._performManuscriptSave()
      );
      
      throw err;
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
   * Handle high memory usage
   */
  private handleHighMemory(): void {
    const stats = this.disposalManager.getMemoryStats();
    console.warn(`High memory usage in editing mode: ${stats.heapUsedMB}MB / ${stats.heapTotalMB}MB`);

    // Trim caches
    this.sentenceParsingCache.clear();

    // Only notify user if memory is very high (over 1GB)
    if (this.panel && stats.heapUsedMB > 1024) {
      this.panel.webview.postMessage({
        type: 'memoryWarning',
        message: 'Memory usage is high. Clearing cache...'
      });
    }

    // Force garbage collection if available
    this.disposalManager.forceGarbageCollection();
  }

  /**
   * Get HTML content for webview
   */
  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editingMode.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editingMode.js')
    );

    const nonce = this.getNonce();
    const helpOverlayHtml = generateHelpOverlayHtml('editing');
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
  <title>Editing Mode</title>
  <link rel="stylesheet" href="${styleUri}">
  <style nonce="${nonce}">
    ${helpOverlayCss}
    ${breadcrumbCss}
  </style>
</head>
<body>
  <div class="editing-mode-container">
    <!-- Header -->
    <div class="header">
      <div class="title">Research Assistant | Editing Mode</div>
      <div class="controls">
        <button id="helpBtn" class="icon-btn" title="Help (?)">?</button>
        <button id="writeBtn" class="icon-btn" title="Write Mode (Shift+W)">✎</button>
      </div>
    </div>

    <!-- Main content -->
    <div class="content">
      <div id="sentencesList" class="sentences-list"></div>
    </div>

    <!-- Find Bar -->
    <div id="findBar" class="find-bar hidden">
      <input 
        id="findInput" 
        class="find-input" 
        type="text" 
        placeholder="Find in editing..."
        autocomplete="off"
      />
      <div id="findCounter" class="find-counter">0 of 0</div>
      <button id="findPrevBtn" class="find-button" title="Previous match (Shift+Enter)">↑</button>
      <button id="findNextBtn" class="find-button" title="Next match (Enter)">↓</button>
      <button id="findCloseBtn" class="find-button close-btn" title="Close (Esc)">✕</button>
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
   * Dispose resources
   */
  dispose(): void {
    // Stop memory monitoring
    this.disposalManager.stopMemoryMonitoring(EditingModeProvider.viewType);

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
    this.sentenceParsingCache.dispose();

    // Clear sentences
    this.sentences = [];
    this.questionAnswerPairs = [];

    // Clear view reference
    this.panel = undefined;

    console.log('Editing mode disposed');
  }
}
