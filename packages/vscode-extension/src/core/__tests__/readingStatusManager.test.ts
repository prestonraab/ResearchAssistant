import { describe, test, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { ReadingStatusManager, ReadingStatus, ReadingProgress } from '../readingStatusManager';

describe('ReadingStatusManager', () => {
  let mockContext: vscode.ExtensionContext;
  let workspaceState: Map<string, any>;

  beforeEach(() => {
    // Create a mock workspace state
    workspaceState = new Map();

    mockContext = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn((key: string, defaultValue?: any) => {
          return workspaceState.get(key) ?? defaultValue;
        }),
        update: jest.fn((key: string, value: any) => {
          workspaceState.set(key, value);
          return Promise.resolve();
        }),
        keys: jest.fn(() => Array.from(workspaceState.keys()))
      } as any,
      globalState: {} as any,
      extensionPath: '/test/extension',
      extensionUri: {} as any,
      environmentVariableCollection: {} as any,
      storagePath: '/test/storage',
      globalStoragePath: '/test/global-storage',
      logPath: '/test/logs',
      extensionMode: 1,
      asAbsolutePath: jest.fn(),
      storageUri: {} as any,
      globalStorageUri: {} as any,
      logUri: {} as any,
      extension: {} as any,
      secrets: {} as any,
      languageModelAccessInformation: {} as any
    };
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with empty status map', () => {
      const manager = new ReadingStatusManager(mockContext);
      
      const stats = manager.getStatistics();
      expect(stats.toRead).toBe(0);
      expect(stats.reading).toBe(0);
      expect(stats.read).toBe(0);
    });

    it('should load existing data from workspace state', () => {
      // Pre-populate workspace state
      workspaceState.set('researchAssistant.readingProgress', {
        'paper1': {
          status: 'read',
          startedAt: '2024-01-01T10:00:00.000Z',
          completedAt: '2024-01-01T11:30:00.000Z',
          readingDuration: 90
        }
      });

      const manager = new ReadingStatusManager(mockContext);
      
      const progress = manager.getStatus('paper1');
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('read');
      expect(progress?.readingDuration).toBe(90);
    });

    it('should handle corrupted workspace state gracefully', () => {
      // Set invalid data
      workspaceState.set('researchAssistant.readingProgress', null);

      // Should not throw
      expect(() => new ReadingStatusManager(mockContext)).not.toThrow();
    });
  });

  describe('setStatus - to-read', () => {
    it('should set status to to-read', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      
      const progress = manager.getStatus('paper1');
      expect(progress?.status).toBe('to-read');
      expect(progress?.startedAt).toBeUndefined();
      expect(progress?.completedAt).toBeUndefined();
      expect(progress?.readingDuration).toBeUndefined();
    });

    it('should persist to-read status to workspace state', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      
      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        'researchAssistant.readingProgress',
        expect.objectContaining({
          'paper1': expect.objectContaining({
            status: 'to-read'
          })
        })
      );
    });

    it('should clear timestamps when changing to to-read', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // First set to reading
      await manager.setStatus('paper1', 'reading');
      
      // Then change to to-read
      await manager.setStatus('paper1', 'to-read');
      
      const progress = manager.getStatus('paper1');
      expect(progress?.status).toBe('to-read');
      expect(progress?.startedAt).toBeUndefined();
      expect(progress?.completedAt).toBeUndefined();
    });
  });

  describe('setStatus - reading (Requirement 16.1)', () => {
    it('should record timestamp when marking as reading', async () => {
      const manager = new ReadingStatusManager(mockContext);
      const beforeTime = new Date();
      
      await manager.setStatus('paper1', 'reading');
      
      const afterTime = new Date();
      const progress = manager.getStatus('paper1');
      
      expect(progress?.status).toBe('reading');
      expect(progress?.startedAt).toBeDefined();
      expect(progress?.startedAt!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(progress?.startedAt!.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      expect(progress?.completedAt).toBeUndefined();
      expect(progress?.readingDuration).toBeUndefined();
    });

    it('should preserve original start time when re-marking as reading', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // First time marking as reading
      await manager.setStatus('paper1', 'reading');
      const firstProgress = manager.getStatus('paper1');
      const originalStartTime = firstProgress?.startedAt;
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Mark as reading again
      await manager.setStatus('paper1', 'reading');
      const secondProgress = manager.getStatus('paper1');
      
      expect(secondProgress?.startedAt).toEqual(originalStartTime);
    });

    it('should persist reading status with timestamp to workspace state', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      
      expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
        'researchAssistant.readingProgress',
        expect.objectContaining({
          'paper1': expect.objectContaining({
            status: 'reading',
            startedAt: expect.any(String)
          })
        })
      );
    });
  });

  describe('setStatus - read (Requirement 16.2)', () => {
    it('should record completion time and calculate duration when marking as read', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // First mark as reading
      await manager.setStatus('paper1', 'reading');
      
      // Wait a bit to simulate reading time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mark as read
      const beforeComplete = new Date();
      await manager.setStatus('paper1', 'read');
      const afterComplete = new Date();
      
      const progress = manager.getStatus('paper1');
      
      expect(progress?.status).toBe('read');
      expect(progress?.startedAt).toBeDefined();
      expect(progress?.completedAt).toBeDefined();
      expect(progress?.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeComplete.getTime());
      expect(progress?.completedAt!.getTime()).toBeLessThanOrEqual(afterComplete.getTime());
      expect(progress?.readingDuration).toBeDefined();
      expect(progress?.readingDuration).toBeGreaterThanOrEqual(0);
    });

    it('should calculate reading duration in minutes', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // Manually set a start time
      const startTime = new Date('2024-01-01T10:00:00.000Z');
      await manager.setStatus('paper1', 'reading');
      
      // Manually update the start time for testing
      const progress = manager.getStatus('paper1');
      if (progress) {
        progress.startedAt = startTime;
      }
      
      // Mock current time to be 90 minutes later
      const originalDate = Date;
      const mockDate = new Date('2024-01-01T11:30:00.000Z');
      global.Date = jest.fn(() => mockDate) as any;
      global.Date.now = jest.fn(() => mockDate.getTime());
      
      await manager.setStatus('paper1', 'read');
      
      const finalProgress = manager.getStatus('paper1');
      expect(finalProgress?.readingDuration).toBe(90);
      
      // Restore Date
      global.Date = originalDate;
    });

    it('should handle marking as read without prior reading status', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // Mark as read directly without marking as reading first
      await manager.setStatus('paper1', 'read');
      
      const progress = manager.getStatus('paper1');
      
      expect(progress?.status).toBe('read');
      expect(progress?.startedAt).toBeDefined();
      expect(progress?.completedAt).toBeDefined();
      expect(progress?.readingDuration).toBeDefined();
      // Duration should be very small (essentially 0)
      expect(progress?.readingDuration).toBeLessThan(1);
    });

    it('should persist read status with timestamps to workspace state', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      await manager.setStatus('paper1', 'read');
      
      expect(mockContext.workspaceState.update).toHaveBeenLastCalledWith(
        'researchAssistant.readingProgress',
        expect.objectContaining({
          'paper1': expect.objectContaining({
            status: 'read',
            startedAt: expect.any(String),
            completedAt: expect.any(String),
            readingDuration: expect.any(Number)
          })
        })
      );
    });
  });

  describe('getStatus (Requirement 4.5)', () => {
    it('should return undefined for unknown paper', () => {
      const manager = new ReadingStatusManager(mockContext);
      
      const progress = manager.getStatus('unknown-paper');
      
      expect(progress).toBeUndefined();
    });

    it('should return correct status for tracked paper', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      
      const progress = manager.getStatus('paper1');
      
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('reading');
    });

    it('should return status after extension restart (Requirement 16.3)', () => {
      // First manager instance
      const manager1 = new ReadingStatusManager(mockContext);
      manager1.setStatus('paper1', 'reading');
      
      // Simulate extension restart by creating new manager with same context
      const manager2 = new ReadingStatusManager(mockContext);
      
      const progress = manager2.getStatus('paper1');
      expect(progress).toBeDefined();
      expect(progress?.status).toBe('reading');
    });
  });

  describe('getPapersByStatus', () => {
    it('should return empty array when no papers have the status', () => {
      const manager = new ReadingStatusManager(mockContext);
      
      const papers = manager.getPapersByStatus('reading');
      
      expect(papers).toEqual([]);
    });

    it('should return papers with specific status', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      await manager.setStatus('paper2', 'reading');
      await manager.setStatus('paper3', 'to-read');
      await manager.setStatus('paper4', 'read');
      
      const toReadPapers = manager.getPapersByStatus('to-read');
      const readingPapers = manager.getPapersByStatus('reading');
      const readPapers = manager.getPapersByStatus('read');
      
      expect(toReadPapers).toHaveLength(2);
      expect(toReadPapers).toContain('paper1');
      expect(toReadPapers).toContain('paper3');
      
      expect(readingPapers).toHaveLength(1);
      expect(readingPapers).toContain('paper2');
      
      expect(readPapers).toHaveLength(1);
      expect(readPapers).toContain('paper4');
    });
  });

  describe('getStatistics (Requirement 16.3)', () => {
    it('should return zero statistics for empty manager', () => {
      const manager = new ReadingStatusManager(mockContext);
      
      const stats = manager.getStatistics();
      
      expect(stats.toRead).toBe(0);
      expect(stats.reading).toBe(0);
      expect(stats.read).toBe(0);
      expect(stats.totalReadingTime).toBe(0);
      expect(stats.averageReadingTime).toBe(0);
    });

    it('should count papers by status', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      await manager.setStatus('paper2', 'to-read');
      await manager.setStatus('paper3', 'reading');
      await manager.setStatus('paper4', 'read');
      await manager.setStatus('paper5', 'read');
      await manager.setStatus('paper6', 'read');
      
      const stats = manager.getStatistics();
      
      expect(stats.toRead).toBe(2);
      expect(stats.reading).toBe(1);
      expect(stats.read).toBe(3);
    });

    it('should calculate total reading time', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // Manually create papers with known reading durations
      await manager.setStatus('paper1', 'read');
      await manager.setStatus('paper2', 'read');
      
      // Manually set durations for testing
      const progress1 = manager.getStatus('paper1');
      const progress2 = manager.getStatus('paper2');
      if (progress1) progress1.readingDuration = 30;
      if (progress2) progress2.readingDuration = 45;
      
      const stats = manager.getStatistics();
      
      expect(stats.totalReadingTime).toBe(75);
      expect(stats.averageReadingTime).toBe(38); // rounded average of 30 and 45
    });

    it('should handle papers without reading duration', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'read');
      await manager.setStatus('paper2', 'read');
      
      // One paper has duration, one doesn't
      const progress1 = manager.getStatus('paper1');
      if (progress1) progress1.readingDuration = 60;
      
      const stats = manager.getStatistics();
      
      expect(stats.totalReadingTime).toBe(60);
      expect(stats.averageReadingTime).toBe(30); // 60 / 2 papers
    });

    it('should calculate average reading time correctly', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'read');
      await manager.setStatus('paper2', 'read');
      await manager.setStatus('paper3', 'read');
      
      const progress1 = manager.getStatus('paper1');
      const progress2 = manager.getStatus('paper2');
      const progress3 = manager.getStatus('paper3');
      if (progress1) progress1.readingDuration = 20;
      if (progress2) progress2.readingDuration = 40;
      if (progress3) progress3.readingDuration = 60;
      
      const stats = manager.getStatistics();
      
      expect(stats.averageReadingTime).toBe(40); // (20 + 40 + 60) / 3
    });
  });

  describe('removeStatus', () => {
    it('should remove status for a paper', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      expect(manager.hasStatus('paper1')).toBe(true);
      
      await manager.removeStatus('paper1');
      
      expect(manager.hasStatus('paper1')).toBe(false);
      expect(manager.getStatus('paper1')).toBeUndefined();
    });

    it('should persist removal to workspace state', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      await manager.removeStatus('paper1');
      
      const stored = workspaceState.get('researchAssistant.readingProgress');
      expect(stored).toBeDefined();
      expect(stored['paper1']).toBeUndefined();
    });

    it('should not throw when removing non-existent paper', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await expect(manager.removeStatus('non-existent')).resolves.not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all reading status', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      await manager.setStatus('paper2', 'reading');
      await manager.setStatus('paper3', 'read');
      
      await manager.clearAll();
      
      const stats = manager.getStatistics();
      expect(stats.toRead).toBe(0);
      expect(stats.reading).toBe(0);
      expect(stats.read).toBe(0);
    });

    it('should persist clear to workspace state', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      await manager.clearAll();
      
      const stored = workspaceState.get('researchAssistant.readingProgress');
      expect(stored).toEqual({});
    });
  });

  describe('getAllProgress', () => {
    it('should return empty map when no papers tracked', () => {
      const manager = new ReadingStatusManager(mockContext);
      
      const allProgress = manager.getAllProgress();
      
      expect(allProgress.size).toBe(0);
    });

    it('should return all tracked papers', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      await manager.setStatus('paper2', 'reading');
      
      const allProgress = manager.getAllProgress();
      
      expect(allProgress.size).toBe(2);
      expect(allProgress.get('paper1')?.status).toBe('to-read');
      expect(allProgress.get('paper2')?.status).toBe('reading');
    });

    it('should return a copy of the map', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'reading');
      
      const allProgress = manager.getAllProgress();
      allProgress.clear();
      
      // Original should not be affected
      expect(manager.hasStatus('paper1')).toBe(true);
    });
  });

  describe('hasStatus', () => {
    it('should return false for untracked paper', () => {
      const manager = new ReadingStatusManager(mockContext);
      
      expect(manager.hasStatus('paper1')).toBe(false);
    });

    it('should return true for tracked paper', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      
      expect(manager.hasStatus('paper1')).toBe(true);
    });
  });

  describe('Persistence across restarts (Requirement 16.3)', () => {
    it('should persist and restore all status types', async () => {
      const manager1 = new ReadingStatusManager(mockContext);
      
      await manager1.setStatus('paper1', 'to-read');
      await manager1.setStatus('paper2', 'reading');
      await manager1.setStatus('paper3', 'read');
      
      // Create new manager (simulating restart)
      const manager2 = new ReadingStatusManager(mockContext);
      
      expect(manager2.getStatus('paper1')?.status).toBe('to-read');
      expect(manager2.getStatus('paper2')?.status).toBe('reading');
      expect(manager2.getStatus('paper3')?.status).toBe('read');
    });

    it('should persist and restore timestamps', async () => {
      const manager1 = new ReadingStatusManager(mockContext);
      
      await manager1.setStatus('paper1', 'reading');
      const originalProgress = manager1.getStatus('paper1');
      const originalStartTime = originalProgress?.startedAt;
      
      // Create new manager (simulating restart)
      const manager2 = new ReadingStatusManager(mockContext);
      
      const restoredProgress = manager2.getStatus('paper1');
      expect(restoredProgress?.startedAt).toEqual(originalStartTime);
    });

    it('should persist and restore reading duration', async () => {
      const manager1 = new ReadingStatusManager(mockContext);
      
      await manager1.setStatus('paper1', 'reading');
      await manager1.setStatus('paper1', 'read');
      
      const originalProgress = manager1.getStatus('paper1');
      const originalDuration = originalProgress?.readingDuration;
      
      // Create new manager (simulating restart)
      const manager2 = new ReadingStatusManager(mockContext);
      
      const restoredProgress = manager2.getStatus('paper1');
      expect(restoredProgress?.readingDuration).toBe(originalDuration);
    });

    it('should maintain statistics across restarts', async () => {
      const manager1 = new ReadingStatusManager(mockContext);
      
      await manager1.setStatus('paper1', 'to-read');
      await manager1.setStatus('paper2', 'reading');
      await manager1.setStatus('paper3', 'read');
      
      const stats1 = manager1.getStatistics();
      
      // Create new manager (simulating restart)
      const manager2 = new ReadingStatusManager(mockContext);
      
      const stats2 = manager2.getStatistics();
      
      expect(stats2.toRead).toBe(stats1.toRead);
      expect(stats2.reading).toBe(stats1.reading);
      expect(stats2.read).toBe(stats1.read);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid status changes', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      await manager.setStatus('paper1', 'to-read');
      await manager.setStatus('paper1', 'reading');
      await manager.setStatus('paper1', 'read');
      await manager.setStatus('paper1', 'to-read');
      
      const progress = manager.getStatus('paper1');
      expect(progress?.status).toBe('to-read');
    });

    it('should handle many papers efficiently', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      // Add 100 papers
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(manager.setStatus(`paper${i}`, 'to-read'));
      }
      await Promise.all(promises);
      
      const stats = manager.getStatistics();
      expect(stats.toRead).toBe(100);
    });

    it('should handle papers with special characters in IDs', async () => {
      const manager = new ReadingStatusManager(mockContext);
      
      const specialId = 'paper-with-special_chars.123@test';
      await manager.setStatus(specialId, 'reading');
      
      const progress = manager.getStatus(specialId);
      expect(progress?.status).toBe('reading');
    });
  });
});
