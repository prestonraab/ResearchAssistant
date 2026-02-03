import * as vscode from 'vscode';
import { CoreState } from './coreState';
import { ServiceState } from './serviceState';
import { PositionMapper } from '../positionMapper';
import { FulltextStatusManager } from '../fulltextStatusManager';
import { ManuscriptContextDetector } from '../manuscriptContextDetector';

/**
 * UI state management for the extension.
 * Handles UI-related components like position mapping and context detection.
 * 
 * NFR-3: All functions < 50 lines
 */
export class UIState {
  public positionMapper?: PositionMapper;
  public fulltextStatusManager: FulltextStatusManager;
  public manuscriptContextDetector: ManuscriptContextDetector;

  constructor(coreState: CoreState, serviceState: ServiceState) {
    const config = coreState.config;
    const workspaceRoot = coreState.workspaceRoot;

    this.fulltextStatusManager = new FulltextStatusManager(
      serviceState.pdfExtractionService,
      serviceState.outlineParser,
      workspaceRoot
    );

    this.manuscriptContextDetector = new ManuscriptContextDetector(
      workspaceRoot,
      serviceState.claimsManager,
      config.coverageThresholds
    );
  }

  /**
   * Initialize the position mapper with the claims panel provider.
   * This should be called after the claims panel provider is created.
   */
  initializePositionMapper(
    claimsPanelProvider: any,
    coreState: CoreState,
    serviceState: ServiceState
  ): void {
    const config = coreState.config;
    const draftingPath = config.outlinePath.split('/')[0];
    
    this.positionMapper = new PositionMapper(
      serviceState.outlineParser,
      claimsPanelProvider,
      serviceState.claimsManager,
      draftingPath
    );
  }

  dispose(): void {
    this.positionMapper?.dispose();
    this.manuscriptContextDetector.dispose();
  }
}
