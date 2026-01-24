import * as vscode from 'vscode';
import * as fs from 'fs/promises';

export interface OutlineSection {
  id: string;
  level: number;
  title: string;
  content: string[];
  parent: string | null;
  children: string[];
  lineStart: number;
  lineEnd: number;
}

export class OutlineParser {
  private filePath: string;
  private sections: OutlineSection[] = [];
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  updatePath(filePath: string): void {
    this.filePath = filePath;
    this.parse();
  }

  async parse(): Promise<OutlineSection[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.sections = this.parseContent(content);
      this.onDidChangeEmitter.fire();
      return this.sections;
    } catch (error) {
      console.error('Error parsing outline:', error);
      this.sections = [];
      return [];
    }
  }

  private parseContent(content: string): OutlineSection[] {
    const lines = content.split('\n');
    const sections: OutlineSection[] = [];
    const stack: OutlineSection[] = [];

    let currentSection: OutlineSection | null = null;
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      
      // Match markdown headers (##, ###, ####)
      const headerMatch = line.match(/^(#{2,4})\s+(.+)$/);
      
      if (headerMatch) {
        // Close previous section
        if (currentSection) {
          currentSection.lineEnd = lineNumber - 1;
        }

        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const id = this.generateId(title, level, lineNumber);

        // Find parent by popping stack until we find a section with lower level
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        const parent = stack.length > 0 ? stack[stack.length - 1] : null;

        currentSection = {
          id,
          level,
          title,
          content: [],
          parent: parent?.id || null,
          children: [],
          lineStart: lineNumber,
          lineEnd: lineNumber
        };

        if (parent) {
          parent.children.push(id);
        }

        sections.push(currentSection);
        stack.push(currentSection);
      } else if (currentSection && line.trim()) {
        // Add content to current section (questions, bullets, etc.)
        currentSection.content.push(line.trim());
      }
    }

    // Close last section
    if (currentSection) {
      currentSection.lineEnd = lineNumber;
    }

    return sections;
  }

  private generateId(title: string, level: number, line: number): string {
    // Generate a hash-like ID from title and position
    const normalized = title.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${normalized}-${level}-${line}`;
  }

  getSections(): OutlineSection[] {
    return this.sections;
  }

  getSection(id: string): OutlineSection | null {
    return this.sections.find(s => s.id === id) || null;
  }

  getSectionAtPosition(position: vscode.Position): OutlineSection | null {
    const line = position.line + 1; // Convert to 1-based
    return this.sections.find(s => s.lineStart <= line && s.lineEnd >= line) || null;
  }

  getHierarchy(): OutlineSection[] {
    return this.sections.filter(s => s.parent === null);
  }
}
