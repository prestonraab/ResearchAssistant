/**
 * Virtual Scroller - Efficiently renders large lists by only rendering visible items
 * Reduces memory usage and improves performance for long lists
 */
export class VirtualScroller {
  private container: HTMLElement;
  private items: any[];
  private itemHeight: number;
  private bufferSize: number;
  private scrollTop: number = 0;
  private containerHeight: number = 0;
  private renderCallback: (items: any[], startIndex: number) => void;
  private scrollListener: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    items: any[],
    itemHeight: number,
    renderCallback: (items: any[], startIndex: number) => void,
    bufferSize: number = 5
  ) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.renderCallback = renderCallback;
    this.bufferSize = bufferSize;
    this.containerHeight = container.clientHeight;

    this.setupScrollListener();
  }

  /**
   * Setup scroll listener with debouncing
   */
  private setupScrollListener(): void {
    let scrollTimeout: NodeJS.Timeout | null = null;

    this.scrollListener = () => {
      this.scrollTop = this.container.scrollTop;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
        this.render();
      }, 50); // Debounce scroll events
    };

    this.container.addEventListener('scroll', this.scrollListener);
  }

  /**
   * Get visible range of items
   */
  private getVisibleRange(): { startIndex: number; endIndex: number } {
    const startIndex = Math.max(
      0,
      Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize
    );

    const endIndex = Math.min(
      this.items.length,
      Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.bufferSize
    );

    return { startIndex, endIndex };
  }

  /**
   * Render visible items
   */
  render(): void {
    const { startIndex, endIndex } = this.getVisibleRange();
    const visibleItems = this.items.slice(startIndex, endIndex);

    this.renderCallback(visibleItems, startIndex);
  }

  /**
   * Update items and re-render
   */
  updateItems(items: any[]): void {
    this.items = items;
    this.render();
  }

  /**
   * Scroll to item by index
   */
  scrollToItem(index: number): void {
    const targetScrollTop = index * this.itemHeight;
    this.container.scrollTop = targetScrollTop;
    this.scrollTop = targetScrollTop;
    this.render();
  }

  /**
   * Scroll to item by ID
   */
  scrollToItemById(itemId: string): void {
    const index = this.items.findIndex(item => item.id === itemId);
    if (index >= 0) {
      this.scrollToItem(index);
    }
  }

  /**
   * Get total height needed for all items
   */
  getTotalHeight(): number {
    return this.items.length * this.itemHeight;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.scrollListener) {
      this.container.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
  }
}

/**
 * Lazy loader for claim cards - loads data on demand as cards enter viewport
 */
export class LazyLoader {
  private observer: IntersectionObserver;
  private loadCallback: (elementId: string) => Promise<void>;
  private loadedElements: Set<string> = new Set();

  constructor(loadCallback: (elementId: string) => Promise<void>) {
    this.loadCallback = loadCallback;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const elementId = (entry.target as HTMLElement).dataset.elementId;
            if (elementId && !this.loadedElements.has(elementId)) {
              this.loadedElements.add(elementId);
              this.loadCallback(elementId).catch(error => {
                console.error(`Failed to lazy load element ${elementId}:`, error);
              });
            }
          }
        });
      },
      {
        rootMargin: '50px' // Start loading 50px before element enters viewport
      }
    );
  }

  /**
   * Observe element for lazy loading
   */
  observe(element: HTMLElement): void {
    this.observer.observe(element);
  }

  /**
   * Stop observing element
   */
  unobserve(element: HTMLElement): void {
    this.observer.unobserve(element);
  }

  /**
   * Reset loaded elements
   */
  reset(): void {
    this.loadedElements.clear();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.observer.disconnect();
    this.loadedElements.clear();
  }
}
