import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface OutlineSection {
  id: string;
  title: string;
  level: number;
  questions: string[];
  lineNumber: number;
  parent?: string;
  children: string[];
  linkedClaims: string[];
  suggestedSearches: string[];
  coverage: 'none' | 'partial' | 'good';
}

interface ClaimLink {
  claimId: string;
  sectionId: string;
  relevance: number;
}

export class OutlineTreeProvider implements vscode.TreeDataProvider<OutlineTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<OutlineTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private sections: Map<string, OutlineSection> = new Map();
  private claimLinks: ClaimLink[] = [];

  refresh(): void {
    this.sections.clear();
    this.claimLinks = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OutlineTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: OutlineTreeItem): Promise<OutlineTreeItem[]> {
    if (!element) {
      return this.getRootItems();
    }
    
    if (element.contextValue === 'section') {
      return this.getSectionChildren(element.sectionId!);
    }
    
    return [];
  }

  private async getRootItems(): Promise<OutlineTreeItem[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const config = vscode.workspace.getConfiguration('citationHover');
    const outlinePath = config.get<string>('outlineFilePath', '03_Drafting/outline.md');
    const fullPath = path.join(workspaceFolders[0].uri.fsPath, outlinePath);

    if (!fs.existsSync(fullPath)) {
      return [new OutlineTreeItem('Outline file not found', vscode.TreeItemCollapsibleState.None)];
    }

    // Parse outline
    await this.parseOutline(fullPath);
    
    // Link claims to sections
    await this.linkClaimsToSections(workspaceFolders[0].uri);

    // Build tree
    return this.buildTree();
  }

  private async parseOutline(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    let currentSection: OutlineSection | null = null;
    let sectionCounter = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match headers (## or ###)
      const headerMatch = line.match(/^(#{2,4})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        
        // Skip abstract and horizontal rules
        if (title.toLowerCase() === 'abstract' || line.startsWith('---')) {
          continue;
        }

        sectionCounter++;
        const sectionId = `S_${sectionCounter.toString().padStart(2, '0')}`;
        
        const section: OutlineSection = {
          id: sectionId,
          title,
          level,
          questions: [],
          lineNumber: i,
          children: [],
          linkedClaims: [],
          suggestedSearches: [],
          coverage: 'none'
        };

        // Find parent
        if (level > 2) {
          // Find most recent section with lower level
          for (const [id, sec] of Array.from(this.sections.entries()).reverse()) {
            if (sec.level < level) {
              section.parent = id;
              sec.children.push(sectionId);
              break;
            }
          }
        }

        this.sections.set(sectionId, section);
        currentSection = section;
        continue;
      }

      // Match questions (lines starting with -)
      if (currentSection && line.trim().startsWith('-')) {
        const question = line.trim().substring(1).trim();
        if (question.endsWith('?')) {
          currentSection.questions.push(question);
        }
      }
    }

    // Generate suggested searches for each section
    for (const section of this.sections.values()) {
      section.suggestedSearches = this.generateSearches(section);
    }
  }

  private generateSearches(section: OutlineSection): string[] {
    const searches: string[] = [];
    const title = section.title.toLowerCase();

    // Extract key terms from title
    const keyTerms = title
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['the', 'and', 'for', 'with'].includes(word));

    // Generate searches based on section content
    if (title.includes('combat')) {
      searches.push('ComBat batch correction', 'empirical Bayes batch effects');
    } else if (title.includes('classifier')) {
      searches.push('machine learning gene expression', 'classification genomics');
    } else if (title.includes('batch effect')) {
      searches.push('batch effects genomics', 'technical variation RNA-seq');
    } else if (title.includes('cross-validation')) {
      searches.push('cross-validation bias batch effects', 'performance estimation genomics');
    } else if (keyTerms.length > 0) {
      // Generic search from key terms
      searches.push(keyTerms.slice(0, 3).join(' '));
    }

    // Add searches from questions
    for (const question of section.questions.slice(0, 2)) {
      const questionTerms = question
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 4 && !['what', 'when', 'where', 'which', 'should'].includes(word))
        .slice(0, 3);
      
      if (questionTerms.length >= 2) {
        searches.push(questionTerms.join(' '));
      }
    }

    return searches.slice(0, 3); // Limit to 3 searches
  }

  private async linkClaimsToSections(workspaceUri: vscode.Uri): Promise<void> {
    const config = vscode.workspace.getConfiguration('citationHover');
    const claimsPath = config.get<string>('claimsFilePath', '01_Knowledge_Base/claims_and_evidence.md');
    const fullPath = path.join(workspaceUri.fsPath, claimsPath);

    if (!fs.existsSync(fullPath)) {
      return;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    
    // Extract claims
    const claimRegex = /## (C_\d+): (.+?)$/gm;
    let match;
    const claims: Array<{id: string, title: string}> = [];

    while ((match = claimRegex.exec(content)) !== null) {
      claims.push({
        id: match[1],
        title: match[2].toLowerCase()
      });
    }

    // Link claims to sections based on keyword matching
    for (const claim of claims) {
      for (const [sectionId, section] of this.sections) {
        const relevance = this.calculateRelevance(claim.title, section);
        
        if (relevance > 0.3) {
          this.claimLinks.push({
            claimId: claim.id,
            sectionId,
            relevance
          });
          
          if (!section.linkedClaims.includes(claim.id)) {
            section.linkedClaims.push(claim.id);
          }
        }
      }
    }

    // Update coverage based on linked claims
    for (const section of this.sections.values()) {
      const claimCount = section.linkedClaims.length;
      const questionCount = section.questions.length;
      
      if (claimCount === 0) {
        section.coverage = 'none';
      } else if (questionCount > 0 && claimCount < questionCount / 2) {
        section.coverage = 'partial';
      } else {
        section.coverage = 'good';
      }
    }
  }

  private calculateRelevance(claimTitle: string, section: OutlineSection): number {
    let score = 0;
    const claimWords = claimTitle.toLowerCase().split(/\s+/);
    const sectionTitle = section.title.toLowerCase();
    const sectionQuestions = section.questions.join(' ').toLowerCase();

    // Check title overlap
    for (const word of claimWords) {
      if (word.length > 3) {
        if (sectionTitle.includes(word)) {
          score += 0.3;
        }
        if (sectionQuestions.includes(word)) {
          score += 0.2;
        }
      }
    }

    // Boost for specific keywords
    const keywordMap: {[key: string]: string[]} = {
      'combat': ['combat', 'empirical', 'bayes'],
      'batch': ['batch', 'effect', 'correction', 'adjustment'],
      'classifier': ['classifier', 'classification', 'machine', 'learning'],
      'cross-validation': ['cross-validation', 'validation', 'performance'],
      'rna-seq': ['rna-seq', 'sequencing', 'expression']
    };

    for (const [keyword, terms] of Object.entries(keywordMap)) {
      if (sectionTitle.includes(keyword)) {
        for (const term of terms) {
          if (claimTitle.includes(term)) {
            score += 0.2;
          }
        }
      }
    }

    return Math.min(score, 1.0);
  }

  private buildTree(): OutlineTreeItem[] {
    const items: OutlineTreeItem[] = [];

    // Get top-level sections (level 2)
    const topSections = Array.from(this.sections.values())
      .filter(s => s.level === 2)
      .sort((a, b) => a.lineNumber - b.lineNumber);

    for (const section of topSections) {
      items.push(this.createSectionItem(section));
    }

    return items;
  }

  private createSectionItem(section: OutlineSection): OutlineTreeItem {
    const hasChildren = section.children.length > 0 || 
                       section.questions.length > 0 || 
                       section.linkedClaims.length > 0 ||
                       section.suggestedSearches.length > 0;

    const item = new OutlineTreeItem(
      section.title,
      hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );

    item.sectionId = section.id;
    item.contextValue = 'section';
    
    // Set icon based on coverage
    if (section.coverage === 'good') {
      item.iconPath = new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
      item.description = `✓ ${section.linkedClaims.length} claims`;
    } else if (section.coverage === 'partial') {
      item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('testing.iconQueued'));
      item.description = `⚠ ${section.linkedClaims.length} claims`;
    } else {
      item.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconUnset'));
      item.description = '○ No claims';
    }

    // Command to jump to section
    item.command = {
      command: 'citationHover.jumpToOutlineSection',
      title: 'Jump to Section',
      arguments: [section]
    };

    item.tooltip = this.createTooltip(section);

    return item;
  }

  private getSectionChildren(sectionId: string): OutlineTreeItem[] {
    const section = this.sections.get(sectionId);
    if (!section) {
      return [];
    }

    const items: OutlineTreeItem[] = [];

    // Add child sections
    for (const childId of section.children) {
      const childSection = this.sections.get(childId);
      if (childSection) {
        items.push(this.createSectionItem(childSection));
      }
    }

    // Add questions group
    if (section.questions.length > 0) {
      const questionsItem = new OutlineTreeItem(
        `❓ Questions (${section.questions.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      questionsItem.contextValue = 'questionsGroup';
      questionsItem.sectionId = sectionId;
      items.push(questionsItem);
    }

    // Add linked claims group
    if (section.linkedClaims.length > 0) {
      const claimsItem = new OutlineTreeItem(
        `📝 Linked Claims (${section.linkedClaims.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      claimsItem.contextValue = 'claimsGroup';
      claimsItem.sectionId = sectionId;
      items.push(claimsItem);
    }

    // Add suggested searches group
    if (section.suggestedSearches.length > 0) {
      const searchesItem = new OutlineTreeItem(
        `🔍 Suggested Searches (${section.suggestedSearches.length})`,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      searchesItem.contextValue = 'searchesGroup';
      searchesItem.sectionId = sectionId;
      items.push(searchesItem);
    }

    return items;
  }

  private createTooltip(section: OutlineSection): string {
    let tooltip = `${section.id}: ${section.title}\n\n`;
    tooltip += `Coverage: ${section.coverage}\n`;
    tooltip += `Claims: ${section.linkedClaims.length}\n`;
    tooltip += `Questions: ${section.questions.length}\n`;
    
    if (section.linkedClaims.length > 0) {
      tooltip += `\nLinked Claims: ${section.linkedClaims.join(', ')}`;
    }
    
    return tooltip;
  }

  getSection(sectionId: string): OutlineSection | undefined {
    return this.sections.get(sectionId);
  }

  getAllSections(): OutlineSection[] {
    return Array.from(this.sections.values());
  }
}

export class OutlineTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public sectionId?: string
  ) {
    super(label, collapsibleState);
  }
}
