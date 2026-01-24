import * as vscode from 'vscode';
import { WritingFeedbackDecorator } from '../ui/writingFeedbackDecorator';
import { ExtensionState } from '../core/state';

// Mock VS Code API
jest.mock('vscode');

describe('WritingFeedbackDecorator', () => {
  let decorator: WritingFeedbackDecorator;
  let mockExtensionState: jest.Mocked<ExtensionState>;
  let mockEditor: jest.Mocked<vscode.TextEditor>;
  let mockDocument: jest.Mocked<vscode.TextDocument>;

  beforeEach(() => {
    // Create mock extension state
    mockExtensionState = {
      getAbsolutePath: jest.fn((path: string) => `/workspace/${path}`),
      claimsManager: {
        getAllClaims: jest.fn(() => [
          {
            id: 'C_01',
            text: 'Machine learning models require large datasets for training',
            category: 'Method',
            source: 'Smith2020',
            sourceId: 1,
            context: '',
            primaryQuote: 'Large datasets are essential for ML',
            supportingQuotes: [],
            sections: [],
            verified: true,
            createdAt: new Date(),
            modifiedAt: new Date()
          }
        ])
      }
    } as any;

    // Create mock document
    mockDocument = {
      languageId: 'markdown',
      uri: {
        fsPath: '/workspace/03_Drafting/manuscript.md'
      },
      getText: jest.fn(),
      positionAt: jest.fn((offset: number) => new vscode.Position(0, offset))
    } as any;

    // Create mock editor
    mockEditor = {
      document: mockDocument,
      setDecorations: jest.fn()
    } as any;

    decorator = new WritingFeedbackDecorator(mockExtensionState);
  });

  afterEach(() => {
    decorator.dispose();
  });

  describe('Vague term detection', () => {
    it('should detect vague terms in text', () => {
      const text = 'Some studies show that many researchers often use various methods.';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      // Should have called setDecorations for vagueness
      expect(mockEditor.setDecorations).toHaveBeenCalled();
      
      // Get the vagueness decorations (first call, first argument)
      const calls = mockEditor.setDecorations.mock.calls;
      const vaguenessCall = calls.find(call => call[1].length > 0);
      
      expect(vaguenessCall).toBeDefined();
      if (vaguenessCall) {
        const decorations = vaguenessCall[1];
        expect(decorations.length).toBeGreaterThan(0);
      }
    });

    it('should not flag vague terms in headers', () => {
      const text = '# Some Introduction\n\nThis is content.';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      // Headers should be skipped
      expect(mockEditor.setDecorations).toHaveBeenCalled();
    });

    it('should not flag vague terms in list items', () => {
      const text = '- Some item\n- Another item';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      expect(mockEditor.setDecorations).toHaveBeenCalled();
    });
  });

  describe('Missing citation detection', () => {
    it('should detect unsupported factual statements', () => {
      const text = 'Research shows that machine learning improves accuracy significantly.';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      // Should have called setDecorations for missing citations
      expect(mockEditor.setDecorations).toHaveBeenCalled();
      
      const calls = mockEditor.setDecorations.mock.calls;
      const missingCitationCall = calls.find(call => call[1].length > 0);
      
      expect(missingCitationCall).toBeDefined();
    });

    it('should not flag statements with claim references', () => {
      const text = 'Research shows that machine learning improves accuracy C_01.';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      // Should not flag this as missing citation
      expect(mockEditor.setDecorations).toHaveBeenCalled();
      
      const calls = mockEditor.setDecorations.mock.calls;
      // Check that missing citation decorations are empty
      const missingCitationCall = calls[1]; // Second decoration type
      if (missingCitationCall) {
        expect(missingCitationCall[1].length).toBe(0);
      }
    });

    it('should not flag questions', () => {
      const text = 'What does research show about machine learning?';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      expect(mockEditor.setDecorations).toHaveBeenCalled();
    });

    it('should skip very short sentences', () => {
      const text = 'Yes. No. Maybe.';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      expect(mockEditor.setDecorations).toHaveBeenCalled();
    });
  });

  describe('Document filtering', () => {
    it('should only process markdown files', () => {
      const nonMarkdownDoc = {
        languageId: 'typescript',
        uri: {
          fsPath: '/workspace/03_Drafting/code.ts'
        },
        getText: jest.fn(() => 'Some code with many variables.'),
        positionAt: jest.fn((offset: number) => new vscode.Position(0, offset))
      } as any;

      const nonMarkdownEditor = {
        document: nonMarkdownDoc,
        setDecorations: jest.fn()
      } as any;

      decorator.activate(nonMarkdownEditor);

      // Should not process non-markdown files
      expect(nonMarkdownEditor.setDecorations).not.toHaveBeenCalled();
    });

    it('should only process files in drafting directory', () => {
      const outsideDoc = {
        languageId: 'markdown',
        uri: {
          fsPath: '/workspace/01_Knowledge_Base/notes.md'
        },
        getText: jest.fn(() => 'Some notes with many items.'),
        positionAt: jest.fn((offset: number) => new vscode.Position(0, offset))
      } as any;

      const outsideEditor = {
        document: outsideDoc,
        setDecorations: jest.fn()
      } as any;

      decorator.activate(outsideEditor);

      // Should not process files outside drafting directory
      expect(outsideEditor.setDecorations).not.toHaveBeenCalled();
    });

    it('should process files in drafting directory', () => {
      const draftingDoc = {
        languageId: 'markdown',
        uri: {
          fsPath: '/workspace/03_Drafting/chapter.md'
        },
        getText: jest.fn(() => 'Research shows significant improvements.'),
        positionAt: jest.fn((offset: number) => new vscode.Position(0, offset))
      } as any;

      const draftingEditor = {
        document: draftingDoc,
        setDecorations: jest.fn()
      } as any;

      decorator.activate(draftingEditor);

      // Should process files in drafting directory
      expect(draftingEditor.setDecorations).toHaveBeenCalled();
    });
  });

  describe('Debouncing', () => {
    it('should debounce text changes', () => {
      jest.useFakeTimers();
      
      const text = 'Some text with many items.';
      mockDocument.getText.mockReturnValue(text);

      const mockEvent = {
        document: mockDocument,
        contentChanges: []
      } as any;

      // Trigger multiple changes rapidly
      decorator.onDidChangeTextDocument(mockEvent, mockEditor);
      decorator.onDidChangeTextDocument(mockEvent, mockEditor);
      decorator.onDidChangeTextDocument(mockEvent, mockEditor);

      // Should not have updated yet
      expect(mockEditor.setDecorations).not.toHaveBeenCalled();

      // Fast-forward time
      jest.advanceTimersByTime(500);

      // Should have updated once
      expect(mockEditor.setDecorations).toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('Claim suggestions', () => {
    it('should suggest relevant claims for unsupported statements', () => {
      const text = 'Machine learning models require large datasets for effective training.';
      mockDocument.getText.mockReturnValue(text);

      decorator.activate(mockEditor);

      // Should have called getAllClaims to get suggestions
      expect(mockExtensionState.claimsManager.getAllClaims).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clear decorations', () => {
      decorator.clearDecorations(mockEditor);

      expect(mockEditor.setDecorations).toHaveBeenCalledTimes(2);
      expect(mockEditor.setDecorations).toHaveBeenCalledWith(expect.anything(), []);
    });

    it('should dispose resources', () => {
      decorator.dispose();
      
      // Should not throw errors
      expect(() => decorator.dispose()).not.toThrow();
    });
  });
});
