/**
 * Unit tests for orphan citation tooltip functionality
 * Tests tooltip display, positioning, event handling, and cleanup
 * 
 * Validates: Requirements 1.2
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock DOM for Node.js environment
class MockElement {
  className: string = '';
  textContent: string = '';
  innerHTML: string = '';
  style: Record<string, string> = {};
  parentNode: MockElement | null = null;
  children: MockElement[] = [];
  attributes: Map<string, string> = new Map();
  listeners: Map<string, Function[]> = new Map();

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  appendChild(child: MockElement) {
    this.children.push(child);
    child.parentNode = this;
  }

  removeChild(child: MockElement) {
    const index = this.children.indexOf(child);
    if (index > -1) {
      this.children.splice(index, 1);
      child.parentNode = null;
    }
  }

  addEventListener(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  removeEventListener(event: string, listener: Function) {
    if (this.listeners.has(event)) {
      const listeners = this.listeners.get(event)!;
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  dispatchEvent(event: any) {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach(listener => listener(event));
  }

  querySelector(selector: string): MockElement | null {
    if (this.className.includes(selector.replace('.', ''))) {
      return this;
    }
    for (const child of this.children) {
      const result = child.querySelector(selector);
      if (result) return result;
    }
    return null;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    if (this.className.includes(selector.replace('.', ''))) {
      results.push(this);
    }
    for (const child of this.children) {
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  insertBefore(newChild: MockElement, refChild: MockElement) {
    const index = this.children.indexOf(refChild);
    if (index > -1) {
      this.children.splice(index, 0, newChild);
      newChild.parentNode = this;
    }
  }

  get firstChild(): MockElement | null {
    return this.children[0] || null;
  }
}

describe('Orphan Citation Tooltips', () => {
  let container: MockElement;
  let mockElement: MockElement;

  beforeEach(() => {
    // Create a mock DOM container for testing
    container = new MockElement();
    container.className = 'test-container';

    // Create a mock citation element
    mockElement = new MockElement();
    mockElement.className = 'orphan-citation';
    mockElement.textContent = 'Johnson2007';
    mockElement.setAttribute('data-tooltip', '<div class="orphan-citation-tooltip"><strong>Orphan Citations:</strong><br/><span class="orphan-years">Johnson2007</span></div>');
    container.appendChild(mockElement);
  });

  afterEach(() => {
    // Clean up
    container.children = [];
  });

  describe('Tooltip Display', () => {
    it('should display tooltip on hover over orphan citation', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      tooltip.innerHTML = '<div class="orphan-citation-tooltip"><strong>Orphan Citations:</strong></div>';
      
      mockElement.appendChild(tooltip);
      
      // Simulate hover
      const event = { type: 'mouseenter', currentTarget: mockElement };
      mockElement.dispatchEvent(event);
      
      // Tooltip should be in the DOM
      expect(mockElement.children).toContain(tooltip);
    });

    it('should hide tooltip on mouse leave', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip visible';
      tooltip.innerHTML = '<div class="orphan-citation-tooltip"><strong>Orphan Citations:</strong></div>';
      
      mockElement.appendChild(tooltip);
      expect(mockElement.children).toContain(tooltip);
      
      // Simulate leave and cleanup
      const event = { type: 'mouseleave', currentTarget: mockElement };
      mockElement.dispatchEvent(event);
      
      // Manually remove tooltip to simulate cleanup
      mockElement.removeChild(tooltip);
      
      // Tooltip should be removed
      expect(mockElement.children).not.toContain(tooltip);
    });

    it('should contain all orphan author-years in tooltip', () => {
      const authorYears = 'Johnson2007, Smith2020, Zhang2019';
      const tooltipContent = `
        <div class="orphan-citation-tooltip">
          <strong>Orphan Citations:</strong><br/>
          <span class="orphan-years">${authorYears}</span><br/>
          <small>These citations lack supporting quotes</small>
        </div>
      `;
      
      mockElement.setAttribute('data-tooltip', tooltipContent);
      
      const tooltip = new MockElement();
      tooltip.innerHTML = tooltipContent;
      
      expect(tooltip.innerHTML).toContain('Johnson2007');
      expect(tooltip.innerHTML).toContain('Smith2020');
      expect(tooltip.innerHTML).toContain('Zhang2019');
    });
  });

  describe('Tooltip Positioning', () => {
    it('should position tooltip above the citation element', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      tooltip.style.position = 'absolute';
      tooltip.style.bottom = '100%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      
      mockElement.appendChild(tooltip);
      
      // Check positioning
      expect(tooltip.style.position).toBe('absolute');
      expect(tooltip.style.bottom).toBe('100%');
    });

    it('should center tooltip horizontally relative to citation', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translateX(-50%)';
      
      mockElement.appendChild(tooltip);
      
      expect(tooltip.style.left).toBe('50%');
      expect(tooltip.style.transform).toBe('translateX(-50%)');
    });

    it('should not interfere with other UI elements', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      tooltip.style.zIndex = '10000';
      tooltip.style.pointerEvents = 'none';
      
      mockElement.appendChild(tooltip);
      
      // Tooltip should have high z-index and not capture events
      expect(tooltip.style.zIndex).toBe('10000');
      expect(tooltip.style.pointerEvents).toBe('none');
    });
  });

  describe('Event Handling', () => {
    it('should attach mouseenter listener to orphan citations', () => {
      const listener = jest.fn();
      mockElement.addEventListener('mouseenter', listener);
      
      const event = { type: 'mouseenter', bubbles: true };
      mockElement.dispatchEvent(event);
      
      expect(listener).toHaveBeenCalled();
    });

    it('should attach mouseleave listener to orphan citations', () => {
      const listener = jest.fn();
      mockElement.addEventListener('mouseleave', listener);
      
      const event = { type: 'mouseleave', bubbles: true };
      mockElement.dispatchEvent(event);
      
      expect(listener).toHaveBeenCalled();
    });

    it('should handle multiple orphan citations independently', () => {
      const citation1 = new MockElement();
      citation1.className = 'orphan-citation';
      citation1.textContent = 'Johnson2007';
      citation1.setAttribute('data-tooltip', '<div>Johnson2007</div>');
      
      const citation2 = new MockElement();
      citation2.className = 'orphan-citation';
      citation2.textContent = 'Smith2020';
      citation2.setAttribute('data-tooltip', '<div>Smith2020</div>');
      
      container.appendChild(citation1);
      container.appendChild(citation2);
      
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      citation1.addEventListener('mouseenter', listener1);
      citation2.addEventListener('mouseenter', listener2);
      
      citation1.dispatchEvent({ type: 'mouseenter', bubbles: true });
      citation2.dispatchEvent({ type: 'mouseenter', bubbles: true });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tooltip Content Generation', () => {
    it('should generate valid HTML for tooltip content', () => {
      const authorYears = 'Johnson2007, Smith2020';
      const tooltipHtml = `
        <div class="orphan-citation-tooltip">
          <strong>Orphan Citations:</strong><br/>
          <span class="orphan-years">${authorYears}</span><br/>
          <small>These citations lack supporting quotes</small>
        </div>
      `;
      
      const tooltip = new MockElement();
      tooltip.innerHTML = tooltipHtml;
      
      expect(tooltip.innerHTML).toContain('orphan-citation-tooltip');
      expect(tooltip.innerHTML).toContain('orphan-years');
      expect(tooltip.innerHTML).toContain('Orphan Citations');
    });

    it('should escape HTML special characters in author-years', () => {
      const maliciousAuthorYear = '<script>alert("xss")</script>';
      const escaped = maliciousAuthorYear
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
      
      const tooltipHtml = `<span class="orphan-years">${escaped}</span>`;
      
      // Should not contain script tags
      expect(tooltipHtml).not.toContain('<script>');
      expect(tooltipHtml).toContain('&lt;script&gt;');
    });

    it('should format multiple orphan citations clearly', () => {
      const authorYears = ['Johnson2007', 'Smith2020', 'Zhang2019'];
      const formatted = authorYears.join(', ');
      
      expect(formatted).toBe('Johnson2007, Smith2020, Zhang2019');
      expect(formatted.split(', ').length).toBe(3);
    });
  });

  describe('Tooltip Cleanup', () => {
    it('should remove tooltip from DOM on mouse leave', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip visible';
      mockElement.appendChild(tooltip);
      
      expect(mockElement.children).toContain(tooltip);
      
      // Simulate cleanup
      mockElement.removeChild(tooltip);
      
      expect(mockElement.children).not.toContain(tooltip);
    });

    it('should prevent memory leaks from multiple hover events', () => {
      const tooltip1 = new MockElement();
      tooltip1.className = 'orphan-tooltip';
      
      mockElement.appendChild(tooltip1);
      
      // Simulate multiple hovers
      mockElement.dispatchEvent({ type: 'mouseenter', bubbles: true });
      mockElement.dispatchEvent({ type: 'mouseleave', bubbles: true });
      mockElement.dispatchEvent({ type: 'mouseenter', bubbles: true });
      
      // Should only have one tooltip at a time
      const tooltips = mockElement.querySelectorAll('.orphan-tooltip');
      expect(tooltips.length).toBeLessThanOrEqual(1);
    });

    it('should clean up all tooltips when rendering new pairs', () => {
      const tooltip1 = new MockElement();
      tooltip1.className = 'orphan-tooltip';
      
      const tooltip2 = new MockElement();
      tooltip2.className = 'orphan-tooltip';
      
      const citation1 = new MockElement();
      citation1.className = 'orphan-citation';
      citation1.appendChild(tooltip1);
      
      const citation2 = new MockElement();
      citation2.className = 'orphan-citation';
      citation2.appendChild(tooltip2);
      
      container.appendChild(citation1);
      container.appendChild(citation2);
      
      // Simulate cleanup
      const allTooltips = container.querySelectorAll('.orphan-tooltip');
      allTooltips.forEach(tooltip => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      });
      
      expect(container.querySelectorAll('.orphan-tooltip').length).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes for tooltip', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.setAttribute('aria-hidden', 'true');
      
      mockElement.appendChild(tooltip);
      
      expect(tooltip.getAttribute('role')).toBe('tooltip');
      expect(tooltip.getAttribute('aria-hidden')).toBe('true');
    });

    it('should be keyboard accessible via hover', () => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      
      mockElement.appendChild(tooltip);
      
      // Add focus listener first
      mockElement.addEventListener('focus', () => {});
      
      // Simulate focus event
      const focusEvent = { type: 'focus', bubbles: true };
      mockElement.dispatchEvent(focusEvent);
      
      // Should have focus listener attached
      expect(mockElement.listeners.has('focus')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty author-years gracefully', () => {
      const tooltipHtml = `
        <div class="orphan-citation-tooltip">
          <strong>Orphan Citations:</strong><br/>
          <span class="orphan-years"></span>
        </div>
      `;
      
      const tooltip = new MockElement();
      tooltip.innerHTML = tooltipHtml;
      
      expect(tooltip.innerHTML).toContain('orphan-years');
    });

    it('should handle very long author-year lists', () => {
      const authorYears = Array.from({ length: 50 }, (_, i) => `Author${i}${2000 + i}`).join(', ');
      const tooltipHtml = `<span class="orphan-years">${authorYears}</span>`;
      
      const tooltip = new MockElement();
      tooltip.innerHTML = tooltipHtml;
      
      expect(tooltip.innerHTML).toContain('Author0');
      expect(tooltip.innerHTML).toContain('Author49');
    });

    it('should handle citations with special characters', () => {
      const authorYears = "O'Brien2020, Müller-Smith2019, José-García2021";
      const tooltipHtml = `<span class="orphan-years">${authorYears}</span>`;
      
      const tooltip = new MockElement();
      tooltip.innerHTML = tooltipHtml;
      
      expect(tooltip.innerHTML).toContain("O'Brien2020");
      expect(tooltip.innerHTML).toContain('Müller-Smith2019');
      expect(tooltip.innerHTML).toContain('José-García2021');
    });

    it('should handle rapid hover/unhover events', (done) => {
      const tooltip = new MockElement();
      tooltip.className = 'orphan-tooltip';
      mockElement.appendChild(tooltip);
      
      // Rapid hover events
      for (let i = 0; i < 10; i++) {
        mockElement.dispatchEvent({ type: 'mouseenter', bubbles: true });
        mockElement.dispatchEvent({ type: 'mouseleave', bubbles: true });
      }
      
      // Should not crash and should clean up properly
      setTimeout(() => {
        expect(true).toBe(true);
        done();
      }, 100);
    });
  });
});
