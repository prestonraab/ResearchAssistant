import { describe, it, expect, beforeEach } from '@jest/globals';
import { EditingModeProvider } from '../ui/editingModeProvider';

/**
 * Unit tests for orphan citation suggestion generation, acceptance, and dismissal
 * Requirements: 2.1, 2.2, 2.3
 */
describe('Orphan Citation Suggestions', () => {
  let mockExtensionState: any;
  let mockContext: any;
  let editingModeProvider: any;

  beforeEach(() => {
    // Mock ExtensionState
    mockExtensionState = {
      claimsManager: {
        getClaim: () => null,
        saveClaim: async () => {},
        updateClaim: async () => {},
        getAllClaims: () => [],
        onDidChange: () => ({ dispose: () => {} })
      },
      getWorkspaceRoot: () => '/workspace',
      getAbsolutePath: (path: string) => `/workspace/${path}`
    };

    // Mock ExtensionContext
    mockContext = {
      extensionUri: { fsPath: '/extension' },
      workspaceState: {
        get: () => undefined,
        update: async () => {}
      }
    };

    // Create provider
    editingModeProvider = new EditingModeProvider(mockExtensionState, mockContext);
  });

  describe('generateSuggestionText', () => {
    it('should generate singular suggestion text for one orphan', () => {
      const text = editingModeProvider['generateSuggestionText'](
        'Test sentence',
        ['Johnson2007']
      );

      expect(text).toContain('Johnson2007');
      expect(text).toContain('has no supporting quote');
      expect(text).not.toContain('quotes');
    });

    it('should generate plural suggestion text for multiple orphans', () => {
      const text = editingModeProvider['generateSuggestionText'](
        'Test sentence',
        ['Johnson2007', 'Smith2020']
      );

      expect(text).toContain('Johnson2007, Smith2020');
      expect(text).toContain('has no supporting quotes');
    });
  });

  describe('dismissOrphanSuggestion', () => {
    it('should track dismissed suggestion in session', async () => {
      const suggestionId = 'S_0';

      await editingModeProvider.dismissOrphanSuggestion(suggestionId);

      expect(editingModeProvider['dismissedSuggestions'].has(suggestionId)).toBe(true);
    });

    it('should preserve underlying data when dismissing', async () => {
      const claimId = 'C_001';
      editingModeProvider['sentences'] = [
        {
          id: 'S_0',
          text: 'Test sentence',
          originalText: 'Test sentence',
          claims: [claimId],
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const sentenceBefore = JSON.stringify(editingModeProvider['sentences'][0]);

      await editingModeProvider.dismissOrphanSuggestion('S_0');

      const sentenceAfter = JSON.stringify(editingModeProvider['sentences'][0]);

      // Verify sentence data is unchanged
      expect(sentenceBefore).toBe(sentenceAfter);
    });

    it('should not affect other suggestions when dismissing one', async () => {
      editingModeProvider['dismissedSuggestions'].add('S_0');

      await editingModeProvider.dismissOrphanSuggestion('S_1');

      expect(editingModeProvider['dismissedSuggestions'].has('S_0')).toBe(true);
      expect(editingModeProvider['dismissedSuggestions'].has('S_1')).toBe(true);
    });
  });

  describe('getOrphanCitationSuggestions', () => {
    it('should return empty array when no sentences exist', async () => {
      editingModeProvider['sentences'] = [];

      const suggestions = await editingModeProvider.getOrphanCitationSuggestions();

      expect(suggestions).toEqual([]);
    });

    it('should return empty array when mapper is not initialized', async () => {
      editingModeProvider['sentences'] = [
        {
          id: 'S_0',
          text: 'Test sentence',
          originalText: 'Test sentence',
          claims: [],
          position: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      editingModeProvider['citationSourceMapper'] = null;

      const suggestions = await editingModeProvider.getOrphanCitationSuggestions();

      expect(suggestions).toEqual([]);
    });
  });
});
