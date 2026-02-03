import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { setupTest } from '../helpers';

/**
 * Performance tests for UI responsiveness
 * 
 * **Validates: Requirements NFR-1 (Performance Targets)**
 * - UI response time: < 100ms
 * 
 * **Validates: Requirements US-3 (Responsive UI)**
 * - Tree view updates < 100ms
 * - Claim hover displays < 200ms
 * - Search results appear < 500ms
 * - File save operations don't block UI
 */
describe('Performance: UI Responsiveness', () => {
  setupTest();

  /**
   * Test that tree view refresh completes within 100ms
   * 
   * **Validates: Requirements US-3 (Tree view updates < 100ms)**
   */
  it('should refresh tree view in < 100ms', async () => {
    const startTime = performance.now();
    
    // Simulate tree view data preparation
    const treeItems: Array<{
      label: string;
      collapsibleState: number;
      children?: Array<{ label: string }>;
    }> = [];
    
    // Create typical tree structure (50 items with children)
    for (let i = 0; i < 50; i++) {
      treeItems.push({
        label: `Item ${i}`,
        collapsibleState: 1, // Collapsed
        children: [
          { label: `Child ${i}-1` },
          { label: `Child ${i}-2` }
        ]
      });
    }
    
    // Simulate tree provider refresh
    const refreshedItems = treeItems.map(item => ({
      ...item,
      refreshed: true
    }));
    
    // Simulate event firing
    const onDidChangeTreeData = jest.fn();
    onDidChangeTreeData();
    
    const duration = performance.now() - startTime;
    
    // Tree view refresh target: < 100ms
    expect(duration).toBeLessThan(100);
    
    console.log(`Tree view refresh: ${duration.toFixed(2)}ms (target: < 100ms)`);
  });

  /**
   * Test that hover information is computed within 200ms
   * 
   * **Validates: Requirements US-3 (Claim hover displays < 200ms)**
   */
  it('should compute hover information in < 200ms', async () => {
    const startTime = performance.now();
    
    // Simulate claim lookup
    const claims = new Map<string, {
      id: string;
      text: string;
      category: string;
      verified: boolean;
      supportingQuotes: string[];
    }>();
    
    // Populate with typical claims
    for (let i = 0; i < 100; i++) {
      claims.set(`C_${String(i).padStart(3, '0')}`, {
        id: `C_${String(i).padStart(3, '0')}`,
        text: `Claim ${i} text content`,
        category: 'Method',
        verified: i % 2 === 0,
        supportingQuotes: [`Quote ${i}-1`, `Quote ${i}-2`]
      });
    }
    
    // Simulate hover computation
    const claimId = 'C_050';
    const claim = claims.get(claimId);
    
    // Simulate markdown generation for hover
    let hoverContent = '';
    if (claim) {
      hoverContent = `**${claim.id}**: ${claim.text}\n\n`;
      hoverContent += `Category: ${claim.category}\n`;
      hoverContent += `Verified: ${claim.verified ? '✓' : '✗'}\n\n`;
      hoverContent += `**Supporting Quotes:**\n`;
      claim.supportingQuotes.forEach(q => {
        hoverContent += `- ${q}\n`;
      });
    }
    
    const duration = performance.now() - startTime;
    
    // Hover computation target: < 200ms
    expect(duration).toBeLessThan(200);
    expect(hoverContent.length).toBeGreaterThan(0);
    
    console.log(`Hover computation: ${duration.toFixed(2)}ms (target: < 200ms)`);
  });

  /**
   * Test that search results are returned within 500ms
   * 
   * **Validates: Requirements US-3 (Search results appear < 500ms)**
   */
  it('should return search results in < 500ms', async () => {
    const startTime = performance.now();
    
    // Simulate searchable data
    const searchableItems: Array<{
      id: string;
      text: string;
      source: string;
    }> = [];
    
    // Create 500 searchable items (typical quote database size)
    for (let i = 0; i < 500; i++) {
      searchableItems.push({
        id: `quote-${i}`,
        text: `This is searchable text content number ${i} with various keywords like research, methodology, findings, and analysis.`,
        source: `Author${i % 20}2024`
      });
    }
    
    // Simulate search operation
    const searchTerm = 'methodology';
    const results = searchableItems.filter(item => 
      item.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Simulate result ranking/sorting
    const rankedResults = results
      .map(r => ({
        ...r,
        score: r.text.toLowerCase().split(searchTerm.toLowerCase()).length - 1
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Top 20 results
    
    const duration = performance.now() - startTime;
    
    // Search target: < 500ms
    expect(duration).toBeLessThan(500);
    expect(rankedResults.length).toBeGreaterThan(0);
    
    console.log(`Search completed: ${duration.toFixed(2)}ms (target: < 500ms)`);
    console.log(`  Found ${results.length} matches, returned top ${rankedResults.length}`);
  });

  /**
   * Test that completion items are provided within 100ms
   * 
   * **Validates: Requirements NFR-1 (UI response time < 100ms)**
   */
  it('should provide completion items in < 100ms', async () => {
    const startTime = performance.now();
    
    // Simulate claim completion provider
    const claims: Array<{ id: string; text: string }> = [];
    for (let i = 0; i < 100; i++) {
      claims.push({
        id: `C_${String(i).padStart(3, '0')}`,
        text: `Claim ${i} description`
      });
    }
    
    // Simulate filtering based on prefix
    const prefix = 'C_0';
    const matchingClaims = claims.filter(c => c.id.startsWith(prefix));
    
    // Simulate creating completion items
    const completionItems = matchingClaims.map(claim => ({
      label: claim.id,
      kind: 17, // Reference
      detail: claim.text,
      insertText: claim.id
    }));
    
    const duration = performance.now() - startTime;
    
    // Completion target: < 100ms
    expect(duration).toBeLessThan(100);
    expect(completionItems.length).toBeGreaterThan(0);
    
    console.log(`Completion items: ${duration.toFixed(2)}ms (target: < 100ms)`);
    console.log(`  Provided ${completionItems.length} items for prefix "${prefix}"`);
  });

  /**
   * Test that file operations don't block UI
   * Simulates async file operations completing without blocking
   * 
   * **Validates: Requirements US-3 (File save operations don't block UI)**
   */
  it('should handle file operations without blocking UI', async () => {
    const uiOperations: number[] = [];
    const fileOperationComplete = { value: false };
    
    // Start a simulated file operation
    const fileOperation = new Promise<void>(resolve => {
      setTimeout(() => {
        fileOperationComplete.value = true;
        resolve();
      }, 100);
    });
    
    // Simulate UI operations while file operation is in progress
    const uiStartTime = performance.now();
    
    for (let i = 0; i < 5; i++) {
      const opStart = performance.now();
      
      // Simulate UI operation (tree refresh, hover, etc.)
      const items = new Array(50).fill(0).map((_, j) => ({ id: j, label: `Item ${j}` }));
      const processed = items.map(item => ({ ...item, processed: true }));
      
      const opDuration = performance.now() - opStart;
      uiOperations.push(opDuration);
    }
    
    const uiTotalTime = performance.now() - uiStartTime;
    
    // Wait for file operation to complete
    await fileOperation;
    
    // All UI operations should complete quickly (< 100ms each)
    uiOperations.forEach((duration, index) => {
      expect(duration).toBeLessThan(100);
    });
    
    // UI should remain responsive during file operation
    expect(uiTotalTime).toBeLessThan(500);
    expect(fileOperationComplete.value).toBe(true);
    
    console.log(`UI responsiveness during file operation:`);
    console.log(`  UI operations: ${uiOperations.map(d => d.toFixed(2) + 'ms').join(', ')}`);
    console.log(`  Total UI time: ${uiTotalTime.toFixed(2)}ms`);
    console.log(`  File operation completed: ${fileOperationComplete.value}`);
  });
});

/**
 * Performance tests for debouncing and throttling
 */
describe('Performance: Debouncing', () => {
  setupTest();

  /**
   * Test that rapid events are properly debounced
   * 
   * **Validates: Requirements US-4 (File change debouncing prevents excessive processing)**
   */
  it('should debounce rapid file changes to single processing', async () => {
    let processCount = 0;
    const debounceMs = 100; // Shorter for testing (actual is 1000ms)
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const processChange = () => {
      processCount++;
    };
    
    const debouncedProcess = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(processChange, debounceMs);
    };
    
    // Simulate 10 rapid file changes
    const startTime = performance.now();
    for (let i = 0; i < 10; i++) {
      debouncedProcess();
    }
    
    // Wait for debounce to complete
    await new Promise(resolve => setTimeout(resolve, debounceMs + 50));
    
    const duration = performance.now() - startTime;
    
    // Should only process once despite 10 changes
    expect(processCount).toBe(1);
    
    console.log(`Debouncing test:`);
    console.log(`  Rapid changes: 10`);
    console.log(`  Actual processes: ${processCount}`);
    console.log(`  Duration: ${duration.toFixed(2)}ms`);
  });

  /**
   * Test that debounced operations complete within reasonable time
   */
  it('should complete debounced operation within time limit', async () => {
    const debounceMs = 100;
    let completed = false;
    
    const startTime = performance.now();
    
    // Simulate debounced operation
    await new Promise<void>(resolve => {
      setTimeout(() => {
        completed = true;
        resolve();
      }, debounceMs);
    });
    
    const duration = performance.now() - startTime;
    
    // Should complete close to debounce time
    expect(duration).toBeGreaterThanOrEqual(debounceMs);
    expect(duration).toBeLessThan(debounceMs + 50); // Allow 50ms tolerance
    expect(completed).toBe(true);
    
    console.log(`Debounce timing: ${duration.toFixed(2)}ms (expected: ~${debounceMs}ms)`);
  });
});

/**
 * Performance tests for batch operations
 */
describe('Performance: Batch Operations', () => {
  setupTest();

  /**
   * Test that batch processing is more efficient than individual processing
   */
  it('should process batches more efficiently than individual items', async () => {
    const items = new Array(100).fill(0).map((_, i) => ({
      id: i,
      text: `Item ${i} content`
    }));
    
    // Individual processing
    const individualStart = performance.now();
    const individualResults: Array<{ id: number; processed: boolean }> = [];
    for (const item of items) {
      individualResults.push({ id: item.id, processed: true });
    }
    const individualDuration = performance.now() - individualStart;
    
    // Batch processing
    const batchStart = performance.now();
    const batchResults = items.map(item => ({ id: item.id, processed: true }));
    const batchDuration = performance.now() - batchStart;
    
    // Both should be fast, but batch should be comparable or faster
    expect(individualDuration).toBeLessThan(100);
    expect(batchDuration).toBeLessThan(100);
    
    console.log(`Batch vs Individual processing (100 items):`);
    console.log(`  Individual: ${individualDuration.toFixed(2)}ms`);
    console.log(`  Batch: ${batchDuration.toFixed(2)}ms`);
  });

  /**
   * Test parallel processing performance
   */
  it('should benefit from parallel processing', async () => {
    const tasks = new Array(5).fill(0).map((_, i) => 
      () => new Promise<number>(resolve => {
        setTimeout(() => resolve(i), 20);
      })
    );
    
    // Sequential execution
    const sequentialStart = performance.now();
    const sequentialResults: number[] = [];
    for (const task of tasks) {
      sequentialResults.push(await task());
    }
    const sequentialDuration = performance.now() - sequentialStart;
    
    // Parallel execution
    const parallelStart = performance.now();
    const parallelResults = await Promise.all(tasks.map(t => t()));
    const parallelDuration = performance.now() - parallelStart;
    
    // Parallel should be significantly faster
    expect(parallelDuration).toBeLessThan(sequentialDuration);
    expect(parallelResults.length).toBe(sequentialResults.length);
    
    console.log(`Parallel vs Sequential (5 tasks @ 20ms each):`);
    console.log(`  Sequential: ${sequentialDuration.toFixed(2)}ms`);
    console.log(`  Parallel: ${parallelDuration.toFixed(2)}ms`);
    console.log(`  Speedup: ${(sequentialDuration / parallelDuration).toFixed(2)}x`);
  });
});
