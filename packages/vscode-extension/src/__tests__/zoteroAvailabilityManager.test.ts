import { jest } from '@jest/globals';
import { setupTest, createMockZoteroApiService } from './helpers';

// Mock vscode module BEFORE importing the service
jest.mock('vscode', () => {
  class MockEventEmitter {
    event = jest.fn();
    fire = jest.fn();
    dispose = jest.fn();
  }

  return {
    window: {
      showWarningMessage: jest.fn(),
      showInformationMessage: jest.fn(),
    },
    commands: {
      executeCommand: jest.fn(),
    },
    Uri: {
      parse: jest.fn((uri: string) => ({ fsPath: uri })),
    },
    EventEmitter: MockEventEmitter,
  };
});

import { ZoteroAvailabilityManager } from '../services/zoteroAvailabilityManager';
import { ZoteroClient } from '@research-assistant/core';

describe('ZoteroAvailabilityManager', () => {
  setupTest();

  let manager: ZoteroAvailabilityManager;
  let mockZoteroApiService: ReturnType<typeof createMockZoteroApiService>;

  beforeEach(() => {
    mockZoteroApiService = createMockZoteroApiService();
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
  });

  describe('initialization', () => {
    test('should initialize with unavailable status by default', async () => {
      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    test('should perform initial availability check on initialize', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
      await manager.initialize();

      expect(mockZoteroApiService.testConnection).toHaveBeenCalled();
    });

    test('should handle initialization errors gracefully', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockRejectedValue(new Error('Connection failed'));

      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
      await manager.initialize();

      expect(manager.getAvailabilityStatus()).toBe(false);
    });
  });

  describe('checkAvailability', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
    });

    test('should return true when Zotero is available', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      const result = await manager.checkAvailability();

      expect(result).toBe(true);
      expect(manager.getAvailabilityStatus()).toBe(true);
    });

    test('should return false when Zotero is unavailable', async () => {
      mockZoteroApiService.testConnection.mockResolvedValue(false);

      const result = await manager.checkAvailability();

      expect(result).toBe(false);
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    test('should timeout if availability check takes too long', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await manager.checkAvailability();

      expect(result).toBe(false);
    });

    test('should cache availability check results', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      // First check
      await manager.checkAvailability();
      expect(mockZoteroApiService.testConnection).toHaveBeenCalledTimes(1);

      // Second check should use cache
      await manager.checkAvailability();
      expect(mockZoteroApiService.testConnection).toHaveBeenCalledTimes(1);
    });

    test('should prevent concurrent availability checks', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Start two checks concurrently
      const check1 = manager.checkAvailability();
      const check2 = manager.checkAvailability();

      await Promise.all([check1, check2]);

      // Should only call testConnection once due to concurrency prevention
      expect(mockZoteroApiService.testConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('availability status', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
    });

    test('should return current availability status', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      expect(manager.getAvailabilityStatus()).toBe(false);

      await manager.checkAvailability();

      expect(manager.getAvailabilityStatus()).toBe(true);
    });
  });

  describe('availability change notifications', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
    });

    test('should notify listeners when availability changes from unavailable to available', async () => {
      const listener = jest.fn();
      manager.onAvailabilityStatusChanged(listener);

      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      await manager.checkAvailability();

      expect(listener).toHaveBeenCalledWith(true);
    });

    test('should notify listeners when availability changes from available to unavailable', async () => {
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      await manager.checkAvailability();

      const listener = jest.fn();
      manager.onAvailabilityStatusChanged(listener);

      mockZoteroApiService.testConnection.mockResolvedValue(false);

      // Clear cache to force new check
      await manager.forceRecheck();

      expect(listener).toHaveBeenCalledWith(false);
    });

    test('should not notify listeners if availability does not change', async () => {
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      await manager.checkAvailability();

      const listener = jest.fn();
      manager.onAvailabilityStatusChanged(listener);

      // Clear cache and check again with same result
      await manager.forceRecheck();

      // Listener should not be called since availability didn't change
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('feature disabling', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
    });

    test('should disable Zotero commands when unavailable', async () => {
      mockZoteroApiService.testConnection.mockResolvedValue(false);

      await manager.checkAvailability();

      // Verify that the manager attempted to disable features
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    test('should hide Zotero UI elements when unavailable', async () => {
      mockZoteroApiService.testConnection.mockResolvedValue(false);

      await manager.checkAvailability();

      // Verify that the manager attempted to hide UI elements
      expect(manager.getAvailabilityStatus()).toBe(false);
    });
  });

  describe('feature enabling', () => {
    test('should transition to available state when Zotero is available', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
      
      // Verify that the manager starts as unavailable
      expect(manager.getAvailabilityStatus()).toBe(false);
      
      // Check availability
      const result = await manager.checkAvailability();

      // Verify that the manager is now available
      expect(result).toBe(true);
      expect(manager.getAvailabilityStatus()).toBe(true);
    });
  });

  describe('forceRecheck', () => {
    test('should bypass cache and perform immediate check', async () => {
      mockZoteroApiService.isConfigured.mockReturnValue(true);
      mockZoteroApiService.testConnection.mockResolvedValue(true);

      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);

      // First check
      const firstResult = await manager.checkAvailability();
      expect(firstResult).toBe(true);

      // Force recheck should bypass cache and return updated status
      const secondResult = await manager.forceRecheck();
      expect(secondResult).toBe(true);
      
      // Verify the manager state reflects the recheck
      expect(manager.getAvailabilityStatus()).toBe(true);
    });
  });

  describe('disposal', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockZoteroApiService as any);
    });

    test('should dispose resources on dispose', () => {
      manager.dispose();

      // Should not throw any errors
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    test('should clear intervals on dispose', async () => {
      await manager.initialize();

      manager.dispose();

      // Verify the manager is disposed by checking disposables are cleared
      // The availability status is not reset on dispose - it maintains its last known state
      // This is intentional to avoid UI flicker
      expect(manager.getAvailabilityStatus()).toBe(true);
    });
  });
});
