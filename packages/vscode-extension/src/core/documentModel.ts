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
 * A run of content within a paragraph - either text or a footnote reference.
 */
export interface DocumentRun {
  /** Type of run: 'text' for regular text, 'footnote-ref' for a footnote reference */
  type: 'text' | 'footnote-ref';
  
  /** Content of the run (text content or empty string for footnote-ref) */
  content: string;
  
  /** ID of the footnote this run references (only for type: 'footnote-ref') */
  footnoteId?: number;
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
