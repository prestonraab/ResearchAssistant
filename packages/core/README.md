# @research-assistant/core

> Shared core library for research assistant tools - claims management, embeddings, and search

## Overview

`@research-assistant/core` is a pure TypeScript library that provides the core functionality for managing academic research claims, generating embeddings, and performing semantic search. It serves as the foundation for both the VS Code extension and MCP server adapters.

### Key Features

- **Claims Management**: Load, parse, and query research claims from markdown files
- **Semantic Embeddings**: Generate and cache OpenAI embeddings for text similarity
- **Intelligent Search**: Search claims by question, draft text, or semantic similarity
- **Coverage Analysis**: Analyze manuscript sections for literature coverage
- **Claim Strength**: Calculate multi-source support for claims
- **Paper Ranking**: Rank papers by relevance to sections or queries
- **Zero Dependencies**: No dependencies on VS Code API or MCP SDK
- **Pure ESM**: Modern ES Modules with full TypeScript support

## Architecture

This library implements a **dual-head architecture** where shared core logic is consumed by two adapters:

```
┌─────────────────────────────────────────────────────────┐
│              MCP Server (Thin Adapter)                  │
│              VS Code Extension (UI Adapter)             │
└────────────────────┬────────────────────────────────────┘
                     │ Direct import
                     ▼
┌─────────────────────────────────────────────────────────┐
│              @research-assistant/core                   │
│  - ClaimsManager                                        │
│  - EmbeddingService (OpenAI)                            │
│  - SearchService                                        │
│  - OutlineParser                                        │
│  - CoverageAnalyzer                                     │
│  - And more...                                          │
└─────────────────────────────────────────────────────────┘
```

## Installation

### As a Workspace Dependency

This package is designed to be used within a monorepo workspace:

```bash
# From workspace root
npm install

# The package will be linked automatically via npm workspaces
```

### In package.json

```json
{
  "dependencies": {
    "@research-assistant/core": "workspace:*"
  }
}
```

### Requirements

- Node.js 18+ (for native ESM support)
- TypeScript 5.3+
- OpenAI API key (for embeddings)

## Quick Start

### Basic Usage

```typescript
import {
  ClaimsManager,
  EmbeddingService,
  SearchService
} from '@research-assistant/core';

// Initialize services
const apiKey = process.env.OPENAI_API_KEY;
const workspaceRoot = '/path/to/workspace';

const embeddingService = new EmbeddingService(
  apiKey,
  '.cache/embeddings',
  1000, // max cache size
  'text-embedding-3-small' // model
);

const claimsManager = new ClaimsManager(workspaceRoot);
await claimsManager.loadClaims();

const searchService = new SearchService(
  embeddingService,
  claimsManager,
  0.3 // similarity threshold
);

// Search for claims
const results = await searchService.searchByQuestion(
  'What are the benefits of property-based testing?'
);

console.log(`Found ${results.length} relevant claims`);
results.forEach(result => {
  console.log(`- ${result.claim.text} (similarity: ${result.similarity})`);
});
```

### Working with Claims

```typescript
import { ClaimsManager } from '@research-assistant/core';

const claimsManager = new ClaimsManager('/path/to/workspace');

// Load claims from markdown files
await claimsManager.loadClaims();

// Get all claims
const allClaims = claimsManager.getAllClaims();
console.log(`Loaded ${allClaims.length} claims`);

// Find specific claim by ID
const claim = claimsManager.getClaim('C_01');
if (claim) {
  console.log(`Claim: ${claim.text}`);
  console.log(`Source: ${claim.source}`);
  console.log(`Category: ${claim.category}`);
}

// Find claims by source
const smithClaims = claimsManager.findClaimsBySource('Smith2020');
console.log(`Found ${smithClaims.length} claims from Smith2020`);

// Find claims by section
const introClaims = claimsManager.findClaimsBySection('introduction');
console.log(`Found ${introClaims.length} claims for introduction`);
```

### Generating Embeddings

```typescript
import { EmbeddingService } from '@research-assistant/core';

const embeddingService = new EmbeddingService(
  process.env.OPENAI_API_KEY!,
  '.cache/embeddings',
  1000, // max cache size
  'text-embedding-3-small'
);

// Generate single embedding
const text = 'Property-based testing is a powerful technique';
const embedding = await embeddingService.generateEmbedding(text);
console.log(`Generated embedding with ${embedding.length} dimensions`);

// Generate batch embeddings (more efficient)
const texts = [
  'First claim text',
  'Second claim text',
  'Third claim text'
];
const embeddings = await embeddingService.generateBatch(texts);
console.log(`Generated ${embeddings.length} embeddings`);

// Calculate similarity
const similarity = embeddingService.cosineSimilarity(
  embeddings[0],
  embeddings[1]
);
console.log(`Similarity: ${similarity}`);

// Cache management
console.log(`Cache size: ${embeddingService.getCacheSize()}`);
embeddingService.trimCache(500); // Keep only 500 most recent
embeddingService.clearCache(); // Clear all
```

### Semantic Search

```typescript
import { SearchService } from '@research-assistant/core';

// Search by question
const results = await searchService.searchByQuestion(
  'How does test coverage relate to code quality?',
  0.4 // optional custom threshold
);

results.forEach(result => {
  console.log(`Claim: ${result.claim.text}`);
  console.log(`Similarity: ${result.similarity.toFixed(3)}`);
  console.log(`Source: ${result.claim.source}`);
  console.log('---');
});

// Search by draft text (paragraph mode)
const draftAnalysis = await searchService.searchByDraft(
  'Testing is important for software quality. It helps catch bugs early.',
  'paragraph',
  0.3
);

console.log(`Supported: ${draftAnalysis.supported.length} sentences`);
console.log(`Unsupported: ${draftAnalysis.unsupported.length} sentences`);

// Search by draft text (sentence mode)
const sentenceAnalysis = await searchService.searchByDraft(
  'Testing is important. It catches bugs. Quality improves.',
  'sentence'
);

sentenceAnalysis.supported.forEach(item => {
  console.log(`✓ "${item.sentence}"`);
  console.log(`  Best match: ${item.bestMatch?.claim.text}`);
});

// Detect generalization keywords
const keywords = searchService.detectGeneralizationKeywords(
  'Testing often improves quality and typically reduces bugs'
);
console.log(`Found keywords: ${keywords.map(k => k.keyword).join(', ')}`);

// Find multi-source support
const multiSource = await searchService.findMultiSourceSupport(
  'Property-based testing is effective',
  2 // minimum sources
);

if (multiSource.hasSufficientSupport) {
  console.log(`Found ${multiSource.sources.length} supporting sources`);
  multiSource.sources.forEach(source => {
    console.log(`- ${source.source}: ${source.claims.length} claims`);
  });
}
```

### Parsing Outlines

```typescript
import { OutlineParser } from '@research-assistant/core';

const parser = new OutlineParser();

// Parse outline file
const sections = await parser.parse('/path/to/outline.md');

console.log(`Parsed ${sections.length} sections`);

sections.forEach(section => {
  console.log(`${section.id}: ${section.title} (level ${section.level})`);
  console.log(`  Lines: ${section.lineStart}-${section.lineEnd}`);
  console.log(`  Content: ${section.content.length} lines`);
});

// Get specific section
const intro = parser.getSection('introduction');
if (intro) {
  console.log(`Introduction: ${intro.content.join('\n')}`);
}

// Get section hierarchy
const hierarchy = parser.getSectionHierarchy();
console.log('Section tree:', JSON.stringify(hierarchy, null, 2));
```

## API Reference

### Core Classes

#### ClaimsManager

Manages loading, parsing, and querying research claims.

```typescript
class ClaimsManager {
  constructor(workspaceRoot: string);
  
  async loadClaims(): Promise<Claim[]>;
  getClaim(claimId: string): Claim | null;
  findClaimsBySource(source: string): Claim[];
  findClaimsBySection(sectionId: string): Claim[];
  getAllClaims(): Claim[];
  getClaimCount(): number;
}
```

#### EmbeddingService

Generates and caches OpenAI embeddings for semantic similarity.

```typescript
class EmbeddingService {
  constructor(
    apiKey: string,
    cacheDir: string,
    maxCacheSize?: number,
    model?: string
  );
  
  async generateEmbedding(text: string): Promise<number[]>;
  async generateBatch(texts: string[]): Promise<number[][]>;
  cosineSimilarity(vec1: number[], vec2: number[]): number;
  trimCache(maxSize: number): void;
  clearCache(): void;
  getCacheSize(): number;
}
```

#### SearchService

Performs semantic search over claims using embeddings.

```typescript
class SearchService {
  constructor(
    embeddingService: EmbeddingService,
    claimsManager: ClaimsManager,
    similarityThreshold?: number
  );
  
  async searchByQuestion(
    question: string,
    threshold?: number
  ): Promise<SearchResult[]>;
  
  async searchByDraft(
    draftText: string,
    mode: 'paragraph' | 'sentence',
    threshold?: number
  ): Promise<DraftAnalysis>;
  
  detectGeneralizationKeywords(text: string): KeywordMatch[];
  
  async findMultiSourceSupport(
    statement: string,
    minSources?: number
  ): Promise<MultiSourceResult>;
}
```

#### OutlineParser

Parses markdown outline files and extracts section hierarchy.

```typescript
class OutlineParser {
  async parse(outlineFilePath: string): Promise<Section[]>;
  getSections(): Section[];
  getSection(sectionId: string): Section | null;
  getSectionHierarchy(): SectionTree;
}
```

#### CoverageAnalyzer

Analyzes manuscript sections for literature coverage.

```typescript
class CoverageAnalyzer {
  constructor(
    searchService: SearchService,
    outlineParser: OutlineParser
  );
  
  async analyzeSectionCoverage(
    sectionId: string
  ): Promise<SectionCoverage>;
  
  async analyzeManuscriptCoverage(): Promise<ManuscriptCoverage>;
}
```

#### ClaimStrengthCalculator

Calculates how strongly a claim is supported by multiple sources.

```typescript
class ClaimStrengthCalculator {
  constructor(
    claimsManager: ClaimsManager,
    embeddingService: EmbeddingService
  );
  
  async calculateClaimStrength(
    claimId: string
  ): Promise<ClaimStrength>;
  
  async calculateClaimStrengthBatch(
    claimIds: string[]
  ): Promise<Map<string, ClaimStrength>>;
}
```

#### PaperRanker

Ranks papers by relevance to sections or queries.

```typescript
class PaperRanker {
  constructor(embeddingService: EmbeddingService);
  
  async rankPapersForSection(
    sectionId: string,
    papers: Paper[]
  ): Promise<RankedPaper[]>;
  
  async rankPapersForQuery(
    query: string,
    papers: Paper[]
  ): Promise<RankedPaper[]>;
}
```

#### ClaimExtractor

Extracts potential claims from paper text.

```typescript
class ClaimExtractor {
  async extractClaimsFromText(
    text: string,
    source: string
  ): Promise<ExtractedClaim[]>;
}
```

#### SynthesisEngine

Generates coherent paragraphs from multiple claims.

```typescript
class SynthesisEngine {
  async generateParagraph(
    claims: Claim[],
    style: 'narrative' | 'analytical' | 'descriptive',
    includeCitations: boolean,
    maxLength?: number
  ): Promise<string>;
  
  async groupClaimsByTheme(
    claims: Claim[],
    threshold?: number
  ): Promise<Map<string, Claim[]>>;
}
```

#### SearchQueryGenerator

Generates targeted search queries for sections.

```typescript
class SearchQueryGenerator {
  async generateSearchQueries(
    sectionId: string
  ): Promise<string[]>;
}
```

### Type Definitions

All TypeScript types are exported for use in your code:

```typescript
import type {
  Claim,
  Section,
  SearchResult,
  DraftAnalysis,
  MultiSourceResult,
  KeywordMatch,
  SectionTree,
  SectionCoverage,
  ManuscriptCoverage,
  ClaimStrength,
  Paper,
  RankedPaper,
  ExtractedClaim
} from '@research-assistant/core';
```

### Utility Functions

```typescript
import {
  normalizeText,
  cleanQuote,
  validateClaim,
  validateSection
} from '@research-assistant/core';

// Text normalization
const normalized = normalizeText('  Some   text  ');
// => 'some text'

// Quote cleaning
const cleaned = cleanQuote('"This is a quote."');
// => 'This is a quote.'

// Validation
const isValid = validateClaim(claim);
const isSectionValid = validateSection(section);
```

## Configuration

### OpenAI API Key

The `EmbeddingService` requires an OpenAI API key:

```typescript
// From environment variable
const apiKey = process.env.OPENAI_API_KEY;

// Or pass directly
const embeddingService = new EmbeddingService(
  'sk-...',
  '.cache/embeddings'
);
```

Get your API key at: https://platform.openai.com/api-keys

### Embedding Models

Supported OpenAI embedding models:

- `text-embedding-3-small` (default) - 1536 dimensions, fast and cost-effective
- `text-embedding-3-large` - 3072 dimensions, higher quality
- `text-embedding-ada-002` - 1536 dimensions, legacy model

```typescript
const embeddingService = new EmbeddingService(
  apiKey,
  cacheDir,
  1000,
  'text-embedding-3-large' // Use larger model
);
```

### Cache Configuration

Control embedding cache behavior:

```typescript
const embeddingService = new EmbeddingService(
  apiKey,
  '.cache/embeddings', // Cache directory
  1000, // Max cache size (number of embeddings)
  'text-embedding-3-small'
);

// The cache uses LRU eviction when full
// Embeddings are persisted to disk for reuse across sessions
```

### Similarity Thresholds

Adjust similarity thresholds for search:

```typescript
const searchService = new SearchService(
  embeddingService,
  claimsManager,
  0.3 // Default threshold (0-1)
);

// Or override per query
const results = await searchService.searchByQuestion(
  'query',
  0.5 // Higher threshold = more strict
);
```

**Recommended thresholds:**
- `0.3` - Broad search, more results
- `0.4` - Balanced (default)
- `0.5` - Strict, high relevance only

## Error Handling

The library uses typed errors for better error handling:

```typescript
import {
  ClaimNotFoundError,
  EmbeddingError,
  ParseError
} from '@research-assistant/core';

try {
  const claim = claimsManager.getClaim('invalid-id');
  if (!claim) {
    throw new ClaimNotFoundError('invalid-id');
  }
} catch (error) {
  if (error instanceof ClaimNotFoundError) {
    console.error('Claim not found:', error.message);
  } else if (error instanceof EmbeddingError) {
    console.error('Embedding failed:', error.message);
  } else if (error instanceof ParseError) {
    console.error('Parse error:', error.message);
  } else {
    throw error; // Unexpected error
  }
}
```

## Testing

The library includes comprehensive tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

- `tests/unit/` - Unit tests for individual classes
- `tests/integration/` - Integration tests with real dependencies
- `tests/property/` - Property-based tests using fast-check

### Writing Tests

```typescript
import { ClaimsManager } from '@research-assistant/core';

describe('ClaimsManager', () => {
  it('should load claims from file', async () => {
    const manager = new ClaimsManager('/path/to/workspace');
    const claims = await manager.loadClaims();
    expect(claims.length).toBeGreaterThan(0);
  });
});
```

## Development

### Building

```bash
# Build TypeScript to JavaScript
npm run build

# Watch mode for development
npm run watch

# Clean build artifacts
npm run clean
```

### Project Structure

```
packages/core/
├── src/
│   ├── managers/          # ClaimsManager
│   ├── services/          # EmbeddingService, SearchService, etc.
│   ├── parsers/           # OutlineParser
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── index.ts           # Main exports
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── property/          # Property-based tests
├── dist/                  # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
└── README.md
```

### ESM Considerations

This library uses ES Modules (ESM):

- Always use `.js` extensions in imports (even for `.ts` files)
- Use `import`/`export` syntax (no `require`)
- `__dirname` is not available (use `import.meta.url`)

```typescript
// ✅ Correct
import { Claim } from './types/index.js';

// ❌ Wrong
import { Claim } from './types';
```

## Contributing

### Guidelines

1. **Code Style**: Follow existing TypeScript conventions
2. **Tests**: Write tests for all new functionality
3. **Documentation**: Update README and JSDoc comments
4. **Types**: Maintain full TypeScript type coverage
5. **ESM**: Use ES Modules with `.js` extensions

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Ensure all tests pass
5. Update documentation
6. Submit pull request

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- ClaimsManager.test.ts

# Run with coverage
npm run test:coverage
```

## Performance

### Benchmarks

Typical performance on modern hardware:

- **Claim loading**: ~50ms for 100 claims
- **Embedding generation**: ~200ms per text (API call)
- **Embedding generation (cached)**: <1ms
- **Search query**: ~50ms for 100 claims
- **Similarity calculation**: <1ms per comparison

### Optimization Tips

1. **Batch embeddings**: Use `generateBatch()` for multiple texts
2. **Cache warming**: Pre-generate embeddings for common queries
3. **Threshold tuning**: Higher thresholds = fewer results = faster
4. **Lazy loading**: Only load claims when needed

## Troubleshooting

### Common Issues

**"OpenAI API key not found"**
- Set `OPENAI_API_KEY` environment variable
- Or pass API key directly to `EmbeddingService` constructor

**"Cannot find module"**
- Ensure you're using Node.js 18+
- Check that imports use `.js` extensions
- Run `npm install` to install dependencies

**"Jest ESM errors"**
- Use `NODE_OPTIONS=--experimental-vm-modules jest`
- Check `jest.config.js` has ESM configuration

**"TypeScript errors"**
- Ensure TypeScript 5.3+
- Check `tsconfig.json` has `"module": "Node16"`
- Run `npm run build` to compile

### Debug Logging

Enable debug logging for troubleshooting:

```typescript
// Set environment variable
process.env.DEBUG = 'research-assistant:*';

// Or use console.log in your code
const results = await searchService.searchByQuestion(query);
console.log('Search results:', results);
```

## License

MIT

## Related Projects

- **MCP Server**: `@research-assistant/mcp-server` - MCP adapter for AI agents
- **VS Code Extension**: `research-assistant` - VS Code extension for researchers

## References

- [Design Document](../../.kiro/specs/core-library-consolidation/design.md) - Detailed architecture and design decisions
- [Requirements](../../.kiro/specs/core-library-consolidation/requirements.md) - User stories and acceptance criteria
- [Tasks](../../.kiro/specs/core-library-consolidation/tasks.md) - Implementation task list
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings) - OpenAI embeddings documentation
- [TypeScript ESM Guide](https://www.typescriptlang.org/docs/handbook/esm-node.html) - TypeScript ES Modules guide

## Support

For issues, questions, or contributions, please refer to the main workspace repository.

---

**Version**: 1.0.0  
**Node**: >=18.0.0  
**License**: MIT
