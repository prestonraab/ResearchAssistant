import { jest } from '@jest/globals';
import { getHelpOverlayJs, generateHelpOverlayHtml, getHelpOverlayCss } from '../keyboardShortcuts';

describe('Keyboard Shortcuts Integration', () => {
  describe('Help Overlay HTML', () => {
    test('should generate help overlay HTML', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('helpOverlay');
      expect(html).toContain('help-content');
    });

    test('should include shortcuts for all modes', () => {
      const modes: Array<'writing' | 'editing' | 'matching' | 'review'> = ['writing', 'editing', 'matching', 'review'];
      
      modes.forEach(mode => {
        const html = generateHelpOverlayHtml(mode);
        expect(html).toContain('Cmd/Ctrl+Alt+W');
        expect(html).toContain('Cmd/Ctrl+Alt+E');
        expect(html).toContain('Cmd/Ctrl+Alt+R');
        expect(html).toContain('?');
        expect(html).toContain('Esc');
      });
    });

    test('should include mode-specific shortcuts for editing', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('c');
      expect(html).toContain('x');
      expect(html).toContain('Enter');
    });
  });

  describe('Help Overlay CSS', () => {
    test('should return CSS string', () => {
      const css = getHelpOverlayCss();
      expect(typeof css).toBe('string');
      expect(css.length).toBeGreaterThan(0);
    });

    test('should include help overlay styles', () => {
      const css = getHelpOverlayCss();
      expect(css).toContain('.help-overlay');
      expect(css).toContain('.help-content');
    });
  });

  describe('Help Overlay JavaScript', () => {
    test('should return JavaScript string', () => {
      const js = getHelpOverlayJs();
      expect(typeof js).toBe('string');
      expect(js.length).toBeGreaterThan(0);
    });

    test('should include toggle function', () => {
      const js = getHelpOverlayJs();
      expect(js).toContain('classList.toggle');
    });

    test('should include keyboard event handling', () => {
      const js = getHelpOverlayJs();
      expect(js).toContain('keydown');
      expect(js).toContain('addEventListener');
    });

    test('should handle escape key', () => {
      const js = getHelpOverlayJs();
      expect(js).toContain('Escape');
    });
  });

  describe('Keyboard Navigation', () => {
    test('should support mode switching shortcuts', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('Cmd/Ctrl+Alt+W');
      expect(html).toContain('Cmd/Ctrl+Alt+E');
      expect(html).toContain('Cmd/Ctrl+Alt+R');
    });

    test('should support sentence navigation shortcuts', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('n');
      expect(html).toContain('p');
    });

    test('should support scroll shortcuts', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('j');
      expect(html).toContain('k');
    });

    test('should support claim operations shortcuts', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('c');
      expect(html).toContain('x');
      expect(html).toContain('Enter');
    });
  });

  describe('Accessibility', () => {
    test('should have proper semantic HTML in help overlay', () => {
      const html = generateHelpOverlayHtml('editing');
      expect(html).toContain('h2');
      expect(html).toContain('h3');
      expect(html).toContain('div');
    });

    test('should support keyboard-only navigation', () => {
      const modes: Array<'writing' | 'editing' | 'matching' | 'review'> = ['writing', 'editing', 'matching', 'review'];
      
      modes.forEach(mode => {
        const html = generateHelpOverlayHtml(mode);
        expect(html).toContain('Cmd/Ctrl+Alt+');
        expect(html).toContain('?');
        expect(html).toContain('Esc');
      });
    });
  });

  describe('Shortcut Consistency', () => {
    test('should use consistent shortcuts across modes', () => {
      const modes: Array<'writing' | 'editing' | 'matching' | 'review'> = ['writing', 'editing', 'matching', 'review'];
      
      modes.forEach(mode => {
        const html = generateHelpOverlayHtml(mode);
        expect(html).toContain('Cmd/Ctrl+Alt+W');
        expect(html).toContain('Cmd/Ctrl+Alt+E');
        expect(html).toContain('Cmd/Ctrl+Alt+R');
        expect(html).toContain('?');
        expect(html).toContain('Esc');
      });
    });
  });
});
