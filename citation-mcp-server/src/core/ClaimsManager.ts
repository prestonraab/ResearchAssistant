import * as fs from 'fs/promises';
import * as path from 'path';
import { Claim } from '../types/index.js';

/**
 * ClaimsManager handles loading and querying claims from the workspace.
 * 
 * Claims can be stored in two formats:
 * 1. Individual claim files in 01_Knowledge_Base/claims/ directory
 * 2. Single claims_and_evidence.md file (fallback)
 * 
 * The manager prioritizes individual claim files and falls back to the
 * single file if the claims directory is empty or doesn't exist.
 */
export class ClaimsManager {
  private claims: Claim[] = [];
  private claimsById: Map<string, Claim> = new Map();
  private claimsBySource: Map<string, Claim[]> = new Map();
  private claimsBySection: Map<string, Claim[]> = new Map();
  private workspaceRoot: string;
  private loaded: boolean = false;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Load claims from the workspace.
   * Tries to load from individual files first, falls back to single file.
   */
  async loadClaims(): Promise<Claim[]> {
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
   * Load claims from the single claims_and_evidence.md file
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
   * Claims follow the format:
   * ## C_XX: Claim text
   * **Category**: ...
   * **Source**: ...
   * **Primary Quote**: ...
   * **Supporting Quotes**: ...
   */
  private parseClaimsFromFile(content: string, filename: string): Claim[] {
    const claims: Claim[] = [];
    const lines = content.split('\n');
    
    let currentClaim: Partial<Claim> | null = null;
    let inSupportingQuotes = false;
    let inPrimaryQuote = false;
    let quoteBuffer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Detect claim header: ## C_XX: Claim text
      const claimHeaderMatch = trimmedLine.match(/^##\s+(C_\d+):\s*(.+)$/);
      if (claimHeaderMatch) {
        // Save previous claim if exists
        if (currentClaim && currentClaim.id) {
          claims.push(this.finalizeClaim(currentClaim));
        }

        // Start new claim
        currentClaim = {
          id: claimHeaderMatch[1],
          text: claimHeaderMatch[2].trim(),
          category: '',
          source: '',
          verified: false,
          primaryQuote: '',
          supportingQuotes: [],
          sections: [],
        };
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

      const sourceMatch = trimmedLine.match(/^\*\*Source\*\*:\s*(.+?)(?:\s*\(Source ID:.*\))?$/);
      if (sourceMatch) {
        currentClaim.source = sourceMatch[1].trim();
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
          currentClaim.primaryQuote = this.cleanQuote(quoteBuffer);
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
            currentClaim.supportingQuotes!.push(this.cleanQuote(quoteBuffer));
            quoteBuffer = '';
          }
          // Start collecting new supporting quote
          const listContent = trimmedLine.substring(1).trim();
          // Extract quote from list item - format: - (Location): "quote text"
          const quoteMatch = listContent.match(/\([^)]+\):\s*"([^"]+)"/);
          if (quoteMatch) {
            currentClaim.supportingQuotes!.push(quoteMatch[1].trim());
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
          currentClaim.primaryQuote = this.cleanQuote(quoteBuffer);
        } else if (inSupportingQuotes && quoteBuffer.trim()) {
          currentClaim.supportingQuotes!.push(this.cleanQuote(quoteBuffer));
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
        currentClaim.primaryQuote = this.cleanQuote(quoteBuffer);
      } else if (inSupportingQuotes && quoteBuffer.trim()) {
        currentClaim.supportingQuotes!.push(this.cleanQuote(quoteBuffer));
      }
      claims.push(this.finalizeClaim(currentClaim));
    }

    return claims;
  }

  /**
   * Clean and normalize quote text
   */
  private cleanQuote(quote: string): string {
    return quote
      .trim()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/^["']|["']$/g, '');  // Remove surrounding quotes
  }

  /**
   * Finalize a claim by ensuring all required fields are present
   */
  private finalizeClaim(partial: Partial<Claim>): Claim {
    return {
      id: partial.id || '',
      text: partial.text || '',
      category: partial.category || 'Unknown',
      source: partial.source || 'Unknown',
      verified: partial.verified || false,
      primaryQuote: partial.primaryQuote || '',
      supportingQuotes: partial.supportingQuotes || [],
      sections: partial.sections || [],
      context: partial.context,
    };
  }

  /**
   * Build indexes for fast lookup
   */
  private buildIndexes(): void {
    for (const claim of this.claims) {
      // Index by ID
      this.claimsById.set(claim.id, claim);

      // Index by source
      if (!this.claimsBySource.has(claim.source)) {
        this.claimsBySource.set(claim.source, []);
      }
      this.claimsBySource.get(claim.source)!.push(claim);

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
   * Get a claim by its ID
   */
  getClaim(claimId: string): Claim | null {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first.');
    }
    return this.claimsById.get(claimId) || null;
  }

  /**
   * Find all claims from a specific source
   */
  findClaimsBySource(source: string): Claim[] {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first.');
    }
    return this.claimsBySource.get(source) || [];
  }

  /**
   * Find all claims associated with a specific section
   */
  findClaimsBySection(sectionId: string): Claim[] {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first.');
    }
    return this.claimsBySection.get(sectionId) || [];
  }

  /**
   * Get all loaded claims
   */
  getAllClaims(): Claim[] {
    if (!this.loaded) {
      throw new Error('Claims not loaded. Call loadClaims() first.');
    }
    return [...this.claims];
  }

  /**
   * Get the count of loaded claims
   */
  getClaimCount(): number {
    return this.claims.length;
  }
}
