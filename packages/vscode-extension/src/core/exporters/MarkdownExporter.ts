import type { Claim, OutlineSection } from '@research-assistant/core';
import type { DocumentModel, DocumentFootnote, BibliographyEntry } from '../documentModel';
import type { ManuscriptExportOptions, CitedQuote } from '../exportService';
import { SentenceClaimQuoteLinkManager } from '../sentenceClaimQuoteLinkManager';
import { ClaimsManager } from '../claimsManagerWrapper';
import type { CoverageMetrics } from '../coverageAnalyzer';
import { ManuscriptParser } from './ManuscriptParser';
import { CitationCollector } from './CitationCollector';
import { ReportGenerator } from './ReportGenerator';
import { BibTeXGenerator } from './BibTeXGenerator';
import type { ZoteroApiService, ZoteroItem } from '../../services/zoteroApiService';
import * as fs from 'fs';
import * as path from 'path';

export type ExportFormat = 'markdown' | 'csv' | 'json';

/**
 * Handles markdown export functionality
 * Generates markdown with Pandoc-citeproc citations [@citekey] and accompanying .bib file
 */
export class MarkdownExporter {
  private citationCollector: CitationCollector;

  constructor(
    private sentenceClaimQuoteLinkManager?: SentenceClaimQuoteLinkManager,
    private claimsManager?: ClaimsManager,
    private zoteroApiService?: ZoteroApiService
  ) {
    this.citationCollector = new CitationCollector(sentenceClaimQuoteLinkManager, claimsManager);
  }

  /**
   * Export manuscript with Pandoc-citeproc style citations
   * Converts \cite{KEY} to [@KEY] and generates accompanying .bib file
   */
  public async exportManuscriptMarkdown(
    manuscriptText: string,
    options: ManuscriptExportOptions
  ): Promise<string> {
    // Convert \cite{} to Pandoc [@] format
    let processedText = this.convertCitationsToPandoc(manuscriptText);
    
    // Remove HTML comment markers
    processedText = this.removeHtmlComments(processedText);
    
    // Extract citation keys and generate .bib file
    const citeKeys = this.extractCitationKeys(manuscriptText);
    if (citeKeys.size > 0 && options.outputPath) {
      await this.generateBibFile(citeKeys, options.outputPath);
    }
    
    // Add YAML front matter for Pandoc
    const yamlHeader = this.generateYamlHeader(options);
    
    return yamlHeader + processedText;
  }

  /**
   * Convert LaTeX \cite{KEY} citations to Pandoc [@KEY] format
   */
  private convertCitationsToPandoc(text: string): string {
    // Convert \cite{KEY} to [@KEY]
    // Also handles multiple citations: \cite{KEY1,KEY2} -> [@KEY1; @KEY2]
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
    // Remove <!-- [ANSWERED] -->, <!-- [undefined] -->, <!-- Source: ... --> etc.
    return text.replace(/<!--\s*\[?[^\]]*\]?\s*-->/g, '').trim();
  }

  /**
   * Extract all citation keys from manuscript
   */
  private extractCitationKeys(text: string): Set<string> {
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
   * Generate .bib file from citation keys using Zotero API
   */
  private async generateBibFile(citeKeys: Set<string>, outputPath: string): Promise<void> {
    const bibPath = outputPath.replace(/\.md$/, '.bib');
    
    if (!this.zoteroApiService || !this.zoteroApiService.isConfigured()) {
      // Generate basic .bib file without Zotero metadata
      await this.generateBasicBibFile(citeKeys, bibPath);
      return;
    }

    try {
      // Fetch items from Zotero
      const items = await this.zoteroApiService.getItems(100);
      
      // Filter items that match our citation keys
      const matchedItems = items.filter(item => citeKeys.has(item.key));
      
      // Create cite key map
      const citeKeyMap = new Map<string, string>();
      for (const item of matchedItems) {
        citeKeyMap.set(item.key, item.key);
      }

      // Generate BibTeX content
      const bibContent = BibTeXGenerator.generateBibFile(matchedItems, citeKeyMap);
      
      // Write .bib file
      const dir = path.dirname(bibPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(bibPath, bibContent, 'utf-8');
    } catch (error) {
      console.warn('Failed to generate .bib file from Zotero:', error);
      await this.generateBasicBibFile(citeKeys, bibPath);
    }
  }

  /**
   * Generate basic .bib file without Zotero metadata
   */
  private async generateBasicBibFile(citeKeys: Set<string>, bibPath: string): Promise<void> {
    const entries: string[] = [];

    for (const key of citeKeys) {
      const bibEntry = `@misc{${key},
  author = {Unknown},
  title = {${key}},
  year = {n.d.}
}`;
      entries.push(bibEntry);
    }

    const bibContent = entries.join('\n\n');
    
    const dir = path.dirname(bibPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(bibPath, bibContent, 'utf-8');
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
