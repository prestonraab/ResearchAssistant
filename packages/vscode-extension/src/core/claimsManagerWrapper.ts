import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaimsManager as CoreClaimsManager } from '@research-assistant/core';
import type { Claim } from '@research-assistant/core';
import { PersistenceUtils } from './persistenceUtils';
import { ClaimsParser } from './claimsParser';
import { ClaimsValidator } from './claimsValidator';
import { ClaimsPersistence } from './claimsPersistence';

interface ClaimFileMapping {
  [claimId: string]: string; // Maps claim ID to category file path
}

/**
 * Facade coordinating parsing, validation, and persistence modules.
 * Adds VS Code-specific functionality: event emitters, CRUD operations, file management.
 */
export class ClaimsManager extends CoreClaimsManager {
  private filePath: string;
  private mutableClaims: Map<string, Claim> = new Map();
  private claimToFileMap: ClaimFileMapping = {};
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private onClaimSavedEmitter = new vscode.EventEmitter<Claim>();
  public readonly onClaimSaved = this.onClaimSavedEmitter.event;
  
  private persistence = new ClaimsPersistence();
  private isLoading: boolean = false;
  
  private pendingReloadTimer: NodeJS.Timeout | undefined;
  private readonly RELOAD_DEBOUNCE_MS = 500;
  
  // Index signature for interface compatibility
  [key: string]: any;

  constructor(filePath: string) {
    const workspaceRoot = path.dirname(path.dirname(filePath));
    super(workspaceRoot);
    this.filePath = filePath;
  }

  async updatePath(filePath: string): Promise<void> {
    this.filePath = filePath;
    await this.loadClaims();
  }

  requestReload(): void {
    if (this.pendingReloadTimer) {
      clearTimeout(this.pendingReloadTimer);
    }

    this.pendingReloadTimer = setTimeout(() => {
      this.loadClaims().catch(error => {
        console.error('Error reloading claims after external change:', error);
      });
      this.pendingReloadTimer = undefined;
    }, this.RELOAD_DEBOUNCE_MS);
  }

  async loadClaims(): Promise<Claim[]> {
    if (this.persistence.isCurrentlyWriting()) {
      console.warn('[ClaimsManager] Write in progress, deferring load');
      this.requestReload();
      return this.getClaims();
    }

    if (this.isLoading) {
      console.warn('[ClaimsManager] Load already in progress, skipping duplicate load');
      return this.getClaims();
    }

    this.isLoading = true;
    try {
      const claims = await super.loadClaims();
      const workspaceRoot = path.dirname(path.dirname(this.filePath));
      
      await ClaimsValidator.inferMissingSources(claims, workspaceRoot);
      await ClaimsValidator.restoreVerificationStatus(claims, workspaceRoot);
      
      this.mutableClaims.clear();
      for (const claim of claims) {
        this.mutableClaims.set(claim.id, claim);
      }
      
      this.claimToFileMap = {};
      const claimsDir = path.join(path.dirname(this.filePath), 'claims');
      
      try {
        const stat = await fs.stat(claimsDir);
        if (stat.isDirectory()) {
          for (const claim of claims) {
            this.claimToFileMap[claim.id] = this.getDefaultFileForClaim(claim);
          }
        } else {
          for (const claim of claims) {
            this.claimToFileMap[claim.id] = this.filePath;
          }
        }
      } catch {
        for (const claim of claims) {
          this.claimToFileMap[claim.id] = this.filePath;
        }
      }
      
      this.onDidChangeEmitter.fire();
      return claims;
    } finally {
      this.isLoading = false;
    }
  }

  getClaims(): Claim[] {
    return Array.from(this.mutableClaims.values());
  }

  getClaim(id: string): Claim | null {
    return this.mutableClaims.get(id) || null;
  }

  getAllClaims(): Claim[] {
    return this.getClaims();
  }

  findClaimsBySource(source: string): Claim[] {
    return this.getClaims().filter(claim => claim.primaryQuote && claim.primaryQuote.source === source);
  }

  findClaimsBySection(sectionId: string): Claim[] {
    return this.getClaims().filter(claim => claim.sections.includes(sectionId));
  }

  async saveClaim(claim: Claim): Promise<void> {
    const validation = ClaimsValidator.validateClaim(claim);
    if (!validation.valid) {
      await PersistenceUtils.showValidationWarning(validation.errors, `claim ${claim?.id}`);
      throw new Error(`Invalid claim: ${validation.errors.join(', ')}`);
    }

    if (!claim.id || !claim.text) {
      throw new Error('Claim must have id and text');
    }
    
    const existingClaim = this.mutableClaims.get(claim.id);
    if (!existingClaim) {
      claim.createdAt = new Date();
    }
    claim.modifiedAt = new Date();
    
    this.mutableClaims.set(claim.id, claim);
    
    if (!this.claimToFileMap[claim.id]) {
      this.claimToFileMap[claim.id] = this.getDefaultFileForClaim(claim);
    }
    
    await this.queuePersist();
    
    this.onDidChangeEmitter.fire();
    this.onClaimSavedEmitter.fire(claim);
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<void> {
    const claim = this.mutableClaims.get(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    const { id: _, createdAt: __, ...allowedUpdates } = updates;
    
    const oldCategory = claim.category;
    Object.assign(claim, allowedUpdates, { modifiedAt: new Date() });
    
    if (updates.category && updates.category !== oldCategory) {
      const newFilePath = this.getDefaultFileForClaim(claim);
      const oldFilePath = this.claimToFileMap[id];
      this.claimToFileMap[id] = newFilePath;
      
      if (oldFilePath && oldFilePath !== newFilePath && oldFilePath.includes('/claims/')) {
        try {
          await this.persistence.removeClaimFromFile(oldFilePath, id);
        } catch (error) {
          console.warn(`Could not remove claim from old file ${oldFilePath}:`, error);
        }
      }
    }
    
    await this.queuePersist();
    this.onDidChangeEmitter.fire();
  }

  async addSectionToClaim(claimId: string, sectionId: string): Promise<void> {
    const claim = this.mutableClaims.get(claimId);
    if (!claim) throw new Error(`Claim ${claimId} not found`);
    if (!claim.sections.includes(sectionId)) {
      claim.sections.push(sectionId);
      claim.modifiedAt = new Date();
      await this.queuePersist();
      this.onDidChangeEmitter.fire();
    }
  }

  async removeSectionFromClaim(claimId: string, sectionId: string): Promise<void> {
    const claim = this.mutableClaims.get(claimId);
    if (!claim) throw new Error(`Claim ${claimId} not found`);
    const index = claim.sections.indexOf(sectionId);
    if (index > -1) {
      claim.sections.splice(index, 1);
      claim.modifiedAt = new Date();
      await this.queuePersist();
      this.onDidChangeEmitter.fire();
    }
  }

  async deleteClaim(id: string): Promise<void> {
    const claim = this.mutableClaims.get(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }
    
    this.mutableClaims.delete(id);
    delete this.claimToFileMap[id];
    await this.queuePersist();
    this.onDidChangeEmitter.fire();
  }

  generateClaimId(): string {
    const existingIds = Array.from(this.mutableClaims.keys());
    const numbers = existingIds
      .map(id => parseInt(id.replace('C_', ''), 10))
      .filter(n => !isNaN(n));
    
    const maxId = numbers.length > 0 ? Math.max(...numbers) : 0;
    const newId = maxId + 1;
    
    return `C_${newId.toString().padStart(2, '0')}`;
  }

  async searchClaims(query: string): Promise<Claim[]> {
    const lowerQuery = query.toLowerCase();
    return this.getClaims().filter(claim => 
      claim.text.toLowerCase().includes(lowerQuery) ||
      (claim.primaryQuote?.text && claim.primaryQuote.text.toLowerCase().includes(lowerQuery)) ||
      (claim.context && claim.context.toLowerCase().includes(lowerQuery))
    );
  }

  async detectSimilarClaims(text: string, threshold: number = 0.85): Promise<Array<{ claim: Claim; similarity: number }>> {
    const lowerText = text.toLowerCase();
    const results: Array<{ claim: Claim; similarity: number }> = [];
    for (const claim of this.getClaims()) {
      const words1 = new Set(lowerText.split(/\s+/));
      const words2 = new Set(claim.text.toLowerCase().split(/\s+/));
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      const similarity = intersection.size / union.size;
      if (similarity >= threshold) results.push({ claim, similarity });
    }
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  async mergeClaims(ids: string[]): Promise<Claim> {
    if (ids.length < 2) throw new Error('Must provide at least 2 claim IDs to merge');
    const claimsToMerge = ids.map(id => this.mutableClaims.get(id)).filter(c => c !== undefined) as Claim[];
    if (claimsToMerge.length !== ids.length) throw new Error('One or more claim IDs not found');
    const primaryClaim = claimsToMerge[0];
    const mergedClaim: Claim = {
      id: this.generateClaimId(),
      text: primaryClaim.text,
      category: primaryClaim.category,
      context: claimsToMerge.map(c => c.context).filter(c => c).join(' | '),
      primaryQuote: primaryClaim.primaryQuote || { text: '', source: '', verified: false },
      supportingQuotes: [],
      sections: [],
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
    for (const claim of claimsToMerge) {
      if (claim.primaryQuote && claim !== primaryClaim) mergedClaim.supportingQuotes.push(claim.primaryQuote);
      mergedClaim.supportingQuotes.push(...claim.supportingQuotes);
    }
    const allSections = new Set<string>();
    for (const claim of claimsToMerge) claim.sections.forEach(s => allSections.add(s));
    mergedClaim.sections = Array.from(allSections);
    await this.saveClaim(mergedClaim);
    return mergedClaim;
  }

  parseClaim(block: string): Claim | null {
    return ClaimsParser.parseClaim(block);
  }

  serializeClaim(claim: Claim): string {
    return ClaimsParser.serializeClaim(claim);
  }

  private async queuePersist(): Promise<void> {
    await this.persistence.queuePersist(() => 
      this.persistence.persistClaims(
        this.getClaims(),
        this.claimToFileMap,
        (claim) => this.getDefaultFileForClaim(claim)
      )
    );
  }

  private getDefaultFileForClaim(claim: Claim): string {
    const claimsDir = path.join(path.dirname(this.filePath), 'claims');
    const categoryFileName = ClaimsParser.getCategoryFileName(claim.category);
    return path.join(claimsDir, categoryFileName);
  }
}
