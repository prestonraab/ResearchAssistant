import type { Claim, OutlineSection } from '@research-assistant/core';
import type { ManuscriptExportOptions } from '../exportService';
import type { CoverageMetrics } from '../coverageAnalyzer';
import { ReportGenerator } from './ReportGenerator';
import { BibTeXGenerator } from './BibTeXGenerator';
import { SourceTagParser } from './SourceTagParser';
import type { ZoteroApiService, ZoteroItem } from '../../services/zoteroApiService';
import * as fs from 'fs';
import * as path from 'path';

export type ExportFormat = 'markdown' | 'csv' | 'json';

/**
 * Handles markdown export functionality
 * Generates markdown with Pandoc-citeproc citations [@citekey] and accompanying .bib file
 */
export class MarkdownExporter {
  constructor(
    private zoteroApiService?: ZoteroApiService
  ) {}

  /**
   * Export manuscript with Pandoc-citeproc style citations
   * Converts [source:: C_XX(AuthorYear)] to [@AuthorYear] and generates accompanying .bib file
   */
  public async exportManuscriptMarkdown(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<string> {
    // Convert [source:: ...] tags to Pandoc [@AuthorYear] format
    let processedText = this.convertSourceTagsToPandoc(manuscriptText);
    
    // Also handle legacy \cite{} format for backwards compatibility
    processedText = this.convertLegacyCitationsToPandoc(processedText);
    
    // Remove HTML comment markers
    processedText = this.removeHtmlComments(processedText);
    
    // Remove Obsidian callout syntax for clean export
    processedText = this.removeObsidianCallouts(processedText);
    
    // Extract citation keys and generate .bib file
    const authorYears = SourceTagParser.getAllAuthorYears(manuscriptText);
    const legacyCiteKeys = this.extractLegacyCitationKeys(manuscriptText);
    
    if ((authorYears.size > 0 || legacyCiteKeys.size > 0) && options.outputPath) {
      await this.generateBibFile(authorYears, legacyCiteKeys, options.outputPath);
    }
    
    // Add YAML front matter for Pandoc
    const yamlHeader = this.generateYamlHeader(options);
    
    return yamlHeader + processedText;
  }

  /**
   * Convert [source:: C_XX(AuthorYear)] tags to Pandoc [@AuthorYear] format
   */
  private convertSourceTagsToPandoc(text: string): string {
    return SourceTagParser.convertSourceTagsToCitations(text, (authorYears) => {
      if (authorYears.length === 0) return '';
      if (authorYears.length === 1) {
        return ` [@${this.normalizeAuthorYear(authorYears[0])}]`;
      }
      // Multiple citations: [@Key1; @Key2]
      const keys = authorYears.map(ay => `@${this.normalizeAuthorYear(ay)}`);
      return ` [${keys.join('; ')}]`;
    });
  }

  /**
   * Normalize AuthorYear to a valid citation key
   * "Zou 2005" -> "Zou2005"
   * "Díaz-Uriarte 2006" -> "DiazUriarte2006"
   */
  private normalizeAuthorYear(authorYear: string): string {
    return authorYear
      .replace(/\s+/g, '')  // Remove spaces
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
      .replace(/[^a-zA-Z0-9]/g, '');  // Remove special chars
  }

  /**
   * Convert legacy LaTeX \cite{KEY} citations to Pandoc [@KEY] format
   */
  private convertLegacyCitationsToPandoc(text: string): string {
    return text.replace(/\\cite\{([^}]+)\}/g, (match, keys) => {
      const keyList = keys.split(',').map((k: string) => k.trim());
      if (keyList.length === 1) {
        return `[@${keyList[0]}]`;
      }
      return '[' + keyList.map((k: string) => `@${k}`).join('; ') + ']';
    });
  }

  /**
   * Remove HTML comment markers from text
   */
  private removeHtmlComments(text: string): string {
    return text.replace(/<!--\s*\[?[^\]]*\]?\s*-->/g, '').trim();
  }

  /**
   * Remove Obsidian callout syntax for clean export
   * Converts "> [!question]- Title (status:: ...)" blocks to regular text
   */
  private removeObsidianCallouts(text: string): string {
    // Remove callout headers: > [!question]- Title (status:: ...)
    let result = text.replace(/^>\s*\[![\w-]+\][+-]?\s*[^\n]*\(status::[^)]*\)\s*$/gm, '');
    
    // Remove standalone status markers
    result = result.replace(/\(status::\s*\w+\)/g, '');
    
    // Convert blockquote lines to regular text (remove leading >)
    result = result.replace(/^>\s*/gm, '');
    
    // Clean up multiple blank lines
    result = result.replace(/\n{3,}/g, '\n\n');
    
    return result.trim();
  }

  /**
   * Extract legacy \cite{} keys from manuscript
   */
  private extractLegacyCitationKeys(text: string): Set<string> {
    const keys = new Set<string>();
    const regex = /\\cite\{([^}]+)\}/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const keyList = match[1].split(',').map(k => k.trim());
      keyList.forEach(k => keys.add(k));
    }
    
    return keys;
  }

  /**
   * Generate YAML front matter for Pandoc
   */
  private generateYamlHeader(options: ManuscriptExportOptions): string {
    const bibFile = options.outputPath 
      ? path.basename(options.outputPath).replace(/\.md$/, '.bib')
      : 'references.bib';
    
    return `---
bibliography: ${bibFile}
csl: apa.csl
link-citations: true
---

`;
  }

  /**
   * Generate .bib file from AuthorYear citations and legacy keys
   */
  private async generateBibFile(
    authorYears: Set<string>,
    legacyCiteKeys: Set<string>,
    outputPath: string
  ): Promise<void> {
    const bibPath = outputPath.replace(/\.md$/, '.bib');
    
    if (!this.zoteroApiService || !this.zoteroApiService.isConfigured()) {
      await this.generateBasicBibFile(authorYears, legacyCiteKeys, bibPath);
      return;
    }

    try {
      const items = await this.zoteroApiService.getItems(100);
      const entries: string[] = [];
      
      // Generate entries for AuthorYear citations
      for (const authorYear of authorYears) {
        const normalizedKey = this.normalizeAuthorYear(authorYear);
        // Try to find matching Zotero item
        const matchingItem = items.find(item => {
          const itemAuthorYear = this.getItemAuthorYear(item);
          return this.normalizeAuthorYear(itemAuthorYear) === normalizedKey;
        });
        
        if (matchingItem) {
          entries.push(BibTeXGenerator.generateEntry(matchingItem, normalizedKey));
        } else {
          // Fallback entry
          entries.push(this.generateFallbackEntry(normalizedKey, authorYear));
        }
      }
      
      // Generate entries for legacy cite keys
      for (const key of legacyCiteKeys) {
        const matchingItem = items.find(item => item.key === key);
        if (matchingItem) {
          entries.push(BibTeXGenerator.generateEntry(matchingItem, key));
        } else {
          entries.push(this.generateFallbackEntry(key, key));
        }
      }
      
      const bibContent = entries.join('\n\n');
      this.writeBibFile(bibPath, bibContent);
    } catch (error) {
      console.warn('Failed to generate .bib file from Zotero:', error);
      await this.generateBasicBibFile(authorYears, legacyCiteKeys, bibPath);
    }
  }

  /**
   * Get AuthorYear string from Zotero item
   */
  private getItemAuthorYear(item: ZoteroItem): string {
    const firstAuthor = item.creators?.[0];
    const authorName = firstAuthor?.lastName || firstAuthor?.name || 'Unknown';
    const year = item.date?.match(/\d{4}/)?.[0] || '';
    return `${authorName}${year}`;
  }

  /**
   * Generate fallback BibTeX entry when Zotero item not found
   */
  private generateFallbackEntry(key: string, displayName: string): string {
    // Try to parse author and year from displayName
    const match = displayName.match(/^(.+?)\s*(\d{4})$/);
    const author = match ? match[1] : 'Unknown';
    const year = match ? match[2] : 'n.d.';
    
    return `@misc{${key},
  author = {${author}},
  title = {${displayName}},
  year = {${year}}
}`;
  }

  /**
   * Generate basic .bib file without Zotero metadata
   */
  private async generateBasicBibFile(
    authorYears: Set<string>,
    legacyCiteKeys: Set<string>,
    bibPath: string
  ): Promise<void> {
    const entries: string[] = [];

    for (const authorYear of authorYears) {
      const key = this.normalizeAuthorYear(authorYear);
      entries.push(this.generateFallbackEntry(key, authorYear));
    }

    for (const key of legacyCiteKeys) {
      entries.push(this.generateFallbackEntry(key, key));
    }

    const bibContent = entries.join('\n\n');
    this.writeBibFile(bibPath, bibContent);
  }

  /**
   * Write .bib file to disk
   */
  private writeBibFile(bibPath: string, content: string): void {
    const dir = path.dirname(bibPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(bibPath, content, 'utf-8');
  }

  /**
   * Generate coverage report as markdown
   */
  public generateCoverageMarkdown(
    metrics: CoverageMetrics[],
    sections: OutlineSection[]
  ): string {
    return ReportGenerator.generateCoverageMarkdown(metrics, sections);
  }

  /**
   * Generate claims report as markdown
   */
  public generateClaimsMarkdown(claims: Claim[], includeMetadata: boolean): string {
    return ReportGenerator.generateClaimsMarkdown(claims, includeMetadata);
  }

  /**
   * Generate reading progress report as markdown
   */
  public generateReadingProgressMarkdown(statuses: unknown[]): string {
    return ReportGenerator.generateReadingProgressMarkdown(statuses);
  }
}
