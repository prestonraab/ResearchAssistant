import { QuickClaimExtractor } from '../core/quickClaimExtractor';
import { ClaimsManager } from '../core/claimsManager';
import { ClaimExtractor } from '../core/claimExtractor';
import { OutlineParser } from '../core/outlineParser';
import { EmbeddingService } from '../core/embeddingService';
import * as vscode from 'vscode';

// Mock vscode
jest.mock('vscode', () => ({
  window: {
    showInputBox: jest.fn(),
    showQuickPick: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    activeTextEditor: undefined
  },
  commands: {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
  },
  Uri: {
    file: jest.fn((path) => ({ fsPath: path }))
  },
  Range: jest.fn(),
  Position: jest.fn(),
  Selection: jest.fn()
}));

describe('QuickClaimExtractor', () => {
  let quickClaimExtractor: QuickClaimExtractor;
  let mockClaimsManager: jest.Mocked<ClaimsManager>;
  let mockClaimExtractor: jest.Mocked<ClaimExtractor>;
  let mockOutlineParser: jest.Mocked<OutlineParser>;
  let mockEmbeddingService: jest.Mocked<EmbeddingService>;
  const extractedTextPath = '/workspace/literature/ExtractedText';

  beforeEach(() => {
    // Create mocks
    mockClaimsManager = {
      saveClaim: jest.fn(),
      generateClaimId: jest.fn().mockReturnValue('C_01'),
      getClaims: jest.fn().mockReturnValue([])
    } as any;

    mockClaimExtractor = {
      categorizeClaim: jest.fn().mockReturnValue('method'),
      suggestSections: jest.fn().mockResolvedValue([
        { id: 'section1', title: 'Methods', level: 2, content: [], parent: null, children: [], lineStart: 0, lineEnd: 10 }
      ])
    } as any;

    mockOutlineParser = {
      parse: jest.fn().mockResolvedValue([
        { id: 'section1', title: 'Methods', level: 2, content: [], parent: null, children: [], lineStart: 0, lineEnd: 10 },
        { id: 'section2', title: 'Results', level: 2, content: [], parent: null, children: [], lineStart: 11, lineEnd: 20 }
      ])
    } as any;

    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
      cosineSimilarity: jest.fn().mockReturnValue(0.8)
    } as any;

    quickClaimExtractor = new QuickClaimExtractor(
      mockClaimsManager,
      mockClaimExtractor,
      mockOutlineParser,
      mockEmbeddingService,
      extractedTextPath
    );
  });

  describe('autoDetectSource', () => {
    it('should extract source from filename', () => {
      const mockDocument = {
        uri: { fsPath: '/workspace/literature/ExtractedText/Smith2023.txt' }
      } as any;

      const source = quickClaimExtractor.autoDetectSource(mockDocument);
      expect(source).toBe('Smith2023');
    });

    it('should handle different file extensions', () => {
      const mockDocument = {
        uri: { fsPath: '/workspace/literature/ExtractedText/Johnson2020.md' }
      } as any;

      const source = quickClaimExtractor.autoDetectSource(mockDocument);
      expect(source).toBe('Johnson2020');
    });

    it('should handle complex filenames', () => {
      const mockDocument = {
        uri: { fsPath: '/workspace/literature/ExtractedText/VanDerWaal2019.txt' }
      } as any;

      const source = quickClaimExtractor.autoDetectSource(mockDocument);
      expect(source).toBe('VanDerWaal2019');
    });
  });

  describe('autoDetectCategory', () => {
    it('should detect method category', () => {
      const text = 'We propose a new algorithm for batch correction';
      const category = quickClaimExtractor.autoDetectCategory(text);
      expect(category).toBe('Method');
      expect(mockClaimExtractor.categorizeClaim).toHaveBeenCalledWith(text);
    });

    it('should detect result category', () => {
      mockClaimExtractor.categorizeClaim.mockReturnValue('result');
      const text = 'Our results show a 95% accuracy improvement';
      const category = quickClaimExtractor.autoDetectCategory(text);
      expect(category).toBe('Result');
    });

    it('should detect challenge category', () => {
      mockClaimExtractor.categorizeClaim.mockReturnValue('challenge');
      const text = 'However, batch effects remain a significant challenge';
      const category = quickClaimExtractor.autoDetectCategory(text);
      expect(category).toBe('Challenge');
    });

    it('should default to Background for unknown types', () => {
      mockClaimExtractor.categorizeClaim.mockReturnValue('unknown' as any);
      const text = 'Some general statement';
      const category = quickClaimExtractor.autoDetectCategory(text);
      expect(category).toBe('Background');
    });
  });

  describe('suggestSections', () => {
    it('should suggest relevant sections using embeddings', async () => {
      const text = 'We developed a new batch correction method';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      expect(sections).toEqual(['section1']);
      expect(mockOutlineParser.parse).toHaveBeenCalled();
      expect(mockClaimExtractor.suggestSections).toHaveBeenCalledWith(text, expect.any(Array));
    });

    it('should return empty array if no sections available', async () => {
      mockOutlineParser.parse.mockResolvedValue([]);
      const text = 'Some claim text';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      expect(sections).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockOutlineParser.parse.mockRejectedValue(new Error('Parse error'));
      const text = 'Some claim text';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      expect(sections).toEqual([]);
    });

    it('should return top 3 sections at most', async () => {
      const allSections = [
        { id: 'section1', title: 'Methods', level: 2, content: [], parent: null, children: [], lineStart: 0, lineEnd: 10 },
        { id: 'section2', title: 'Results', level: 2, content: [], parent: null, children: [], lineStart: 11, lineEnd: 20 },
        { id: 'section3', title: 'Discussion', level: 2, content: [], parent: null, children: [], lineStart: 21, lineEnd: 30 },
        { id: 'section4', title: 'Conclusion', level: 2, content: [], parent: null, children: [], lineStart: 31, lineEnd: 40 }
      ];
      
      mockOutlineParser.parse.mockResolvedValue(allSections);
      // suggestSections returns top 3 from ClaimExtractor
      mockClaimExtractor.suggestSections.mockResolvedValue(allSections.slice(0, 3));

      const text = 'Some claim text';
      const sections = await quickClaimExtractor.suggestSections(text);
      
      expect(sections.length).toBeLessThanOrEqual(3);
    });
  });

  describe('saveAndVerify', () => {
    it('should save claim to database', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Smith2023',
        sourceId: 1,
        context: '',
        primaryQuote: 'Test quote',
        supportingQuotes: [],
        sections: ['section1'],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      await quickClaimExtractor.saveAndVerify(claim);

      expect(mockClaimsManager.saveClaim).toHaveBeenCalledWith(claim);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
        'Claim C_01 saved successfully',
        'View Claim'
      );
    });

    it('should handle save errors', async () => {
      const claim = {
        id: 'C_01',
        text: 'Test claim',
        category: 'Method',
        source: 'Smith2023',
        sourceId: 1,
        context: '',
        primaryQuote: 'Test quote',
        supportingQuotes: [],
        sections: [],
        verified: false,
        createdAt: new Date(),
        modifiedAt: new Date()
      };

      mockClaimsManager.saveClaim.mockRejectedValue(new Error('Save failed'));

      await quickClaimExtractor.saveAndVerify(claim);

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to save claim')
      );
    });
  });

  describe('registerCommands', () => {
    it('should register quickExtractClaim command', () => {
      // Mock registerCommand to return a disposable
      (vscode.commands.registerCommand as jest.Mock).mockReturnValue({
        dispose: jest.fn()
      });
      
      const disposables = quickClaimExtractor.registerCommands();
      
      expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
        'researchAssistant.quickExtractClaim',
        expect.any(Function)
      );
      expect(disposables.length).toBeGreaterThan(0);
    });
  });

  describe('extractFromSelection - validation', () => {
    it('should warn if no active editor', async () => {
      (vscode.window as any).activeTextEditor = undefined;

      await quickClaimExtractor.extractFromSelection();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith('No active editor');
    });

    it('should warn if not in ExtractedText file', async () => {
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: { fsPath: '/workspace/manuscript.md' }
        },
        selection: { isEmpty: false }
      };

      await quickClaimExtractor.extractFromSelection();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Quick Extract Claim is only available for ExtractedText files'
      );
    });

    it('should warn if selection is empty', async () => {
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: { fsPath: '/workspace/literature/ExtractedText/Smith2023.txt' },
          getText: jest.fn()
        },
        selection: { isEmpty: true }
      };

      await quickClaimExtractor.extractFromSelection();

      expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
        'Please select text to extract as a claim'
      );
    });
  });

  describe('Integration - full workflow', () => {
    it('should complete full extraction workflow', async () => {
      const selectedText = 'We developed a novel batch correction algorithm';
      
      (vscode.window as any).activeTextEditor = {
        document: {
          uri: { fsPath: '/workspace/literature/ExtractedText/Smith2023.txt' },
          getText: jest.fn().mockReturnValue(selectedText)
        },
        selection: { isEmpty: false }
      };

      // Mock user inputs
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(selectedText);
      (vscode.window.showQuickPick as jest.Mock).mockResolvedValue({ action: 'save' });
      (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

      await quickClaimExtractor.extractFromSelection();

      expect(mockClaimsManager.saveClaim).toHaveBeenCalled();
      const savedClaim = (mockClaimsManager.saveClaim as jest.Mock).mock.calls[0][0];
      expect(savedClaim.text).toBe(selectedText);
      expect(savedClaim.source).toBe('Smith2023');
      expect(savedClaim.category).toBe('Method');
    });
  });
});
