import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';
import { OutlineParser } from '../outlineParserWrapper';

/**
 * OutlineParser Wrapper Tests
 * 
 * The core OutlineParser is tested in @research-assistant/core.
 * These tests verify the VS Code-specific wrapper functionality:
 * - Event emission on parse
 * - Position conversion (VSCode Position to line number)
 * - Hierarchy building
 * - Path management
 */

describe('OutlineParser Wrapper', () => {
  let parser: OutlineParser;
  const testFilePath = '/test/outline.md';

  beforeEach(() => {
    parser = new OutlineParser(testFilePath);
  });

  describe('constructor and path management', () => {
    test('should store file path', () => {
      expect(parser.getFilePath()).toBe(testFilePath);
    });

    test('should update file path', () => {
      const newPath = '/new/path.md';
      parser.updatePath(newPath);
      expect(parser.getFilePath()).toBe(newPath);
    });
  });

  describe('event emission', () => {
    test('should emit onDidChange when parse is called', async () => {
      const listener = jest.fn();
      parser.onDidChange(listener);

      // Mock the core parser's parse method to avoid file I/O
      const coreParser = parser.getCoreParser() as any;
      jest.spyOn(coreParser, 'parse').mockResolvedValue([]);

      await parser.parse();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('getSectionAtPosition', () => {
    test('should accept VSCode Position object', () => {
      const coreParser = parser.getCoreParser() as any;
      
      // Mock getSectionAtPosition to return a section
      jest.spyOn(coreParser, 'getSectionAtPosition').mockReturnValue({
        id: '1',
        title: 'Section 1',
        level: 2,
        lineStart: 0,
        lineEnd: 5,
        content: []
      });

      const position = { line: 2, character: 0 } as vscode.Position;
      const section = parser.getSectionAtPosition(position);

      expect(section).not.toBeNull();
      expect(section?.id).toBe('1');
    });

    test('should accept line number directly', () => {
      const coreParser = parser.getCoreParser() as any;
      
      jest.spyOn(coreParser, 'getSectionAtPosition').mockReturnValue({
        id: '1',
        title: 'Section 1',
        level: 2,
        lineStart: 0,
        lineEnd: 5,
        content: []
      });

      const section = parser.getSectionAtPosition(2);

      expect(section).not.toBeNull();
      expect(section?.id).toBe('1');
    });

    test('should return null for position outside any section', () => {
      const coreParser = parser.getCoreParser() as any;
      
      jest.spyOn(coreParser, 'getSectionAtPosition').mockReturnValue(null);

      const section = parser.getSectionAtPosition(0);

      expect(section).toBeNull();
    });
  });

  describe('getHierarchy', () => {
    test('should build parent-child relationships', () => {
      const coreParser = parser.getCoreParser() as any;
      
      jest.spyOn(coreParser, 'getSections').mockReturnValue([
        { id: '1', title: 'Parent', level: 2, lineStart: 0, lineEnd: 10, content: [] },
        { id: '2', title: 'Child', level: 3, lineStart: 2, lineEnd: 5, content: [] },
        { id: '3', title: 'Sibling', level: 2, lineStart: 11, lineEnd: 15, content: [] }
      ]);

      const hierarchy = parser.getHierarchy();

      expect(hierarchy).toHaveLength(3);
      
      // Parent should have child
      expect(hierarchy[0].children).toContain('2');
      expect(hierarchy[0].parent).toBeNull();
      
      // Child should have parent
      expect(hierarchy[1].parent).toBe('1');
      expect(hierarchy[1].children).toHaveLength(0);
      
      // Sibling should have no parent (same level as first)
      expect(hierarchy[2].parent).toBeNull();
    });

    test('should return empty array when no sections', () => {
      const coreParser = parser.getCoreParser() as any;
      
      jest.spyOn(coreParser, 'getSections').mockReturnValue([]);

      const hierarchy = parser.getHierarchy();
      expect(hierarchy).toEqual([]);
    });
  });

  describe('delegation to core parser', () => {
    test('should delegate getSectionById to core parser', () => {
      const coreParser = parser.getCoreParser() as any;
      
      jest.spyOn(coreParser, 'getSectionById').mockReturnValue({
        id: 'test-id',
        title: 'Test',
        level: 2,
        lineStart: 0,
        lineEnd: 5,
        content: []
      });

      const section = parser.getSectionById('test-id');

      expect(section).not.toBeNull();
      expect(section?.title).toBe('Test');
    });

    test('should delegate getSections to core parser', () => {
      const coreParser = parser.getCoreParser() as any;
      
      const mockSections = [
        { id: '1', title: 'One', level: 2, lineStart: 0, lineEnd: 5, content: [] },
        { id: '2', title: 'Two', level: 2, lineStart: 6, lineEnd: 10, content: [] }
      ];
      
      jest.spyOn(coreParser, 'getSections').mockReturnValue(mockSections);

      const sections = parser.getSections();

      expect(sections).toHaveLength(2);
    });
  });
});
