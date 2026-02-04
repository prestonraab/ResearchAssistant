import { jest } from '@jest/globals';
import { WritingModeManager } from '../writingModeManager';

describe('WritingModeManager', () => {
  let manager: WritingModeManager;

  beforeEach(() => {
    manager = new WritingModeManager();
  });

  describe('initialization', () => {
    test('should not be initialized by default', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    test('should initialize state', () => {
      const state = manager.initializeState('manuscript.md', 'outline.md');

      expect(state).toBeDefined();
      expect(state.manuscriptPath).toBe('manuscript.md');
      expect(state.outlinePath).toBe('outline.md');
      expect(state.centerItemPosition).toBeUndefined();
    });

    test('should be initialized after initialization', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('getState', () => {
    test('should return null when not initialized', () => {
      expect(manager.getState()).toBeNull();
    });

    test('should return state when initialized', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      const state = manager.getState();

      expect(state).not.toBeNull();
      expect(state?.manuscriptPath).toBe('manuscript.md');
    });
  });

  describe('current section', () => {
    beforeEach(() => {
      manager.initializeState('manuscript.md', 'outline.md');
    });

    test('should set current section', () => {
      manager.setCurrentSection('section_1');
      expect(manager.getCurrentSection()).toBe('section_1');
    });

    test('should return undefined if not set', () => {
      expect(manager.getCurrentSection()).toBeUndefined();
    });

    test('should update timestamp on section change', () => {
      manager.setCurrentSection('section_1');
      const state1 = manager.getState();

      // Small delay to ensure timestamp difference
      setTimeout(() => {
        manager.setCurrentSection('section_2');
        const state2 = manager.getState();

        expect(state2!.lastUpdated.getTime()).toBeGreaterThanOrEqual(state1!.lastUpdated.getTime());
      }, 10);
    });
  });

  describe('center item tracking', () => {
    beforeEach(() => {
      manager.initializeState('manuscript.md', 'outline.md');
    });

    test('should save and retrieve center item ID', () => {
      manager.saveCenterItemId('item-123', 100);
      expect(manager.getCenterItemId()).toBe('item-123');
      expect(manager.getCenterItemPosition()).toBe(100);
    });

    test('should return undefined by default', () => {
      expect(manager.getCenterItemId()).toBeUndefined();
      expect(manager.getCenterItemPosition()).toBeUndefined();
    });

    test('should update timestamp on center item change', () => {
      manager.saveCenterItemId('item-1', 100);
      const state1 = manager.getState();

      setTimeout(() => {
        manager.saveCenterItemId('item-2', 200);
        const state2 = manager.getState();

        expect(state2!.lastUpdated.getTime()).toBeGreaterThanOrEqual(state1!.lastUpdated.getTime());
      }, 10);
    });
  });

  describe('clearState', () => {
    test('should clear state', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      manager.clearState();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getState()).toBeNull();
    });

    test('should allow re-initialization after clear', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      manager.clearState();
      manager.initializeState('new.md', 'new_outline.md');

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getState()?.manuscriptPath).toBe('new.md');
    });
  });

  describe('edge cases', () => {
    test('should handle operations on uninitialized manager', () => {
      expect(() => {
        manager.setCurrentSection('section_1');
      }).not.toThrow();

      expect(manager.getCurrentSection()).toBeUndefined();
    });

    test('should handle empty paths', () => {
      const state = manager.initializeState('', '');
      expect(state.manuscriptPath).toBe('');
      expect(state.outlinePath).toBe('');
    });
  });
});
