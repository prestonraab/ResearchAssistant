/**
 * Configuration management for the citation MCP server
 * Loads settings from environment variables with sensible defaults
 */

export interface Config {
  workspaceRoot: string;
  openaiApiKey: string;
  embeddingCacheDir: string;
  embeddingModel: string;
  similarityThreshold: number;
  citationBoostFactor: number;
  maxCacheSize: number;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): Config {
  const workspaceRoot = process.env.CITATION_WORKSPACE_ROOT || process.cwd();
  const openaiApiKey = process.env.OPENAI_API_KEY || '';
  
  if (!openaiApiKey) {
    console.warn('Warning: OPENAI_API_KEY not set. Embedding features will not work.');
  }

  return {
    workspaceRoot,
    openaiApiKey,
    embeddingCacheDir: process.env.EMBEDDING_CACHE_DIR || '.cache/embeddings',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.3'),
    citationBoostFactor: parseFloat(process.env.CITATION_BOOST_FACTOR || '0.1'),
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '1000', 10),
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: Config): string[] {
  const errors: string[] = [];

  if (!config.workspaceRoot) {
    errors.push('CITATION_WORKSPACE_ROOT is required');
  }

  if (config.similarityThreshold < 0 || config.similarityThreshold > 1) {
    errors.push('SIMILARITY_THRESHOLD must be between 0 and 1');
  }

  if (config.citationBoostFactor < 0) {
    errors.push('CITATION_BOOST_FACTOR must be non-negative');
  }

  if (config.maxCacheSize < 1) {
    errors.push('MAX_CACHE_SIZE must be at least 1');
  }

  return errors;
}
