# Changelog

All notable changes to the Research Assistant project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2024-01-XX

### Breaking Changes

#### OpenAI API Key Required
- **VS Code Extension**: Now requires an OpenAI API key to be configured in settings (`researchAssistant.openaiApiKey`)
- **MCP Server**: Now requires `OPENAI_API_KEY` environment variable to be set
- The extension no longer uses TF-IDF embeddings; OpenAI embeddings are now mandatory for semantic search functionality
- Users must obtain an API key from [OpenAI Platform](https://platform.openai.com/api-keys) to use the extension

### Added

#### Core Library (`@research-assistant/core`)
- **New Package**: Created shared core library at `packages/core/` containing all business logic
- **Zero Dependencies**: Core library has no dependencies on MCP SDK or VS Code API, making it portable and reusable
- **ES Modules**: Full ESM support with `"type": "module"` for modern JavaScript practices
- **Comprehensive TypeScript Types**: All exports include full type definitions for excellent IDE support

#### Shared Services
- **ClaimsManager**: Centralized claims management with support for single-file and multi-file structures
- **EmbeddingService**: OpenAI-powered semantic embeddings with intelligent caching (memory + disk)
- **SearchService**: Advanced semantic search with question-based and draft-based analysis
- **OutlineParser**: Markdown outline parsing with section hierarchy extraction
- **CoverageAnalyzer**: Literature coverage analysis for manuscript sections
- **ClaimStrengthCalculator**: Multi-source claim strength validation
- **PaperRanker**: Semantic paper ranking for section relevance
- **ClaimExtractor**: Automated claim extraction from source texts
- **SynthesisEngine**: Multi-claim synthesis with citation support
- **SearchQueryGenerator**: Intelligent search query generation from section content

#### Extension Features
- **OpenAI Embeddings**: Replaced TF-IDF with OpenAI's `text-embedding-3-small` model for superior semantic understanding
- **Configurable Embedding Model**: Choose between `text-embedding-3-small`, `text-embedding-3-large`, or `text-embedding-ada-002`
- **Embedding Cache**: Intelligent caching system with configurable size limits (default: 1000 embeddings)
- **Helpful Error Messages**: Clear guidance when API key is missing or invalid, with links to settings
- **Direct Core Access**: Extension now imports core library directly for zero-latency operations

#### MCP Server Features
- **Thin Adapter Architecture**: MCP server is now a lightweight wrapper around core library
- **Consistent Behavior**: Identical search algorithms and similarity thresholds as extension
- **Environment-Based Configuration**: Simple configuration via `OPENAI_API_KEY` environment variable

#### Testing
- **Comprehensive Test Suite**: 186 tests across unit, integration, and property-based testing
- **Property-Based Tests**: Using fast-check for robust validation of invariants
- **ESM Test Support**: Jest configured for ES Modules with experimental VM modules

### Changed

#### Architecture
- **Monorepo Structure**: Migrated to npm workspaces with three packages:
  - `packages/core/` - Shared core library
  - `packages/mcp-server/` - MCP adapter
  - `packages/vscode-extension/` - VS Code adapter
- **Dual-Head Architecture**: Both extension and MCP server now consume the same core library, eliminating code duplication
- **Build System**: Unified build system with workspace-level commands (`npm run build`, `npm test`)

#### Code Quality
- **Eliminated Duplication**: Removed 5000+ lines of duplicate code between extension and MCP server
- **Single Source of Truth**: All business logic now lives in one place (core library)
- **Consistent Behavior**: Identical claim parsing, search ranking, and quote verification across both adapters
- **Improved Maintainability**: Bug fixes and improvements now benefit both extension and MCP server automatically

#### Performance
- **LRU Cache Eviction**: Intelligent cache management prevents unbounded memory growth
- **Disk Cache Persistence**: Embeddings persist across sessions, reducing API calls
- **Batch Embedding Generation**: More efficient API usage for multiple texts
- **Optimized Search**: Improved search algorithms with better ranking

### Fixed

- **Cache Size Management**: Fixed property test failure in EmbeddingService to ensure cache never exceeds configured limit
- **Type Safety**: Resolved TypeScript compilation errors in extension state management
- **Import Resolution**: Fixed ESM import paths with proper `.js` extensions
- **Memory Leaks**: Implemented proper cache trimming to prevent memory issues

### Improved

#### Documentation
- **Core Library README**: Comprehensive API documentation with usage examples
- **MCP Server README**: Installation and configuration guide with tool reference
- **Extension README**: Updated with migration guide and OpenAI API key setup instructions
- **Architecture Documentation**: Detailed design document explaining dual-head architecture

#### Developer Experience
- **Source Maps**: Full source map support for debugging across all packages
- **Watch Mode**: Development watch mode for all packages
- **Incremental Builds**: Fast incremental compilation with TypeScript
- **Better Error Messages**: Clear, actionable error messages throughout

### Migration Guide

#### For Extension Users

1. **Install v0.2.0**: Update to the latest version
2. **Get OpenAI API Key**: Sign up at [OpenAI Platform](https://platform.openai.com/api-keys)
3. **Configure Extension**:
   - Open VS Code Settings (Cmd/Ctrl + ,)
   - Search for "Research Assistant"
   - Set `researchAssistant.openaiApiKey` to your API key
4. **Verify Setup**: Run any search command - you should see improved results

#### For MCP Server Users

1. **Update Package**: Run `npm install -g @research-assistant/mcp-server@latest`
2. **Set Environment Variable**: Add `export OPENAI_API_KEY=your-key-here` to your shell profile
3. **Restart Server**: The server will now use OpenAI embeddings

#### Breaking Changes Impact

- **Existing Workspaces**: All existing claims files and extracted texts continue to work without modification
- **Cache Files**: Old TF-IDF cache files are ignored; new OpenAI embeddings will be generated on first use
- **Commands**: All extension commands work identically; no workflow changes required
- **MCP Tools**: All MCP tools maintain the same interface; no client changes needed

### Technical Details

#### Dependencies
- **Added**: `openai@^4.20.0` for embedding generation
- **Node.js**: Requires Node.js 18+ for native ESM support
- **TypeScript**: Upgraded to TypeScript 5.3+ for better ESM support

#### Build Configuration
- **ES2022 Target**: Modern JavaScript features for better performance
- **Node16 Module Resolution**: Proper ESM module resolution
- **Strict Mode**: Full TypeScript strict mode for type safety

### Known Issues

- MCP server size is currently 2380 lines (target: < 500 lines) - optimization in progress
- Extension bundle size increased by ~45KB due to OpenAI SDK inclusion

### Acknowledgments

This release represents a major architectural improvement, consolidating duplicate code and modernizing the codebase with ES Modules. The shared core library ensures consistent behavior between the extension and MCP server while making future development more efficient.

---

## [0.1.0] - 2023-XX-XX

### Added
- Initial release of Research Assistant VS Code Extension
- Initial release of Citation MCP Server
- Claims management and verification
- Quote verification against source texts
- Coverage analysis for manuscript sections
- TF-IDF-based semantic search
- Outline parsing and section tracking

---

[0.2.0]: https://github.com/yourusername/research-assistant/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourusername/research-assistant/releases/tag/v0.1.0
