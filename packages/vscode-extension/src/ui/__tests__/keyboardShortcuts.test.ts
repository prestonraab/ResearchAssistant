import { jest } from '@jest/globals';
import {
  getShortcutsForMode,
  generateHelpOverlayHtml,
  getHelpOverlayCss,
  getHelpOverlayJs,
  GLOBAL_SHORTCUTS,
  WRITING_MODE_SHORTCUTS,
  EDITING_MODE_SHORTCUTS,
  CLAIM_MATCHING_SHORTCUTS,
  CLAIM_REVIEW_SHORTCUTS
} from '../keyboardShortcuts';

describe('Keyboard Shortcuts', () => {
  describe('getShortcutsForMode', () => {
    test('should return writing mode shortcuts', () => {
      const shortcuts = getShortcutsForMode('writing');
      expect(shortcuts).toEqual(WRITING_MODE_SHORTCUTS);
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    test('should return editing mode shortcuts', () => {
      const shortcuts = getShortcutsForMode('editing');
      expect(shortcuts).toEqual(EDITING_MODE_SHORTCUTS);
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    test('should return claim matching shortcuts', () => {
      const shortcuts = getShortcutsForMode('matching');
      expect(shortcuts).toEqual(CLAIM_MATCHING_SHORTCUTS);
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    test('should return claim review shortcuts', () => {
      const shortcuts = getShortcutsForMode('review');
      expect(shortcuts).toEqual(CLAIM_REVIEW_SHORTCUTS);
      expect(shortcuts.length).toBeGreaterThan(0);
    });

    test('should return global shortcuts for unknown mode', () => {
      const shortcuts = getShortcutsForMode('unknown' as any);
      expect(shortcuts).toEqual([GLOBAL_SHORTCUTS]);
    });
  });

  describe('generateHelpOverlayHtml', () => {
    test('should generate HTML for writing mode', () => {
      const html = generateHelpOverlayHtml('writing');
      expect(html).toContain('help-overlay');
      expect(html).toContain('KEYBOARD SHORTCUTS');
      expect(html).toContain('NAVIGATION');
      expect(html).toContain('EDITING');
    });

    test('should generate HTML for editing mode', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('help-overlay');
      expect(html).toContain('SENTENCE EDITING');
    });

    test('should generate HTML for claim matching mode', () => {
      const html = generateHelpOverlayHtml('matching');
      expect(html).toContain('help-overlay');
      expect(html).toContain('CLAIM MATCHING');
    });

    test('should generate HTML for claim review mode', () => {
      const html = generateHelpOverlayHtml('review');
      expect(html).toContain('help-overlay');
      expect(html).toContain('QUOTE MANAGEMENT');
      expect(html).toContain('VALIDATION');
    });

    test('should include all shortcuts in HTML', () => {
      const html = generateHelpOverlayHtml('writing');
      expect(html).toContain('Shift+W');
      expect(html).toContain('Shift+E');
      expect(html).toContain('Shift+C');
      expect(html).toContain('Esc');
    });
  });

  describe('getHelpOverlayCss', () => {
    test('should return CSS string', () => {
      const css = getHelpOverlayCss();
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    test('should include help-overlay styles', () => {
      const css = getHelpOverlayCss();
      expect(css).toContain('.help-overlay');
      expect(css).toContain('.help-content');
      expect(css).toContain('.shortcut');
    });

    test('should include semi-transparent background', () => {
      const css = getHelpOverlayCss();
      expect(css).toContain('rgba(0, 0, 0, 0.7)');
    });
  });

  describe('getHelpOverlayJs', () => {
    test('should return JavaScript string', () => {
      const js = getHelpOverlayJs();
      expect(typeof js).toBe('string');
      expect(js.length).toBeGreaterThan(0);
    });

    test('should include keyboard event handling', () => {
      const js = getHelpOverlayJs();
      expect(js).toContain('keydown');
      expect(js).toContain('Escape');
    });

    test('should include toggle functionality', () => {
      const js = getHelpOverlayJs();
      expect(js).toContain('classList.toggle');
      expect(js).toContain('hidden');
    });
  });

  describe('Shortcut Groups', () => {
    test('GLOBAL_SHORTCUTS should have navigation shortcuts', () => {
      expect(GLOBAL_SHORTCUTS.title).toBe('NAVIGATION');
      expect(GLOBAL_SHORTCUTS.shortcuts.length).toBeGreaterThan(0);
      expect(GLOBAL_SHORTCUTS.shortcuts.some(s => s.key === '?')).toBe(true);
      expect(GLOBAL_SHORTCUTS.shortcuts.some(s => s.key === 'Esc')).toBe(true);
    });

    test('WRITING_MODE_SHORTCUTS should include global and editing shortcuts', () => {
      expect(WRITING_MODE_SHORTCUTS.length).toBeGreaterThan(1);
      expect(WRITING_MODE_SHORTCUTS[0]).toEqual(GLOBAL_SHORTCUTS);
    });

    test('EDITING_MODE_SHORTCUTS should include sentence editing shortcuts', () => {
      const editingShortcuts = EDITING_MODE_SHORTCUTS.find(g => g.title === 'SENTENCE EDITING');
      expect(editingShortcuts).toBeDefined();
      expect(editingShortcuts?.shortcuts.some(s => s.key === 'c')).toBe(true);
      expect(editingShortcuts?.shortcuts.some(s => s.key === 'x')).toBe(true);
    });

    test('CLAIM_REVIEW_SHORTCUTS should include quote management shortcuts', () => {
      const quoteShortcuts = CLAIM_REVIEW_SHORTCUTS.find(g => g.title === 'QUOTE MANAGEMENT');
      expect(quoteShortcuts).toBeDefined();
      expect(quoteShortcuts?.shortcuts.some(s => s.key === 'v')).toBe(true);
      expect(quoteShortcuts?.shortcuts.some(s => s.key === 'a')).toBe(true);
    });
  });
});
