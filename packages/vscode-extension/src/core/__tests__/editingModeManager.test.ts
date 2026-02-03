import { jest } from '@jest/globals';
import { EditingModeManager } from '../editingModeManager';
import { setupTest } from '../../__tests__/helpers';

describe('EditingModeManager', () => {
  setupTest();
  
  let manager: EditingModeManager;

  beforeEach(() => {
    manager = new EditingModeManager();
  });

  describe('initialization', () => {
    test('should not be initialized by default', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    test('should initialize state', () => {
      const state = manager.initializeState();

      expect(state).toBeDefined();
      expect(state.expandedClaims.size).toBe(0);
      expect(state.selectedSentences.size).toBe(0);
    });

    test('should be initialized after initialization', () => {
      manager.initializeState();
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('current sentence', () => {
    beforeEach(() => {
      manager.initializeState();
    });

    test('should set current sentence', () => {
      manager.setCurrentSentence('S_1');
      expect(manager.getCurrentSentence()).toBe('S_1');
    });

    test('should return undefined if not set', () => {
      expect(manager.getCurrentSentence()).toBeUndefined();
    });
  });

  describe('current claim', () => {
    beforeEach(() => {
      manager.initializeState();
    });

    test('should set current claim', () => {
      manager.setCurrentClaim('C_1');
      expect(manager.getCurrentClaim()).toBe('C_1');
    });

    test('should return undefined if not set', () => {
      expect(manager.getCurrentClaim()).toBeUndefined();
    });
  });

  describe('claim expansion', () => {
    beforeEach(() => {
      manager.initializeState();
    });

    test('should toggle claim expansion', () => {
      expect(manager.isClaimExpanded('S_1')).toBe(false);

      manager.toggleClaimExpansion('S_1');
      expect(manager.isClaimExpanded('S_1')).toBe(true);

      manager.toggleClaimExpansion('S_1');
      expect(manager.isClaimExpanded('S_1')).toBe(false);
    });

    test('should expand multiple sentences independently', () => {
      manager.toggleClaimExpansion('S_1');
      manager.toggleClaimExpansion('S_2');

      expect(manager.isClaimExpanded('S_1')).toBe(true);
      expect(manager.isClaimExpanded('S_2')).toBe(true);
      expect(manager.isClaimExpanded('S_3')).toBe(false);
    });

    test('should collapse all claims', () => {
      manager.toggleClaimExpansion('S_1');
      manager.toggleClaimExpansion('S_2');

      manager.collapseAllClaims();

      expect(manager.isClaimExpanded('S_1')).toBe(false);
      expect(manager.isClaimExpanded('S_2')).toBe(false);
    });
  });

  describe('sentence selection', () => {
    beforeEach(() => {
      manager.initializeState();
    });

    test('should select a sentence', () => {
      manager.selectSentence('S_1');
      expect(manager.getSelectedSentences()).toContain('S_1');
    });

    test('should deselect a sentence', () => {
      manager.selectSentence('S_1');
      manager.deselectSentence('S_1');
      expect(manager.getSelectedSentences()).not.toContain('S_1');
    });

    test('should toggle sentence selection', () => {
      manager.toggleSentenceSelection('S_1');
      expect(manager.getSelectedSentences()).toContain('S_1');

      manager.toggleSentenceSelection('S_1');
      expect(manager.getSelectedSentences()).not.toContain('S_1');
    });

    test('should select multiple sentences', () => {
      manager.selectSentence('S_1');
      manager.selectSentence('S_2');
      manager.selectSentence('S_3');

      const selected = manager.getSelectedSentences();
      expect(selected).toHaveLength(3);
      expect(selected).toContain('S_1');
      expect(selected).toContain('S_2');
      expect(selected).toContain('S_3');
    });

    test('should not duplicate selections', () => {
      manager.selectSentence('S_1');
      manager.selectSentence('S_1');

      expect(manager.getSelectedSentences()).toHaveLength(1);
    });

    test('should clear selection', () => {
      manager.selectSentence('S_1');
      manager.selectSentence('S_2');

      manager.clearSelection();

      expect(manager.getSelectedSentences()).toHaveLength(0);
    });
  });

  describe('scroll position', () => {
    beforeEach(() => {
      manager.initializeState();
    });

    test('should save center item position', () => {
      manager.saveCenterItemId('item-1', 100);
      expect(manager.getCenterItemPosition()).toBe(100);
    });

    test('should return undefined by default', () => {
      expect(manager.getCenterItemPosition()).toBeUndefined();
    });

    test('should handle large positions', () => {
      manager.saveCenterItemId('item-1', 999999);
      expect(manager.getCenterItemPosition()).toBe(999999);
    });
  });

  describe('clearState', () => {
    test('should clear state', () => {
      manager.initializeState();
      manager.clearState();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getState()).toBeNull();
    });

    test('should allow re-initialization after clear', () => {
      manager.initializeState();
      manager.clearState();
      manager.initializeState();

      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('complex scenarios', () => {
    beforeEach(() => {
      manager.initializeState();
    });

    test('should handle mixed operations', () => {
      manager.setCurrentSentence('S_1');
      manager.setCurrentClaim('C_1');
      manager.selectSentence('S_1');
      manager.selectSentence('S_2');
      manager.toggleClaimExpansion('S_1');
      manager.saveCenterItemId('item-1', 150);

      expect(manager.getCurrentSentence()).toBe('S_1');
      expect(manager.getCurrentClaim()).toBe('C_1');
      expect(manager.getSelectedSentences()).toHaveLength(2);
      expect(manager.isClaimExpanded('S_1')).toBe(true);
      expect(manager.getCenterItemPosition()).toBe(150);
    });

    test('should maintain state consistency', () => {
      manager.selectSentence('S_1');
      manager.toggleClaimExpansion('S_1');
      manager.setCurrentSentence('S_1');

      const state = manager.getState();
      expect(state?.selectedSentences.has('S_1')).toBe(true);
      expect(state?.expandedClaims.has('S_1')).toBe(true);
      expect(state?.currentSentenceId).toBe('S_1');
    });
  });

  describe('edge cases', () => {
    test('should handle operations on uninitialized manager', () => {
      expect(() => {
        manager.setCurrentSentence('S_1');
      }).not.toThrow();

      expect(manager.getCurrentSentence()).toBeUndefined();
    });

    test('should handle empty selections', () => {
      expect(manager.getSelectedSentences()).toEqual([]);
    });

    test('should handle negative position', () => {
      manager.initializeState();
      manager.saveCenterItemId('item-1', -100);
      expect(manager.getCenterItemPosition()).toBe(-100);
    });
  });
});
