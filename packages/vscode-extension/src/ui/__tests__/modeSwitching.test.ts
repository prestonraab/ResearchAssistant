import { jest } from '@jest/globals';
import {
  modeStateManager,
  generateBreadcrumb,
  getBreadcrumbCss,
  getModeSwitchingJs,
  generateModeIndicator
} from '../modeSwitching';

describe('Mode Switching', () => {
  beforeEach(() => {
    modeStateManager.clearStates();
  });

  describe('ModeStateManager', () => {
    test('should save and retrieve state for a mode', () => {
      modeStateManager.saveState('writing', 100, 'section-1', 'section');
      const state = modeStateManager.getState('writing');

      expect(state).toBeDefined();
      expect(state?.mode).toBe('writing');
      expect(state?.scrollPosition).toBe(100);
      expect(state?.currentItemId).toBe('section-1');
      expect(state?.currentItemType).toBe('section');
    });

    test('should save state for multiple modes', () => {
      modeStateManager.saveState('writing', 100, 'section-1', 'section');
      modeStateManager.saveState('editing', 200, 'sentence-1', 'sentence');
      modeStateManager.saveState('review', 300, 'claim-1', 'claim');

      expect(modeStateManager.getState('writing')?.scrollPosition).toBe(100);
      expect(modeStateManager.getState('editing')?.scrollPosition).toBe(200);
      expect(modeStateManager.getState('review')?.scrollPosition).toBe(300);
    });

    test('should set and get current mode', () => {
      modeStateManager.setCurrentMode('writing');
      expect(modeStateManager.getCurrentMode()).toBe('writing');

      modeStateManager.setCurrentMode('editing');
      expect(modeStateManager.getCurrentMode()).toBe('editing');
    });

    test('should clear all states', () => {
      modeStateManager.saveState('writing', 100);
      modeStateManager.saveState('editing', 200);

      modeStateManager.clearStates();

      expect(modeStateManager.getState('writing')).toBeUndefined();
      expect(modeStateManager.getState('editing')).toBeUndefined();
    });

    test('should include timestamp in saved state', () => {
      const beforeTime = Date.now();
      modeStateManager.saveState('writing', 100);
      const afterTime = Date.now();

      const state = modeStateManager.getState('writing');
      expect(state?.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(state?.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('generateBreadcrumb', () => {
    test('should generate breadcrumb for writing mode', () => {
      const breadcrumb = generateBreadcrumb('writing');
      expect(breadcrumb).toContain('Writing');
      expect(breadcrumb).toContain('breadcrumb-item');
    });

    test('should include section in breadcrumb', () => {
      const breadcrumb = generateBreadcrumb('writing', 'Chapter 1');
      expect(breadcrumb).toContain('Chapter 1');
      expect(breadcrumb).toContain('>');
    });

    test('should include sentence in breadcrumb', () => {
      const breadcrumb = generateBreadcrumb('editing', 'Section 1', 'This is a sentence');
      expect(breadcrumb).toContain('Section 1');
      expect(breadcrumb).toContain('This is a sentence');
    });

    test('should truncate long sentences', () => {
      const longSentence = 'a'.repeat(100);
      const breadcrumb = generateBreadcrumb('editing', undefined, longSentence);
      expect(breadcrumb).toContain('...');
      expect(breadcrumb.length).toBeLessThan(longSentence.length + 50);
    });

    test('should work for all modes', () => {
      const modes: Array<'writing' | 'editing' | 'matching' | 'review'> = ['writing', 'editing', 'matching', 'review'];
      modes.forEach(mode => {
        const breadcrumb = generateBreadcrumb(mode);
        expect(breadcrumb).toBeTruthy();
        expect(breadcrumb).toContain('breadcrumb-item');
      });
    });
  });

  describe('getBreadcrumbCss', () => {
    test('should return CSS string', () => {
      const css = getBreadcrumbCss();
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    test('should include breadcrumb styles', () => {
      const css = getBreadcrumbCss();
      expect(css).toContain('.breadcrumb');
      expect(css).toContain('.breadcrumb-item');
      expect(css).toContain('.mode-indicator');
    });

    test('should include header styles', () => {
      const css = getBreadcrumbCss();
      expect(css).toContain('.header');
      expect(css).toContain('.controls');
      expect(css).toContain('.icon-btn');
    });
  });

  describe('getModeSwitchingJs', () => {
    test('should return JavaScript string', () => {
      const js = getModeSwitchingJs();
      expect(typeof js).toBe('string');
      expect(js.length).toBeGreaterThan(0);
    });

    test('should include keyboard event handling', () => {
      const js = getModeSwitchingJs();
      expect(js).toContain('keydown');
      expect(js).toContain('shiftKey');
    });

    test('should include mode switching shortcuts', () => {
      const js = getModeSwitchingJs();
      expect(js).toContain('switchToWritingMode');
      expect(js).toContain('switchToEditingMode');
      expect(js).toContain('switchToClaimReview');
    });

    test('should include scroll position saving', () => {
      const js = getModeSwitchingJs();
      expect(js).toContain('saveScrollPosition');
      expect(js).toContain('scrollY');
    });
  });

  describe('generateModeIndicator', () => {
    test('should generate indicator for writing mode', () => {
      const indicator = generateModeIndicator('writing');
      expect(indicator).toContain('Writing');
      expect(indicator).toContain('mode-indicator');
    });

    test('should generate indicator for editing mode', () => {
      const indicator = generateModeIndicator('editing');
      expect(indicator).toContain('Editing');
    });

    test('should generate indicator for matching mode', () => {
      const indicator = generateModeIndicator('matching');
      expect(indicator).toContain('Matching');
    });

    test('should generate indicator for review mode', () => {
      const indicator = generateModeIndicator('review');
      expect(indicator).toContain('Review');
    });

    test('should include mode-indicator class', () => {
      const modes: Array<'writing' | 'editing' | 'matching' | 'review'> = ['writing', 'editing', 'matching', 'review'];
      modes.forEach(mode => {
        const indicator = generateModeIndicator(mode);
        expect(indicator).toContain('mode-indicator');
      });
    });
  });
});
