import * as vscode from 'vscode';
import { OutlineParser as CoreOutlineParser, type OutlineSection } from '@research-assistant/core';

/**
 * Extended OutlineSection with hierarchy information.
 */
export interface OutlineSectionWithHierarchy extends OutlineSection {
  parent: string | null;
  children: string[];
}

/**
 * Wrapper around core OutlineParser that adds VS Code-specific functionality:
 * - Event emitters for change notifications
 * - Constructor accepts file path
 * - updatePath() method for changing the file
 * - getHierarchy() method for building tree structure
 * - Converts VS Code Position to line numbers
 */
export class OutlineParser {
  private coreParser: CoreOutlineParser;
  private filePath: string;
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.coreParser = new CoreOutlineParser();
  }

  /**
   * Get the underlying core parser for use with core services.
   */
  getCoreParser(): CoreOutlineParser {
    return this.coreParser;
  }

  /**
   * Parse the outline file.
   */
  async parse(): Promise<OutlineSection[]> {
    const sections = await this.coreParser.parse(this.filePath);
    this._onDidChange.fire();
    return sections;
  }

  /**
   * Update the file path and optionally re-parse.
   */
  updatePath(newPath: string): void {
    this.filePath = newPath;
  }

  /**
   * Get section at a VS Code Position or line number.
   */
  getSectionAtPosition(position: vscode.Position | number): OutlineSection | null {
    const lineNumber = typeof position === 'number' ? position : position.line;
    return this.coreParser.getSectionAtPosition(lineNumber);
  }

  /**
   * Get section by ID.
   */
  getSectionById(sectionId: string): OutlineSection | null {
    return this.coreParser.getSectionById(sectionId);
  }

  /**
   * Get all sections.
   */
  getSections(): OutlineSection[] {
    return this.coreParser.getSections();
  }

  /**
   * Get hierarchical structure of sections.
   * Builds parent-child relationships based on heading levels.
   */
  getHierarchy(): OutlineSectionWithHierarchy[] {
    const sections = this.coreParser.getSections();
    
    // Add parent and children properties to sections
    const enrichedSections: OutlineSectionWithHierarchy[] = sections.map(s => ({
      ...s,
      parent: null as string | null,
      children: [] as string[]
    }));

    // Build hierarchy based on levels
    for (let i = 0; i < enrichedSections.length; i++) {
      const current = enrichedSections[i];
      
      // Find parent (first section with lower level going backwards)
      for (let j = i - 1; j >= 0; j--) {
        if (enrichedSections[j].level < current.level) {
          current.parent = enrichedSections[j].id;
          enrichedSections[j].children.push(current.id);
          break;
        }
      }
    }

    return enrichedSections;
  }

  /**
   * Get the current file path.
   */
  getFilePath(): string {
    return this.filePath;
  }
}
