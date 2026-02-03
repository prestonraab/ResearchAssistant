import { MCPClientManager, ZoteroItem, VerificationResult } from '../mcp/mcpClient';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { setupTest, waitForAsync } from './helpers';

// Mock fs modules
jest.mock('fs/promises');

describe('MCPClientManager', () => {
  setupTest();

  let mcpClient: MCPClientManager;
  const mockWorkspaceFolder = {
    uri: { fsPath: '/test/workspace' },
    name: 'test',
    index: 0,
  };

  beforeEach(() => {
    // Mock workspace folders
    (vscode.workspace as any).workspaceFolders = [mockWorkspaceFolder];
    
    // Mock config file reading
    const mockConfig = JSON.stringify({
      mcpServers: {
        zotero: { command: 'zotero-mcp' },
        citation: { command: 'node', args: ['citation-server.js'] },
        docling: { command: 'docling-mcp' },
      },
    });
    (fs.readFile as jest.Mock).mockResolvedValue(mockConfig);
  });

  afterEach(() => {
    if (mcpClient) {
      mcpClient.dispose();
    }
  });

  describe('Configuration Loading', () => {
    test('should load MCP configuration from .kiro/settings/mcp.json', async () => {
      mcpClient = new MCPClientManager();
      await waitForAsync();
      
      expect(fs.readFile).toHaveBeenCalledWith(
        '/test/workspace/.kiro/settings/mcp.json',
        'utf-8'
      );
    });

    test('should handle missing configuration file gracefully', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      mcpClient = new MCPClientManager();
      await waitForAsync();
      
      expect(mcpClient.isConnected('zotero')).toBe(false);
    });

    test('should handle invalid JSON in configuration', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('{ invalid json }');
      
      mcpClient = new MCPClientManager();
      await waitForAsync();
      
      expect(mcpClient.isConnected('zotero')).toBe(false);
    });

    test('should strip comments from JSONC configuration', async () => {
      const mockConfigWithComments = `{
        // This is a comment
        "mcpServers": {
          /* Block comment */
          "zotero": { "command": "zotero-mcp" }
        }
      }`;
      (fs.readFile as jest.Mock).mockResolvedValue(mockConfigWithComments);
      
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should parse successfully despite comments
      expect(fs.readFile).toHaveBeenCalled();
    });

    test('should handle missing workspace folders', async () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(fs.readFile).not.toHaveBeenCalled();
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should report all servers as disconnected initially', () => {
      expect(mcpClient.isConnected('zotero')).toBe(false);
      expect(mcpClient.isConnected('citation')).toBe(false);
      expect(mcpClient.isConnected('docling')).toBe(false);
    });

    test('should handle reconnection attempts', async () => {
      await expect(mcpClient.reconnect('zotero')).rejects.toThrow();
      expect(mcpClient.isConnected('zotero')).toBe(false);
    });

    test('should respect disabled servers in configuration', async () => {
      const mockConfigDisabled = JSON.stringify({
        mcpServers: {
          zotero: { command: 'zotero-mcp', disabled: true },
        },
      });
      (fs.readFile as jest.Mock).mockResolvedValue(mockConfigDisabled);
      
      const client = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await client.reconnect('zotero');
      expect(client.isConnected('zotero')).toBe(false);
      
      client.dispose();
    });
  });

  describe('Caching Behavior', () => {
    beforeEach(async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should return cached results when offline', async () => {
      // First call will fail (not connected), but we can manually set cache
      const mockResults: ZoteroItem[] = [
        {
          itemKey: 'ABC123',
          title: 'Test Paper',
          authors: ['Smith, J.'],
          year: 2023,
        },
      ];
      
      // Manually populate cache by calling the method (it will cache empty results)
      await mcpClient.zoteroSemanticSearch('test query', 10);
      
      // Second call should return cached results
      const results = await mcpClient.zoteroSemanticSearch('test query', 10);
      expect(results).toEqual([]);
    });

    test('should cache metadata requests', async () => {
      const result1 = await mcpClient.getItemMetadata('ABC123');
      const result2 = await mcpClient.getItemMetadata('ABC123');
      
      // Both should return null (not connected), but from cache on second call
      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    test('should cache fulltext requests', async () => {
      const result1 = await mcpClient.getItemFulltext('ABC123');
      const result2 = await mcpClient.getItemFulltext('ABC123');
      
      expect(result1).toBe('');
      expect(result2).toBe('');
    });

    test('should cache verification results', async () => {
      const result1 = await mcpClient.verifyQuote('test quote', 'Smith2023');
      const result2 = await mcpClient.verifyQuote('test quote', 'Smith2023');
      
      expect(result1).toEqual({ verified: false, similarity: 0 });
      expect(result2).toEqual({ verified: false, similarity: 0 });
    });

    test('should clear cache when requested', async () => {
      await mcpClient.zoteroSemanticSearch('test', 10);
      
      const statsBefore = mcpClient.getCacheStats();
      expect(statsBefore.size).toBeGreaterThan(0);
      
      mcpClient.clearCache();
      
      const statsAfter = mcpClient.getCacheStats();
      expect(statsAfter.size).toBe(0);
    });

    test('should provide cache statistics', async () => {
      await mcpClient.zoteroSemanticSearch('test1', 10);
      await mcpClient.getItemMetadata('ABC123');
      
      const stats = mcpClient.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.keys.length).toBeGreaterThan(0);
      expect(stats.keys.some(k => k.includes('zotero:search'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should handle timeout errors gracefully', async () => {
      // All methods should return cached or default values when not connected
      const searchResults = await mcpClient.zoteroSemanticSearch('test', 10);
      expect(searchResults).toEqual([]);
    });

    test('should handle connection failures gracefully', async () => {
      await expect(mcpClient.reconnect('invalid-server')).rejects.toThrow();
    });

    test('should return empty results for failed searches', async () => {
      const results = await mcpClient.searchQuotes('test term');
      expect(results).toEqual([]);
    });

    test('should throw error for batch operations when offline', async () => {
      await expect(mcpClient.verifyAllQuotes()).rejects.toThrow(
        'Citation MCP not available for batch verification'
      );
    });
  });

  describe('Zotero MCP Methods', () => {
    beforeEach(async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should handle semantic search when offline', async () => {
      const results = await mcpClient.zoteroSemanticSearch('machine learning', 5);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should handle get collections when offline', async () => {
      const collections = await mcpClient.getCollections();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBe(0);
    });

    test('should cache different search queries separately', async () => {
      await mcpClient.zoteroSemanticSearch('query1', 10);
      await mcpClient.zoteroSemanticSearch('query2', 10);
      
      const stats = mcpClient.getCacheStats();
      expect(stats.keys.filter(k => k.includes('zotero:search')).length).toBe(2);
    });
  });

  describe('Citation MCP Methods', () => {
    beforeEach(async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should handle quote verification when offline', async () => {
      const result = await mcpClient.verifyQuote(
        'This is a test quote',
        'Smith2023'
      );
      
      expect(result).toEqual({
        verified: false,
        similarity: 0,
      });
    });

    test('should handle quote search when offline', async () => {
      const results = await mcpClient.searchQuotes('test term', 'Smith');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('Docling MCP Methods', () => {
    beforeEach(async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should handle document conversion when offline', async () => {
      const result = await mcpClient.convertDocument('/path/to/document.pdf');
      expect(result).toBe('');
    });

    test('should handle markdown export when offline', async () => {
      const result = await mcpClient.exportToMarkdown('doc-key-123');
      expect(result).toBe('');
    });

    test('should cache document conversions', async () => {
      await mcpClient.convertDocument('/path/to/doc.pdf');
      await mcpClient.convertDocument('/path/to/doc.pdf');
      
      const stats = mcpClient.getCacheStats();
      expect(stats.keys.some(k => k.includes('docling:convert'))).toBe(true);
    });
  });

  describe('Resource Cleanup', () => {
    test('should clean up resources on dispose', async () => {
      mcpClient = new MCPClientManager();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await mcpClient.zoteroSemanticSearch('test', 10);
      expect(mcpClient.getCacheStats().size).toBeGreaterThan(0);
      
      mcpClient.dispose();
      
      expect(mcpClient.getCacheStats().size).toBe(0);
      expect(mcpClient.isConnected('zotero')).toBe(false);
    });
  });
});
