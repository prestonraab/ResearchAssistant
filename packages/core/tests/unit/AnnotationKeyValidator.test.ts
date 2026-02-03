/**
 * Unit tests for Annotation Key Validator
 * 
 * Tests cover:
 * - Annotation key format validation
 * - Annotation key immutability
 * - Audit logging for deleted quotes with annotation keys
 * - Audit log querying by annotation key, quote ID, and paper ID
 * 
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateAnnotationKey,
  makeAnnotationKeyImmutable,
  AnnotationKeyAuditLog,
} from '../../src/utils/AnnotationKeyValidator.js';

describe('AnnotationKeyValidator', () => {
  describe('validateAnnotationKey()', () => {
    it('should validate a correct annotation key format', () => {
      const result = validateAnnotationKey('ABC123DEF456');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.key).toBe('ABC123DEF456');
    });

    it('should validate annotation keys with underscores', () => {
      const result = validateAnnotationKey('annotation_key_123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate annotation keys with hyphens', () => {
      const result = validateAnnotationKey('annotation-key-123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate annotation keys with mixed case', () => {
      const result = validateAnnotationKey('AbC123DeF456');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate minimum length annotation key (8 characters)', () => {
      const result = validateAnnotationKey('12345678');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate maximum length annotation key (32 characters)', () => {
      const result = validateAnnotationKey('12345678901234567890123456789012');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject empty string', () => {
      const result = validateAnnotationKey('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Annotation key cannot be empty');
    });

    it('should reject whitespace-only string', () => {
      const result = validateAnnotationKey('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Annotation key cannot be whitespace-only');
    });

    it('should reject key shorter than 8 characters', () => {
      const result = validateAnnotationKey('1234567');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('8-32 characters');
    });

    it('should reject key longer than 32 characters', () => {
      const result = validateAnnotationKey('123456789012345678901234567890123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('8-32 characters');
    });

    it('should reject key with special characters', () => {
      const result = validateAnnotationKey('ABC123!@#$%^&*');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric characters');
    });

    it('should reject key with spaces', () => {
      const result = validateAnnotationKey('ABC 123 DEF');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('alphanumeric characters');
    });

    it('should reject null value', () => {
      const result = validateAnnotationKey(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Annotation key cannot be empty');
    });

    it('should reject undefined value', () => {
      const result = validateAnnotationKey(undefined as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Annotation key cannot be empty');
    });
  });

  describe('makeAnnotationKeyImmutable()', () => {
    it('should return the key if valid', () => {
      const key = 'ABC123DEF456';
      const result = makeAnnotationKeyImmutable(key);
      expect(result).toBe(key);
    });

    it('should throw error if key is invalid', () => {
      expect(() => {
        makeAnnotationKeyImmutable('invalid');
      }).toThrow('Cannot make invalid annotation key immutable');
    });

    it('should throw error with validation message', () => {
      expect(() => {
        makeAnnotationKeyImmutable('ABC!@#$');
      }).toThrow('Cannot make invalid annotation key immutable');
    });
  });

  describe('AnnotationKeyAuditLog', () => {
    let auditLog: AnnotationKeyAuditLog;

    beforeEach(() => {
      auditLog = new AnnotationKeyAuditLog();
    });

    describe('logDeletedQuote()', () => {
      it('should log a deleted quote with annotation key', () => {
        const entryId = auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_123',
          'RNA-seq is widely used',
          'paper_456'
        );

        expect(entryId).toBeDefined();
        expect(entryId).toMatch(/^audit_\d+$/);

        const entry = auditLog.getEntry(entryId);
        expect(entry).toBeDefined();
        expect(entry?.annotationKey).toBe('ABC123DEF456');
        expect(entry?.quoteId).toBe('quote_123');
        expect(entry?.quoteText).toBe('RNA-seq is widely used');
        expect(entry?.paperId).toBe('paper_456');
      });

      it('should include optional deletedBy and reason fields', () => {
        const entryId = auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_123',
          'Test quote',
          'paper_456',
          'user@example.com',
          'Duplicate quote'
        );

        const entry = auditLog.getEntry(entryId);
        expect(entry?.deletedBy).toBe('user@example.com');
        expect(entry?.reason).toBe('Duplicate quote');
      });

      it('should set deletedAt timestamp', () => {
        const beforeTime = new Date();
        const entryId = auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_123',
          'Test quote',
          'paper_456'
        );
        const afterTime = new Date();

        const entry = auditLog.getEntry(entryId);
        expect(entry?.deletedAt).toBeDefined();
        
        const deletedAtDate = new Date(entry?.deletedAt || '');
        expect(deletedAtDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(deletedAtDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      });

      it('should reject invalid annotation key', () => {
        expect(() => {
          auditLog.logDeletedQuote(
            'invalid',
            'quote_123',
            'Test quote',
            'paper_456'
          );
        }).toThrow('Cannot log deleted quote with invalid annotation key');
      });

      it('should generate unique entry IDs', () => {
        const id1 = auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        const id2 = auditLog.logDeletedQuote(
          'XYZ789ABC123',
          'quote_2',
          'Quote 2',
          'paper_2'
        );

        expect(id1).not.toBe(id2);
      });
    });

    describe('getEntriesByAnnotationKey()', () => {
      it('should return entries for a specific annotation key', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_2',
          'Quote 2',
          'paper_1'
        );

        auditLog.logDeletedQuote(
          'XYZ789ABC123',
          'quote_3',
          'Quote 3',
          'paper_2'
        );

        const entries = auditLog.getEntriesByAnnotationKey('ABC123DEF456');
        expect(entries).toHaveLength(2);
        expect(entries[0].quoteId).toBe('quote_1');
        expect(entries[1].quoteId).toBe('quote_2');
      });

      it('should return empty array for non-existent annotation key', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        const entries = auditLog.getEntriesByAnnotationKey('NONEXISTENT');
        expect(entries).toHaveLength(0);
      });
    });

    describe('getEntriesByQuoteId()', () => {
      it('should return entry for a specific quote ID', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_123',
          'Test quote',
          'paper_456'
        );

        const entries = auditLog.getEntriesByQuoteId('quote_123');
        expect(entries).toHaveLength(1);
        expect(entries[0].annotationKey).toBe('ABC123DEF456');
      });

      it('should return empty array for non-existent quote ID', () => {
        const entries = auditLog.getEntriesByQuoteId('nonexistent');
        expect(entries).toHaveLength(0);
      });
    });

    describe('getEntriesByPaperId()', () => {
      it('should return entries for a specific paper ID', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_456'
        );

        auditLog.logDeletedQuote(
          'XYZ789ABC123',
          'quote_2',
          'Quote 2',
          'paper_456'
        );

        auditLog.logDeletedQuote(
          'DEF456GHI789',
          'quote_3',
          'Quote 3',
          'paper_789'
        );

        const entries = auditLog.getEntriesByPaperId('paper_456');
        expect(entries).toHaveLength(2);
        expect(entries[0].quoteId).toBe('quote_1');
        expect(entries[1].quoteId).toBe('quote_2');
      });

      it('should return empty array for non-existent paper ID', () => {
        const entries = auditLog.getEntriesByPaperId('nonexistent');
        expect(entries).toHaveLength(0);
      });
    });

    describe('getAllEntries()', () => {
      it('should return all audit entries', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        auditLog.logDeletedQuote(
          'XYZ789ABC123',
          'quote_2',
          'Quote 2',
          'paper_2'
        );

        const entries = auditLog.getAllEntries();
        expect(entries).toHaveLength(2);
      });

      it('should return empty array when no entries exist', () => {
        const entries = auditLog.getAllEntries();
        expect(entries).toHaveLength(0);
      });
    });

    describe('getEntry()', () => {
      it('should retrieve an entry by ID', () => {
        const entryId = auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_123',
          'Test quote',
          'paper_456'
        );

        const entry = auditLog.getEntry(entryId);
        expect(entry).toBeDefined();
        expect(entry?.annotationKey).toBe('ABC123DEF456');
      });

      it('should return null for non-existent entry ID', () => {
        const entry = auditLog.getEntry('nonexistent');
        expect(entry).toBeNull();
      });
    });

    describe('getEntryCount()', () => {
      it('should return correct entry count', () => {
        expect(auditLog.getEntryCount()).toBe(0);

        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        expect(auditLog.getEntryCount()).toBe(1);

        auditLog.logDeletedQuote(
          'XYZ789ABC123',
          'quote_2',
          'Quote 2',
          'paper_2'
        );

        expect(auditLog.getEntryCount()).toBe(2);
      });
    });

    describe('clear()', () => {
      it('should clear all audit entries', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        expect(auditLog.getEntryCount()).toBe(1);

        auditLog.clear();

        expect(auditLog.getEntryCount()).toBe(0);
        expect(auditLog.getAllEntries()).toHaveLength(0);
      });

      it('should reset entry ID counter after clear', () => {
        auditLog.logDeletedQuote(
          'ABC123DEF456',
          'quote_1',
          'Quote 1',
          'paper_1'
        );

        auditLog.clear();

        const newEntryId = auditLog.logDeletedQuote(
          'XYZ789ABC123',
          'quote_2',
          'Quote 2',
          'paper_2'
        );

        // Should start from audit_1 again
        expect(newEntryId).toBe('audit_1');
      });
    });
  });
});

