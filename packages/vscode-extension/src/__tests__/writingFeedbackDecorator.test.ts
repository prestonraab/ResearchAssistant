import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { WritingFeedbackDecorator } from '../ui/writingFeedbackDecorator';
import { ExtensionState } from '../core/state';
import { 
  setupTest, 
  aClaim,
  createMinimalDocument,
  createMinimalUri,
  createMinimalPosition
} from './helpers';

/**
 * Tests for WritingFeedbackDecorator
 * 
 * **Refactored:** Uses minimal mocks instead of manual document creation
 * to reduce mock maintenance burden (Task 4.4)
 */
describe('WritingFeedbackDecorator', () => {
  setupTest();

  let decorator: WritingFeedbackDecorator;
  let mockExtensionState: jest.Mocked<any>;
  let mockEditor: jest.Mocked<any>;

  /**
   * Helper to create a mock document with getText and positionAt
   * Uses minimal mock as base and adds required methods
   */
  function createTestDocument(options: {
    text: string;
    fsPath: string;
    languageId?: string;
  }) {
    const doc = createMinimalDocument({
      text: options.text,
      uri: createMinimalUri(options.fsPath),
      fileName: options.fsPath,
      languageId: options.languageId || 'markdown'
    });
    
    // Add positionAt method needed by decorator
    (doc as any).positionAt = jest.fn((offset: number) => {
      const lines = options.text.substring(0, offset).split('\n');
      const line = lines.length - 1;
      const character = lines[lines.length - 1].length;
      return createMinimalPosition(line, character);
    });
    
    return doc;
  }

  /**
   * Helper to create a mock editor with document
   */
  function createTestEditor(document: any) {
    return {
      document,
      setDecorations: jest.fn()
    } as any;
  }

  beforeEach(() => {
    mockExtensionState = {
      getAbsolutePath: jest.fn((path: string) => `/workspace/${path}`),
      claimsManager: {
        getAllClaims: jest.fn(() => [
          aClaim()
            .withId('C_01')
            .withText('Machine learning models require large datasets for training')
            .withCategory('Method')
            .withContext('')
            .withPrimaryQuote('Large datasets are essential for ML', 'Smith2020')
            .verified()
            .build()
        ])
      }
    } as any;

    const mockDocument = createTestDocument({
      text: '',
      fsPath: '/workspace/03_Drafting/manuscript.md'
    });

    mockEditor = createTestEditor(mockDocument);

    decorator = new WritingFeedbackDecorator(mockExtensionState);
  });

  afterEach(() => {
    decorator.dispose();
  });

  describe('Vague term detection', () => {
    test('should detect vague terms in text', () => {
      const text = 'Some studies show that many researchers often use various methods.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const vaguenessCall = calls.find((call: any) => call[1].length > 0);
      
      expect(vaguenessCall).toBeDefined();
      if (vaguenessCall) {
        const decorations = vaguenessCall[1];
        expect(decorations.length).toBeGreaterThan(0);
        expect(decorations.length).toBeGreaterThanOrEqual(4);
        
        decorations.forEach((d: any) => {
          expect(d.hoverMessage).toBeDefined();
          const message = d.hoverMessage.value || d.hoverMessage;
          expect(message).toContain('Vague term');
        });
      }
    });

    test('should not flag vague terms in headers', () => {
      const text = '# Some Introduction\n\nThis is content.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const vaguenessCall = calls[0];
      
      if (vaguenessCall) {
        const decorations = vaguenessCall[1];
        const decoratedInHeader = decorations.filter((d: any) => 
          d.range.start.line === 0
        );
        expect(decoratedInHeader.length).toBe(0);
      }
    });

    test('should not flag vague terms in list items', () => {
      const text = '- Some item\n- Another item';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const vaguenessCall = calls[0];
      
      if (vaguenessCall) {
        const decorations = vaguenessCall[1];
        expect(decorations.length).toBe(0);
      }
    });
  });

  describe('Missing citation detection', () => {
    test('should detect unsupported factual statements', () => {
      const text = 'Research shows that machine learning improves accuracy significantly.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const missingCitationCall = calls[1];
      
      expect(missingCitationCall).toBeDefined();
      if (missingCitationCall) {
        const decorations = missingCitationCall[1];
        expect(decorations.length).toBeGreaterThan(0);
        
        const decoration = decorations[0];
        expect(decoration.hoverMessage).toBeDefined();
        const message = decoration.hoverMessage.value || decoration.hoverMessage;
        expect(message).toContain('Unsupported statement');
      }
    });

    test('should not flag statements with claim references', () => {
      const text = 'Research shows that machine learning improves accuracy C_01.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const missingCitationCall = calls[1];
      
      expect(missingCitationCall).toBeDefined();
      if (missingCitationCall) {
        const decorations = missingCitationCall[1];
        expect(decorations.length).toBe(0);
      }
    });

    test('should not flag questions', () => {
      const text = 'What does research show about machine learning?';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const missingCitationCall = calls[1];
      
      if (missingCitationCall) {
        const decorations = missingCitationCall[1];
        expect(decorations.length).toBe(0);
      }
    });

    test('should skip very short sentences', () => {
      const text = 'Yes. No. Maybe.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      const calls = mockEditor.setDecorations.mock.calls;
      const vaguenessCall = calls[0];
      const missingCitationCall = calls[1];
      
      if (vaguenessCall) {
        expect(vaguenessCall[1].length).toBe(0);
      }
      if (missingCitationCall) {
        expect(missingCitationCall[1].length).toBe(0);
      }
    });
  });

  describe('Document filtering', () => {
    test('should only process markdown files', () => {
      const mockDocument = createTestDocument({
        text: 'Some code with many variables.',
        fsPath: '/workspace/03_Drafting/code.ts',
        languageId: 'typescript'
      });
      const nonMarkdownEditor = createTestEditor(mockDocument);

      decorator.activate(nonMarkdownEditor);

      expect(nonMarkdownEditor.setDecorations).not.toHaveBeenCalled();
    });

    test('should only process files in drafting directory', () => {
      const mockDocument = createTestDocument({
        text: 'Some notes with many items.',
        fsPath: '/workspace/01_Knowledge_Base/notes.md'
      });
      const outsideEditor = createTestEditor(mockDocument);

      decorator.activate(outsideEditor);

      // Verify no decorations were set (output verification)
      const calls = outsideEditor.setDecorations.mock.calls;
      expect(calls.length).toBe(0);
    });

    test('should process files in drafting directory', () => {
      const mockDocument = createTestDocument({
        text: 'Research shows significant improvements.',
        fsPath: '/workspace/03_Drafting/chapter.md'
      });
      const draftingEditor = createTestEditor(mockDocument);

      decorator.activate(draftingEditor);

      // Verify decorations were set (output verification)
      const calls = draftingEditor.setDecorations.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      const missingCitationCall = calls[1];
      
      if (missingCitationCall) {
        const decorations = missingCitationCall[1];
        expect(decorations.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Debouncing', () => {
    test('should debounce text changes', () => {
      jest.useFakeTimers();
      
      const text = 'Some text with many items.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      const mockEvent = {
        document: mockDocument,
        contentChanges: []
      } as any;

      decorator.onDidChangeTextDocument(mockEvent, mockEditor);
      decorator.onDidChangeTextDocument(mockEvent, mockEditor);
      decorator.onDidChangeTextDocument(mockEvent, mockEditor);

      // Verify no decorations set yet (debounce not triggered)
      let calls = mockEditor.setDecorations.mock.calls;
      expect(calls.length).toBe(0);

      jest.advanceTimersByTime(500);

      // Verify decorations were set after debounce
      calls = mockEditor.setDecorations.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      const vaguenessCall = calls[0];
      
      if (vaguenessCall) {
        const decorations = vaguenessCall[1];
        expect(decorations.length).toBeGreaterThan(0);
        
        decorations.forEach((d: any) => {
          expect(d.hoverMessage).toBeDefined();
          const message = d.hoverMessage.value || d.hoverMessage;
          expect(message).toContain('Vague term');
        });
      }
      
      jest.useRealTimers();
    });
  });

  describe('Claim suggestions', () => {
    test('should suggest relevant claims for unsupported statements', () => {
      const text = 'Machine learning models require large datasets for effective training.';
      const mockDocument = createTestDocument({
        text,
        fsPath: '/workspace/03_Drafting/manuscript.md'
      });
      mockEditor = createTestEditor(mockDocument);

      decorator.activate(mockEditor);

      // Verify decorations were set (output verification)
      const calls = mockEditor.setDecorations.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      const missingCitationCall = calls[1];
      
      if (missingCitationCall) {
        const decorations = missingCitationCall[1];
        expect(decorations.length).toBeGreaterThan(0);
        
        const decoration = decorations[0];
        const message = decoration.hoverMessage.value || decoration.hoverMessage;
        expect(message).toContain('C_01');
        expect(message).toContain('Machine learning models require large datasets');
      }
    });
  });

  describe('Cleanup', () => {
    test('should clear decorations', () => {
      decorator.clearDecorations(mockEditor);

      // Verify decorations were cleared (output verification)
      const calls = mockEditor.setDecorations.mock.calls;
      expect(calls.length).toBe(2);
      
      // Last call should be with empty array
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual([]);
    });

    test('should dispose resources', () => {
      decorator.dispose();
      
      expect(() => decorator.dispose()).not.toThrow();
    });
  });
});
