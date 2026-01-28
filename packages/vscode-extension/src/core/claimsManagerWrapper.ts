import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaimsManager as CoreClaimsManager } from '@research-assistant/core';
import type { Claim } from '@research-assistant/core';
import { PersistenceUtils } from './persistenceUtils';

interface ClaimFileMapping {
  [claimId: string]: string; // Maps claim ID to category file path
}

/**
 * VS Code-specific wrapper around the core ClaimsManager.
 * 
 * Adds VS Code-specific functionality:
 * - Event emitters for UI updates
 * - File writing capabilities
 * - Claim CRUD operations
 * - Category file management
 * 
 * The core ClaimsManager handles all reading and parsing logic.
 */
export class ClaimsManager extends CoreClaimsManager {
  private filePath: string;
  private mutableClaims: Map<string, Claim> = new Map(); // Mutable claims for CRUD operations
  private claimToFileMap: ClaimFileMapping = {}; // Track which file each claim belongs to
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;
  private onClaimSavedEmitter = new vscode.EventEmitter<Claim>();
  public readonly onClaimSaved = this.onClaimSavedEmitter.event;
  
  // Write queue to prevent race conditions
  private writeQueue: Promise<void> = Promise.resolve();
  private isLoading: boolean = false;
  private isWriting: boolean = false;
  
  // Consolidate multiple file change events
  private pendingReloadTimer: NodeJS.Timeout | undefined;
  private readonly RELOAD_DEBOUNCE_MS = 500;

  constructor(filePath: string) {
    // Extract workspace root from file path
    // filePath is typically: /workspace/01_Knowledge_Base/claims_and_evidence.md
    const workspaceRoot = path.dirname(path.dirname(filePath));
    super(workspaceRoot);
    this.filePath = filePath;
  }

  async updatePath(filePath: string): Promise<void> {
    this.filePath = filePath;
    await this.loadClaims();
  }

  /**
   * Request a reload with debouncing to consolidate multiple changes
   * Used by file watchers to avoid multiple reloads
   */
  requestReload(): void {
    // Clear existing timer
    if (this.pendingReloadTimer) {
      clearTimeout(this.pendingReloadTimer);
    }

    // Set new timer to reload after debounce period
    this.pendingReloadTimer = setTimeout(() => {
      this.loadClaims().catch(error => {
        console.error('Error reloading claims after external change:', error);
      });
      this.pendingReloadTimer = undefined;
    }, this.RELOAD_DEBOUNCE_MS);
  }

  /**
   * Override loadClaims to add event emission and sync mutable state
   */
  async loadClaims(): Promise<Claim[]> {
    // Prevent loads during active writes to maintain consistency
    if (this.isWriting) {
      console.warn('[ClaimsManager] Write in progress, deferring load');
      // Request reload after write completes
      this.requestReload();
      return this.getClaims();
    }

    // Prevent concurrent loads
    if (this.isLoading) {
      console.warn('[ClaimsManager] Load already in progress, skipping duplicate load');
      return this.getClaims();
    }

    this.isLoading = true;
    try {
      const claims = await super.loadClaims();
      
      // Infer missing sources from filenames
      await this.inferMissingSources(claims);
      
      // Sync mutable claims map
      this.mutableClaims.clear();
      for (const claim of claims) {
        this.mutableClaims.set(claim.id, claim);
      }
      
      // Build file mapping for claims
      this.claimToFileMap = {};
      const claimsDir = path.join(path.dirname(this.filePath), 'claims');
      
      try {
        const stat = await fs.stat(claimsDir);
        if (stat.isDirectory()) {
          // Claims are in category files
          for (const claim of claims) {
            this.claimToFileMap[claim.id] = this.getDefaultFileForClaim(claim);
          }
        } else {
          // Claims are in single file
          for (const claim of claims) {
            this.claimToFileMap[claim.id] = this.filePath;
          }
        }
      } catch {
        // Claims directory doesn't exist, use single file
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

  /**
   * Infer source (author-year) from extracted text filenames for claims without sources.
   * Uses the primary quote to find matching files.
   */
  private async inferMissingSources(claims: Claim[]): Promise<void> {
    const extractedTextPath = path.join(
      path.dirname(path.dirname(this.filePath)),
      'literature',
      'ExtractedText'
    );

    try {
      const files = await fs.readdir(extractedTextPath);
      const txtFiles = files.filter(f => f.endsWith('.txt'));

      for (const claim of claims) {
        // Skip if already has a source in primaryQuote
        if (claim.primaryQuote && claim.primaryQuote.source && claim.primaryQuote.source !== 'Unknown' && claim.primaryQuote.source !== '') {
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
  private extractAuthorYearFromFilename(filename: string): string | null {
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
   * Get all claims (alias for getAllClaims for backward compatibility)
   * Returns mutable claims for write operations
   */
  getClaims(): Claim[] {
    return Array.from(this.mutableClaims.values());
  }

  /**
   * Override getClaim to use mutable state
   */
  getClaim(id: string): Claim | null {
    return this.mutableClaims.get(id) || null;
  }

  /**
   * Override getAllClaims to use mutable state
   */
  getAllClaims(): Claim[] {
    return this.getClaims();
  }

  /**
   * Override findClaimsBySource to use mutable state
   */
  findClaimsBySource(source: string): Claim[] {
    return this.getClaims().filter(claim => claim.primaryQuote && claim.primaryQuote.source === source);
  }

  /**
   * Override findClaimsBySection to use mutable state
   */
  findClaimsBySection(sectionId: string): Claim[] {
    return this.getClaims().filter(claim => claim.sections.includes(sectionId));
  }

  /**
   * Save a new or updated claim
   */
  async saveClaim(claim: Claim): Promise<void> {
    // Validate claim before saving
    const validation = PersistenceUtils.validateClaim(claim);
    if (!validation.valid) {
      await PersistenceUtils.showValidationWarning(validation.errors, `claim ${claim?.id}`);
      throw new Error(`Invalid claim: ${validation.errors.join(', ')}`);
    }

    // Ensure claim has required fields
    if (!claim.id || !claim.text) {
      throw new Error('Claim must have id and text');
    }
    
    // Set timestamps
    const existingClaim = this.mutableClaims.get(claim.id);
    if (!existingClaim) {
      claim.createdAt = new Date();
    }
    claim.modifiedAt = new Date();
    
    // Update mutable state
    this.mutableClaims.set(claim.id, claim);
    
    // Update file mapping if not already set
    if (!this.claimToFileMap[claim.id]) {
      this.claimToFileMap[claim.id] = this.getDefaultFileForClaim(claim);
    }
    
    // Queue the persistence operation
    await this.queuePersist();
    
    this.onDidChangeEmitter.fire();
    
    // Fire event for auto-verification (Requirement 43.1)
    this.onClaimSavedEmitter.fire(claim);
  }

  /**
   * Update an existing claim
   */
  async updateClaim(id: string, updates: Partial<Claim>): Promise<void> {
    const claim = this.mutableClaims.get(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    // Prevent changing immutable fields
    const { id: _, createdAt: __, ...allowedUpdates } = updates;
    
    // Check if category is being changed
    const oldCategory = claim.category;
    Object.assign(claim, allowedUpdates, { modifiedAt: new Date() });
    
    // If category changed, update the file mapping
    if (updates.category && updates.category !== oldCategory) {
      const newFilePath = this.getDefaultFileForClaim(claim);
      const oldFilePath = this.claimToFileMap[id];
      this.claimToFileMap[id] = newFilePath;
      
      // If claims are in category files, remove from old file
      if (oldFilePath && oldFilePath !== newFilePath && oldFilePath.includes('/claims/')) {
        try {
          const oldFileContent = await fs.readFile(oldFilePath, 'utf-8');
          const claimHeaderRegex = new RegExp(`## ${id}:.*?(?=##|$)`, 'gs');
          const newContent = oldFileContent.replace(claimHeaderRegex, '').trim();
          if (newContent) {
            await fs.writeFile(oldFilePath, newContent + '\n', 'utf-8');
          } else {
            // If file is now empty, delete it
            await fs.unlink(oldFilePath);
          }
        } catch (error) {
          console.warn(`Could not remove claim from old file ${oldFilePath}:`, error);
        }
      }
    }
    
    // Queue the persistence operation
    await this.queuePersist();
    
    this.onDidChangeEmitter.fire();
  }

  /**
   * Add a section association to a claim
   */
  async addSectionToClaim(claimId: string, sectionId: string): Promise<void> {
    const claim = this.mutableClaims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    if (!claim.sections.includes(sectionId)) {
      claim.sections.push(sectionId);
      claim.modifiedAt = new Date();
      await this.queuePersist();
      
      this.onDidChangeEmitter.fire();
    }
  }

  /**
   * Remove a section association from a claim
   */
  async removeSectionFromClaim(claimId: string, sectionId: string): Promise<void> {
    const claim = this.mutableClaims.get(claimId);
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const index = claim.sections.indexOf(sectionId);
    if (index > -1) {
      claim.sections.splice(index, 1);
      claim.modifiedAt = new Date();
      await this.queuePersist();
      
      this.onDidChangeEmitter.fire();
    }
  }

  /**
   * Delete a claim
   */
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

  /**
   * Generate a unique claim ID
   */
  generateClaimId(): string {
    const existingIds = Array.from(this.mutableClaims.keys());
    const numbers = existingIds
      .map(id => parseInt(id.replace('C_', ''), 10))
      .filter(n => !isNaN(n));
    
    const maxId = numbers.length > 0 ? Math.max(...numbers) : 0;
    const newId = maxId + 1;
    
    return `C_${newId.toString().padStart(2, '0')}`;
  }

  /**
   * Search claims by text content
   */
  async searchClaims(query: string): Promise<Claim[]> {
    const lowerQuery = query.toLowerCase();
    return this.getClaims().filter(claim => 
      claim.text.toLowerCase().includes(lowerQuery) ||
      (claim.primaryQuote?.text && claim.primaryQuote.text.toLowerCase().includes(lowerQuery)) ||
      (claim.context && claim.context.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Detect similar claims using semantic similarity
   * @param text The claim text to compare against
   * @param threshold Similarity threshold (0-1), default 0.85
   * @returns Array of similar claims with similarity scores
   */
  async detectSimilarClaims(text: string, threshold: number = 0.85): Promise<Array<{ claim: Claim; similarity: number }>> {
    // This is a placeholder implementation
    // In production, this should use the EmbeddingService
    const lowerText = text.toLowerCase();
    const results: Array<{ claim: Claim; similarity: number }> = [];
    
    for (const claim of this.getClaims()) {
      // Simple word-based similarity as fallback
      const claimLower = claim.text.toLowerCase();
      const words1 = new Set(lowerText.split(/\s+/));
      const words2 = new Set(claimLower.split(/\s+/));
      
      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const union = new Set([...words1, ...words2]);
      
      const similarity = intersection.size / union.size;
      
      if (similarity >= threshold) {
        results.push({ claim, similarity });
      }
    }
    
    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results;
  }

  /**
   * Merge multiple claims into one
   */
  async mergeClaims(ids: string[]): Promise<Claim> {
    if (ids.length < 2) {
      throw new Error('Must provide at least 2 claim IDs to merge');
    }

    const claimsToMerge = ids.map(id => this.mutableClaims.get(id)).filter(c => c !== undefined) as Claim[];
    
    if (claimsToMerge.length !== ids.length) {
      throw new Error('One or more claim IDs not found');
    }

    // Create merged claim
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

    // Combine all quotes
    for (const claim of claimsToMerge) {
      if (claim.primaryQuote && claim !== primaryClaim) {
        mergedClaim.supportingQuotes.push(claim.primaryQuote);
      }
      mergedClaim.supportingQuotes.push(...claim.supportingQuotes);
    }

    // Combine all section associations
    const allSections = new Set<string>();
    for (const claim of claimsToMerge) {
      claim.sections.forEach(s => allSections.add(s));
    }
    mergedClaim.sections = Array.from(allSections);

    // Save merged claim
    await this.saveClaim(mergedClaim);

    // Optionally delete original claims (commented out for safety)
    // for (const id of ids) {
    //   await this.deleteClaim(id);
    // }

    return mergedClaim;
  }

  /**
   * Parse a claim block from markdown format
   * Public method for testing and external use
   */
  parseClaim(block: string): Claim | null {
    // Use the core parsing logic by creating a temporary file
    // This is a workaround since the core parser is private
    // In practice, this method is mainly used for testing
    const lines = block.split('\n');
    const headerMatch = lines[0].match(/^## (C_\d+):\s*(.+)$/);
    if (!headerMatch) {
      return null;
    }

    // Basic parsing for compatibility
    const id = headerMatch[1];
    const text = headerMatch[2].trim();
    
    return {
      id,
      text,
      category: '',
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
  }

  /**
   * Serialize a claim to markdown format
   * Public method for testing and external use
   */
  serializeClaim(claim: Claim): string {
    let content = `## ${claim.id}: ${claim.text}\n\n`;
    
    if (claim.category) {
      content += `**Category**: ${claim.category}  \n`;
    }
    
    // Get source from primaryQuote (quotes have sources, not claims)
    if (claim.primaryQuote && claim.primaryQuote.source) {
      const source = claim.primaryQuote.source;
      const sourceId = claim.primaryQuote.sourceId;
      if (sourceId) {
        content += `**Source**: ${source} (Source ID: ${sourceId})  \n`;
      } else {
        content += `**Source**: ${source}  \n`;
      }
    }
    
    // Add sections field if claim has section associations
    if (claim.sections && claim.sections.length > 0) {
      content += `**Sections**: [${claim.sections.join(', ')}]  \n`;
    }
    
    if (claim.context) {
      content += `**Context**: ${claim.context}\n\n`;
    }
    
    if (claim.primaryQuote && claim.primaryQuote.text) {
      const quoteText = claim.primaryQuote.text;
      // Detect if quote has a citation prefix (e.g., "(Abstract):")
      const hasPrefix = quoteText.match(/^\([^)]+\):/);
      if (hasPrefix) {
        content += `**Primary Quote** ${hasPrefix[0]}\n`;
        content += `> "${quoteText.substring(hasPrefix[0].length).trim()}"\n\n`;
      } else {
        content += `**Primary Quote**:\n`;
        content += `> "${quoteText}"\n\n`;
      }
    }
    
    if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
      content += `**Supporting Quotes**:\n`;
      for (const quoteObj of claim.supportingQuotes) {
        const quoteText = quoteObj.text || '';
        // Check if quote has citation prefix
        const prefixMatch = quoteText.match(/^\(([^)]+)\):\s*(.+)$/);
        if (prefixMatch) {
          content += `- (${prefixMatch[1]}): "${prefixMatch[2]}"\n`;
        } else {
          content += `- "${quoteText}"\n`;
        }
      }
      content += '\n';
    }
    
    return content;
  }

  // Private helper methods for file writing

  /**
   * Queue a persistence operation to prevent race conditions
   * All writes are serialized through this queue
   */
  private async queuePersist(): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.persistClaims()).catch(error => {
      console.error('Error in write queue:', error);
      throw error;
    });
    
    return this.writeQueue;
  }

  private async persistClaims(): Promise<void> {
    this.isWriting = true;
    try {
      // Group claims by their source file
      const claimsByFile = new Map<string, Claim[]>();
      
      for (const claim of this.getClaims()) {
        const filePath = this.claimToFileMap[claim.id] || this.getDefaultFileForClaim(claim);
        
        if (!claimsByFile.has(filePath)) {
          claimsByFile.set(filePath, []);
        }
        claimsByFile.get(filePath)!.push(claim);
      }
      
      // Write each file with atomic writes and retry logic
      const writeResults: Array<{ filePath: string; success: boolean; error?: Error }> = [];
      for (const [filePath, claims] of claimsByFile.entries()) {
        try {
          const content = this.buildClaimsFileContent(filePath, claims);
          
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
          () => this.persistClaims()
        );
        
        throw new Error(`Failed to persist ${failedWrites.length} file(s)`);
      }
      
      console.log(`Persisted ${this.getClaims().length} claims across ${claimsByFile.size} file(s)`);
    } catch (error) {
      console.error('Error persisting claims:', error);
      throw error;
    } finally {
      this.isWriting = false;
    }
  }

  private buildClaimsFileContent(filePath: string, claims: Claim[]): string {
    // Sort claims by ID for consistent ordering
    claims.sort((a, b) => {
      const aNum = parseInt(a.id.replace('C_', ''), 10);
      const bNum = parseInt(b.id.replace('C_', ''), 10);
      return aNum - bNum;
    });

    // Build file content
    let content = '';
    
    // Add header if this is a category file
    if (filePath.includes('/claims/')) {
      const fileName = path.basename(filePath, '.md');
      const categoryName = this.getCategoryNameFromFileName(fileName);
      content = `# Claims and Evidence: ${categoryName}\n\n`;
      content += `This file contains all **${categoryName}** claims with their supporting evidence.\n\n`;
      content += '---\n\n';
    }

    // Add each claim
    for (const claim of claims) {
      content += this.serializeClaim(claim);
      content += '\n---\n\n\n';
    }

    return content;
  }

  private getCategoryNameFromFileName(fileName: string): string {
    const nameMap: { [key: string]: string } = {
      'methods_batch_correction': 'Method - Batch Correction',
      'methods_advanced': 'Method - Advanced',
      'methods_classifiers': 'Method - Classifiers',
      'methods': 'Method',
      'results': 'Result',
      'challenges': 'Challenge',
      'data_sources': 'Data Source',
      'data_trends': 'Data Trend',
      'impacts': 'Impact',
      'applications': 'Application',
      'phenomena': 'Phenomenon'
    };
    
    return nameMap[fileName] || fileName;
  }

  private getDefaultFileForClaim(claim: Claim): string {
    // If claims are organized by category, determine the category file
    const claimsDir = path.join(path.dirname(this.filePath), 'claims');
    const categoryFileName = this.getCategoryFileName(claim.category);
    return path.join(claimsDir, categoryFileName);
  }

  private getCategoryFileName(category: string): string {
    // Map category names to file names - matches user's existing structure
    const categoryMap: { [key: string]: string } = {
      'Method': 'methods_batch_correction.md', // Default for Method category
      'Method - Batch Correction': 'methods_batch_correction.md',
      'Method - Advanced': 'methods_advanced.md',
      'Method - Classifiers': 'methods_classifiers.md',
      'Result': 'results.md',
      'Challenge': 'challenges.md',
      'Data Source': 'data_sources.md',
      'Data Trend': 'data_trends.md',
      'Impact': 'impacts.md',
      'Application': 'applications.md',
      'Phenomenon': 'phenomena.md'
    };
    
    return categoryMap[category] || 'uncategorized.md';
  }

  private async writeClaimsToFile(filePath: string, claims: Claim[]): Promise<void> {
    const content = this.buildClaimsFileContent(filePath, claims);
    await this.writeFileIncremental(filePath, content);
  }

  private async writeFileIncremental(filePath: string, newContent: string): Promise<void> {
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
}
