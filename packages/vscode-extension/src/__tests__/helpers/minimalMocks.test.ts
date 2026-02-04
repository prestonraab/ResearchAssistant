/**
 * Tests for minimal mock helpers
 * 
 * These tests verify that the minimal mocks provide the exact functionality
 * needed by tests, based on the audit findings from task 4.1.
 */

import { describe, it, expect } from '@jest/globals';
import {
  createMinimalPosition,
  createMinimalRange,
  createMinimalDocument,
  createMinimalHover,
  createMinimalCompletionItem,
  createMinimalCompletionList,
  createMinimalSelection,
  createMinimalUri,
  createMinimalCancellationToken,
  createDocumentWithClaims,
  createDocumentWithWord,
  startOfDocument,
  startOfLine,
  entireLine,
  wordRange
} from './minimalMocks';

describe('Minimal Mock Helpers', () => {
  describe('createMinimalPosition', () => {
    it('should create position with line and character', () => {
      const pos = createMinimalPosition(5, 10);
      
      expect(pos.line).toBe(5);
      expect(pos.character).toBe(10);
    });
    
    it('should handle zero position', () => {
      const pos = createMinimalPosition(0, 0);
      
      expect(pos.line).toBe(0);
      expect(pos.character).toBe(0);
    });
  });

  describe('createMinimalRange', () => {
    it('should create range with start and end positions', () => {
      const range = createMinimalRange(0, 3, 0, 7);
      
      expect(range.start.line).toBe(0);
      expect(range.start.character).toBe(3);
      expect(range.end.line).toBe(0);
      expect(range.end.character).toBe(7);
    });
    
    it('should correctly identify empty range', () => {
      const range = createMinimalRange(5, 10, 5, 10);
      
      expect(range.isEmpty).toBe(true);
    });
    
    it('should correctly identify non-empty range', () => {
      const range = createMinimalRange(5, 10, 5, 15);
      
      expect(range.isEmpty).toBe(false);
    });
    
    it('should correctly identify single line range', () => {
      const range = createMinimalRange(5, 10, 5, 15);
      
      expect(range.isSingleLine).toBe(true);
    });
    
    it('should correctly identify multi-line range', () => {
      const range = createMinimalRange(5, 10, 7, 5);
      
      expect(range.isSingleLine).toBe(false);
    });
  });

  describe('createMinimalDocument', () => {
    it('should create document with text content', () => {
      const doc = createMinimalDocument({
        text: 'Line 1\nLine 2\nLine 3'
      });
      
      expect(doc.getText()).toBe('Line 1\nLine 2\nLine 3');
      expect(doc.lineCount).toBe(3);
    });
    
    it('should default to markdown language', () => {
      const doc = createMinimalDocument({ text: 'test' });
      
      expect(doc.languageId).toBe('markdown');
    });
    
    it('should allow custom language', () => {
      const doc = createMinimalDocument({
        text: 'test',
        languageId: 'typescript'
      });
      
      expect(doc.languageId).toBe('typescript');
    });
    
    it('should provide line access', () => {
      const doc = createMinimalDocument({
        text: 'Line 1\nLine 2\nLine 3'
      });
      
      const line = doc.lineAt(1);
      expect(line.text).toBe('Line 2');
      expect(line.lineNumber).toBe(1);
    });
    
    it('should provide range for line', () => {
      const doc = createMinimalDocument({
        text: 'Line 1\nLine 2\nLine 3'
      });
      
      const line = doc.lineAt(1);
      expect(line.range.start.line).toBe(1);
      expect(line.range.start.character).toBe(0);
      expect(line.range.end.line).toBe(1);
      expect(line.range.end.character).toBe(6);
    });
    
    it('should detect empty lines', () => {
      const doc = createMinimalDocument({
        text: 'Line 1\n\nLine 3'
      });
      
      const line = doc.lineAt(1);
      expect(line.isEmptyOrWhitespace).toBe(true);
    });
    
    it('should detect non-whitespace index', () => {
      const doc = createMinimalDocument({
        text: '  indented'
      });
      
      const line = doc.lineAt(0);
      expect(line.firstNonWhitespaceCharacterIndex).toBe(2);
    });
    
    it('should get text in range', () => {
      const doc = createMinimalDocument({
        text: 'Hello World'
      });
      
      const range = createMinimalRange(0, 0, 0, 5);
      expect(doc.getText(range)).toBe('Hello');
    });
    
    it('should find word at position', () => {
      const doc = createMinimalDocument({
        text: 'Hello World'
      });
      
      const pos = createMinimalPosition(0, 6);
      const range = doc.getWordRangeAtPosition(pos);
      
      expect(range).toBeDefined();
      expect(range!.start.character).toBe(6);
      expect(range!.end.character).toBe(11);
    });
    
    it('should return undefined when no word at position', () => {
      const doc = createMinimalDocument({
        text: 'Hello   World'
      });
      
      const pos = createMinimalPosition(0, 5); // Space position
      const range = doc.getWordRangeAtPosition(pos);
      
      expect(range).toBeUndefined();
    });
    
    it('should use custom regex for word matching', () => {
      const doc = createMinimalDocument({
        text: 'C_01 is a claim'
      });
      
      const pos = createMinimalPosition(0, 0);
      const range = doc.getWordRangeAtPosition(pos, /C_\d+/);
      
      expect(range).toBeDefined();
      expect(doc.getText(range!)).toBe('C_01');
    });
  });

  describe('createMinimalHover', () => {
    it('should create hover with content', () => {
      const hover = createMinimalHover('Test content');
      
      expect(hover.contents).toHaveLength(1);
      expect(hover.contents[0].value).toBe('Test content');
    });
    
    it('should include range when provided', () => {
      const range = createMinimalRange(0, 0, 0, 5);
      const hover = createMinimalHover('Test', range);
      
      expect(hover.range).toBe(range);
    });
    
    it('should have undefined range when not provided', () => {
      const hover = createMinimalHover('Test');
      
      expect(hover.range).toBeUndefined();
    });
  });

  describe('createMinimalCompletionItem', () => {
    it('should create completion item with label', () => {
      const item = createMinimalCompletionItem('C_01');
      
      expect(item.label).toBe('C_01');
      expect(item.insertText).toBe('C_01');
    });
    
    it('should include kind when provided', () => {
      const item = createMinimalCompletionItem('C_01', 9);
      
      expect(item.kind).toBe(9);
    });
    
    it('should default kind to 0', () => {
      const item = createMinimalCompletionItem('C_01');
      
      expect(item.kind).toBe(0);
    });
    
    it('should have empty detail by default', () => {
      const item = createMinimalCompletionItem('C_01');
      
      expect(item.detail).toBe('');
    });
    
    it('should allow setting properties', () => {
      const item = createMinimalCompletionItem('C_01');
      item.detail = 'Test claim';
      item.documentation = 'Documentation';
      
      expect(item.detail).toBe('Test claim');
      expect(item.documentation).toBe('Documentation');
    });
  });

  describe('createMinimalCompletionList', () => {
    it('should create completion list with items', () => {
      const items = [
        createMinimalCompletionItem('C_01'),
        createMinimalCompletionItem('C_02')
      ];
      const list = createMinimalCompletionList(items);
      
      expect(list.items).toHaveLength(2);
      expect(list.items[0].label).toBe('C_01');
    });
    
    it('should default isIncomplete to false', () => {
      const list = createMinimalCompletionList([]);
      
      expect(list.isIncomplete).toBe(false);
    });
    
    it('should allow setting isIncomplete', () => {
      const list = createMinimalCompletionList([], true);
      
      expect(list.isIncomplete).toBe(true);
    });
  });

  describe('createMinimalSelection', () => {
    it('should create selection with positions', () => {
      const sel = createMinimalSelection(5, 0, 5, 55);
      
      expect(sel.start.line).toBe(5);
      expect(sel.start.character).toBe(0);
      expect(sel.end.line).toBe(5);
      expect(sel.end.character).toBe(55);
    });
    
    it('should have anchor and active positions', () => {
      const sel = createMinimalSelection(5, 0, 5, 55);
      
      expect(sel.anchor.line).toBe(5);
      expect(sel.active.line).toBe(5);
    });
    
    it('should correctly identify empty selection', () => {
      const sel = createMinimalSelection(5, 10, 5, 10);
      
      expect(sel.isEmpty).toBe(true);
    });
    
    it('should correctly identify single line selection', () => {
      const sel = createMinimalSelection(5, 0, 5, 55);
      
      expect(sel.isSingleLine).toBe(true);
    });
    
    it('should correctly identify multi-line selection', () => {
      const sel = createMinimalSelection(5, 0, 7, 10);
      
      expect(sel.isSingleLine).toBe(false);
    });
  });

  describe('createMinimalUri', () => {
    it('should create uri with fsPath', () => {
      const uri = createMinimalUri('/workspace/file.md');
      
      expect(uri.fsPath).toBe('/workspace/file.md');
    });
    
    it('should have file scheme', () => {
      const uri = createMinimalUri('/workspace/file.md');
      
      expect(uri.scheme).toBe('file');
    });
    
    it('should have path property', () => {
      const uri = createMinimalUri('/workspace/file.md');
      
      expect(uri.path).toBe('/workspace/file.md');
    });
  });

  describe('createMinimalCancellationToken', () => {
    it('should create non-cancelled token by default', () => {
      const token = createMinimalCancellationToken();
      
      expect(token.isCancellationRequested).toBe(false);
    });
    
    it('should create cancelled token when requested', () => {
      const token = createMinimalCancellationToken(true);
      
      expect(token.isCancellationRequested).toBe(true);
    });
    
    it('should have onCancellationRequested method', () => {
      const token = createMinimalCancellationToken();
      
      expect(token.onCancellationRequested).toBeDefined();
      const disposable = token.onCancellationRequested();
      expect(disposable.dispose).toBeDefined();
    });
  });

  describe('Convenience Helpers', () => {
    describe('createDocumentWithClaims', () => {
      it('should create document with claim references', () => {
        const doc = createDocumentWithClaims(['C_01', 'C_02']);
        
        const text = doc.getText();
        expect(text).toContain('C_01');
        expect(text).toContain('C_02');
        expect(doc.lineCount).toBe(2);
      });
    });

    describe('createDocumentWithWord', () => {
      it('should create document with word at position', () => {
        const { document, range, word } = createDocumentWithWord('C_01', 0, 5);
        
        expect(word).toBe('C_01');
        expect(document.getText(range)).toBe('C_01');
        expect(range.start.character).toBe(5);
      });
      
      it('should return word range at position', () => {
        const { document, range } = createDocumentWithWord('C_01', 0, 5);
        
        const pos = createMinimalPosition(0, 6);
        const foundRange = document.getWordRangeAtPosition(pos);
        
        expect(foundRange).toBe(range);
      });
      
      it('should return undefined for position outside word', () => {
        const { document } = createDocumentWithWord('C_01', 0, 5);
        
        const pos = createMinimalPosition(0, 0);
        const foundRange = document.getWordRangeAtPosition(pos);
        
        expect(foundRange).toBeUndefined();
      });
    });

    describe('startOfDocument', () => {
      it('should create position at (0,0)', () => {
        const pos = startOfDocument();
        
        expect(pos.line).toBe(0);
        expect(pos.character).toBe(0);
      });
    });

    describe('startOfLine', () => {
      it('should create position at start of line', () => {
        const pos = startOfLine(5);
        
        expect(pos.line).toBe(5);
        expect(pos.character).toBe(0);
      });
    });

    describe('entireLine', () => {
      it('should create range spanning line', () => {
        const range = entireLine(3, 50);
        
        expect(range.start.line).toBe(3);
        expect(range.start.character).toBe(0);
        expect(range.end.line).toBe(3);
        expect(range.end.character).toBe(50);
      });
      
      it('should default to length 100', () => {
        const range = entireLine(3);
        
        expect(range.end.character).toBe(100);
      });
    });

    describe('wordRange', () => {
      it('should create range for word', () => {
        const range = wordRange(2, 10, 5);
        
        expect(range.start.line).toBe(2);
        expect(range.start.character).toBe(10);
        expect(range.end.line).toBe(2);
        expect(range.end.character).toBe(15);
      });
    });
  });

  describe('Integration - Typical Test Patterns', () => {
    it('should support hover provider test pattern', () => {
      // Typical hover provider test
      const doc = createMinimalDocument({
        text: 'This references C_01 in the text.'
      });
      const pos = createMinimalPosition(0, 17);
      const token = createMinimalCancellationToken();
      
      // Simulate finding word at position
      const range = doc.getWordRangeAtPosition(pos, /C_\d+/);
      expect(range).toBeDefined();
      
      const claimId = doc.getText(range!);
      expect(claimId).toBe('C_01');
      
      // Simulate creating hover
      const hover = createMinimalHover(`### ${claimId}: Test Claim`, range);
      expect(hover.contents[0].value).toContain('C_01');
    });

    it('should support completion provider test pattern', () => {
      // Typical completion provider test
      const doc = createMinimalDocument({
        text: 'Type C_ to get completions'
      });
      const pos = createMinimalPosition(0, 7);
      const token = createMinimalCancellationToken();
      
      // Simulate creating completions
      const items = [
        createMinimalCompletionItem('C_01', 9),
        createMinimalCompletionItem('C_02', 9)
      ];
      items[0].detail = 'First claim';
      items[1].detail = 'Second claim';
      
      const list = createMinimalCompletionList(items, false);
      
      expect(list.items).toHaveLength(2);
      expect(list.items[0].label).toBe('C_01');
      expect(list.isIncomplete).toBe(false);
    });

    it('should support document with claims test pattern', () => {
      // Typical claim detection test
      const doc = createDocumentWithClaims(['C_01', 'C_02', 'C_03']);
      
      expect(doc.lineCount).toBe(3);
      expect(doc.getText()).toContain('C_01');
      expect(doc.getText()).toContain('C_02');
      expect(doc.getText()).toContain('C_03');
      
      const line1 = doc.lineAt(0);
      expect(line1.text).toContain('C_01');
    });
  });
});
