/**
 * Format-agnostic document model for manuscript export
 * 
 * This module defines interfaces that represent a manuscript document
 * in a format-independent way. The same DocumentModel can be rendered
 * to multiple output formats (Word, LaTeX, Markdown, etc.) by different
 * renderer implementations.
 */

/**
 * A complete document model representing a manuscript with all its content,
 * citations, and metadata.
 */
export interface DocumentModel {
  /** Array of document sections (headings and their content) */
  sections: DocumentSection[];
  
  /** Bibliography entries for all cited sources */
  bibliography: BibliographyEntry[];
  
  /** Document-level metadata including footnotes and options */
  metadata: DocumentMetadata;
}

/**
 * A section of the document, typically corresponding to a heading and its content.
 */
export interface DocumentSection {
  /** The heading text (without markdown syntax) */
  heading: string;
  
  /** Heading level: 1 for #, 2 for ##, etc. */
  level: number;
  
  /** Paragraphs contained within this section */
  paragraphs: DocumentParagraph[];
}

/**
 * A paragraph within a section, composed of text runs and footnote references.
 */
export interface DocumentParagraph {
  /** Array of text runs and footnote references that make up this paragraph */
  runs: DocumentRun[];
}

/**
 * A run of content within a paragraph - text, footnote reference, citation, image, or table.
 */
export interface DocumentRun {
  /** Type of run: 'text', 'footnote-ref', 'citation', 'image', or 'table' */
  type: 'text' | 'footnote-ref' | 'citation' | 'image' | 'table';
  
  /** Content of the run (text content or empty string for footnote-ref/citation/image/table) */
  content: string;
  
  /** ID of the footnote this run references (only for type: 'footnote-ref') */
  footnoteId?: number;
  
  /** Citation data (only for type: 'citation') */
  citation?: DocumentCitation;
  
  /** Image data (only for type: 'image') */
  image?: DocumentImage;
  
  /** Table data (only for type: 'table') */
  table?: DocumentTable;
}

/**
 * A citation reference in the document.
 */
export interface DocumentCitation {
  /** The citation key (e.g., "Johnson2007") */
  citeKey: string;
  
  /** Zotero item key if available */
  zoteroKey?: string;
  
  /** Zotero user ID for URI construction */
  zoteroUserId?: string;
  
  /** Display text for the citation (e.g., "(Johnson et al., 2007)") */
  displayText?: string;
  
  /** Author name(s) - simple string format */
  authors?: string;
  
  /** Publication year */
  year?: string;
  
  /** Item title */
  title?: string;
  
  /** Full CSL-JSON item data for Zotero Word integration */
  itemData?: CslItemData;
}

/**
 * CSL-JSON item data structure for Zotero Word integration.
 * This follows the Citation Style Language JSON schema.
 * @see https://github.com/citation-style-language/schema
 */
export interface CslItemData {
  /** Numeric ID (can be any unique number) */
  id: number;
  
  /** Item type (article-journal, book, chapter, etc.) */
  type: string;
  
  /** Item title */
  title?: string;
  
  /** Authors in CSL format */
  author?: CslAuthor[];
  
  /** Container title (journal name, book title, etc.) */
  'container-title'?: string;
  
  /** Publication date */
  issued?: { 'date-parts': (string | number)[][] };
  
  /** Volume number */
  volume?: string;
  
  /** Issue number */
  issue?: string;
  
  /** Page range */
  page?: string;
  
  /** DOI */
  DOI?: string;
  
  /** URL */
  URL?: string;
  
  /** Abstract */
  abstract?: string;
  
  /** ISSN */
  ISSN?: string;
  
  /** ISBN */
  ISBN?: string;
  
  /** Publisher */
  publisher?: string;
  
  /** Publisher place */
  'publisher-place'?: string;
  
  /** Edition */
  edition?: string;
}

/**
 * CSL author format
 */
export interface CslAuthor {
  /** Family name (last name) */
  family?: string;
  
  /** Given name (first name) */
  given?: string;
  
  /** Full name (for single-field names) */
  literal?: string;
}

/**
 * An image embedded in the document.
 */
export interface DocumentImage {
  /** Path to the image file (absolute or relative to manuscript) */
  path: string;
  
  /** Alt text for the image */
  altText: string;
  
  /** Optional caption */
  caption?: string;
  
  /** Width in pixels (optional, for sizing) */
  width?: number;
  
  /** Height in pixels (optional, for sizing) */
  height?: number;
}

/**
 * A table in the document.
 */
export interface DocumentTable {
  /** Array of rows, each containing an array of cell contents */
  rows: string[][];
  
  /** Whether the first row is a header row */
  hasHeader: boolean;
  
  /** Optional caption */
  caption?: string;
}

/**
 * A footnote containing citation information.
 */
export interface DocumentFootnote {
  /** Unique identifier for this footnote within the document */
  id: number;
  
  /** The quoted text from the source */
  quoteText: string;
  
  /** The source name or citation */
  source: string;
  
  /** Publication year (optional) */
  year?: string;
}

/**
 * A bibliography entry representing a unique source cited in the document.
 */
export interface BibliographyEntry {
  /** The source name or citation */
  source: string;
  
  /** Publication year (optional) */
  year?: string;
}

/**
 * Document-level metadata including footnotes and export options.
 */
export interface DocumentMetadata {
  /** Array of all footnotes in the document */
  footnotes: DocumentFootnote[];
  
  /** Footnote numbering scope: 'document' for continuous, 'section' for per-section reset */
  footnoteScope: 'document' | 'section';
  
  /** Whether to include footnotes in the export */
  includeFootnotes: boolean;
  
  /** Whether to include bibliography section in the export */
  includeBibliography: boolean;
}
