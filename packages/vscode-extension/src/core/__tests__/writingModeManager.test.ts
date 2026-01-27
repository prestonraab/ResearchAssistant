import { WritingModeManager } from '../writingModeManager';

describe('WritingModeManager', () => {
  let manager: WritingModeManager;

  beforeEach(() => {
    manager = new WritingModeManager();
  });

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    it('should initialize state', () => {
      const state = manager.initializeState('manuscript.md', 'outline.md');

      expect(state).toBeDefined();
      expect(state.manuscriptPath).toBe('manuscript.md');
      expect(state.outlinePath).toBe('outline.md');
      expect(state.scrollPosition).toBe(0);
    });

    it('should be initialized after initialization', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('getState', () => {
    it('should return null when not initialized', () => {
      expect(manager.getState()).toBeNull();
    });

    it('should return state when initialized', () => {
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

    it('should set current section', () => {
      manager.setCurrentSection('section_1');
      expect(manager.getCurrentSection()).toBe('section_1');
    });

    it('should return undefined if not set', () => {
      expect(manager.getCurrentSection()).toBeUndefined();
    });

    it('should update timestamp on section change', () => {
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

  describe('scroll position', () => {
    beforeEach(() => {
      manager.initializeState('manuscript.md', 'outline.md');
    });

    it('should save scroll position', () => {
      manager.saveScrollPosition(100);
      expect(manager.getScrollPosition()).toBe(100);
    });

    it('should return 0 by default', () => {
      expect(manager.getScrollPosition()).toBe(0);
    });

    it('should handle large scroll positions', () => {
      manager.saveScrollPosition(999999);
      expect(manager.getScrollPosition()).toBe(999999);
    });

    it('should update timestamp on scroll', () => {
      manager.saveScrollPosition(100);
      const state1 = manager.getState();

      setTimeout(() => {
        manager.saveScrollPosition(200);
        const state2 = manager.getState();

        expect(state2!.lastUpdated.getTime()).toBeGreaterThanOrEqual(state1!.lastUpdated.getTime());
      }, 10);
    });
  });

  describe('clearState', () => {
    it('should clear state', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      manager.clearState();

      expect(manager.isInitialized()).toBe(false);
      expect(manager.getState()).toBeNull();
    });

    it('should allow re-initialization after clear', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      manager.clearState();
      manager.initializeState('new.md', 'new_outline.md');

      expect(manager.isInitialized()).toBe(true);
      expect(manager.getState()?.manuscriptPath).toBe('new.md');
    });
  });

  describe('edge cases', () => {
    it('should handle operations on uninitialized manager', () => {
      expect(() => {
        manager.setCurrentSection('section_1');
      }).not.toThrow();

      expect(manager.getCurrentSection()).toBeUndefined();
    });

    it('should handle empty paths', () => {
      const state = manager.initializeState('', '');
      expect(state.manuscriptPath).toBe('');
      expect(state.outlinePath).toBe('');
    });

    it('should handle negative scroll position', () => {
      manager.initializeState('manuscript.md', 'outline.md');
      manager.saveScrollPosition(-100);
      expect(manager.getScrollPosition()).toBe(-100);
    });
  });
});
