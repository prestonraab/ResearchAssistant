#!/usr/bin/env node
/**
 * Quick benchmark script - pure JS, no compilation needed
 * Run with: node packages/vscode-extension/benchmark/quick-profile.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const WORKSPACE_ROOT = path.join(__dirname, '../../..');
const EMBEDDING_INDEX_PATH = path.join(WORKSPACE_ROOT, '.kiro/embedding-index.json');
const EXTRACTED_TEXT_PATH = path.join(WORKSPACE_ROOT, 'literature/ExtractedText');
const CORE_DIST = path.join(__dirname, '../../core/dist');

// Load compiled modules
const { EmbeddingQuantizer } = require(path.join(CORE_DIST, 'services/EmbeddingQuantizer.js'));
const { TextNormalizer } = require(path.join(CORE_DIST, 'utils/text-normalizer.js'));
const { FuzzyMatcher } = require(path.join(CORE_DIST, 'utils/fuzzy-matcher.js'));

console.log('='.repeat(60));
console.log('QUICK PERFORMANCE BENCHMARK');
console.log('='.repeat(60));

// ============================================
// 1. Load data
// ============================================
console.log('\n[1] Loading test data...');

let index;
try {
  index = JSON.parse(fs.readFileSync(EMBEDDING_INDEX_PATH, 'utf-8'));
  console.log(`    Loaded ${index.snippets.length} embeddings`);
} catch (e) {
  console.error('    Failed to load embedding index:', e.message);
  process.exit(1);
}

let sampleDoc;
try {
  const files = fs.readdirSync(EXTRACTED_TEXT_PATH).filter(f => f.endsWith('.txt'));
  sampleDoc = fs.readFileSync(path.join(EXTRACTED_TEXT_PATH, files[0]), 'utf-8');
  console.log(`    Loaded sample doc: ${(sampleDoc.length / 1024).toFixed(1)} KB`);
} catch (e) {
  console.error('    Failed to load sample doc:', e.message);
  process.exit(1);
}

// ============================================
// 2. Benchmark Cosine Similarity
// ============================================
console.log('\n[2] Benchmarking Cosine Similarity...');

const queryEmbedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

// Single similarity
let start = performance.now();
const snippet = index.snippets[0];
const quantized = new Int8Array(snippet.embedding);
for (let i = 0; i < 1000; i++) {
  EmbeddingQuantizer.cosineSimilarityQuantized(queryEmbedding, quantized, snippet.embeddingMetadata);
}
let elapsed = performance.now() - start;
console.log(`    Single similarity (1000x): ${elapsed.toFixed(2)}ms (${(elapsed/1000).toFixed(3)}ms each)`);

// All snippets (simulating search)
start = performance.now();
let count = 0;
for (const s of index.snippets) {
  if (s.embeddingMetadata && typeof s.embeddingMetadata.min === 'number') {
    const q = new Int8Array(s.embedding);
    EmbeddingQuantizer.cosineSimilarityQuantized(queryEmbedding, q, s.embeddingMetadata);
    count++;
  }
}
elapsed = performance.now() - start;
console.log(`    All ${count} snippets: ${elapsed.toFixed(2)}ms (${(elapsed/count).toFixed(4)}ms each)`);

// ============================================
// 3. Benchmark Levenshtein
// ============================================
console.log('\n[3] Benchmarking Levenshtein Distance...');

const str1 = "batch effects can lead to lack of reproducibility and incorrect conclusions";
const str2 = "batch effects can lead to lack of reproducibility and incorrect results";

start = performance.now();
for (let i = 0; i < 1000; i++) {
  TextNormalizer.calculateSimilarity(str1, str2);
}
elapsed = performance.now() - start;
console.log(`    Short strings (1000x): ${elapsed.toFixed(2)}ms (${(elapsed/1000).toFixed(3)}ms each)`);

const longStr1 = str1.repeat(3);
const longStr2 = str2.repeat(3);

start = performance.now();
for (let i = 0; i < 100; i++) {
  TextNormalizer.calculateSimilarity(longStr1, longStr2);
}
elapsed = performance.now() - start;
console.log(`    Long strings (100x): ${elapsed.toFixed(2)}ms (${(elapsed/100).toFixed(3)}ms each)`);

// ============================================
// 4. Benchmark FuzzyMatcher - THE BOTTLENECK
// ============================================
console.log('\n[4] Benchmarking FuzzyMatcher (THE BOTTLENECK)...');

const fuzzyMatcher = new FuzzyMatcher(0.7);
const quote = "batch effects can lead to lack of reproducibility";

// Test with increasing document sizes
const sizes = [1000, 5000, 10000, 20000, 50000];

for (const size of sizes) {
  const doc = sampleDoc.substring(0, size);
  
  start = performance.now();
  fuzzyMatcher.findMatch(quote, doc);
  elapsed = performance.now() - start;
  
  console.log(`    ${(size/1000).toFixed(0)}KB doc: ${elapsed.toFixed(2)}ms`);
  
  // Stop if it's taking too long
  if (elapsed > 5000) {
    console.log('    (Stopping - too slow)');
    break;
  }
}

// ============================================
// 5. Analysis
// ============================================
console.log('\n' + '='.repeat(60));
console.log('ANALYSIS');
console.log('='.repeat(60));

console.log(`
The FuzzyMatcher uses a sliding window with Levenshtein distance.
For a quote of length Q and document of length D:
  - Window sizes: Q*0.9 to Q*1.1 (about 0.2*Q windows)
  - Positions per window: D - windowSize
  - Levenshtein per position: O(Q * windowSize) = O(Q²)
  
Total complexity: O(D * Q²)

For Q=50 chars and D=50,000 chars:
  - ~50,000 window positions
  - ~2,500 operations per Levenshtein
  - = 125,000,000 operations!

SOLUTIONS:
1. Use n-gram pre-filtering (already implemented in TrigramIndex)
2. Skip positions that can't possibly match (early termination)
3. Use faster algorithms (bitap, suffix arrays)
4. Only search in candidate regions from n-gram index
`);

console.log('Done!');
