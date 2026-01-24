import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Claim {
  id: string;
  text: string;
  category: string;
  source: string;
  sourceId: number;
  context: string;
  primaryQuote: string;
  supportingQuotes: string[];
  sections: string[];
  verified: boolean;
  createdAt: Date;
  modifiedAt: Date;
}

interface ClaimFileMapping {
  [claimId: string]: string; // Maps claim ID to category file path
}

export class ClaimsManager {
  private filePath: string;
  private claims: Map<string, Claim> = new Map();
  private claimToFileMap: ClaimFileMapping = {}; // Track which file each claim belongs to
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  updatePath(filePath: string): void {
    this.filePath = filePath;
    this.loadClaims();
  }

  async loadClaims(): Promise<Claim[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const claimsDir = path.join(path.dirname(this.filePath), 'claims');
      
      // Check if claims are in separate category files
      const hasCategoryFiles = await this.checkCategoryFiles(claimsDir);
      
      let claims: Claim[];
      if (hasCategoryFiles) {
        claims = await this.loadFromCategoryFiles(claimsDir);
      } else {
        // Fall back to parsing main file
        claims = this.parseContent(content);
        // All claims are in the main file
        for (const claim of claims) {
          this.claimToFileMap[claim.id] = this.filePath;
        }
      }
      
      this.claims.clear();
      for (const claim of claims) {
        this.claims.set(claim.id, claim);
      }
      
      this.onDidChangeEmitter.fire();
      return claims;
    } catch (error) {
      console.error('Error loading claims:', error);
      this.claims.clear();
      return [];
    }
  }

  private async checkCategoryFiles(claimsDir: string): Promise<boolean> {
    try {
      const stat = await fs.stat(claimsDir);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  private async loadFromCategoryFiles(claimsDir: string): Promise<Claim[]> {
    const allClaims: Claim[] = [];
    
    try {
      const files = await fs.readdir(claimsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      for (const file of mdFiles) {
        const filePath = path.join(claimsDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const claims = this.parseContent(content);
          
          // Track which file each claim came from
          for (const claim of claims) {
            this.claimToFileMap[claim.id] = filePath;
            allClaims.push(claim);
          }
        } catch (error) {
          console.error(`Error reading category file ${file}:`, error);
          // Continue with other files
        }
      }
    } catch (error) {
      console.error('Error loading category files:', error);
    }
    
    return allClaims;
  }

  private parseContent(content: string): Claim[] {
    const claims: Claim[] = [];
    const claimBlocks = content.split(/(?=^## C_\d+)/m).filter(block => block.trim());

    for (const block of claimBlocks) {
      try {
        const claim = this.parseClaimBlock(block);
        if (claim) {
          claims.push(claim);
        }
      } catch (error) {
        console.error('Error parsing claim block:', error);
        // Continue parsing other claims
      }
    }

    return claims;
  }

  private parseClaimBlock(block: string): Claim | null {
    const lines = block.split('\n');
    
    // Extract claim ID and text from header (format: ## C_XX: Claim text)
    const headerMatch = lines[0].match(/^## (C_\d+):\s*(.+)$/);
    if (!headerMatch) {
      console.warn('Invalid claim header format:', lines[0]);
      return null;
    }

    const id = headerMatch[1];
    const text = headerMatch[2].trim();
    let category = '';
    let source = '';
    let sourceId = 0;
    let context = '';
    let primaryQuote = '';
    const supportingQuotes: string[] = [];
    const sections: string[] = [];

    // Parse claim fields
    let inPrimaryQuote = false;
    let inSupportingQuotes = false;
    let currentQuote = '';
    let foundEnd = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Handle field markers - support both formats: "**Field:**" and "**Field**:"
      if (line.match(/^\*\*Category(\*\*)?:/)) {
        category = line.replace(/^\*\*Category(\*\*)?:\s*/, '').trim();
        inPrimaryQuote = false;
        inSupportingQuotes = false;
      } else if (line.match(/^\*\*Source(\*\*)?:/)) {
        // Format: **Source**: AuthorYear (Source ID: N) or **Source:** AuthorYear (Source ID: N)
        const sourceMatch = line.match(/\*\*Source(\*\*)?:\s*(\w+\d+)\s*\(Source ID:\s*(\d+)\)/);
        if (sourceMatch) {
          source = sourceMatch[2];
          sourceId = parseInt(sourceMatch[3], 10);
        }
        inPrimaryQuote = false;
        inSupportingQuotes = false;
      } else if (line.match(/^\*\*Context(\*\*)?:/)) {
        context = line.replace(/^\*\*Context(\*\*)?:\s*/, '').trim();
        inPrimaryQuote = false;
        inSupportingQuotes = false;
      } else if (line.startsWith('**Primary Quote**')) {
        inPrimaryQuote = true;
        inSupportingQuotes = false;
        currentQuote = '';
        // Check if quote starts on same line
        const quoteMatch = line.match(/\*\*Primary Quote\*\*[^:]*:\s*(.+)$/);
        if (quoteMatch) {
          currentQuote = quoteMatch[1].trim();
        }
      } else if (line.startsWith('**Supporting Quotes**')) {
        if (inPrimaryQuote && currentQuote) {
          primaryQuote = currentQuote.trim();
        }
        inPrimaryQuote = false;
        inSupportingQuotes = true;
        currentQuote = '';
      } else if (line.startsWith('---')) {
        // End of claim block
        if (inPrimaryQuote && currentQuote) {
          primaryQuote = currentQuote.trim();
        } else if (inSupportingQuotes && currentQuote) {
          supportingQuotes.push(this.cleanQuote(currentQuote.trim()));
        }
        foundEnd = true;
        break;
      } else if (line.trim().startsWith('>')) {
        // Quote line
        const quoteLine = line.trim().substring(1).trim();
        if (quoteLine) {
          currentQuote += (currentQuote ? ' ' : '') + quoteLine;
        }
      } else if (line.trim().startsWith('-') && inSupportingQuotes) {
        // Save previous supporting quote if exists
        if (currentQuote) {
          supportingQuotes.push(this.cleanQuote(currentQuote.trim()));
          currentQuote = '';
        }
        // Start new supporting quote
        const quoteLine = line.trim().substring(1).trim();
        if (quoteLine.startsWith('(')) {
          // Has citation prefix like "(Section 2.3):"
          const quoteMatch = quoteLine.match(/\([^)]+\):\s*(.+)$/);
          if (quoteMatch) {
            currentQuote = quoteMatch[1].trim();
          }
        } else {
          currentQuote = quoteLine;
        }
      } else if ((inPrimaryQuote || inSupportingQuotes) && line.trim() && !line.startsWith('**')) {
        // Continue multi-line quote only if not starting a new list item
        if (!line.trim().startsWith('-')) {
          currentQuote += ' ' + line.trim();
        }
      }
    }

    // Save any remaining quote only if we didn't find the end marker
    if (!foundEnd) {
      if (inPrimaryQuote && currentQuote) {
        primaryQuote = currentQuote.trim();
      } else if (inSupportingQuotes && currentQuote) {
        supportingQuotes.push(this.cleanQuote(currentQuote.trim()));
      }
    }

    // Clean up primary quote
    primaryQuote = this.cleanQuote(primaryQuote);
    // Supporting quotes already cleaned when added

    return {
      id,
      text,
      category,
      source,
      sourceId,
      context,
      primaryQuote,
      supportingQuotes,
      sections,
      verified: false,
      createdAt: new Date(),
      modifiedAt: new Date()
    };
  }

  private cleanQuote(quote: string): string {
    let cleaned = quote.trim();
    // Remove surrounding quotes if present
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.substring(1, cleaned.length - 1);
    }
    return cleaned;
  }

  getClaims(): Claim[] {
    return Array.from(this.claims.values());
  }

  getClaim(id: string): Claim | null {
    return this.claims.get(id) || null;
  }

  findClaimsBySection(sectionId: string): Claim[] {
    return this.getClaims().filter(claim => claim.sections.includes(sectionId));
  }

  findClaimsBySource(source: string): Claim[] {
    return this.getClaims().filter(claim => claim.source === source);
  }

  async saveClaim(claim: Claim): Promise<void> {
    // Ensure claim has required fields
    if (!claim.id || !claim.text) {
      throw new Error('Claim must have id and text');
    }
    
    // Set timestamps
    if (!this.claims.has(claim.id)) {
      claim.createdAt = new Date();
    }
    claim.modifiedAt = new Date();
    
    this.claims.set(claim.id, claim);
    
    // Update file mapping if not already set
    if (!this.claimToFileMap[claim.id]) {
      this.claimToFileMap[claim.id] = this.getDefaultFileForClaim(claim);
    }
    
    await this.persistClaims();
    this.onDidChangeEmitter.fire();
  }

  async updateClaim(id: string, updates: Partial<Claim>): Promise<void> {
    const claim = this.claims.get(id);
    if (!claim) {
      throw new Error(`Claim ${id} not found`);
    }

    // Prevent changing immutable fields
    const { id: _, createdAt: __, ...allowedUpdates } = updates;
    
    Object.assign(claim, allowedUpdates, { modifiedAt: new Date() });
    await this.persistClaims();
    this.onDidChangeEmitter.fire();
  }

  async deleteClaim(id: string): Promise<void> {
    if (!this.claims.has(id)) {
      throw new Error(`Claim ${id} not found`);
    }
    
    this.claims.delete(id);
    delete this.claimToFileMap[id];
    await this.persistClaims();
    this.onDidChangeEmitter.fire();
  }

  /**
   * Generate a unique claim ID
   */
  generateClaimId(): string {
    const existingIds = Array.from(this.claims.keys());
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
      claim.primaryQuote.toLowerCase().includes(lowerQuery) ||
      claim.context.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Merge multiple claims into one
   */
  async mergeClaims(ids: string[]): Promise<Claim> {
    if (ids.length < 2) {
      throw new Error('Must provide at least 2 claim IDs to merge');
    }

    const claimsToMerge = ids.map(id => this.claims.get(id)).filter(c => c !== undefined) as Claim[];
    
    if (claimsToMerge.length !== ids.length) {
      throw new Error('One or more claim IDs not found');
    }

    // Create merged claim
    const primaryClaim = claimsToMerge[0];
    const mergedClaim: Claim = {
      id: this.generateClaimId(),
      text: primaryClaim.text,
      category: primaryClaim.category,
      source: claimsToMerge.map(c => c.source).join(', '),
      sourceId: primaryClaim.sourceId,
      context: claimsToMerge.map(c => c.context).filter(c => c).join(' | '),
      primaryQuote: primaryClaim.primaryQuote,
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

  private async persistClaims(): Promise<void> {
    try {
      // Group claims by their source file
      const claimsByFile = new Map<string, Claim[]>();
      
      for (const claim of this.claims.values()) {
        const filePath = this.claimToFileMap[claim.id] || this.getDefaultFileForClaim(claim);
        
        if (!claimsByFile.has(filePath)) {
          claimsByFile.set(filePath, []);
        }
        claimsByFile.get(filePath)!.push(claim);
      }
      
      // Write each file incrementally
      for (const [filePath, claims] of claimsByFile.entries()) {
        await this.writeClaimsToFile(filePath, claims);
      }
      
      console.log(`Persisted ${this.claims.size} claims across ${claimsByFile.size} file(s)`);
    } catch (error) {
      console.error('Error persisting claims:', error);
      throw error;
    }
  }

  private getDefaultFileForClaim(claim: Claim): string {
    // If claims are organized by category, determine the category file
    const claimsDir = path.join(path.dirname(this.filePath), 'claims');
    const categoryFileName = this.getCategoryFileName(claim.category);
    return path.join(claimsDir, categoryFileName);
  }

  private getCategoryFileName(category: string): string {
    // Map category names to file names
    const categoryMap: { [key: string]: string } = {
      'Method': 'methods.md',
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

    // Write file with incremental update strategy
    await this.writeFileIncremental(filePath, content);
  }

  private getCategoryNameFromFileName(fileName: string): string {
    const nameMap: { [key: string]: string } = {
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

  private serializeClaim(claim: Claim): string {
    let content = `## ${claim.id}: ${claim.text}\n\n`;
    
    if (claim.category) {
      content += `**Category**: ${claim.category}  \n`;
    }
    
    if (claim.source && claim.sourceId) {
      content += `**Source**: ${claim.source} (Source ID: ${claim.sourceId})  \n`;
    }
    
    if (claim.context) {
      content += `**Context**: ${claim.context}\n\n`;
    }
    
    if (claim.primaryQuote) {
      content += `**Primary Quote**:\n`;
      content += `> "${claim.primaryQuote}"\n\n`;
    }
    
    if (claim.supportingQuotes && claim.supportingQuotes.length > 0) {
      content += `**Supporting Quotes**:\n`;
      for (const quote of claim.supportingQuotes) {
        content += `- "${quote}"\n`;
      }
      content += '\n';
    }
    
    return content;
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
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Write new content
        await fs.writeFile(filePath, newContent, 'utf-8');
      }
    } catch (error) {
      console.error(`Error writing file ${filePath}:`, error);
      throw error;
    }
  }
}
