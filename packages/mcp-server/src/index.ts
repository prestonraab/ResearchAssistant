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
import { OutlineParser } from './core/OutlineParser.js';
import { SearchService } from './services/SearchService.js';
import { CoverageAnalyzer } from './services/CoverageAnalyzer.js';
import { ClaimStrengthCalculator } from './services/ClaimStrengthCalculator.js';
import { PaperRanker } from './services/PaperRanker.js';
import { ClaimExtractor } from './services/ClaimExtractor.js';
import { SynthesisEngine } from './services/SynthesisEngine.js';
import { SearchQueryGenerator } from './services/SearchQueryGenerator.js';

// Configuration
const WORKSPACE_ROOT = process.env.CITATION_WORKSPACE_ROOT || process.cwd();
const EXTRACTED_TEXT_DIR = path.join(WORKSPACE_ROOT, 'literature', 'ExtractedText');
const CLAIMS_FILE = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'claims_and_evidence.md');
const CLAIMS_DIR = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'claims');
const SOURCES_FILE = path.join(WORKSPACE_ROOT, '01_Knowledge_Base', 'sources.md');
const OUTLINE_FILE = path.join(WORKSPACE_ROOT, '03_Drafting', 'outline.md');
const MANUSCRIPT_FILE = path.join(WORKSPACE_ROOT, '03_Drafting', 'manuscript.md');

// Initialize services
const config = loadConfig();
const configErrors = validateConfig(config);
if (configErrors.length > 0) {
  console.error('Configuration errors:', configErrors);
}

let embeddingService: EmbeddingService | null = null;
let claimsManager: ClaimsManager | null = null;
let searchService: SearchService | null = null;
let outlineParser: OutlineParser | null = null;
let coverageAnalyzer: CoverageAnalyzer | null = null;
let claimStrengthCalculator: ClaimStrengthCalculator | null = null;
let paperRanker: PaperRanker | null = null;
let claimExtractor: ClaimExtractor | null = null;
let synthesisEngine: SynthesisEngine | null = null;
let searchQueryGenerator: SearchQueryGenerator | null = null;

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
  outlineParser = new OutlineParser();
  coverageAnalyzer = new CoverageAnalyzer(
    outlineParser,
    searchService,
    MANUSCRIPT_FILE,
    config.similarityThreshold
  );
  claimStrengthCalculator = new ClaimStrengthCalculator(
    embeddingService,
    claimsManager,
    config.similarityThreshold
  );
  paperRanker = new PaperRanker(
    embeddingService,
    outlineParser,
    50, // citationBoostThreshold
    config.citationBoostFactor || 0.1,
    200, // wordsPerMinute
    500  // wordsPerPage
  );
  claimExtractor = new ClaimExtractor(embeddingService);
  synthesisEngine = new SynthesisEngine(embeddingService);
  searchQueryGenerator = new SearchQueryGenerator(outlineParser);
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

// Concise version for summary output
interface QuoteVerificationSummary {
  claimId: string;
  claimTitle: string;
  authorYear: string;
  quoteType: 'Primary' | 'Supporting';
  similarity: number;
  claimFile: string;
  lineNumber: number;
  issue: string; // Brief description of the problem
}

function verifyAllQuotes(detailed: boolean = false): {
  totalQuotes: number;
  verifiedQuotes: number;
  incorrectQuotes: QuoteVerificationResult[] | QuoteVerificationSummary[];
  missingSourceFiles: string[];
  summary?: string;
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

  // Generate summary
  const verifiedCount = quotes.length - results.length;
  const summaryText = `Verified ${verifiedCount}/${quotes.length} quotes (${((verifiedCount/quotes.length)*100).toFixed(1)}%). Found ${results.length} issues.`;

  // Return concise summary by default
  if (!detailed) {
    const conciseResults: QuoteVerificationSummary[] = results.map(r => {
      let issue = '';
      if (r.error) {
        issue = r.error.includes('No source file') ? 'Missing source file' : 'Error';
      } else if (r.similarity < 0.5) {
        issue = `Very low similarity (${(r.similarity * 100).toFixed(0)}%)`;
      } else if (r.similarity < 0.85) {
        issue = `Low similarity (${(r.similarity * 100).toFixed(0)}%)`;
      } else {
        issue = 'Not verified';
      }

      return {
        claimId: r.claimId,
        claimTitle: r.claimTitle.substring(0, 60) + (r.claimTitle.length > 60 ? '...' : ''),
        authorYear: r.authorYear,
        quoteType: r.quoteType,
        similarity: Math.round(r.similarity * 100) / 100,
        claimFile: r.claimFile,
        lineNumber: r.lineNumber,
        issue
      };
    });

    return {
      totalQuotes: quotes.length,
      verifiedQuotes: verifiedCount,
      incorrectQuotes: conciseResults,
      missingSourceFiles: Array.from(missingSourceFiles),
      summary: summaryText
    };
  }

  // Return detailed results if requested
  return {
    totalQuotes: quotes.length,
    verifiedQuotes: verifiedCount,
    incorrectQuotes: results,
    missingSourceFiles: Array.from(missingSourceFiles),
    summary: summaryText
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
    description: 'Verify all quotes in claims_and_evidence.md file. Returns a concise summary by default, or detailed report with full context if detailed=true. Use this to audit all citations at once.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description: 'Optional: Return full details including context and nearest matches. Default is false (concise summary only).'
        }
      }
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
  },
  {
    name: 'analyze_section_coverage',
    description: 'Analyze literature coverage for a specific section at the sentence level. Returns which sentences are supported by claims, which need citations, and generates targeted search queries for unsupported sentences.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'The section ID to analyze (e.g., "2.1", "introduction")'
        }
      },
      required: ['section_id']
    }
  },
  {
    name: 'analyze_manuscript_coverage',
    description: 'Analyze literature coverage for the entire manuscript. Returns coverage statistics for all sections and identifies the weakest sections that need more supporting evidence.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_manuscript_context',
    description: 'Get the manuscript context at a specific cursor position. Returns the current section, its coverage analysis, and relevant claims. Use this to understand what section the user is working on.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor_position: {
          type: 'number',
          description: 'The line number (1-indexed) where the cursor is positioned in the manuscript'
        }
      },
      required: ['cursor_position']
    }
  },
  {
    name: 'calculate_claim_strength',
    description: 'Calculate how strongly a claim is supported by multiple independent sources. Returns a strength score, list of supporting claims from different sources, and any contradictory claims. Use this to identify well-established findings versus isolated claims.',
    inputSchema: {
      type: 'object',
      properties: {
        claim_id: {
          type: 'string',
          description: 'The claim ID to analyze (e.g., "C_01", "C_02a")'
        }
      },
      required: ['claim_id']
    }
  },
  {
    name: 'calculate_claim_strength_batch',
    description: 'Calculate claim strength for multiple claims efficiently in a single operation. Returns a map of claim IDs to their strength results. Use this when analyzing multiple claims at once to minimize API calls.',
    inputSchema: {
      type: 'object',
      properties: {
        claim_ids: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of claim IDs to analyze (e.g., ["C_01", "C_02", "C_03"])'
        }
      },
      required: ['claim_ids']
    }
  },
  {
    name: 'rank_papers_for_section',
    description: 'Rank papers by relevance to a specific section. Calculates semantic similarity between paper abstracts and section content, applies citation boost for highly-cited papers, and estimates reading time. Returns papers sorted by relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'The section ID to rank papers for (e.g., "2.1", "introduction")'
        },
        papers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemKey: {
                type: 'string',
                description: 'Zotero item key or unique identifier'
              },
              title: {
                type: 'string',
                description: 'Paper title'
              },
              authors: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'List of author names'
              },
              year: {
                type: 'number',
                description: 'Publication year'
              },
              abstract: {
                type: 'string',
                description: 'Paper abstract text'
              },
              citationCount: {
                type: 'number',
                description: 'Number of citations (optional)'
              },
              pageCount: {
                type: 'number',
                description: 'Number of pages (optional)'
              },
              wordCount: {
                type: 'number',
                description: 'Word count (optional)'
              }
            },
            required: ['itemKey', 'title', 'authors', 'year']
          },
          description: 'Array of paper metadata objects to rank'
        }
      },
      required: ['section_id', 'papers']
    }
  },
  {
    name: 'rank_papers_for_query',
    description: 'Rank papers by relevance to a query string. Calculates semantic similarity between paper abstracts and the query, applies citation boost for highly-cited papers, and estimates reading time. Returns papers sorted by relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query text to rank papers against'
        },
        papers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              itemKey: {
                type: 'string',
                description: 'Zotero item key or unique identifier'
              },
              title: {
                type: 'string',
                description: 'Paper title'
              },
              authors: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'List of author names'
              },
              year: {
                type: 'number',
                description: 'Publication year'
              },
              abstract: {
                type: 'string',
                description: 'Paper abstract text'
              },
              citationCount: {
                type: 'number',
                description: 'Number of citations (optional)'
              },
              pageCount: {
                type: 'number',
                description: 'Number of pages (optional)'
              },
              wordCount: {
                type: 'number',
                description: 'Word count (optional)'
              }
            },
            required: ['itemKey', 'title', 'authors', 'year']
          },
          description: 'Array of paper metadata objects to rank'
        }
      },
      required: ['query', 'papers']
    }
  },
  {
    name: 'extract_claims_from_text',
    description: 'Extract potential claims from paper text. Identifies declarative sentences, calculates confidence scores, categorizes by type, and includes surrounding context. Use this to identify important statements to add to the claims database.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The paper text to extract claims from'
        },
        source: {
          type: 'string',
          description: 'Source identifier (e.g., "Smith2020")'
        }
      },
      required: ['text', 'source']
    }
  },
  {
    name: 'suggest_sections_for_claim',
    description: 'Suggest relevant outline sections for a claim using semantic similarity. Returns top 1-3 sections ranked by relevance. Use this to help organize evidence effectively.',
    inputSchema: {
      type: 'object',
      properties: {
        claim_text: {
          type: 'string',
          description: 'The claim text to find sections for'
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Section ID'
              },
              title: {
                type: 'string',
                description: 'Section title'
              },
              level: {
                type: 'number',
                description: 'Heading level (1-6)'
              },
              lineStart: {
                type: 'number',
                description: 'Start line number'
              },
              lineEnd: {
                type: 'number',
                description: 'End line number'
              },
              content: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Section content lines'
              }
            },
            required: ['id', 'title', 'level', 'lineStart', 'lineEnd', 'content']
          },
          description: 'Array of outline sections'
        }
      },
      required: ['claim_text', 'sections']
    }
  },
  {
    name: 'group_claims_by_theme',
    description: 'Group claims by theme using semantic clustering. Returns a map of theme labels to claim arrays. Use this to organize related claims before synthesis.',
    inputSchema: {
      type: 'object',
      properties: {
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Claim ID'
              },
              text: {
                type: 'string',
                description: 'Claim text'
              },
              category: {
                type: 'string',
                description: 'Claim category'
              },
              source: {
                type: 'string',
                description: 'Source identifier'
              },
              verified: {
                type: 'boolean',
                description: 'Quote verification status'
              },
              primaryQuote: {
                type: 'string',
                description: 'Primary supporting quote'
              },
              supportingQuotes: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Additional supporting quotes'
              },
              sections: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Associated section IDs'
              }
            },
            required: ['id', 'text', 'category', 'source', 'verified', 'primaryQuote', 'supportingQuotes', 'sections']
          },
          description: 'Array of claims to group'
        },
        threshold: {
          type: 'number',
          description: 'Optional: Similarity threshold for clustering (0-1). Default is 0.6',
          minimum: 0,
          maximum: 1
        }
      },
      required: ['claims']
    }
  },
  {
    name: 'generate_paragraph',
    description: 'Generate a coherent paragraph from multiple claims. Supports narrative, analytical, and descriptive styles. Preserves citations and adds transition phrases. Use this to draft literature review paragraphs.',
    inputSchema: {
      type: 'object',
      properties: {
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Claim ID'
              },
              text: {
                type: 'string',
                description: 'Claim text'
              },
              category: {
                type: 'string',
                description: 'Claim category'
              },
              source: {
                type: 'string',
                description: 'Source identifier'
              },
              verified: {
                type: 'boolean',
                description: 'Quote verification status'
              },
              primaryQuote: {
                type: 'string',
                description: 'Primary supporting quote'
              },
              supportingQuotes: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Additional supporting quotes'
              },
              sections: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Associated section IDs'
              }
            },
            required: ['id', 'text', 'category', 'source', 'verified', 'primaryQuote', 'supportingQuotes', 'sections']
          },
          description: 'Array of claims to synthesize'
        },
        style: {
          type: 'string',
          enum: ['narrative', 'analytical', 'descriptive'],
          description: 'Writing style: narrative (tells story), analytical (compares/contrasts), descriptive (lists/enumerates)'
        },
        include_citations: {
          type: 'boolean',
          description: 'Whether to include citation references in (AuthorYear) format'
        },
        max_length: {
          type: 'number',
          description: 'Optional: Maximum paragraph length in characters. Default is 0 (no limit)',
          minimum: 0
        }
      },
      required: ['claims', 'style', 'include_citations']
    }
  },
  {
    name: 'generate_search_queries',
    description: 'Generate 2-5 targeted search queries for a section based on title and content. Extracts key terms, converts questions to queries, and ensures uniqueness. Use this to find relevant papers efficiently.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'The section ID to generate queries for (e.g., "2.1", "introduction")'
        }
      },
      required: ['section_id']
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
        const detailed = args.detailed as boolean | undefined;
        const result = verifyAllQuotes(detailed || false);
        
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

      case 'analyze_section_coverage': {
        // Validate that coverage analyzer is available
        if (!coverageAnalyzer) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Coverage analyzer not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const sectionId = args.section_id as string;
        if (!sectionId || sectionId.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'section_id',
                message: 'Section ID parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Check if outline file exists
        if (!fs.existsSync(OUTLINE_FILE)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'FILE_NOT_FOUND',
                path: OUTLINE_FILE,
                message: `Outline file not found: ${OUTLINE_FILE}`,
                suggestions: ['Create an outline.md file in 03_Drafting/', 'Check CITATION_WORKSPACE_ROOT environment variable']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Parse the outline file
        await outlineParser!.parse(OUTLINE_FILE);

        // Load claims before analyzing
        await claimsManager!.loadClaims();

        // Analyze section coverage
        const coverage = await coverageAnalyzer.analyzeSectionCoverage(sectionId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(coverage, null, 2)
          }]
        };
      }

      case 'analyze_manuscript_coverage': {
        // Validate that coverage analyzer is available
        if (!coverageAnalyzer) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Coverage analyzer not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Check if manuscript file exists
        if (!fs.existsSync(MANUSCRIPT_FILE)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'FILE_NOT_FOUND',
                path: MANUSCRIPT_FILE,
                message: `Manuscript file not found: ${MANUSCRIPT_FILE}`,
                suggestions: ['Create a manuscript.md file in 03_Drafting/', 'Check CITATION_WORKSPACE_ROOT environment variable']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Load claims before analyzing
        await claimsManager!.loadClaims();

        // Analyze manuscript coverage
        const coverage = await coverageAnalyzer.analyzeManuscriptCoverage();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(coverage, null, 2)
          }]
        };
      }

      case 'get_manuscript_context': {
        // Validate that coverage analyzer is available
        if (!coverageAnalyzer) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Coverage analyzer not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const cursorPosition = args.cursor_position as number;
        if (cursorPosition === undefined || cursorPosition < 1) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'cursor_position',
                message: 'Cursor position must be a positive integer (1-indexed line number)'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Check if manuscript file exists
        if (!fs.existsSync(MANUSCRIPT_FILE)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'FILE_NOT_FOUND',
                path: MANUSCRIPT_FILE,
                message: `Manuscript file not found: ${MANUSCRIPT_FILE}`,
                suggestions: ['Create a manuscript.md file in 03_Drafting/', 'Check CITATION_WORKSPACE_ROOT environment variable']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Parse the manuscript file
        await outlineParser!.parse(MANUSCRIPT_FILE);

        // Get section at position (convert from 1-indexed to 0-indexed)
        const section = outlineParser!.getSectionAtPosition(cursorPosition - 1);

        if (!section) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'SECTION_NOT_FOUND',
                message: `No section found at line ${cursorPosition}`,
                cursorPosition
              }, null, 2)
            }],
            isError: true
          };
        }

        // Load claims before analyzing
        await claimsManager!.loadClaims();

        // Analyze coverage for this section
        const coverage = await coverageAnalyzer.analyzeSectionCoverage(section.id);

        // Get claims associated with this section
        const sectionClaims = claimsManager!.findClaimsBySection(section.id);

        // Return context
        const context = {
          section: {
            id: section.id,
            title: section.title,
            level: section.level,
            lineStart: section.lineStart + 1, // Convert to 1-indexed
            lineEnd: section.lineEnd + 1, // Convert to 1-indexed
            content: section.content
          },
          coverage,
          relevantClaims: sectionClaims
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(context, null, 2)
          }]
        };
      }

      case 'calculate_claim_strength': {
        // Validate that claim strength calculator is available
        if (!claimStrengthCalculator) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Claim strength calculator not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const claimId = args.claim_id as string;
        if (!claimId || claimId.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'claim_id',
                message: 'Claim ID parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Load claims before calculating
        await claimsManager!.loadClaims();

        // Check if claim exists
        const claim = claimsManager!.getClaim(claimId);
        if (!claim) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CLAIM_NOT_FOUND',
                message: `Claim not found: ${claimId}`,
                claimId,
                suggestions: ['Check the claim ID spelling', 'Use list_sources to see available claims']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Calculate claim strength
        const result = await claimStrengthCalculator.calculateStrength(claimId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case 'calculate_claim_strength_batch': {
        // Validate that claim strength calculator is available
        if (!claimStrengthCalculator) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Claim strength calculator not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const claimIds = args.claim_ids as string[];
        if (!Array.isArray(claimIds)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'claim_ids',
                message: 'claim_ids must be an array of strings'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Handle empty array gracefully
        if (claimIds.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({}, null, 2)
            }]
          };
        }

        // Load claims before calculating
        await claimsManager!.loadClaims();

        // Calculate claim strength for all claims
        const resultsMap = await claimStrengthCalculator.calculateStrengthBatch(claimIds);
        
        // Convert Map to object for JSON serialization
        const resultsObject: Record<string, any> = {};
        for (const [claimId, result] of resultsMap.entries()) {
          resultsObject[claimId] = result;
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(resultsObject, null, 2)
          }]
        };
      }

      case 'rank_papers_for_section': {
        // Validate that paper ranker is available
        if (!paperRanker) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Paper ranker not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const sectionId = args.section_id as string;
        if (!sectionId || sectionId.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'section_id',
                message: 'Section ID parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const papers = args.papers as any[];
        if (!Array.isArray(papers)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'papers',
                message: 'papers must be an array'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Handle empty array gracefully
        if (papers.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify([], null, 2)
            }]
          };
        }

        // Validate required fields in each paper
        for (let i = 0; i < papers.length; i++) {
          const paper = papers[i];
          if (!paper.itemKey || !paper.title || !paper.authors || !paper.year) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'VALIDATION_ERROR',
                  field: `papers[${i}]`,
                  message: 'Each paper must have itemKey, title, authors, and year fields'
              }, null, 2)
              }],
              isError: true
            };
          }
        }

        // Check if outline file exists
        if (!fs.existsSync(OUTLINE_FILE)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'FILE_NOT_FOUND',
                path: OUTLINE_FILE,
                message: `Outline file not found: ${OUTLINE_FILE}`,
                suggestions: ['Create an outline.md file in 03_Drafting/', 'Check CITATION_WORKSPACE_ROOT environment variable']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Parse the outline file
        await outlineParser!.parse(OUTLINE_FILE);

        // Rank papers for section
        const rankedPapers = await paperRanker.rankPapersForSection(sectionId, papers);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(rankedPapers, null, 2)
          }]
        };
      }

      case 'rank_papers_for_query': {
        // Validate that paper ranker is available
        if (!paperRanker) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Paper ranker not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const query = args.query as string;
        if (!query || query.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'query',
                message: 'Query parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const queryPapers = args.papers as any[];
        if (!Array.isArray(queryPapers)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'papers',
                message: 'papers must be an array'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Handle empty array gracefully
        if (queryPapers.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify([], null, 2)
            }]
          };
        }

        // Validate required fields in each paper
        for (let i = 0; i < queryPapers.length; i++) {
          const paper = queryPapers[i];
          if (!paper.itemKey || !paper.title || !paper.authors || !paper.year) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'VALIDATION_ERROR',
                  field: `papers[${i}]`,
                  message: 'Each paper must have itemKey, title, authors, and year fields'
                }, null, 2)
              }],
              isError: true
            };
          }
        }

        // Rank papers for query
        const rankedQueryPapers = await paperRanker.rankPapersForQuery(query, queryPapers);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(rankedQueryPapers, null, 2)
          }]
        };
      }

      case 'extract_claims_from_text': {
        // Validate that claim extractor is available
        if (!claimExtractor) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Claim extractor not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const text = args.text as string;
        if (!text || text.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'text',
                message: 'Text parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const source = args.source as string;
        if (!source || source.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'source',
                message: 'Source parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Extract claims
        const potentialClaims = claimExtractor.extractFromText(text, source);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(potentialClaims, null, 2)
          }]
        };
      }

      case 'suggest_sections_for_claim': {
        // Validate that claim extractor is available
        if (!claimExtractor) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Claim extractor not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const claimText = args.claim_text as string;
        if (!claimText || claimText.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'claim_text',
                message: 'Claim text parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        const sections = args.sections as any[];
        if (!Array.isArray(sections)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'sections',
                message: 'sections must be an array'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Handle empty array gracefully
        if (sections.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify([], null, 2)
            }]
          };
        }

        // Validate required fields in each section
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          if (!section.id || !section.title || section.level === undefined || 
              section.lineStart === undefined || section.lineEnd === undefined || 
              !Array.isArray(section.content)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'VALIDATION_ERROR',
                  field: `sections[${i}]`,
                  message: 'Each section must have id, title, level, lineStart, lineEnd, and content fields'
                }, null, 2)
              }],
              isError: true
            };
          }
        }

        // Suggest sections
        const suggestions = await claimExtractor.suggestSections(claimText, sections);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(suggestions, null, 2)
          }]
        };
      }

      case 'group_claims_by_theme': {
        // Validate that synthesis engine is available
        if (!synthesisEngine) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Synthesis engine not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const claims = args.claims as any[];
        if (!Array.isArray(claims)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'claims',
                message: 'claims must be an array'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Handle empty array gracefully
        if (claims.length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({}, null, 2)
            }]
          };
        }

        // Validate required fields in each claim
        for (let i = 0; i < claims.length; i++) {
          const claim = claims[i];
          if (!claim.id || !claim.text || !claim.category || !claim.source || 
              claim.verified === undefined || !claim.primaryQuote || 
              !Array.isArray(claim.supportingQuotes) || !Array.isArray(claim.sections)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'VALIDATION_ERROR',
                  field: `claims[${i}]`,
                  message: 'Each claim must have id, text, category, source, verified, primaryQuote, supportingQuotes, and sections fields'
                }, null, 2)
              }],
              isError: true
            };
          }
        }

        const thresholdParam = args.threshold !== undefined ? (args.threshold as number) : undefined;
        
        // Validate threshold if provided
        if (thresholdParam !== undefined && (thresholdParam < 0 || thresholdParam > 1)) {
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

        // Group claims by theme
        const themeMap = await synthesisEngine.groupClaimsByTheme(claims, thresholdParam);
        
        // Convert Map to object for JSON serialization
        const themeObject: Record<string, any> = {};
        for (const [theme, themeClaims] of themeMap.entries()) {
          themeObject[theme] = themeClaims;
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(themeObject, null, 2)
          }]
        };
      }

      case 'generate_paragraph': {
        // Validate that synthesis engine is available
        if (!synthesisEngine) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Synthesis engine not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const paragraphClaims = args.claims as any[];
        if (!Array.isArray(paragraphClaims)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'claims',
                message: 'claims must be an array'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Handle empty array gracefully
        if (paragraphClaims.length === 0) {
          return {
            content: [{
              type: 'text',
              text: ''
            }]
          };
        }

        // Validate required fields in each claim
        for (let i = 0; i < paragraphClaims.length; i++) {
          const claim = paragraphClaims[i];
          if (!claim.id || !claim.text || !claim.category || !claim.source || 
              claim.verified === undefined || !claim.primaryQuote || 
              !Array.isArray(claim.supportingQuotes) || !Array.isArray(claim.sections)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  error: 'VALIDATION_ERROR',
                  field: `claims[${i}]`,
                  message: 'Each claim must have id, text, category, source, verified, primaryQuote, supportingQuotes, and sections fields'
                }, null, 2)
              }],
              isError: true
            };
          }
        }

        const style = args.style as string;
        if (style !== 'narrative' && style !== 'analytical' && style !== 'descriptive') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'style',
                message: 'Style must be one of: narrative, analytical, descriptive'
              }, null, 2)
            }],
            isError: true
          };
        }

        const includeCitations = args.include_citations as boolean;
        if (typeof includeCitations !== 'boolean') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'include_citations',
                message: 'include_citations must be a boolean'
              }, null, 2)
            }],
            isError: true
          };
        }

        const maxLength = args.max_length !== undefined ? (args.max_length as number) : 0;
        
        // Validate maxLength if provided
        if (maxLength < 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'max_length',
                message: 'max_length must be non-negative'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Generate paragraph
        const paragraph = await synthesisEngine.generateParagraph({
          claims: paragraphClaims,
          style: style as 'narrative' | 'analytical' | 'descriptive',
          includeCitations,
          maxLength
        });
        
        return {
          content: [{
            type: 'text',
            text: paragraph
          }]
        };
      }

      case 'generate_search_queries': {
        // Validate that search query generator is available
        if (!searchQueryGenerator) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'CONFIGURATION_ERROR',
                message: 'Search query generator not available. OPENAI_API_KEY may not be configured.',
                suggestions: ['Set OPENAI_API_KEY environment variable', 'Check configuration settings']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Validate input parameters
        const querySectionId = args.section_id as string;
        if (!querySectionId || querySectionId.trim().length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'VALIDATION_ERROR',
                field: 'section_id',
                message: 'Section ID parameter is required and cannot be empty'
              }, null, 2)
            }],
            isError: true
          };
        }

        // Check if outline file exists
        if (!fs.existsSync(OUTLINE_FILE)) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'FILE_NOT_FOUND',
                path: OUTLINE_FILE,
                message: `Outline file not found: ${OUTLINE_FILE}`,
                suggestions: ['Create an outline.md file in 03_Drafting/', 'Check CITATION_WORKSPACE_ROOT environment variable']
              }, null, 2)
            }],
            isError: true
          };
        }

        // Parse the outline file
        await outlineParser!.parse(OUTLINE_FILE);

        // Generate search queries
        const queries = await searchQueryGenerator.generateQueriesForSection(querySectionId);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(queries, null, 2)
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
