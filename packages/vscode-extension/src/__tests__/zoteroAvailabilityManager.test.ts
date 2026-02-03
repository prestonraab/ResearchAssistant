import { jest } from '@jest/globals';

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
import { MCPClientManager } from '../mcp/mcpClient';

describe('ZoteroAvailabilityManager', () => {
  let manager: ZoteroAvailabilityManager;
  let mockMcpClient: jest.Mocked<MCPClientManager>;

  beforeEach(() => {
    // Create mock MCP client fresh for each test
    mockMcpClient = {
      reconnect: jest.fn(),
      isConnected: jest.fn(),
      dispose: jest.fn(),
    } as any;
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
  });

  describe('initialization', () => {
    it('should initialize with unavailable status by default', async () => {
      manager = new ZoteroAvailabilityManager(mockMcpClient);
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    it('should perform initial availability check on initialize', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      manager = new ZoteroAvailabilityManager(mockMcpClient);
      await manager.initialize();

      expect(mockMcpClient.reconnect).toHaveBeenCalledWith('zotero');
    });

    it('should handle initialization errors gracefully', async () => {
      mockMcpClient.reconnect.mockRejectedValue(new Error('Connection failed'));

      manager = new ZoteroAvailabilityManager(mockMcpClient);
      await manager.initialize();

      expect(manager.getAvailabilityStatus()).toBe(false);
    });
  });

  describe('checkAvailability', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockMcpClient);
    });

    it('should return true when Zotero is available', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      const result = await manager.checkAvailability();

      expect(result).toBe(true);
      expect(manager.getAvailabilityStatus()).toBe(true);
    });

    it('should return false when Zotero is unavailable', async () => {
      mockMcpClient.reconnect.mockRejectedValue(new Error('Connection failed'));

      const result = await manager.checkAvailability();

      expect(result).toBe(false);
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    it('should timeout if availability check takes too long', async () => {
      mockMcpClient.reconnect.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await manager.checkAvailability();

      expect(result).toBe(false);
    });

    it('should cache availability check results', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      // First check
      await manager.checkAvailability();
      expect(mockMcpClient.reconnect).toHaveBeenCalledTimes(1);

      // Second check should use cache
      await manager.checkAvailability();
      expect(mockMcpClient.reconnect).toHaveBeenCalledTimes(1);
    });

    it('should prevent concurrent availability checks', async () => {
      mockMcpClient.reconnect.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      // Start two checks concurrently
      const check1 = manager.checkAvailability();
      const check2 = manager.checkAvailability();

      await Promise.all([check1, check2]);

      // Should only call reconnect once due to concurrency prevention
      expect(mockMcpClient.reconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('availability status', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockMcpClient);
    });

    it('should return current availability status', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      expect(manager.getAvailabilityStatus()).toBe(false);

      await manager.checkAvailability();

      expect(manager.getAvailabilityStatus()).toBe(true);
    });
  });

  describe('availability change notifications', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockMcpClient);
    });

    it('should notify listeners when availability changes from unavailable to available', async () => {
      const listener = jest.fn();
      manager.onAvailabilityStatusChanged(listener);

      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      await manager.checkAvailability();

      expect(listener).toHaveBeenCalledWith(true);
    });

    it('should notify listeners when availability changes from available to unavailable', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      await manager.checkAvailability();

      const listener = jest.fn();
      manager.onAvailabilityStatusChanged(listener);

      mockMcpClient.reconnect.mockRejectedValue(new Error('Connection lost'));
      mockMcpClient.isConnected.mockReturnValue(false);

      // Clear cache to force new check
      await manager.forceRecheck();

      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should not notify listeners if availability does not change', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

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
      manager = new ZoteroAvailabilityManager(mockMcpClient);
    });

    it('should disable Zotero commands when unavailable', async () => {
      mockMcpClient.reconnect.mockRejectedValue(new Error('Connection failed'));

      await manager.checkAvailability();

      // Verify that the manager attempted to disable features
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    it('should hide Zotero UI elements when unavailable', async () => {
      mockMcpClient.reconnect.mockRejectedValue(new Error('Connection failed'));

      await manager.checkAvailability();

      // Verify that the manager attempted to hide UI elements
      expect(manager.getAvailabilityStatus()).toBe(false);
    });
  });

  describe('feature enabling', () => {
    it('should transition to available state when Zotero is available', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      manager = new ZoteroAvailabilityManager(mockMcpClient);
      
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
    it('should bypass cache and perform immediate check', async () => {
      mockMcpClient.reconnect.mockResolvedValue(undefined);
      mockMcpClient.isConnected.mockReturnValue(true);

      manager = new ZoteroAvailabilityManager(mockMcpClient);

      // First check
      await manager.checkAvailability();
      expect(mockMcpClient.reconnect).toHaveBeenCalledTimes(1);

      // Force recheck should bypass cache
      await manager.forceRecheck();
      expect(mockMcpClient.reconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe('disposal', () => {
    beforeEach(() => {
      manager = new ZoteroAvailabilityManager(mockMcpClient);
    });

    it('should dispose resources on dispose', () => {
      manager.dispose();

      // Should not throw any errors
      expect(manager.getAvailabilityStatus()).toBe(false);
    });

    it('should clear intervals on dispose', async () => {
      await manager.initialize();

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      manager.dispose();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
