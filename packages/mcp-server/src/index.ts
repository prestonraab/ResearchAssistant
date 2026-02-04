#!/usr/bin/env node

/**
 * MCP Server - Thin adapter exposing core services via Model Context Protocol
 * 
 * This server is a lightweight wrapper around @research-assistant/core that:
 * - Initializes core services with configuration
 * - Exposes tools via MCP protocol
 * - Delegates all business logic to core services
 * 
 * Target: < 300 lines (thin adapter pattern)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as path from 'path';
import { loadConfig, validateConfig } from './config.js';
import { tools } from './tools.js';
import { handleToolCall, Services } from './handlers.js';
import {
  EmbeddingService,
  ClaimsManager,
  OutlineParser,
  SearchService,
  CoverageAnalyzer,
  ClaimStrengthCalculator,
  PaperRanker,
  ClaimExtractor,
  SynthesisEngine,
  SearchQueryGenerator,
  LiteratureIndexer,
} from '@research-assistant/core';
import { ZoteroClient } from '@research-assistant/core';
import { DoclingService } from './services/DoclingService.js';

// Load and validate configuration
const config = loadConfig();
const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error('Configuration errors:', configErrors);
  process.exit(1);
}

// Initialize core services
let embeddingService: EmbeddingService;
if (config.openaiApiKey) {
  embeddingService = new EmbeddingService(
    config.openaiApiKey,
    path.join(config.workspaceRoot, config.embeddingCacheDir),
    config.maxCacheSize,
    config.embeddingModel
  );
  console.error('✓ Embedding service initialized');
} else {
  console.error('⚠ OPENAI_API_KEY not set. Embedding-dependent tools will not work.');
  // Create a stub embedding service that throws errors when used
  embeddingService = new EmbeddingService(
    'stub-key',
    path.join(config.workspaceRoot, config.embeddingCacheDir),
    config.maxCacheSize,
    config.embeddingModel
  );
}

const claimsManager = new ClaimsManager(config.workspaceRoot);
const searchService = new SearchService(embeddingService, claimsManager, config.similarityThreshold);
const outlineParser = new OutlineParser();
const manuscriptFile = path.join(config.workspaceRoot, '03_Drafting', 'manuscript.md');
const literatureIndexer = new LiteratureIndexer(
  config.workspaceRoot,
  embeddingService
);

// Initialize Zotero client if credentials are available
let zoteroClient: ZoteroClient | undefined;
const zoteroApiKey = config.zoteroApiKey;
const zoteroUserId = config.zoteroUserId;

if (zoteroApiKey && zoteroUserId) {
  zoteroClient = new ZoteroClient();
  zoteroClient.initialize(zoteroApiKey, zoteroUserId);
  console.error('✓ Zotero client initialized');
} else {
  console.error('⚠ Zotero credentials not found in .env. Set ZOTERO_API_KEY and ZOTERO_USER_ID to enable Zotero tools');
}

// Initialize Docling service
const doclingService = new DoclingService();
console.error('✓ Docling service initialized');

const services: Services = {
  embeddingService,
  claimsManager,
  searchService,
  outlineParser,
  coverageAnalyzer: new CoverageAnalyzer(outlineParser, searchService, manuscriptFile, config.similarityThreshold),
  claimStrengthCalculator: new ClaimStrengthCalculator(embeddingService, claimsManager, config.similarityThreshold, config.workspaceRoot),
  paperRanker: new PaperRanker(embeddingService, outlineParser, 50, config.citationBoostFactor, 200, 500),
  claimExtractor: new ClaimExtractor(embeddingService),
  synthesisEngine: new SynthesisEngine(embeddingService),
  searchQueryGenerator: new SearchQueryGenerator(outlineParser),
  literatureIndexer,
  zoteroClient,
  doclingService,
  workspaceRoot: config.workspaceRoot,
};

console.error('✓ All services initialized successfully');

// Auto-load claims and outline on startup
(async () => {
  try {
    console.error('Loading claims database...');
    await claimsManager.loadClaims();
    const claimCount = claimsManager.getAllClaims().length;
    console.error(`✓ Loaded ${claimCount} claims`);
  } catch (error) {
    console.error('⚠ Failed to load claims:', error instanceof Error ? error.message : String(error));
  }

  try {
    console.error('Parsing outline...');
    const outlinePath = path.join(config.workspaceRoot, '03_Drafting', 'outline.md');
    await outlineParser.parse(outlinePath);
    const sectionCount = outlineParser.getSections().length;
    console.error(`✓ Parsed ${sectionCount} sections from outline`);
  } catch (error) {
    console.error('⚠ Failed to parse outline:', error instanceof Error ? error.message : String(error));
  }

  try {
    console.error('Indexing literature files (this may take a few minutes on first run)...');
    const stats = await literatureIndexer.indexChangedFiles();
    console.error(`✓ Literature indexed: ${stats.indexed} new, ${stats.skipped} unchanged, ${stats.errors} errors`);
    
    if (stats.indexed === 0 && stats.skipped === 0) {
      console.error('⚠ No literature files found or indexed. Check that literature/ExtractedText exists and contains .txt files');
    }
  } catch (error) {
    console.error('⚠ Failed to index literature:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
  }
})();

// Create MCP server
const server = new Server(
  {
    name: 'citation-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool call requests - delegate to handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: args } = request.params;

  try {
    const result = await handleToolCall(toolName, args || {}, services);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error handling tool '${toolName}':`, errorMessage);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            tool: toolName,
          }, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Citation MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
