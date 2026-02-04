#!/usr/bin/env npx ts-node
/**
 * Standalone benchmark script for profiling search operations
 * Run with: npx ts-node packages/vscode-extension/benchmark/profile-search.ts
 * 
 * Or compile and run:
 *   npx tsc packages/vscode-extension/benchmark/profile-search.ts --outDir packages/vscode-extension/benchmark/dist --esModuleInterop
 *   node packages/vscode-extension/benchmark/dist/profile-search.js
 */

import * as fs from 'fs';
import * as path from 'path';

// Import from compiled core package
const corePath = path.join(__dirname, '../../core/dist');
const { EmbeddingQuantizer } = require(path.join(corePath, 'services/EmbeddingQuantizer.js'));
const { TextNormalizer } = require(path.join(corePath, 'utils/text-normalizer.js'));
const { FuzzyMatcher } = require(path.join(corePath, 'utils/fuzzy-matcher.js'));

// Configuration
const WORKSPACE_ROOT = path.join(__dirname, '../../..');
const EMBEDDING_INDEX_PATH = path.join(WORKSPACE_ROOT, '.kiro/embedding-index.json');
const EXTRACTED_TEXT_PATH = path.join(WORKSPACE_ROOT, 'literature/ExtractedText');

interface ProfileResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSec: number;
}

/**
 * Profile a function over multiple iterations
 */
async function profile(
  name: string,
  fn: () => Promise<void> | void,
  iterations: number = 100
): Promise<ProfileResult> {
  const times: number[] = [];
  
  // Warmup
  for (let i = 0; i < Math.min(5, iterations); i++) {
    await fn();
  }
  
  // Actual profiling
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  
  const totalMs = times.reduce((a, b) => a + b, 0);
  const avgMs = totalMs / iterations;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  
  return {
    name,
    iterations,
    totalMs,
    avgMs,
    minMs,
    maxMs,
    opsPerSec: 1000 / avgMs
  };
}

/**
 * Print profile results
 */
function printResults(results: ProfileResult[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('BENCHMARK RESULTS');
  console.log('='.repeat(80));
  
  for (const r of results) {
    console.log(`\n${r.name}:`);
    console.log(`  Iterations: ${r.iterations}`);
    console.log(`  Average:    ${r.avgMs.toFixed(3)} ms`);
    console.log(`  Min:        ${r.minMs.toFixed(3)} ms`);
    console.log(`  Max:        ${r.maxMs.toFixed(3)} ms`);
    console.log(`  Ops/sec:    ${r.opsPerSec.toFixed(1)}`);
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Load embedding index
 */
function loadEmbeddingIndex(): any {
  if (!fs.existsSync(EMBEDDING_INDEX_PATH)) {
    console.error('Embedding index not found at:', EMBEDDING_INDEX_PATH);
    console.error('Run the extension first to build the index.');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(EMBEDDING_INDEX_PATH, 'utf-8'));
  console.log(`Loaded embedding index: ${data.snippets.length} snippets`);
  return data;
}

/**
 * Load sample documents for fuzzy matching tests
 */
function loadSampleDocuments(): string[] {
  if (!fs.existsSync(EXTRACTED_TEXT_PATH)) {
    console.error('Extracted text path not found:', EXTRACTED_TEXT_PATH);
    process.exit(1);
  }
  
  const files = fs.readdirSync(EXTRACTED_TEXT_PATH)
    .filter(f => f.endsWith('.txt'))
    .slice(0, 5); // Just use first 5 files
  
  return files.map(f => fs.readFileSync(path.join(EXTRACTED_TEXT_PATH, f), 'utf-8'));
}

/**
 * Generate a random embedding (simulating a query)
 */
function generateRandomEmbedding(dim: number = 1536): number[] {
  const embedding: number[] = [];
  for (let i = 0; i < dim; i++) {
    embedding.push(Math.random() * 2 - 1); // Random values between -1 and 1
  }
  return embedding;
}

async function main() {
  console.log('Loading test data...');
  
  const index = loadEmbeddingIndex();
  const documents = loadSampleDocuments();
  const queryEmbedding = generateRandomEmbedding();
  
  // Sample quote for fuzzy matching
  const sampleQuote = "batch effects can lead to lack of reproducibility and incorrect conclusions";
  
  const results: ProfileResult[] = [];
  
  // ============================================
  // 1. Cosine Similarity (single)
  // ============================================
  console.log('\nProfiling: Cosine Similarity (single)...');
  
  const snippet = index.snippets[0];
  const quantized = new Int8Array(snippet.embedding);
  const metadata = snippet.embeddingMetadata;
  
  results.push(await profile(
    'CosineSimilarity (single)',
    () => {
      EmbeddingQuantizer.cosineSimilarityQuantized(queryEmbedding, quantized, metadata);
    },
    10000
  ));
  
  // ============================================
  // 2. Cosine Similarity (all snippets - simulating search)
  // ============================================
  console.log('\nProfiling: Cosine Similarity (all snippets)...');
  
  const allQuantized = index.snippets.map((s: any) => ({
    quantized: new Int8Array(s.embedding),
    metadata: s.embeddingMetadata
  }));
  
  results.push(await profile(
    `CosineSimilarity (${index.snippets.length} snippets)`,
    () => {
      for (const s of allQuantized) {
        if (s.metadata && typeof s.metadata.min === 'number') {
          EmbeddingQuantizer.cosineSimilarityQuantized(queryEmbedding, s.quantized, s.metadata);
        }
      }
    },
    10
  ));
  
  // ============================================
  // 3. Levenshtein Distance
  // ============================================
  console.log('\nProfiling: Levenshtein Distance...');
  
  const str1 = sampleQuote;
  const str2 = "batch effects can lead to lack of reproducibility and incorrect results";
  
  results.push(await profile(
    'Levenshtein Distance (short strings ~70 chars)',
    () => {
      TextNormalizer.calculateSimilarity(str1, str2);
    },
    10000
  ));
  
  // ============================================
  // 4. Levenshtein Distance (longer strings)
  // ============================================
  console.log('\nProfiling: Levenshtein Distance (longer)...');
  
  const longStr1 = sampleQuote.repeat(5);
  const longStr2 = str2.repeat(5);
  
  results.push(await profile(
    'Levenshtein Distance (long strings ~350 chars)',
    () => {
      TextNormalizer.calculateSimilarity(longStr1, longStr2);
    },
    1000
  ));
  
  // ============================================
  // 5. FuzzyMatcher.findMatch (small document)
  // ============================================
  console.log('\nProfiling: FuzzyMatcher.findMatch (small doc)...');
  
  const fuzzyMatcher = new FuzzyMatcher(0.7);
  const smallDoc = documents[0].substring(0, 5000); // First 5KB
  
  results.push(await profile(
    'FuzzyMatcher.findMatch (5KB doc)',
    () => {
      fuzzyMatcher.findMatch(sampleQuote, smallDoc);
    },
    100
  ));
  
  // ============================================
  // 6. FuzzyMatcher.findMatch (medium document)
  // ============================================
  console.log('\nProfiling: FuzzyMatcher.findMatch (medium doc)...');
  
  const mediumDoc = documents[0].substring(0, 20000); // First 20KB
  
  results.push(await profile(
    'FuzzyMatcher.findMatch (20KB doc)',
    () => {
      fuzzyMatcher.findMatch(sampleQuote, mediumDoc);
    },
    20
  ));
  
  // ============================================
  // 7. FuzzyMatcher.findMatch (full document)
  // ============================================
  console.log('\nProfiling: FuzzyMatcher.findMatch (full doc)...');
  
  const fullDoc = documents[0]; // Full document
  console.log(`  Document size: ${(fullDoc.length / 1024).toFixed(1)} KB`);
  
  results.push(await profile(
    `FuzzyMatcher.findMatch (${(fullDoc.length / 1024).toFixed(0)}KB doc)`,
    () => {
      fuzzyMatcher.findMatch(sampleQuote, fullDoc);
    },
    5
  ));
  
  // ============================================
  // 8. Text Normalization
  // ============================================
  console.log('\nProfiling: Text Normalization...');
  
  results.push(await profile(
    'TextNormalizer.normalizeForMatching',
    () => {
      TextNormalizer.normalizeForMatching(sampleQuote);
    },
    10000
  ));
  
  // ============================================
  // Print Results
  // ============================================
  printResults(results);
  
  // ============================================
  // Analysis
  // ============================================
  console.log('\nANALYSIS:');
  console.log('-'.repeat(40));
  
  const embeddingSearchTime = results.find(r => r.name.includes('snippets'))?.avgMs || 0;
  const fuzzyFullTime = results.find(r => r.name.includes('KB doc') && !r.name.includes('5KB') && !r.name.includes('20KB'))?.avgMs || 0;
  
  console.log(`\nEstimated time for claim review operations:`);
  console.log(`  - Embedding search (${index.snippets.length} snippets): ${embeddingSearchTime.toFixed(0)}ms`);
  console.log(`  - Fuzzy match per document: ${fuzzyFullTime.toFixed(0)}ms`);
  console.log(`  - Fuzzy match 7 candidates: ${(fuzzyFullTime * 7).toFixed(0)}ms`);
  console.log(`  - Total estimated: ${(embeddingSearchTime + fuzzyFullTime * 7).toFixed(0)}ms`);
  
  if (embeddingSearchTime > 500) {
    console.log('\n⚠️  Embedding search is slow. Consider:');
    console.log('    - Using approximate nearest neighbor (ANN) index');
    console.log('    - Pre-filtering by document metadata');
  }
  
  if (fuzzyFullTime > 200) {
    console.log('\n⚠️  Fuzzy matching is slow. Consider:');
    console.log('    - Using n-gram pre-filtering (already implemented)');
    console.log('    - Limiting search to candidate regions only');
    console.log('    - Using faster string matching algorithms (e.g., bitap)');
  }
}

main().catch(console.error);
