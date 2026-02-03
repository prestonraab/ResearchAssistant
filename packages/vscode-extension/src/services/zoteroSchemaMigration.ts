/**
 * Zotero Schema Migration Service
 * 
 * Handles migration of existing quote data to include Zotero metadata fields.
 * Since this project uses JSON/Markdown file storage rather than SQL,
 * this service provides utilities for:
 * - Validating existing quote data
 * - Adding default Zotero metadata fields to existing quotes
 * - Creating indexes for efficient lookup by annotation key
 * 
 * @see Requirements 3.1, 3.2, 8.1, 8.6 - Zotero PDF Integration
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { 
  SourcedQuote, 
  ZoteroQuoteMetadata, 
  ZoteroAnnotationAuditEntry,
  ZoteroSyncState,
  AnnotationKeyValidation
} from '@research-assistant/core';

/**
 * Regular expression for validating Zotero annotation keys
 * Zotero annotation keys are 8-character alphanumeric strings
 */
const ZOTERO_ANNOTATION_KEY_REGEX = /^[A-Z0-9]{8}$/;

/**
 * Validates a Zotero annotation key format
 * 
 * @param key - The annotation key to validate
 * @returns Validation result with error message if invalid
 * 
 * @see Requirements 8.2 - Annotation key validation
 */
export function validateAnnotationKey(key: string): AnnotationKeyValidation {
  if (!key || typeof key !== 'string') {
    return {
      valid: false,
      key: key || '',
      error: 'Annotation key must be a non-empty string'
    };
  }

  const trimmedKey = key.trim().toUpperCase();
  
  if (trimmedKey.length !== 8) {
    return {
      valid: false,
      key,
      error: `Annotation key must be exactly 8 characters, got ${trimmedKey.length}`
    };
  }

  if (!ZOTERO_ANNOTATION_KEY_REGEX.test(trimmedKey)) {
    return {
      valid: false,
      key,
      error: 'Annotation key must contain only uppercase letters and numbers'
    };
  }

  return {
    valid: true,
    key: trimmedKey
  };
}

/**
 * Creates default Zotero sync state
 * 
 * @returns Default sync state configuration
 */
export function createDefaultSyncState(): ZoteroSyncState {
  return {
    lastSyncTimestamp: null,
    syncEnabled: false,
    syncIntervalMinutes: 15,
    lastSyncStatus: 'never',
    retryCount: 0
  };
}

/**
 * Index structure for efficient annotation key lookup
 */
export interface AnnotationKeyIndex {
  // Map from annotation key to quote identifier
  keyToQuoteId: Map<string, string>;
  // Map from quote ID to annotation key (for reverse lookup)
  quoteIdToKey: Map<string, string>;
  // Last updated timestamp
  lastUpdated: string;
}

/**
 * Creates an empty annotation key index
 */
export function createAnnotationKeyIndex(): AnnotationKeyIndex {
  return {
    keyToQuoteId: new Map(),
    quoteIdToKey: new Map(),
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Adds an entry to the annotation key index
 * 
 * @param index - The index to update
 * @param annotationKey - The Zotero annotation key
 * @param quoteId - The quote identifier
 * @returns Updated index
 * 
 * @see Requirements 8.6 - Annotation key indexing
 */
export function addToAnnotationKeyIndex(
  index: AnnotationKeyIndex,
  annotationKey: string,
  quoteId: string
): AnnotationKeyIndex {
  const validation = validateAnnotationKey(annotationKey);
  if (!validation.valid) {
    console.warn(`[ZoteroSchemaMigration] Invalid annotation key: ${validation.error}`);
    return index;
  }

  index.keyToQuoteId.set(validation.key, quoteId);
  index.quoteIdToKey.set(quoteId, validation.key);
  index.lastUpdated = new Date().toISOString();
  
  return index;
}

/**
 * Removes an entry from the annotation key index
 * 
 * @param index - The index to update
 * @param quoteId - The quote identifier to remove
 * @returns The removed annotation key, or undefined if not found
 */
export function removeFromAnnotationKeyIndex(
  index: AnnotationKeyIndex,
  quoteId: string
): string | undefined {
  const annotationKey = index.quoteIdToKey.get(quoteId);
  if (annotationKey) {
    index.keyToQuoteId.delete(annotationKey);
    index.quoteIdToKey.delete(quoteId);
    index.lastUpdated = new Date().toISOString();
  }
  return annotationKey;
}

/**
 * Looks up a quote ID by annotation key
 * 
 * @param index - The index to search
 * @param annotationKey - The annotation key to look up
 * @returns Quote ID if found, undefined otherwise
 * 
 * @see Requirements 8.6 - Efficient lookup by annotation key
 */
export function lookupByAnnotationKey(
  index: AnnotationKeyIndex,
  annotationKey: string
): string | undefined {
  const validation = validateAnnotationKey(annotationKey);
  if (!validation.valid) {
    return undefined;
  }
  return index.keyToQuoteId.get(validation.key);
}

/**
 * Serializes the annotation key index for persistence
 */
export function serializeAnnotationKeyIndex(index: AnnotationKeyIndex): string {
  return JSON.stringify({
    keyToQuoteId: Array.from(index.keyToQuoteId.entries()),
    quoteIdToKey: Array.from(index.quoteIdToKey.entries()),
    lastUpdated: index.lastUpdated
  }, null, 2);
}

/**
 * Deserializes the annotation key index from storage
 */
export function deserializeAnnotationKeyIndex(json: string): AnnotationKeyIndex {
  try {
    const data = JSON.parse(json);
    return {
      keyToQuoteId: new Map(data.keyToQuoteId || []),
      quoteIdToKey: new Map(data.quoteIdToKey || []),
      lastUpdated: data.lastUpdated || new Date().toISOString()
    };
  } catch (error) {
    console.warn('[ZoteroSchemaMigration] Failed to deserialize index, creating new one');
    return createAnnotationKeyIndex();
  }
}

/**
 * Audit log manager for tracking deleted quotes with annotation keys
 * 
 * @see Requirements 8.3 - Annotation key audit trail
 */
export class ZoteroAuditLog {
  private entries: ZoteroAnnotationAuditEntry[] = [];
  private filePath: string;
  private loaded: boolean = false;

  constructor(workspaceRoot: string) {
    this.filePath = path.join(workspaceRoot, '.kiro', 'data', 'zotero-audit-log.json');
  }

  /**
   * Load audit log from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.entries = JSON.parse(content);
      this.loaded = true;
    } catch (error) {
      // File doesn't exist yet, start with empty log
      this.entries = [];
      this.loaded = true;
    }
  }

  /**
   * Save audit log to disk
   */
  async save(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf-8');
  }

  /**
   * Add an entry to the audit log when a quote with annotation key is deleted
   * 
   * @param entry - The audit entry to add
   */
  async addEntry(entry: ZoteroAnnotationAuditEntry): Promise<void> {
    if (!this.loaded) {
      await this.load();
    }
    this.entries.push(entry);
    await this.save();
  }

  /**
   * Get all audit entries
   */
  async getEntries(): Promise<ZoteroAnnotationAuditEntry[]> {
    if (!this.loaded) {
      await this.load();
    }
    return [...this.entries];
  }

  /**
   * Find entries by annotation key
   */
  async findByAnnotationKey(annotationKey: string): Promise<ZoteroAnnotationAuditEntry[]> {
    if (!this.loaded) {
      await this.load();
    }
    return this.entries.filter(e => e.annotationKey === annotationKey);
  }
}

/**
 * Checks if a quote has Zotero metadata
 */
export function hasZoteroMetadata(quote: SourcedQuote): boolean {
  return quote.zoteroMetadata !== undefined && quote.zoteroMetadata.fromZotero === true;
}

/**
 * Creates Zotero metadata for a quote imported from a Zotero highlight
 * 
 * @param annotationKey - The Zotero annotation key
 * @param highlightColor - The highlight color (hex code)
 * @param itemKey - Optional Zotero item key for the parent PDF
 * @param matchConfidence - Optional fuzzy match confidence score
 * @param originalText - Optional original text if different from matched
 * @returns ZoteroQuoteMetadata object
 * 
 * @see Requirements 3.1, 8.1 - Zotero metadata storage
 */
export function createZoteroMetadata(
  annotationKey: string,
  highlightColor: string,
  itemKey?: string,
  matchConfidence?: number,
  originalText?: string
): ZoteroQuoteMetadata {
  const validation = validateAnnotationKey(annotationKey);
  if (!validation.valid) {
    throw new Error(`Invalid annotation key: ${validation.error}`);
  }

  return {
    annotationKey: validation.key,
    highlightColor: normalizeHexColor(highlightColor),
    importedAt: new Date().toISOString(),
    fromZotero: true,
    itemKey,
    matchConfidence,
    originalText
  };
}

/**
 * Normalizes a hex color code to lowercase with # prefix
 */
function normalizeHexColor(color: string): string {
  if (!color) {
    return '#ffff00'; // Default to yellow
  }
  
  let normalized = color.trim().toLowerCase();
  if (!normalized.startsWith('#')) {
    normalized = '#' + normalized;
  }
  
  // Validate hex color format
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    console.warn(`[ZoteroSchemaMigration] Invalid hex color: ${color}, using default`);
    return '#ffff00';
  }
  
  return normalized;
}

/**
 * Migration result summary
 */
export interface MigrationResult {
  success: boolean;
  quotesProcessed: number;
  quotesUpdated: number;
  indexEntriesCreated: number;
  errors: string[];
}

/**
 * Zotero Schema Migration Service
 * 
 * Provides utilities for migrating existing quote data to support Zotero metadata
 */
export class ZoteroSchemaMigrationService {
  private workspaceRoot: string;
  private auditLog: ZoteroAuditLog;
  private annotationKeyIndex: AnnotationKeyIndex;
  private indexFilePath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.auditLog = new ZoteroAuditLog(workspaceRoot);
    this.annotationKeyIndex = createAnnotationKeyIndex();
    this.indexFilePath = path.join(workspaceRoot, '.kiro', 'data', 'annotation-key-index.json');
  }

  /**
   * Initialize the migration service by loading existing indexes
   */
  async initialize(): Promise<void> {
    await this.loadAnnotationKeyIndex();
    await this.auditLog.load();
  }

  /**
   * Load the annotation key index from disk
   */
  private async loadAnnotationKeyIndex(): Promise<void> {
    try {
      const content = await fs.readFile(this.indexFilePath, 'utf-8');
      this.annotationKeyIndex = deserializeAnnotationKeyIndex(content);
    } catch (error) {
      // Index doesn't exist yet, use empty one
      this.annotationKeyIndex = createAnnotationKeyIndex();
    }
  }

  /**
   * Save the annotation key index to disk
   */
  async saveAnnotationKeyIndex(): Promise<void> {
    const dir = path.dirname(this.indexFilePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.indexFilePath, 
      serializeAnnotationKeyIndex(this.annotationKeyIndex), 
      'utf-8'
    );
  }

  /**
   * Register a quote with Zotero metadata in the index
   * 
   * @param quoteId - The quote identifier
   * @param annotationKey - The Zotero annotation key
   */
  async registerQuote(quoteId: string, annotationKey: string): Promise<void> {
    addToAnnotationKeyIndex(this.annotationKeyIndex, annotationKey, quoteId);
    await this.saveAnnotationKeyIndex();
  }

  /**
   * Unregister a quote from the index and add to audit log
   * 
   * @param quoteId - The quote identifier
   * @param quoteText - The quote text (for audit)
   * @param paperId - The paper identifier (for audit)
   * @param reason - Optional reason for deletion
   */
  async unregisterQuote(
    quoteId: string, 
    quoteText: string, 
    paperId: string,
    reason?: string
  ): Promise<void> {
    const annotationKey = removeFromAnnotationKeyIndex(this.annotationKeyIndex, quoteId);
    
    if (annotationKey) {
      // Add to audit log for future reconciliation
      await this.auditLog.addEntry({
        annotationKey,
        quoteId,
        quoteText,
        paperId,
        deletedAt: new Date().toISOString(),
        reason
      });
      
      await this.saveAnnotationKeyIndex();
    }
  }

  /**
   * Look up a quote by annotation key
   */
  lookupByAnnotationKey(annotationKey: string): string | undefined {
    return lookupByAnnotationKey(this.annotationKeyIndex, annotationKey);
  }

  /**
   * Get the audit log instance
   */
  getAuditLog(): ZoteroAuditLog {
    return this.auditLog;
  }

  /**
   * Get index statistics
   */
  getIndexStats(): { totalEntries: number; lastUpdated: string } {
    return {
      totalEntries: this.annotationKeyIndex.keyToQuoteId.size,
      lastUpdated: this.annotationKeyIndex.lastUpdated
    };
  }
}

export default ZoteroSchemaMigrationService;
