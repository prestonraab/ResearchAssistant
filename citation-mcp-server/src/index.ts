#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const WORKSPACE_ROOT = process.env.CITATION_WORKSPACE_ROOT || process.cwd();
const EXTRACTED_TEXT_DIR = path.join(WORKSPACE_ROOT, 'literature', 'ExtractedText');
const CLAIMS_FILE = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'claims_and_evidence.md');
const SOURCES_FILE = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'sources.md');

interface SearchResult {
  file: string;
  author: string;
  year: string;
  matches: Array<{
    lineNumber: number;
    text: string;
    context: string;
  }>;
}

interface SourceInfo {
  sourceId: string;
  authorYear: string;
  authors: string;
  year: string;
  title: string;
}

// Normalize text for searching
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Load source mappings
function loadSourceMappings(): Map<string, SourceInfo> {
  const sources = new Map<string, SourceInfo>();
  
  if (!fs.existsSync(SOURCES_FILE)) {
    return sources;
  }

  const content = fs.readFileSync(SOURCES_FILE, 'utf-8');
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('|') && !line.includes('Source ID')) {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 6 && parts[1] && /^\d+$/.test(parts[1])) {
        sources.set(parts[2], {
          sourceId: parts[1],
          authorYear: parts[2],
          authors: parts[4],
          year: parts[5],
          title: parts[6]
        });
      }
    }
  }
  
  return sources;
}

// Search for text in extracted files
function searchInFiles(searchTerm: string, authorFilter?: string): SearchResult[] {
  if (!fs.existsSync(EXTRACTED_TEXT_DIR)) {
    return [];
  }

  const results: SearchResult[] = [];
  const files = fs.readdirSync(EXTRACTED_TEXT_DIR)
    .filter(f => f.endsWith('.txt'));

  const normalizedSearch = normalizeText(searchTerm);

  for (const filename of files) {
    // Apply author filter if provided
    if (authorFilter && !filename.toLowerCase().includes(authorFilter.toLowerCase())) {
      continue;
    }

    const filepath = path.join(EXTRACTED_TEXT_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');

    const matches: SearchResult['matches'] = [];

    for (let i = 0; i < lines.length; i++) {
      const normalizedLine = normalizeText(lines[i]);
      
      if (normalizedLine.includes(normalizedSearch)) {
        // Get context (2 lines before and after)
        const contextStart = Math.max(0, i - 2);
        const contextEnd = Math.min(lines.length, i + 3);
        const context = lines.slice(contextStart, contextEnd).join('\n');

        matches.push({
          lineNumber: i + 1,
          text: lines[i].trim(),
          context: context
        });
      }
    }

    if (matches.length > 0) {
      // Extract author and year from filename
      const match = filename.match(/^(.+?)\s+-\s+(\d{4})/);
      const author = match ? match[1] : filename;
      const year = match ? match[2] : '';

      results.push({
        file: filename,
        author,
        year,
        matches
      });
    }
  }

  return results;
}

// Verify a quote exists in source
function verifyQuote(quote: string, authorYear: string): {
  verified: boolean;
  similarity: number;
  sourceFile?: string;
  matchedText?: string;
} {
  if (!fs.existsSync(EXTRACTED_TEXT_DIR)) {
    return { verified: false, similarity: 0 };
  }

  const files = fs.readdirSync(EXTRACTED_TEXT_DIR)
    .filter(f => f.endsWith('.txt') && f.includes(authorYear));

  if (files.length === 0) {
    return { verified: false, similarity: 0 };
  }

  const sourceFile = files[0];
  const filepath = path.join(EXTRACTED_TEXT_DIR, sourceFile);
  const content = fs.readFileSync(filepath, 'utf-8');

  const normalizedQuote = normalizeText(quote);
  const normalizedContent = normalizeText(content);

  // Check for exact match
  if (normalizedContent.includes(normalizedQuote)) {
    return {
      verified: true,
      similarity: 1.0,
      sourceFile,
      matchedText: quote
    };
  }

  // Fuzzy matching with sliding window
  const quoteWords = normalizedQuote.split(' ');
  const contentWords = normalizedContent.split(' ');
  const windowSize = quoteWords.length;

  let bestSimilarity = 0;
  let bestMatch = '';

  for (let i = 0; i <= contentWords.length - windowSize; i++) {
    const window = contentWords.slice(i, i + windowSize).join(' ');
    
    // Simple similarity: count matching words
    const matchingWords = quoteWords.filter(word => window.includes(word)).length;
    const similarity = matchingWords / quoteWords.length;

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = window;
    }

    if (similarity >= 0.85) {
      break;
    }
  }

  return {
    verified: bestSimilarity >= 0.85,
    similarity: bestSimilarity,
    sourceFile,
    matchedText: bestMatch
  };
}

// Get available sources
function listSources(): SourceInfo[] {
  const sources = loadSourceMappings();
  return Array.from(sources.values());
}

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

// Define tools
const tools: Tool[] = [
  {
    name: 'search_quotes',
    description: 'Search for text in extracted source files. Returns exact quotes from papers. Use this to find quotes before adding them to claims_and_evidence.md to prevent hallucinations.',
    inputSchema: {
      type: 'object',
      properties: {
        search_term: {
          type: 'string',
          description: 'Text to search for in source files'
        },
        author_filter: {
          type: 'string',
          description: 'Optional: Filter by author name (e.g., "Johnson", "Soneson")'
        }
      },
      required: ['search_term']
    }
  },
  {
    name: 'verify_quote',
    description: 'Verify that a quote actually exists in a source file. Returns verification status and similarity score. Use this before adding quotes to claims_and_evidence.md.',
    inputSchema: {
      type: 'object',
      properties: {
        quote: {
          type: 'string',
          description: 'The quote text to verify'
        },
        author_year: {
          type: 'string',
          description: 'Author-year identifier (e.g., "Johnson2007", "Soneson2014")'
        }
      },
      required: ['quote', 'author_year']
    }
  },
  {
    name: 'list_sources',
    description: 'List all available sources with their metadata. Use this to see what papers are available.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_source_text',
    description: 'Get the full extracted text from a source file. Use this to read the complete paper text.',
    inputSchema: {
      type: 'object',
      properties: {
        author_year: {
          type: 'string',
          description: 'Author-year identifier (e.g., "Johnson2007")'
        }
      },
      required: ['author_year']
    }
  }
];

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error('No arguments provided');
  }

  try {
    switch (name) {
      case 'search_quotes': {
        const searchTerm = args.search_term as string;
        const authorFilter = args.author_filter as string | undefined;
        const results = searchInFiles(searchTerm, authorFilter);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      }

      case 'verify_quote': {
        const quote = args.quote as string;
        const authorYear = args.author_year as string;
        const result = verifyQuote(quote, authorYear);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'list_sources': {
        const sources = listSources();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(sources, null, 2)
          }]
        };
      }

      case 'get_source_text': {
        const authorYear = args.author_year as string;
        
        if (!fs.existsSync(EXTRACTED_TEXT_DIR)) {
          throw new Error('Extracted text directory not found');
        }

        const files = fs.readdirSync(EXTRACTED_TEXT_DIR)
          .filter(f => f.endsWith('.txt') && f.includes(authorYear));

        if (files.length === 0) {
          throw new Error(`No source file found for ${authorYear}`);
        }

        const filepath = path.join(EXTRACTED_TEXT_DIR, files[0]);
        const content = fs.readFileSync(filepath, 'utf-8');
        
        return {
          content: [{
            type: 'text',
            text: content
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${errorMessage}`
      }],
      isError: true
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
