import { modeStateManager } from '../modeSwitching';

describe('Mode Switching Integration', () => {
  beforeEach(() => {
    modeStateManager.clearStates();
  });

  describe('State Preservation', () => {
    test('should preserve scroll position when switching modes', () => {
      // Save state for writing mode
      modeStateManager.saveState('writing', 500, 'section-1', 'section');
      
      // Switch to editing mode
      modeStateManager.setCurrentMode('editing');
      modeStateManager.saveState('editing', 200, 'sentence-1', 'sentence');
      
      // Switch back to writing mode
      modeStateManager.setCurrentMode('writing');
      const writingState = modeStateManager.getState('writing');
      
      expect(writingState?.scrollPosition).toBe(500);
    });

    test('should preserve current item when switching modes', () => {
      // Save state with current item
      modeStateManager.saveState('editing', 100, 'sentence-42', 'sentence');
      
      // Switch to review mode
      modeStateManager.setCurrentMode('review');
      modeStateManager.saveState('review', 150, 'claim-10', 'claim');
      
      // Switch back to editing mode
      modeStateManager.setCurrentMode('editing');
      const editingState = modeStateManager.getState('editing');
      
      expect(editingState?.currentItemId).toBe('sentence-42');
      expect(editingState?.currentItemType).toBe('sentence');
    });

    test('should handle rapid mode switching', () => {
      const modes: Array<'writing' | 'editing' | 'matching' | 'review'> = ['writing', 'editing', 'matching', 'review'];
      const itemTypes: Array<'sentence' | 'claim' | 'section'> = ['sentence', 'claim', 'section'];
      
      // Rapidly switch between modes
      modes.forEach((mode, index) => {
        modeStateManager.setCurrentMode(mode);
        modeStateManager.saveState(mode, index * 100, `item-${index}`, itemTypes[index % 3]);
      });
      
      // Verify all states are preserved
      modes.forEach((mode, index) => {
        const state = modeStateManager.getState(mode);
        expect(state?.scrollPosition).toBe(index * 100);
        expect(state?.currentItemId).toBe(`item-${index}`);
      });
    });

    test('should restore state when returning to mode', () => {
      // Initial state
      modeStateManager.saveState('writing', 250, 'section-5', 'section');
      
      // Switch away and back
      modeStateManager.setCurrentMode('editing');
      modeStateManager.saveState('editing', 100, 'sentence-1', 'sentence');
      
      modeStateManager.setCurrentMode('writing');
      const restoredState = modeStateManager.getState('writing');
      
      expect(restoredState?.scrollPosition).toBe(250);
      expect(restoredState?.currentItemId).toBe('section-5');
    });
  });

  describe('Mode Switching Sequence', () => {
    test('should handle writing -> editing -> review sequence', () => {
      // Writing mode
      modeStateManager.setCurrentMode('writing');
      modeStateManager.saveState('writing', 100, 'section-1', 'section');
      
      // Editing mode
      modeStateManager.setCurrentMode('editing');
      modeStateManager.saveState('editing', 200, 'sentence-1', 'sentence');
      
      // Review mode
      modeStateManager.setCurrentMode('review');
      modeStateManager.saveState('review', 300, 'claim-1', 'claim');
      
      // Verify all states
      expect(modeStateManager.getState('writing')?.scrollPosition).toBe(100);
      expect(modeStateManager.getState('editing')?.scrollPosition).toBe(200);
      expect(modeStateManager.getState('review')?.scrollPosition).toBe(300);
    });

    test('should handle editing -> matching -> editing sequence', () => {
      // Editing mode
      modeStateManager.setCurrentMode('editing');
      modeStateManager.saveState('editing', 150, 'sentence-5', 'sentence');
      
      // Matching mode
      modeStateManager.setCurrentMode('matching');
      modeStateManager.saveState('matching', 50, 'sentence-5', 'sentence');
      
      // Back to editing
      modeStateManager.setCurrentMode('editing');
      const editingState = modeStateManager.getState('editing');
      
      expect(editingState?.scrollPosition).toBe(150);
      expect(editingState?.currentItemId).toBe('sentence-5');
    });
  });

  describe('State Consistency', () => {
    test('should maintain consistent state across multiple saves', () => {
      const mode = 'editing';
      const itemTypes: Array<'sentence' | 'claim' | 'section'> = ['sentence', 'claim', 'section'];
      
      // Multiple saves to same mode
      modeStateManager.saveState(mode, 100, 'item-1', itemTypes[0]);
      modeStateManager.saveState(mode, 200, 'item-2', itemTypes[1]);
      modeStateManager.saveState(mode, 300, 'item-3', itemTypes[2]);
      
      // Last save should be the current state
      const state = modeStateManager.getState(mode);
      expect(state?.scrollPosition).toBe(300);
      expect(state?.currentItemId).toBe('item-3');
    });

    test('should include timestamp for each state', () => {
      modeStateManager.saveState('writing', 100);
      const state = modeStateManager.getState('writing');
      
      expect(state?.timestamp).toBeDefined();
      expect(typeof state?.timestamp).toBe('number');
      expect(state?.timestamp).toBeGreaterThan(0);
    });

    test('should handle undefined scroll position', () => {
      modeStateManager.saveState('editing', 0, 'item-1', 'item' as any);
      const state = modeStateManager.getState('editing');
      
      expect(state?.currentItemId).toBe('item-1');
      expect(state?.scrollPosition).toBe(0);
    });
  });
});
