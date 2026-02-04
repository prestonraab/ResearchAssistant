import type { ZoteroItem } from '../../services/zoteroApiService';

/**
 * Generates BibTeX entries from Zotero items
 */
export class BibTeXGenerator {
  /**
   * Generate a BibTeX entry from a Zotero item
   * 
   * @param item Zotero item
   * @param citeKey The citation key to use
   * @returns BibTeX entry string
   */
  public static generateEntry(item: ZoteroItem, citeKey: string): string {
    const entryType = this.mapZoteroTypeToBibTeX(item.itemType);
    const fields = this.extractBibTeXFields(item);
    
    const fieldLines = Object.entries(fields)
      .map(([key, value]) => `  ${key} = {${value}}`)
      .join(',\n');
    
    return `@${entryType}{${citeKey},\n${fieldLines}\n}`;
  }

  /**
   * Generate complete BibTeX file content from multiple items
   * 
   * @param items Zotero items
   * @param citeKeyMap Map of Zotero keys to citation keys
   * @returns Complete BibTeX file content
   */
  public static generateBibFile(
    items: ZoteroItem[],
    citeKeyMap: Map<string, string>
  ): string {
    const entries: string[] = [];
    
    for (const item of items) {
      const citeKey = citeKeyMap.get(item.key) || item.key;
      try {
        const entry = this.generateEntry(item, citeKey);
        entries.push(entry);
      } catch (error) {
        console.warn(`Failed to generate BibTeX entry for ${item.key}:`, error);
      }
    }
    
    return entries.join('\n\n');
  }

  /**
   * Map Zotero item type to BibTeX entry type
   */
  private static mapZoteroTypeToBibTeX(zoteroType: string): string {
    const typeMap: Record<string, string> = {
      'journalArticle': 'article',
      'book': 'book',
      'bookSection': 'inbook',
      'conferencePaper': 'inproceedings',
      'report': 'techreport',
      'thesis': 'phdthesis',
      'webpage': 'misc',
      'document': 'misc',
      'preprint': 'article',
      'magazineArticle': 'article',
      'newspaperArticle': 'article',
      'encyclopediaArticle': 'inbook',
      'dictionaryEntry': 'inbook',
      'case': 'misc',
      'statute': 'misc',
      'bill': 'misc',
      'hearing': 'misc',
      'patent': 'patent',
      'map': 'misc',
      'computerProgram': 'misc',
      'dataset': 'dataset',
      'presentation': 'misc',
      'videoRecording': 'misc',
      'audioRecording': 'misc',
      'artwork': 'misc',
      'photograph': 'misc',
      'film': 'misc',
      'interview': 'misc',
      'letter': 'misc',
      'manuscript': 'unpublished',
      'note': 'misc',
      'attachment': 'misc'
    };
    
    return typeMap[zoteroType] || 'misc';
  }

  /**
   * Extract BibTeX fields from Zotero item
   */
  private static extractBibTeXFields(item: ZoteroItem): Record<string, string> {
    const fields: Record<string, string> = {};
    
    // Title
    if (item.title) {
      fields['title'] = this.escapeBibTeX(item.title);
    }
    
    // Authors
    if (item.creators && item.creators.length > 0) {
      const authors = item.creators
        .map(c => {
          if (c.name) return c.name;
          if (c.lastName && c.firstName) {
            return `${c.lastName}, ${c.firstName}`;
          }
          return c.lastName || '';
        })
        .filter(a => a)
        .join(' and ');
      
      if (authors) {
        fields['author'] = authors;
      }
    }
    
    // Year
    if (item.date) {
      const year = this.extractYear(item.date);
      if (year) {
        fields['year'] = year;
      }
    }
    
    // DOI
    if (item.doi) {
      fields['doi'] = item.doi;
    }
    
    // URL
    if (item.url) {
      fields['url'] = item.url;
    }
    
    // Abstract
    if (item.abstractNote) {
      fields['abstract'] = this.escapeBibTeX(item.abstractNote);
    }
    
    // Tags/Keywords
    if (item.tags && item.tags.length > 0) {
      const keywords = item.tags
        .map(t => typeof t === 'string' ? t : (t as any).tag || '')
        .filter(k => k)
        .join(', ');
      
      if (keywords) {
        fields['keywords'] = keywords;
      }
    }
    
    return fields;
  }

  /**
   * Extract year from date string
   */
  private static extractYear(dateStr: string): string | undefined {
    const match = dateStr.match(/(\d{4})/);
    return match ? match[1] : undefined;
  }

  /**
   * Escape special BibTeX characters
   */
  private static escapeBibTeX(text: string): string {
    return text
      .replace(/\\/g, '\\textbackslash{}')
      .replace(/[{}]/g, match => `\\${match}`)
      .replace(/~/g, '\\textasciitilde{}')
      .replace(/\^/g, '\\textasciicircum{}')
      .replace(/&/g, '\\&')
      .replace(/#/g, '\\#')
      .replace(/%/g, '\\%')
      .replace(/\$/g, '\\$')
      .replace(/_/g, '\\_');
  }
}
