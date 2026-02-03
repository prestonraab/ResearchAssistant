/**
 * Annotation Key Validator
 * 
 * Validates Zotero annotation keys and manages annotation key immutability.
 * Zotero annotation keys follow a specific format and are used for bidirectional
 * linking between quotes and Zotero highlights.
 * 
 * @see Requirements 8.1, 8.2, 8.3 - Zotero PDF Integration
 */

import type { AnnotationKeyValidation, ZoteroAnnotationAuditEntry } from '../types/index.js';

/**
 * Zotero annotation key format validation
 * 
 * Zotero annotation keys typically follow the pattern:
 * - Alphanumeric characters (a-z, A-Z, 0-9)
 * - Underscores and hyphens allowed
 * - Length: typically 8-32 characters
 * - Examples: "ABC123DEF456", "annotation_key_123"
 */
const ANNOTATION_KEY_PATTERN = /^[a-zA-Z0-9_-]{8,32}$/;

/**
 * Validates a Zotero annotation key format
 * 
 * Checks that the annotation key follows Zotero's expected format:
 * - Contains only alphanumeric characters, underscores, and hyphens
 * - Length between 8 and 32 characters
 * - Not empty or whitespace-only
 * 
 * @param key - The annotation key to validate
 * @returns Validation result with status and error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateAnnotationKey("ABC123DEF456");
 * if (result.valid) {
 *   console.log("Key is valid");
 * } else {
 *   console.error(result.error);
 * }
 * ```
 * 
 * **Validates: Requirements 8.2**
 */
export function validateAnnotationKey(key: string): AnnotationKeyValidation {
  // Check for null or undefined
  if (!key) {
    return {
      valid: false,
      key,
      error: 'Annotation key cannot be empty',
    };
  }

  // Check for whitespace-only strings
  if (typeof key !== 'string' || key.trim() === '') {
    return {
      valid: false,
      key,
      error: 'Annotation key cannot be whitespace-only',
    };
  }

  // Check format
  if (!ANNOTATION_KEY_PATTERN.test(key)) {
    return {
      valid: false,
      key,
      error: `Annotation key must contain only alphanumeric characters, underscores, and hyphens, and be 8-32 characters long. Got: "${key}"`,
    };
  }

  return {
    valid: true,
    key,
  };
}

/**
 * Ensures an annotation key is immutable by preventing modification
 * 
 * This function is used to mark an annotation key as immutable in the system.
 * Once set, the annotation key should not be changed. This is enforced at the
 * application level through the QuoteManager.
 * 
 * @param key - The annotation key to mark as immutable
 * @returns The same key if valid, throws error if invalid
 * @throws Error if the annotation key is invalid
 * 
 * @example
 * ```typescript
 * const immutableKey = makeAnnotationKeyImmutable("ABC123DEF456");
 * // Key is now treated as immutable in the system
 * ```
 * 
 * **Validates: Requirements 8.1**
 */
export function makeAnnotationKeyImmutable(key: string): string {
  const validation = validateAnnotationKey(key);
  
  if (!validation.valid) {
    throw new Error(`Cannot make invalid annotation key immutable: ${validation.error}`);
  }
  
  // In a real implementation, this would mark the key as immutable in the database
  // For now, we just return the validated key
  return key;
}

/**
 * Audit log for deleted quotes with annotation keys
 * 
 * Maintains a record of deleted quotes that had Zotero annotation keys,
 * enabling future reconciliation between the quote database and Zotero.
 */
export class AnnotationKeyAuditLog {
  private auditEntries: Map<string, ZoteroAnnotationAuditEntry> = new Map();
  private nextEntryId: number = 1;

  /**
   * Log a deleted quote with annotation key
   * 
   * Records the deletion of a quote that had a Zotero annotation key.
   * This enables future reconciliation and tracking of quote lifecycle.
   * 
   * @param annotationKey - The Zotero annotation key
   * @param quoteId - The quote identifier
   * @param quoteText - The quote text at time of deletion
   * @param paperId - The associated paper identifier
   * @param deletedBy - Optional user or process that deleted the quote
   * @param reason - Optional reason for deletion
   * @returns The audit entry ID
   * 
   * @example
   * ```typescript
   * const auditLog = new AnnotationKeyAuditLog();
   * const entryId = auditLog.logDeletedQuote(
   *   "ABC123DEF456",
   *   "quote_123",
   *   "RNA-seq is widely used",
   *   "paper_456",
   *   "user@example.com",
   *   "Duplicate quote"
   * );
   * ```
   * 
   * **Validates: Requirements 8.3**
   */
  logDeletedQuote(
    annotationKey: string,
    quoteId: string,
    quoteText: string,
    paperId: string,
    deletedBy?: string,
    reason?: string
  ): string {
    // Validate annotation key before logging
    const validation = validateAnnotationKey(annotationKey);
    if (!validation.valid) {
      throw new Error(`Cannot log deleted quote with invalid annotation key: ${validation.error}`);
    }

    const entryId = `audit_${this.nextEntryId++}`;
    const entry: ZoteroAnnotationAuditEntry = {
      annotationKey,
      quoteId,
      quoteText,
      paperId,
      deletedAt: new Date().toISOString(),
      deletedBy,
      reason,
    };

    this.auditEntries.set(entryId, entry);
    return entryId;
  }

  /**
   * Get audit entries for a specific annotation key
   * 
   * Retrieves all audit log entries associated with a particular annotation key.
   * 
   * @param annotationKey - The annotation key to search for
   * @returns Array of matching audit entries
   * 
   * @example
   * ```typescript
   * const entries = auditLog.getEntriesByAnnotationKey("ABC123DEF456");
   * ```
   */
  getEntriesByAnnotationKey(annotationKey: string): ZoteroAnnotationAuditEntry[] {
    return Array.from(this.auditEntries.values()).filter(
      entry => entry.annotationKey === annotationKey
    );
  }

  /**
   * Get audit entries for a specific quote
   * 
   * Retrieves all audit log entries associated with a particular quote.
   * 
   * @param quoteId - The quote identifier to search for
   * @returns Array of matching audit entries
   */
  getEntriesByQuoteId(quoteId: string): ZoteroAnnotationAuditEntry[] {
    return Array.from(this.auditEntries.values()).filter(
      entry => entry.quoteId === quoteId
    );
  }

  /**
   * Get audit entries for a specific paper
   * 
   * Retrieves all audit log entries associated with a particular paper.
   * 
   * @param paperId - The paper identifier to search for
   * @returns Array of matching audit entries
   */
  getEntriesByPaperId(paperId: string): ZoteroAnnotationAuditEntry[] {
    return Array.from(this.auditEntries.values()).filter(
      entry => entry.paperId === paperId
    );
  }

  /**
   * Get all audit entries
   * 
   * @returns Array of all audit entries
   */
  getAllEntries(): ZoteroAnnotationAuditEntry[] {
    return Array.from(this.auditEntries.values());
  }

  /**
   * Get audit entry by ID
   * 
   * @param entryId - The audit entry ID
   * @returns The audit entry if found, null otherwise
   */
  getEntry(entryId: string): ZoteroAnnotationAuditEntry | null {
    return this.auditEntries.get(entryId) ?? null;
  }

  /**
   * Clear all audit entries
   * 
   * Used for testing and resetting state.
   */
  clear(): void {
    this.auditEntries.clear();
    this.nextEntryId = 1;
  }

  /**
   * Get total number of audit entries
   * 
   * @returns Number of audit entries
   */
  getEntryCount(): number {
    return this.auditEntries.size;
  }
}

