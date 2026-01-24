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
import { loadConfig, validateConfig } from './config.js';
import { EmbeddingService } from './core/EmbeddingService.js';
import { ClaimsManager } from './core/ClaimsManager.js';
import { SearchService } from './services/SearchService.js';

// Configuration
const WORKSPACE_ROOT = process.env.CITATION_WORKSPACE_ROOT || process.cwd();
const EXTRACTED_TEXT_DIR = path.join(WORKSPACE_ROOT, 'literature', 'ExtractedText');
const CLAIMS_FILE = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'claims_and_evidence.md');
const CLAIMS_DIR = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'claims');
const SOURCES_FILE = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'sources.md');

// Initialize services
const config = loadConfig();
const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error('Configuration errors:', configErrors);
}

let embeddingService: EmbeddingService | null = null;
let claimsManager: ClaimsManager | null = null;
let searchService: SearchService | null = null;

// Initialize services if API key is available
if (config.openaiApiKey) {
  embeddingService = new EmbeddingService(
    config.openaiApiKey,
    path.join(config.workspaceRoot, config.embeddingCacheDir),
    config.maxCacheSize,
    config.embeddingModel
  );
  claimsManager = new ClaimsManager(config.workspaceRoot);
  searchService = new SearchService(
    embeddingService,
    claimsManager,
    config.similarityThreshold
  );
}

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

// Normalize text for matching (handles Unicode characters)
function normalizeForMatching(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s\d]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Flexible author-year matching
function matchesAuthorYear(filename: string, authorYear: string): boolean {
  const normalizedFilename = normalizeForMatching(filename);
  const normalizedAuthorYear = normalizeForMatching(authorYear);
  
  // Direct match
  if (normalizedFilename.includes(normalizedAuthorYear)) {
    return true;
  }
  
  // Extract year from authorYear (last 4 digits)
  const yearMatch = authorYear.match(/(\d{4})/);
  if (!yearMatch) {
    return false;
  }
  const year = yearMatch[1];
  
  // Extract author part (everything before the year)
  const authorPart = authorYear.replace(/\d{4}/, '').trim();
  const normalizedAuthorPart = normalizeForMatching(authorPart);
  
  // Must have the year
  const hasYear = normalizedFilename.includes(year);
  if (!hasYear) {
    return false;
  }
  
  // Check if author part matches (handling "et al." variations)
  const authorWords = normalizedAuthorPart.split(/\s+/).filter(w => w.length > 2);
  
  // If we have author words, at least one significant word must match
  if (authorWords.length > 0) {
    for (const word of authorWords) {
      if (normalizedFilename.includes(word)) {
        return true;
      }
    }
  }
  
  // Fallback: if the author part is very short (like "Du"), be more lenient
  // Check if it appears as a word boundary in the filename
  if (authorPart.length <= 4) {
    const authorRegex = new RegExp(`\\b${normalizedAuthorPart}\\b`, 'i');
    if (authorRegex.test(normalizedFilename)) {
      return true;
    }
  }
  
  return false;
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

// Search for text in extracted files with fuzzy matching
function searchInFiles(searchTerm: string, authorFilter?: string): SearchResult[] {
  if (!fs.existsSync(EXTRACTED_TEXT_DIR)) {
    return [];
  }

  const results: SearchResult[] = [];
  const files = fs.readdirSync(EXTRACTED_TEXT_DIR)
    .filter(f => f.endsWith('.txt'));

  const normalizedSearch = normalizeText(searchTerm);
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);

  for (const filename of files) {
    // Apply author filter if provided (flexible matching)
    if (authorFilter && !matchesAuthorYear(filename, authorFilter)) {
      continue;
    }

    const filepath = path.join(EXTRACTED_TEXT_DIR, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    const lines = content.split('\n');
    const normalizedContent = normalizeText(content);

    const matches: SearchResult['matches'] = [];

    // First try exact match
    if (normalizedContent.includes(normalizedSearch)) {
      // Find all occurrences
      let searchIndex = 0;
      while (true) {
        const foundIndex = normalizedContent.indexOf(normalizedSearch, searchIndex);
        if (foundIndex === -1) break;

        // Find which line this is in
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineLength = normalizeText(lines[i]).length + 1;
          if (charCount <= foundIndex && charCount + lineLength > foundIndex) {
            // Get context (2 lines before and after)
            const contextStart = Math.max(0, i - 2);
            const contextEnd = Math.min(lines.length, i + 3);
            const context = lines.slice(contextStart, contextEnd).join('\n');

            matches.push({
              lineNumber: i + 1,
              text: lines[i].trim(),
              context: context
            });
            break;
          }
          charCount += lineLength;
        }

        searchIndex = foundIndex + normalizedSearch.length;
      }
    } else {
      // Fuzzy matching: find lines with high word overlap
      for (let i = 0; i < lines.length; i++) {
        const normalizedLine = normalizeText(lines[i]);
        
        // Count matching words
        const matchingWords = searchWords.filter(word => normalizedLine.includes(word)).length;
        const similarity = searchWords.length > 0 ? matchingWords / searchWords.length : 0;
        
        // Include if similarity is high enough (>= 70%)
        if (similarity >= 0.7) {
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
  contextBefore?: string;
  contextAfter?: string;
  nearestMatch?: string;
  error?: string;
  availableFiles?: string[];
  searchedDirectory?: string;
} {
  // Check if directory exists
  if (!fs.existsSync(EXTRACTED_TEXT_DIR)) {
    return { 
      verified: false, 
      similarity: 0,
      error: `Extracted text directory not found: ${EXTRACTED_TEXT_DIR}`,
      searchedDirectory: EXTRACTED_TEXT_DIR
    };
  }

  // Get all available files
  const allFiles = fs.readdirSync(EXTRACTED_TEXT_DIR)
    .filter(f => f.endsWith('.txt'));

  // Find files matching the author-year pattern (flexible matching)
  const files = allFiles.filter(f => matchesAuthorYear(f, authorYear));

  if (files.length === 0) {
    return { 
      verified: false, 
      similarity: 0,
      error: `No source file found matching "${authorYear}"`,
      availableFiles: allFiles.slice(0, 10), // Show first 10 files as examples
      searchedDirectory: EXTRACTED_TEXT_DIR
    };
  }

  const sourceFile = files[0];
  const filepath = path.join(EXTRACTED_TEXT_DIR, sourceFile);
  
  let content: string;
  try {
    content = fs.readFileSync(filepath, 'utf-8');
  } catch (err) {
    return {
      verified: false,
      similarity: 0,
      error: `Failed to read source file: ${err instanceof Error ? err.message : String(err)}`,
      sourceFile,
      searchedDirectory: EXTRACTED_TEXT_DIR
    };
  }

  const normalizedQuote = normalizeText(quote);
  const normalizedContent = normalizeText(content);
  const lines = content.split('\n');

  // Check for exact match
  if (normalizedContent.includes(normalizedQuote)) {
    // Find the exact location in the original text to get context
    const quoteStart = normalizedContent.indexOf(normalizedQuote);
    const quoteEnd = quoteStart + normalizedQuote.length;
    
    // Find line numbers for context
    let charCount = 0;
    let startLine = 0;
    let endLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const lineLength = normalizeText(lines[i]).length + 1; // +1 for newline
      if (charCount <= quoteStart && charCount + lineLength > quoteStart) {
        startLine = i;
      }
      if (charCount <= quoteEnd && charCount + lineLength >= quoteEnd) {
        endLine = i;
        break;
      }
      charCount += lineLength;
    }
    
    // Get context (2 lines before and after)
    const contextStart = Math.max(0, startLine - 2);
    const contextEnd = Math.min(lines.length - 1, endLine + 2);
    const contextBefore = lines.slice(contextStart, startLine).join('\n');
    const contextAfter = lines.slice(endLine + 1, contextEnd + 1).join('\n');
    
    return {
      verified: true,
      similarity: 1.0,
      sourceFile,
      matchedText: quote,
      contextBefore: contextBefore || undefined,
      contextAfter: contextAfter || undefined,
      searchedDirectory: EXTRACTED_TEXT_DIR
    };
  }

  // Fuzzy matching with sliding window to find nearest match
  const quoteWords = normalizedQuote.split(' ');
  const contentWords = normalizedContent.split(' ');
  const windowSize = quoteWords.length;

  let bestSimilarity = 0;
  let bestMatchIndex = 0;
  let bestMatch = '';

  for (let i = 0; i <= contentWords.length - windowSize; i++) {
    const window = contentWords.slice(i, i + windowSize).join(' ');
    
    // Simple similarity: count matching words
    const matchingWords = quoteWords.filter(word => window.includes(word)).length;
    const similarity = matchingWords / quoteWords.length;

    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatchIndex = i;
      bestMatch = window;
    }

    if (similarity >= 0.85) {
      break;
    }
  }

  // Find the best match in the original text to get proper context
  if (bestSimilarity > 0) {
    // Reconstruct position in original text
    let charCount = 0;
    let wordCount = 0;
    let matchStartLine = 0;
    let matchEndLine = 0;
    
    const normalizedLines = lines.map(l => normalizeText(l));
    
    for (let i = 0; i < normalizedLines.length; i++) {
      const lineWords = normalizedLines[i].split(' ').filter(w => w.length > 0);
      
      if (wordCount <= bestMatchIndex && wordCount + lineWords.length > bestMatchIndex) {
        matchStartLine = i;
      }
      if (wordCount <= bestMatchIndex + windowSize && wordCount + lineWords.length >= bestMatchIndex + windowSize) {
        matchEndLine = i;
        break;
      }
      
      wordCount += lineWords.length;
    }
    
    // Get context (2 lines before and after)
    const contextStart = Math.max(0, matchStartLine - 2);
    const contextEnd = Math.min(lines.length - 1, matchEndLine + 2);
    const contextBefore = lines.slice(contextStart, matchStartLine).join('\n');
    const contextAfter = lines.slice(matchEndLine + 1, contextEnd + 1).join('\n');
    const nearestMatch = lines.slice(matchStartLine, matchEndLine + 1).join('\n');
    
    return {
      verified: bestSimilarity >= 0.85,
      similarity: bestSimilarity,
      sourceFile,
      matchedText: bestMatch,
      nearestMatch: nearestMatch || undefined,
      contextBefore: contextBefore || undefined,
      contextAfter: contextAfter || undefined,
      searchedDirectory: EXTRACTED_TEXT_DIR
    };
  }

  return {
    verified: false,
    similarity: bestSimilarity,
    sourceFile,
    matchedText: bestMatch,
    searchedDirectory: EXTRACTED_TEXT_DIR
  };
}

// Get available sources
function listSources(): SourceInfo[] {
  const sources = loadSourceMappings();
  return Array.from(sources.values());
}

// Parse claims_and_evidence.md and extract all quotes
interface ClaimQuote {
  claimId: string;
  claimTitle: string;
  authorYear: string;
  quote: string;
  quoteType: 'Primary' | 'Supporting';
  lineNumber: number;
  sourceFile: string;
}

function extractQuotesFromClaims(): ClaimQuote[] {
  const quotes: ClaimQuote[] = [];
  
  // Check if claims are in separate files (new structure)
  if (fs.existsSync(CLAIMS_DIR)) {
    const claimFiles = fs.readdirSync(CLAIMS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(CLAIMS_DIR, f));
    
    for (const filepath of claimFiles) {
      const content = fs.readFileSync(filepath, 'utf-8');
      const lines = content.split('\n');
      const filename = path.basename(filepath);
      
      let currentClaimId = '';
      let currentClaimTitle = '';
      let currentAuthorYear = '';
      let inQuote = false;
      let currentQuote = '';
      let currentQuoteType: 'Primary' | 'Supporting' = 'Primary';
      let quoteStartLine = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match claim headers like "## C_01: ..."
        const claimMatch = line.match(/^## (C_\d+[a-z]?):\s*(.+)$/);
        if (claimMatch) {
          currentClaimId = claimMatch[1];
          currentClaimTitle = claimMatch[2];
          currentAuthorYear = '';
          continue;
        }

        // Match source line like "**Source**: Johnson2007 (Source ID: 1)"
        const sourceMatch = line.match(/\*\*Source\*\*:\s*(\w+\d{4})/);
        if (sourceMatch) {
          currentAuthorYear = sourceMatch[1];
          continue;
        }

        // Match quote type headers
        if (line.includes('**Primary Quote**')) {
          currentQuoteType = 'Primary';
          continue;
        }
        if (line.includes('**Supporting Quotes**')) {
          currentQuoteType = 'Supporting';
          continue;
        }

        // Start of quote (line starting with ">")
        if (line.trim().startsWith('>') && !inQuote) {
          inQuote = true;
          quoteStartLine = i + 1;
          currentQuote = line.trim().substring(1).trim(); // Remove ">" and trim
          continue;
        }

        // Continuation of quote
        if (inQuote && line.trim().startsWith('>')) {
          currentQuote += ' ' + line.trim().substring(1).trim();
          continue;
        }

        // End of quote
        if (inQuote && !line.trim().startsWith('>')) {
          inQuote = false;
          if (currentQuote && currentAuthorYear && currentClaimId) {
            // Remove surrounding quotes if present
            const cleanQuote = currentQuote.replace(/^[""]|[""]$/g, '').trim();
            quotes.push({
              claimId: currentClaimId,
              claimTitle: currentClaimTitle,
              authorYear: currentAuthorYear,
              quote: cleanQuote,
              quoteType: currentQuoteType,
              lineNumber: quoteStartLine,
              sourceFile: filename
            });
          }
          currentQuote = '';
        }
      }
    }
  }
  // Fallback to old single-file structure
  else if (fs.existsSync(CLAIMS_FILE)) {
    const content = fs.readFileSync(CLAIMS_FILE, 'utf-8');
    const lines = content.split('\n');

    let currentClaimId = '';
    let currentClaimTitle = '';
    let currentAuthorYear = '';
    let inQuote = false;
    let currentQuote = '';
    let currentQuoteType: 'Primary' | 'Supporting' = 'Primary';
    let quoteStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match claim headers like "## C_01: ..."
      const claimMatch = line.match(/^## (C_\d+[a-z]?):\s*(.+)$/);
      if (claimMatch) {
        currentClaimId = claimMatch[1];
        currentClaimTitle = claimMatch[2];
        currentAuthorYear = '';
        continue;
      }

      // Match source line like "**Source**: Johnson2007 (Source ID: 1)"
      const sourceMatch = line.match(/\*\*Source\*\*:\s*(\w+\d{4})/);
      if (sourceMatch) {
        currentAuthorYear = sourceMatch[1];
        continue;
      }

      // Match quote type headers
      if (line.includes('**Primary Quote**')) {
        currentQuoteType = 'Primary';
        continue;
      }
      if (line.includes('**Supporting Quotes**')) {
        currentQuoteType = 'Supporting';
        continue;
      }

      // Start of quote (line starting with ">")
      if (line.trim().startsWith('>') && !inQuote) {
        inQuote = true;
        quoteStartLine = i + 1;
        currentQuote = line.trim().substring(1).trim(); // Remove ">" and trim
        continue;
      }

      // Continuation of quote
      if (inQuote && line.trim().startsWith('>')) {
        currentQuote += ' ' + line.trim().substring(1).trim();
        continue;
      }

      // End of quote
      if (inQuote && !line.trim().startsWith('>')) {
        inQuote = false;
        if (currentQuote && currentAuthorYear && currentClaimId) {
          // Remove surrounding quotes if present
          const cleanQuote = currentQuote.replace(/^[""]|[""]$/g, '').trim();
          quotes.push({
            claimId: currentClaimId,
            claimTitle: currentClaimTitle,
            authorYear: currentAuthorYear,
            quote: cleanQuote,
            quoteType: currentQuoteType,
            lineNumber: quoteStartLine,
            sourceFile: 'claims_and_evidence.md'
          });
        }
        currentQuote = '';
      }
    }
  }

  return quotes;
}

// Verify all quotes in claims_and_evidence.md
interface QuoteVerificationResult {
  claimId: string;
  claimTitle: string;
  authorYear: string;
  quote: string;
  quoteType: 'Primary' | 'Supporting';
  lineNumber: number;
  claimFile: string;
  verified: boolean;
  similarity: number;
  sourceFile?: string;
  nearestMatch?: string;
  contextBefore?: string;
  contextAfter?: string;
  error?: string;
}

function verifyAllQuotes(): {
  totalQuotes: number;
  verifiedQuotes: number;
  incorrectQuotes: QuoteVerificationResult[];
  missingSourceFiles: string[];
} {
  const quotes = extractQuotesFromClaims();
  const results: QuoteVerificationResult[] = [];
  const missingSourceFiles = new Set<string>();

  for (const quote of quotes) {
    const verification = verifyQuote(quote.quote, quote.authorYear);
    
    if (verification.error && verification.error.includes('No source file found')) {
      missingSourceFiles.add(quote.authorYear);
    }

    if (!verification.verified || verification.similarity < 0.85) {
      results.push({
        claimId: quote.claimId,
        claimTitle: quote.claimTitle,
        authorYear: quote.authorYear,
        quote: quote.quote,
        quoteType: quote.quoteType,
        lineNumber: quote.lineNumber,
        claimFile: quote.sourceFile,
        verified: verification.verified,
        similarity: verification.similarity,
        sourceFile: verification.sourceFile,
        nearestMatch: verification.nearestMatch,
        contextBefore: verification.contextBefore,
        contextAfter: verification.contextAfter,
        error: verification.error
      });
    }
  }

  return {
    totalQuotes: quotes.length,
    verifiedQuotes: quotes.length - results.length,
    incorrectQuotes: results,
    missingSourceFiles: Array.from(missingSourceFiles)
  };
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
    name: 'verify_all_quotes',
    description: 'Verify all quotes in claims_and_evidence.md file. Returns a report of incorrect quotes with their nearest matches and context. Use this to audit all citations at once.',
    inputSchema: {
      type: 'object',
      properties: {}
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
  },
  {
    name: 'search_by_question',
    description: 'Search for claims relevant to a research question using semantic similarity. Returns claims ranked by relevance with similarity scores. Use this to find existing evidence before writing new content.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The research question or topic to search for'
        },
        threshold: {
          type: 'number',
          description: 'Optional: Minimum similarity threshold (0-1). Default is 0.3',
          minimum: 0,
          maximum: 1
        }
      },
      required: ['question']
    }
  },
  {
    name: 'search_by_draft',
    description: 'Search for claims matching draft manuscript text. Analyzes each sentence to find supporting evidence and identifies gaps. Use this after writing a draft to find citations.',
    inputSchema: {
      type: 'object',
      properties: {
        draft_text: {
          type: 'string',
          description: 'The draft manuscript text to analyze'
        },
        mode: {
          type: 'string',
          enum: ['paragraph', 'sentence'],
          description: 'Analysis mode: "paragraph" treats text as one unit, "sentence" analyzes each sentence independently'
        },
        threshold: {
          type: 'number',
          description: 'Optional: Minimum similarity threshold (0-1). Default is 0.3',
          minimum: 0,
          maximum: 1
        }
      },
      required: ['draft_text', 'mode']
    }
  },
  {
    name: 'find_multi_source_support',
    description: 'Find multiple independent sources supporting a statement. Use this for claims with generalization keywords (often, typically, generally, etc.) that require multiple sources.',
    inputSchema: {
      type: 'object',
      properties: {
        statement: {
          type: 'string',
          description: 'The statement that needs multiple source support'
        },
        min_sources: {
          type: 'number',
          description: 'Optional: Minimum number of independent sources required. Default is 2',
          minimum: 1
        }
      },
      required: ['statement']
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

      case 'verify_all_quotes': {
        const result = verifyAllQuotes();
        
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
          .filter(f => f.endsWith('.txt') && matchesAuthorYear(f, authorYear));

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

      case 'search_by_question': {
        // Validate that search service is available
        if (!searchService) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Search service not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const question = args.question as string;
        if (!question || question.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'question',
                message: 'Question parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const threshold = args.threshold !== undefined ? (args.threshold as number) : undefined;
        
        // Validate threshold if provided
        if (threshold !== undefined && (threshold < 0 || threshold > 1)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'threshold',
                message: 'Threshold must be between 0 and 1'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Load claims before searching
        await claimsManager!.loadClaims();

        // Perform search
        const results = await searchService.searchByQuestion(question, threshold);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      }

      case 'search_by_draft': {
        // Validate that search service is available
        if (!searchService) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Search service not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const draftText = args.draft_text as string;
        if (!draftText || draftText.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'draft_text',
                message: 'Draft text parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const mode = args.mode as 'paragraph' | 'sentence';
        if (mode !== 'paragraph' && mode !== 'sentence') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'mode',
                message: 'Mode must be either "paragraph" or "sentence"'
              }, null, 2)
            }],
            isError: true
          };
        }

        const draftThreshold = args.threshold !== undefined ? (args.threshold as number) : undefined;
        
        // Validate threshold if provided
        if (draftThreshold !== undefined && (draftThreshold < 0 || draftThreshold > 1)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'threshold',
                message: 'Threshold must be between 0 and 1'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Load claims before searching
        await claimsManager!.loadClaims();

        // Perform search
        const results = await searchService.searchByDraft(draftText, mode, draftThreshold);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      }

      case 'find_multi_source_support': {
        // Validate that search service is available
        if (!searchService) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Search service not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const statement = args.statement as string;
        if (!statement || statement.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'statement',
                message: 'Statement parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const minSources = args.min_sources !== undefined ? (args.min_sources as number) : 2;
        
        // Validate minSources if provided
        if (minSources < 1) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'min_sources',
                message: 'Minimum sources must be at least 1'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Load claims before searching
        await claimsManager!.loadClaims();

        // Perform search
        const results = await searchService.findMultiSourceSupport(statement, minSources);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(results, null, 2)
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
