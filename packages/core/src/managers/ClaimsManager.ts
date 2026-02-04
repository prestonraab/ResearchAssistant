import * as fs from 'fs/promises';
import * as path from 'path';
import type { Claim, SourcedQuote } from '../types/index.js';

export interface ClaimsManagerOptions {
  /**
   * If true, the manager operates in memory-only mode without file I/O.
   * Useful for testing where you want to inject claims directly.
   */
  inMemory?: boolean;
}

/**
 * ClaimsManager handles loading and querying claims from the workspace.
 * 
 * Claims can be stored in two formats:
 * 1. Individual claim files in 01_Knowledge_Base/claims/ directory
 * 2. Single claims_and_evidence.md file (fallback)
 * 
 * The manager prioritizes individual claim files and falls back to the
 * single file if the claims directory is empty or doesn't exist.
 * 
 * This is a read-only implementation - file writing should be handled by
 * the consuming application (extension or MCP server).
 * 
 * For testing, the manager can be created in in-memory mode where claims
 * are managed directly without file I/O.
 * 
 * @example
 * ```typescript
 * // File-based mode
 * const manager = new ClaimsManager('/path/to/workspace');
 * await manager.loadClaims();
 * const claim = manager.getClaim('C_01');
 * 
 * // In-memory mode for testing
 * const testManager = new ClaimsManager('', { inMemory: true });
 * testManager.addClaim({ id: 'C_01', text: 'Test claim', ... });
 * const claim = testManager.getClaim('C_01');
 * ```
 */
export class ClaimsManager {
  private claims: Claim[] = [];
  private claimsById: Map<string, Claim> = new Map();
  private claimsBySource: Map<string, Claim[]> = new Map();
  private claimsBySection: Map<string, Claim[]> = new Map();
  private workspaceRoot: string;
  private loaded: boolean = false;
  private inMemoryMode: boolean = false;

  /**
   * Create a new ClaimsManager instance.
   * 
   * @param workspaceRoot - Absolute path to the workspace root directory (can be empty string for in-memory mode)
   * @param options - Configuration options
   */
  constructor(workspaceRoot: string, options?: ClaimsManagerOptions) {
    this.workspaceRoot = workspaceRoot;
    this.inMemoryMode = options?.inMemory ?? false;
    
    // In-memory mode is immediately "loaded" since there's no file I/O
    if (this.inMemoryMode) {
      this.loaded = true;
    }
  }

  /**
   * Load claims from the workspace.
   * 
   * Tries to load from individual files in 01_Knowledge_Base/claims/ first,
   * falls back to single claims_and_evidence.md file if the directory is
   * empty or doesn't exist.
   * 
   * Note: In in-memory mode, this method does nothing and returns the current claims.
   * 
   * @returns Array of loaded claims
   * @throws Error if there are issues reading files (other than not found)
   * @throws Error if called in in-memory mode
   */
  async loadClaims(): Promise<Claim[]> {
    if (this.inMemoryMode) {
      // In-memory mode doesn't load from files
      return [...this.claims];
    }

    this.claims = [];
    this.claimsById.clear();
    this.claimsBySource.clear();
    this.claimsBySection.clear();

    const claimsDir = path.join(this.workspaceRoot, '01_Knowledge_Base', 'claims');
    const singleFile = path.join(this.workspaceRoot, '01_Knowledge_Base', 'claims_and_evidence.md');

    try {
      // Try loading from individual claim files first
      const stats = await fs.stat(claimsDir);
      if (stats.isDirectory()) {
        const files = await fs.readdir(claimsDir);
        const mdFiles = files.filter(f => f.endsWith('.md'));
        
        if (mdFiles.length > 0) {
          // Load from individual files
          for (const file of mdFiles) {
            const filePath = path.join(claimsDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const fileClaims = this.parseClaimsFromFile(content, file);
            this.claims.push(...fileClaims);
          }
        } else {
          // Directory exists but is empty, try fallback
          await this.loadFromSingleFile(singleFile);
        }
      }
    } catch (error) {
      // Claims directory doesn't exist, try fallback
      await this.loadFromSingleFile(singleFile);
    }

    // Build indexes
    this.buildIndexes();
    this.loaded = true;

    return this.claims;
  }

  /**
   * Load claims from the single claims_and_evidence.md file.
   * 
   * @param filePath - Path to the claims file
   * @private
   */
  private async loadFromSingleFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const claims = this.parseClaimsFromFile(content, 'claims_and_evidence.md');
      this.claims.push(...claims);
    } catch (error) {
      // Neither source exists - return empty claims array
      console.warn(`No claims found in workspace: ${this.workspaceRoot}`);
    }
  }

  /**
   * Parse claims from a markdown file.
   * 
   * Claims follow the format:
   * ```markdown
   * ## C_XX: Claim text
   * **Category**: ...
   * **Source**: ...
   * **Primary Quote**: ...
   * **Supporting Quotes**: ...
   * ```
   * 
   * @param content - File content to parse
   * @param filename - Name of the file being parsed (for debugging)
   * @returns Array of parsed claims
   * @private
   */
  private parseClaimsFromFile(content: string, filename: string): Claim[] {
    const claims: Claim[] = [];
    const lines = content.split('\n');
    
    let currentClaim: Partial<Claim> | null = null;
    let inSupportingQuotes = false;
    let inPrimaryQuote = false;
    let quoteBuffer = '';
    let currentSource = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect claim header: ## C_XX: Claim text
      const claimHeaderMatch = trimmedLine.match(/^##\s+(C_\d+):\s*(.+)$/);
      if (claimHeaderMatch) {
        // Save previous claim if exists
        if (currentClaim && currentClaim.id) {
          claims.push(this.finalizeClaim(currentClaim, currentSource));
        }

        // Start new claim
        currentClaim = {
          id: claimHeaderMatch[1],
          text: claimHeaderMatch[2].trim(),
          category: '',
          verified: false,
          primaryQuote: { text: '', source: '', verified: false },
          supportingQuotes: [],
          sections: [],
        };
        currentSource = '';
        inSupportingQuotes = false;
        inPrimaryQuote = false;
        quoteBuffer = '';
        continue;
      }

      if (!currentClaim) continue;

      // Parse metadata fields
      const categoryMatch = trimmedLine.match(/^\*\*Category\*\*:\s*(.+)$/);
      if (categoryMatch) {
        currentClaim.category = categoryMatch[1].trim();
        continue;
      }

      const sourceMatch = trimmedLine.match(/^\*\*Source\*\*:\s*(.+?)(?:\s*\(Source ID:\s*(\d+)\))?$/);
      if (sourceMatch) {
        currentSource = sourceMatch[1].trim();
        if (sourceMatch[2]) {
          // Store sourceId to apply to primaryQuote later
          if (!currentClaim.primaryQuote) {
            currentClaim.primaryQuote = { text: '', source: currentSource, verified: false };
          }
          currentClaim.primaryQuote.sourceId = parseInt(sourceMatch[2], 10);
        }
        continue;
      }

      const contextMatch = trimmedLine.match(/^\*\*Context\*\*:\s*(.+)$/);
      if (contextMatch) {
        currentClaim.context = contextMatch[1].trim();
        continue;
      }

      // Detect Primary Quote section
      if (trimmedLine.match(/^\*\*Primary Quote\*\*/)) {
        inPrimaryQuote = true;
        inSupportingQuotes = false;
        quoteBuffer = '';
        continue;
      }

      // Detect Supporting Quotes section
      if (trimmedLine.match(/^\*\*Supporting Quotes\*\*/)) {
        // Save primary quote if we were collecting it
        if (inPrimaryQuote && quoteBuffer.trim()) {
          const cleanedQuote = this.cleanQuote(quoteBuffer);
          currentClaim.primaryQuote = {
            text: cleanedQuote,
            source: currentSource,
            verified: false
          };
        }
        inSupportingQuotes = true;
        inPrimaryQuote = false;
        quoteBuffer = '';
        continue;
      }

      // Collect quote content
      if (inPrimaryQuote) {
        // Look for quoted text (lines starting with >)
        if (trimmedLine.startsWith('>')) {
          quoteBuffer += trimmedLine.substring(1).trim() + ' ';
        }
      }

      if (inSupportingQuotes) {
        // Supporting quotes are list items with quoted text
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
          // Save previous supporting quote if exists
          if (quoteBuffer.trim()) {
            const cleanedQuote = this.cleanQuote(quoteBuffer);
            currentClaim.supportingQuotes!.push({
              text: cleanedQuote,
              source: currentSource,
              verified: false
            });
            quoteBuffer = '';
          }
          // Start collecting new supporting quote
          const listContent = trimmedLine.substring(1).trim();
          // Extract quote from list item - format: - (Location): "quote text"
          const quoteMatch = listContent.match(/\([^)]+\):\s*"([^"]+)"/);
          if (quoteMatch) {
            currentClaim.supportingQuotes!.push({
              text: quoteMatch[1].trim(),
              source: currentSource,
              verified: false
            });
          } else if (listContent.startsWith('>')) {
            quoteBuffer = listContent.substring(1).trim() + ' ';
          }
        } else if (trimmedLine.startsWith('>') && quoteBuffer) {
          // Continuation of multi-line quote
          quoteBuffer += trimmedLine.substring(1).trim() + ' ';
        }
      }

      // Detect section separator (---)
      if (trimmedLine === '---') {
        // Save any pending quote
        if (inPrimaryQuote && quoteBuffer.trim()) {
          const cleanedQuote = this.cleanQuote(quoteBuffer);
          currentClaim.primaryQuote = {
            text: cleanedQuote,
            source: currentSource,
            verified: false
          };
        } else if (inSupportingQuotes && quoteBuffer.trim()) {
          const cleanedQuote = this.cleanQuote(quoteBuffer);
          currentClaim.supportingQuotes!.push({
            text: cleanedQuote,
            source: currentSource,
            verified: false
          });
        }
        inPrimaryQuote = false;
        inSupportingQuotes = false;
        quoteBuffer = '';
      }
    }

    // Save last claim
    if (currentClaim && currentClaim.id) {
      // Save any pending quote
      if (inPrimaryQuote && quoteBuffer.trim()) {
        const cleanedQuote = this.cleanQuote(quoteBuffer);
        currentClaim.primaryQuote = {
          text: cleanedQuote,
          source: currentSource,
          verified: false
        };
      } else if (inSupportingQuotes && quoteBuffer.trim()) {
        const cleanedQuote = this.cleanQuote(quoteBuffer);
        currentClaim.supportingQuotes!.push({
          text: cleanedQuote,
          source: currentSource,
          verified: false
        });
      }
      claims.push(this.finalizeClaim(currentClaim, currentSource));
    }

    return claims;
  }

  /**
   * Clean and normalize quote text.
   * 
   * Removes extra whitespace and surrounding quotes.
   * 
   * @param quote - Raw quote text
   * @returns Cleaned quote text
   * @private
   */
  private cleanQuote(quote: string): string {
    return quote
      .trim()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/^["']|["']$/g, '');  // Remove surrounding quotes
  }

  /**
   * Finalize a claim by ensuring all required fields are present.
   * 
   * @param partial - Partial claim object from parsing
   * @param source - The source for this claim
   * @returns Complete claim object with all required fields
   * @private
   */
  private finalizeClaim(partial: Partial<Claim>, source: string): Claim {
    // Ensure primaryQuote is a SourcedQuote
    let primaryQuote: SourcedQuote;
    if (typeof partial.primaryQuote === 'string') {
      // Migration from old format
      primaryQuote = {
        text: partial.primaryQuote,
        source: source,
        verified: false
      };
    } else if (partial.primaryQuote && typeof partial.primaryQuote === 'object') {
      primaryQuote = partial.primaryQuote as SourcedQuote;
    } else {
      primaryQuote = {
        text: '',
        source: source,
        verified: false
      };
    }

    // Ensure supportingQuotes are SourcedQuotes
    let supportingQuotes: SourcedQuote[] = [];
    if (partial.supportingQuotes && Array.isArray(partial.supportingQuotes)) {
      supportingQuotes = partial.supportingQuotes.map(quote => {
        if (typeof quote === 'string') {
          // Migration from old format
          return {
            text: quote,
            source: source,
            verified: false
          };
        }
        return quote as SourcedQuote;
      });
    }

    return {
      id: partial.id || '',
      text: partial.text || '',
      category: partial.category || 'Unknown',
      context: partial.context || '',
      verified: partial.verified || false,
      primaryQuote,
      supportingQuotes,
      sections: partial.sections || [],
      createdAt: partial.createdAt || new Date(),
      modifiedAt: partial.modifiedAt || new Date(),
    };
  }

  /**
   * Build indexes for fast lookup.
   * 
   * Creates maps for quick access by ID, source, and section.
   * 
   * @private
   */
  private buildIndexes(): void {
    for (const claim of this.claims) {
      // Index by ID
      this.claimsById.set(claim.id, claim);

      // Index by source (from primaryQuote)
      const source = claim.primaryQuote.source;
      if (!this.claimsBySource.has(source)) {
        this.claimsBySource.set(source, []);
      }
      this.claimsBySource.get(source)!.push(claim);

      // Index by section
      for (const section of claim.sections) {
        if (!this.claimsBySection.has(section)) {
          this.claimsBySection.set(section, []);
        }
        this.claimsBySection.get(section)!.push(claim);
      }
    }
  }

  /**
   * Get a claim by its ID.
   * 
   * @param claimId - The claim ID (e.g., 'C_01')
   * @returns The claim if found, null otherwise
   * @throws Error if claims haven't been loaded yet
   * 
   * @example
   * ```typescript
   * const claim = manager.getClaim('C_01');
   * if (claim) {
   *   console.log(claim.text);
   * }
   * ```
   */
  getClaim(claimId: string): Claim | null {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first. This is an internal error - please report it.');
    }
    return this.claimsById.get(claimId) || null;
  }

  /**
   * Find all claims from a specific source.
   * 
   * @param source - The source identifier (e.g., 'Smith2020')
   * @returns Array of claims from that source
   * @throws Error if claims haven't been loaded yet
   * 
   * @example
   * ```typescript
   * const claims = manager.findClaimsBySource('Smith2020');
   * console.log(`Found ${claims.length} claims from Smith2020`);
   * ```
   */
  findClaimsBySource(source: string): Claim[] {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first. This is an internal error - please report it.');
    }
    return this.claimsBySource.get(source) || [];
  }

  /**
   * Find all claims associated with a specific section.
   * 
   * @param sectionId - The section identifier (e.g., '2.1', 'introduction')
   * @returns Array of claims associated with that section
   * @throws Error if claims haven't been loaded yet
   * 
   * @example
   * ```typescript
   * const claims = manager.findClaimsBySection('2.1');
   * console.log(`Found ${claims.length} claims for section 2.1`);
   * ```
   */
  findClaimsBySection(sectionId: string): Claim[] {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first. This is an internal error - please report it.');
    }
    return this.claimsBySection.get(sectionId) || [];
  }

  /**
   * Get all loaded claims.
   * 
   * @returns Array of all claims (copy to prevent external modification)
   * @throws Error if claims haven't been loaded yet
   * 
   * @example
   * ```typescript
   * const allClaims = manager.getAllClaims();
   * console.log(`Total claims: ${allClaims.length}`);
   * ```
   */
  getAllClaims(): Claim[] {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first. This is an internal error - please report it.');
    }
    return [...this.claims];
  }

  /**
   * Get the count of loaded claims.
   * 
   * @returns Number of claims currently loaded
   * 
   * @example
   * ```typescript
   * console.log(`Loaded ${manager.getClaimCount()} claims`);
   * ```
   */
  getClaimCount(): number {
    return this.claims.length;
  }

  /**
   * Check if claims have been loaded.
   * 
   * @returns True if loadClaims() has been called successfully
   * 
   * @example
   * ```typescript
   * if (!manager.isLoaded()) {
   *   await manager.loadClaims();
   * }
   * ```
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Add a claim directly to the manager (in-memory mode only).
   * 
   * This method is primarily intended for testing, allowing you to inject
   * claims without file I/O. It can only be used when the manager is in
   * in-memory mode.
   * 
   * @param claim - The claim to add
   * @throws Error if not in in-memory mode
   * 
   * @example
   * ```typescript
   * const manager = new ClaimsManager('', { inMemory: true });
   * manager.addClaim({
   *   id: 'C_01',
   *   text: 'Test claim',
   *   category: 'Method',
   *   verified: false,
   *   primaryQuote: { text: 'Quote', source: 'Source', verified: false },
   *   supportingQuotes: [],
   *   sections: []
   * });
   * ```
   */
  addClaim(claim: Claim): void {
    if (!this.inMemoryMode) {
      throw new Error('addClaim() can only be used in in-memory mode. Create the manager with { inMemory: true }');
    }

    // Add to main array
    this.claims.push(claim);

    // Update indexes
    this.claimsById.set(claim.id, claim);

    // Index by source
    const source = claim.primaryQuote.source;
    if (!this.claimsBySource.has(source)) {
      this.claimsBySource.set(source, []);
    }
    this.claimsBySource.get(source)!.push(claim);

    // Index by sections
    for (const section of claim.sections) {
      if (!this.claimsBySection.has(section)) {
        this.claimsBySection.set(section, []);
      }
      this.claimsBySection.get(section)!.push(claim);
    }
  }
}
