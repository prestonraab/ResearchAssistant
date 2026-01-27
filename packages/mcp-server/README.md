# Citation MCP Server

A Model Context Protocol (MCP) server that provides AI agents with powerful citation management and literature review capabilities. This server exposes tools for searching claims, analyzing coverage, ranking papers, and synthesizing literature.

## Overview

The Citation MCP Server is a thin adapter that wraps the `@research-assistant/core` library, making its functionality available to AI agents like Claude, Kiro, and other MCP-compatible systems. It enables:

- **Semantic search** across extracted claims from research papers
- **Coverage analysis** to identify gaps in literature support
- **Claim strength calculation** to assess evidence quality
- **Paper ranking** by relevance to sections or queries
- **Claim extraction** from paper text
- **Literature synthesis** with multiple writing styles

## Installation

### Via npx (Recommended)

The easiest way to use the server is via `npx`:

```bash
npx @research-assistant/mcp-server
```

### From Source

Clone the repository and build:

```bash
git clone <repository-url>
cd research-assistant-workspace
npm install
npm run build
```

Then run:

```bash
node packages/mcp-server/dist/index.js
```

## Configuration

The server is configured via environment variables:

### Required

- **`OPENAI_API_KEY`** (required)  
  Your OpenAI API key for generating embeddings. Get one at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  
  ```bash
  export OPENAI_API_KEY="sk-..."
  ```

### Optional

- **`CITATION_WORKSPACE_ROOT`** (default: current directory)  
  Path to your research workspace containing claims and manuscript files
  
  ```bash
  export CITATION_WORKSPACE_ROOT="/path/to/workspace"
  ```

- **`EMBEDDING_CACHE_DIR`** (default: `.cache/embeddings`)  
  Directory for caching embeddings (relative to workspace root)
  
  ```bash
  export EMBEDDING_CACHE_DIR=".cache/embeddings"
  ```

- **`EMBEDDING_MODEL`** (default: `text-embedding-3-small`)  
  OpenAI embedding model to use. Options:
  - `text-embedding-3-small` (1536 dimensions, faster, cheaper)
  - `text-embedding-3-large` (3072 dimensions, more accurate)
  - `text-embedding-ada-002` (legacy model)
  
  ```bash
  export EMBEDDING_MODEL="text-embedding-3-small"
  ```

- **`SIMILARITY_THRESHOLD`** (default: `0.3`)  
  Minimum cosine similarity for search results (0-1)
  
  ```bash
  export SIMILARITY_THRESHOLD="0.3"
  ```

- **`CITATION_BOOST_FACTOR`** (default: `0.1`)  
  Boost factor for highly-cited papers in ranking (0-1)
  
  ```bash
  export CITATION_BOOST_FACTOR="0.1"
  ```

- **`MAX_CACHE_SIZE`** (default: `1000`)  
  Maximum number of embeddings to cache in memory
  
  ```bash
  export MAX_CACHE_SIZE="1000"
  ```

## Workspace Structure

The server expects your workspace to follow this structure:

```
workspace/
├── 01_Knowledge_Base/
│   └── claims_and_evidence.md          # Claims database (single file)
│   └── claims/                         # OR multi-file structure
│       ├── Smith2020.md
│       └── Johnson2021.md
├── 02_Bibliography/
│   └── extracted_text/                 # Extracted paper text
│       ├── Smith2020.txt
│       └── Johnson2021.txt
├── 03_Drafting/
│   ├── outline.md                      # Manuscript outline
│   └── manuscript.md                   # Draft manuscript
└── .cache/
    └── embeddings/                     # Embedding cache (auto-created)
```

## Tool Reference

### Search Tools

#### `search_by_question`

Search for claims relevant to a research question using semantic similarity.

**Input:**
```json
{
  "question": "What are the effects of climate change on biodiversity?",
  "threshold": 0.3
}
```

**Output:**
```json
[
  {
    "claim": {
      "id": "C_01",
      "text": "Climate change reduces species diversity...",
      "source": "Smith2020",
      "category": "finding"
    },
    "similarity": 0.85
  }
]
```

**Use case:** Find existing evidence before writing new content.

---

#### `search_by_draft`

Analyze draft text to find supporting claims and identify gaps.

**Input:**
```json
{
  "draft_text": "Climate change has significant impacts on ecosystems. Many species are at risk.",
  "mode": "sentence",
  "threshold": 0.3
}
```

**Output:**
```json
{
  "sentences": [
    {
      "text": "Climate change has significant impacts on ecosystems.",
      "matches": [...],
      "needsCitation": false
    },
    {
      "text": "Many species are at risk.",
      "matches": [...],
      "needsCitation": true
    }
  ]
}
```

**Use case:** Find citations after writing a draft.

---

#### `find_multi_source_support`

Find multiple independent sources supporting a statement.

**Input:**
```json
{
  "statement": "Climate change typically affects biodiversity",
  "min_sources": 2
}
```

**Output:**
```json
{
  "sources": [
    { "source": "Smith2020", "claims": [...] },
    { "source": "Johnson2021", "claims": [...] }
  ],
  "count": 2
}
```

**Use case:** Support claims with generalization keywords (often, typically, generally).

---

### Coverage Analysis Tools

#### `analyze_section_coverage`

Analyze literature coverage for a specific section.

**Input:**
```json
{
  "section_id": "2.1"
}
```

**Output:**
```json
{
  "section": "2.1 Climate Impacts",
  "totalSentences": 10,
  "supportedSentences": 7,
  "unsupportedSentences": 3,
  "coveragePercent": 70,
  "suggestions": [
    "Search for: biodiversity loss mechanisms"
  ]
}
```

**Use case:** Identify which sentences need citations.

---

#### `analyze_manuscript_coverage`

Analyze coverage for the entire manuscript.

**Input:**
```json
{}
```

**Output:**
```json
{
  "sections": [
    { "id": "1", "coverage": 85 },
    { "id": "2.1", "coverage": 70 },
    { "id": "2.2", "coverage": 45 }
  ],
  "weakestSections": ["2.2", "3.1"]
}
```

**Use case:** Find sections that need more evidence.

---

### Claim Strength Tools

#### `calculate_claim_strength`

Calculate how strongly a claim is supported by multiple sources.

**Input:**
```json
{
  "claim_id": "C_01"
}
```

**Output:**
```json
{
  "claimId": "C_01",
  "strengthScore": 0.85,
  "supportingClaims": [
    { "source": "Smith2020", "similarity": 0.9 },
    { "source": "Johnson2021", "similarity": 0.8 }
  ],
  "contradictoryClaims": []
}
```

**Use case:** Identify well-established findings vs. isolated claims.

---

#### `calculate_claim_strength_batch`

Calculate strength for multiple claims efficiently.

**Input:**
```json
{
  "claim_ids": ["C_01", "C_02", "C_03"]
}
```

**Output:**
```json
{
  "C_01": { "strengthScore": 0.85, ... },
  "C_02": { "strengthScore": 0.65, ... },
  "C_03": { "strengthScore": 0.92, ... }
}
```

**Use case:** Analyze multiple claims at once to minimize API calls.

---

### Paper Ranking Tools

#### `rank_papers_for_section`

Rank papers by relevance to a specific section.

**Input:**
```json
{
  "section_id": "2.1",
  "papers": [
    {
      "itemKey": "ABC123",
      "title": "Climate Change Effects",
      "authors": ["Smith, J."],
      "year": 2020,
      "abstract": "This paper examines...",
      "citationCount": 150
    }
  ]
}
```

**Output:**
```json
[
  {
    "itemKey": "ABC123",
    "relevanceScore": 0.87,
    "similarityScore": 0.82,
    "citationBoost": 0.05,
    "estimatedReadingTime": 25
  }
]
```

**Use case:** Prioritize which papers to read for a section.

---

#### `rank_papers_for_query`

Rank papers by relevance to a query string.

**Input:**
```json
{
  "query": "biodiversity loss mechanisms",
  "papers": [...]
}
```

**Output:** Same as `rank_papers_for_section`

**Use case:** Find relevant papers for a specific topic.

---

### Claim Extraction Tools

#### `extract_claims_from_text`

Extract potential claims from paper text.

**Input:**
```json
{
  "text": "Climate change reduces biodiversity. Species are migrating to cooler regions.",
  "source": "Smith2020"
}
```

**Output:**
```json
[
  {
    "text": "Climate change reduces biodiversity",
    "confidence": 0.9,
    "category": "finding",
    "context": "...surrounding text..."
  }
]
```

**Use case:** Identify important statements to add to claims database.

---

### Synthesis Tools

#### `suggest_sections_for_claim`

Suggest relevant outline sections for a claim.

**Input:**
```json
{
  "claim_text": "Climate change affects migration patterns",
  "sections": [
    { "id": "2.1", "title": "Climate Impacts", ... },
    { "id": "2.2", "title": "Migration Patterns", ... }
  ]
}
```

**Output:**
```json
[
  { "sectionId": "2.2", "relevance": 0.92 },
  { "sectionId": "2.1", "relevance": 0.78 }
]
```

**Use case:** Organize evidence effectively.

---

#### `group_claims_by_theme`

Group related claims using semantic clustering.

**Input:**
```json
{
  "claims": [...],
  "threshold": 0.6
}
```

**Output:**
```json
{
  "Climate Impacts": [claim1, claim2],
  "Migration Patterns": [claim3, claim4]
}
```

**Use case:** Organize claims before synthesis.

---

#### `generate_paragraph`

Generate a coherent paragraph from multiple claims.

**Input:**
```json
{
  "claims": [...],
  "style": "narrative",
  "include_citations": true,
  "max_length": 500
}
```

**Output:**
```json
{
  "paragraph": "Climate change has profound effects on biodiversity (Smith2020). Recent studies show...",
  "citationsUsed": ["Smith2020", "Johnson2021"]
}
```

**Styles:**
- `narrative`: Tells a story with logical flow
- `analytical`: Compares and contrasts findings
- `descriptive`: Lists and enumerates findings

**Use case:** Draft literature review paragraphs.

---

#### `generate_search_queries`

Generate targeted search queries for a section.

**Input:**
```json
{
  "section_id": "2.1"
}
```

**Output:**
```json
{
  "queries": [
    "climate change biodiversity impacts",
    "species migration patterns warming",
    "ecosystem disruption temperature"
  ]
}
```

**Use case:** Find relevant papers efficiently.

---

## Usage with AI Agents

### Kiro

Add to your Kiro configuration:

```json
{
  "mcpServers": {
    "citation": {
      "command": "npx",
      "args": ["@research-assistant/mcp-server"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "CITATION_WORKSPACE_ROOT": "/path/to/workspace"
      }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "citation": {
      "command": "npx",
      "args": ["@research-assistant/mcp-server"],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "CITATION_WORKSPACE_ROOT": "/path/to/workspace"
      }
    }
  }
}
```

## Troubleshooting

### Server won't start

**Problem:** `OPENAI_API_KEY not set` error

**Solution:** Set the environment variable:
```bash
export OPENAI_API_KEY="sk-..."
```

---

**Problem:** `Configuration errors: CITATION_WORKSPACE_ROOT is required`

**Solution:** Either:
1. Run from your workspace directory, OR
2. Set the environment variable:
```bash
export CITATION_WORKSPACE_ROOT="/path/to/workspace"
```

---

### No claims found

**Problem:** Tools return empty results

**Solution:** Check your workspace structure:
1. Ensure `01_Knowledge_Base/claims_and_evidence.md` exists OR
2. Ensure `01_Knowledge_Base/claims/` directory has `.md` files
3. Verify claims follow the correct format (see workspace structure)

---

### Slow performance

**Problem:** Search queries take a long time

**Solution:**
1. Check embedding cache is working (`.cache/embeddings/` should have files)
2. Increase `MAX_CACHE_SIZE` if you have many unique queries
3. Use `text-embedding-3-small` instead of `text-embedding-3-large`

---

### High API costs

**Problem:** OpenAI API bills are high

**Solution:**
1. Embeddings are cached - costs should be low after initial generation
2. Use `text-embedding-3-small` (cheaper than `text-embedding-3-large`)
3. Check cache is persisting between sessions
4. Avoid regenerating embeddings unnecessarily

---

### Memory issues

**Problem:** Server uses too much memory

**Solution:**
1. Reduce `MAX_CACHE_SIZE` (default: 1000)
2. Clear embedding cache: `rm -rf .cache/embeddings/*`
3. Restart the server periodically

---

### TypeScript errors

**Problem:** Import errors or type mismatches

**Solution:**
1. Ensure you're using Node.js 18+
2. Rebuild the project: `npm run build`
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

---

## Requirements

- **Node.js**: 18.0.0 or higher
- **OpenAI API Key**: Required for embeddings
- **Workspace**: Properly structured research workspace

## Architecture

The Citation MCP Server is a thin adapter (< 500 lines) that:
1. Loads configuration from environment variables
2. Initializes core services from `@research-assistant/core`
3. Exposes tools via MCP protocol
4. Delegates all business logic to core services

This design ensures:
- **Zero duplication**: All logic in core library
- **Easy maintenance**: Bug fixes in one place
- **Consistent behavior**: Same logic for all consumers
- **Performance**: Direct imports, no overhead

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Watching

```bash
npm run watch
```

## License

[Your license here]

## Support

For issues and questions:
- GitHub Issues: [repository-url]/issues
- Documentation: [docs-url]

## Related Projects

- **@research-assistant/core**: Core library with all business logic
- **@research-assistant/vscode-extension**: VS Code extension for researchers
