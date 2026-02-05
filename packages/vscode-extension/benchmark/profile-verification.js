#!/usr/bin/env node
/**
 * Profile the quote verification loop in detail
 * Run with: node packages/vscode-extension/benchmark/profile-verification.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const WORKSPACE_ROOT = path.join(__dirname, '../../..');
const EXTRACTED_TEXT_PATH = path.join(WORKSPACE_ROOT, 'literature/ExtractedText');
const CORE_DIST = path.join(__dirname, '../../core/dist');

// Load compiled modules
const { TextNormalizer } = require(path.join(CORE_DIST, 'utils/text-normalizer.js'));
const { FuzzyMatcher } = require(path.join(CORE_DIST, 'utils/fuzzy-matcher.js'));

console.log('='.repeat(70));
console.log('QUOTE VERIFICATION PROFILER');
console.log('='.repeat(70));

// Test quote from user
const TEST_QUOTE = "Random forest gene selection yields very small sets of genes while preserving predictive accuracy";
const TEST_SOURCE = "Diaz-Uriarte2006"; // Expected source

console.log(`\nTest Quote: "${TEST_QUOTE}"`);
console.log(`Expected Source: ${TEST_SOURCE}`);

// ============================================
// Load all documents
// ============================================
console.log('\n[1] Loading documents...');
const loadStart = performance.now();

const allDocs = [];
let totalSize = 0;
const files = fs.readdirSync(EXTRACTED_TEXT_PATH).filter(f => f.endsWith('.txt'));

for (const file of files) {
  const content = fs.readFileSync(path.join(EXTRACTED_TEXT_PATH, file), 'utf-8');
  allDocs.push({ name: file, content, size: content.length });
  totalSize += content.length;
}

const loadTime = performance.now() - loadStart;
console.log(`    Loaded ${allDocs.length} docs (${(totalSize / 1024 / 1024).toFixed(2)} MB) in ${loadTime.toFixed(0)}ms`);

// ============================================
// Build N-gram index
// ============================================
console.log('\n[2] Building N-gram index...');
const indexStart = performance.now();

const NGRAM_SIZE = 6;
function extractNgrams(text) {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams = new Set();
  for (let i = 0; i <= normalized.length - NGRAM_SIZE; i++) {
    ngrams.add(normalized.substring(i, i + NGRAM_SIZE));
  }
  return ngrams;
}

// Calculate ngram frequency across all docs
const ngramDocFreq = new Map();
const documents = new Map();

for (const doc of allDocs) {
  const ngrams = extractNgrams(doc.content);
  documents.set(doc.name, { ngrams, content: doc.content, size: doc.size });
  
  for (const ngram of ngrams) {
    ngramDocFreq.set(ngram, (ngramDocFreq.get(ngram) || 0) + 1);
  }
}

// Build inverted index
const invertedIndex = new Map();
for (const doc of allDocs) {
  const ngrams = documents.get(doc.name).ngrams;
  for (const ngram of ngrams) {
    if (!invertedIndex.has(ngram)) {
      invertedIndex.set(ngram, new Set());
    }
    invertedIndex.get(ngram).add(doc.name);
  }
}

const indexTime = performance.now() - indexStart;
console.log(`    Built index with ${invertedIndex.size} unique ngrams in ${indexTime.toFixed(0)}ms`);

// ============================================
// Profile: N-gram candidate finding
// ============================================
console.log('\n[3] N-gram candidate finding...');
const candidateStart = performance.now();

const queryNgrams = extractNgrams(TEST_QUOTE);
console.log(`    Query has ${queryNgrams.size} ngrams`);

// Find rare ngrams (appear in < 20% of docs)
const rareNgrams = new Set();
for (const ngram of queryNgrams) {
  const freq = ngramDocFreq.get(ngram) || 0;
  if (freq < allDocs.length * 0.2) {
    rareNgrams.add(ngram);
  }
}
console.log(`    ${rareNgrams.size} rare ngrams (< 20% doc frequency)`);

// Count matches per document
const docNgramCounts = new Map();
for (const ngram of rareNgrams) {
  const docs = invertedIndex.get(ngram);
  if (docs) {
    for (const docId of docs) {
      docNgramCounts.set(docId, (docNgramCounts.get(docId) || 0) + 1);
    }
  }
}

// Filter candidates by containment threshold
const thresholds = [0.30, 0.15, 0.10, 0.05];
for (const threshold of thresholds) {
  const candidates = [];
  for (const [docId, matchCount] of docNgramCounts) {
    const containment = matchCount / rareNgrams.size;
    if (containment >= threshold) {
      candidates.push({ docId, containment, matchCount });
    }
  }
  candidates.sort((a, b) => b.containment - a.containment);
  
  console.log(`    At ${(threshold * 100).toFixed(0)}% threshold: ${candidates.length} candidates`);
  if (candidates.length > 0 && candidates.length <= 5) {
    for (const c of candidates) {
      const shortName = c.docId.substring(0, 50);
      console.log(`      - ${shortName}... (${(c.containment * 100).toFixed(1)}%, ${c.matchCount} matches)`);
    }
  }
}

const candidateTime = performance.now() - candidateStart;
console.log(`    Candidate finding took ${candidateTime.toFixed(2)}ms`);

// ============================================
// Profile: Fuzzy matching on each candidate
// ============================================
console.log('\n[4] Fuzzy matching on candidates...');

const fuzzyMatcher = new FuzzyMatcher(0.7);

// Get candidates at 15% threshold
const candidates = [];
for (const [docId, matchCount] of docNgramCounts) {
  const containment = matchCount / rareNgrams.size;
  if (containment >= 0.15) {
    candidates.push({ docId, containment, matchCount });
  }
}
candidates.sort((a, b) => b.containment - a.containment);

console.log(`    Testing ${candidates.length} candidates at 15% threshold`);

const fuzzyResults = [];
let totalFuzzyTime = 0;

for (const candidate of candidates.slice(0, 10)) {
  const doc = documents.get(candidate.docId);
  if (!doc) continue;
  
  const fuzzyStart = performance.now();
  const result = fuzzyMatcher.findMatch(TEST_QUOTE, doc.content);
  const fuzzyTime = performance.now() - fuzzyStart;
  totalFuzzyTime += fuzzyTime;
  
  const shortName = candidate.docId.substring(0, 45);
  const docSizeKB = (doc.size / 1024).toFixed(0);
  
  if (result.matched && result.confidence !== undefined) {
    fuzzyResults.push({
      docId: candidate.docId,
      confidence: result.confidence,
      matchedText: result.matchedText?.substring(0, 60),
      time: fuzzyTime
    });
    console.log(`    ${shortName}... (${docSizeKB}KB): ${(result.confidence * 100).toFixed(1)}% in ${fuzzyTime.toFixed(0)}ms`);
  } else {
    console.log(`    ${shortName}... (${docSizeKB}KB): no match in ${fuzzyTime.toFixed(0)}ms`);
  }
}

console.log(`    Total fuzzy time: ${totalFuzzyTime.toFixed(0)}ms`);

// ============================================
// Profile: Full document scan (worst case)
// ============================================
console.log('\n[5] Full document scan (worst case baseline)...');

const fullScanStart = performance.now();
let fullScanMatches = 0;
let fullScanTime = 0;

// Only scan first 10 docs to avoid taking forever
for (const doc of allDocs.slice(0, 10)) {
  const scanStart = performance.now();
  const result = fuzzyMatcher.findMatch(TEST_QUOTE, doc.content);
  const scanTime = performance.now() - scanStart;
  fullScanTime += scanTime;
  
  if (result.matched && result.confidence >= 0.8) {
    fullScanMatches++;
    const shortName = doc.name.substring(0, 45);
    console.log(`    Found in ${shortName}... (${(result.confidence * 100).toFixed(1)}%) - ${scanTime.toFixed(0)}ms`);
  }
}

console.log(`    Scanned 10 docs in ${fullScanTime.toFixed(0)}ms (avg ${(fullScanTime / 10).toFixed(0)}ms/doc)`);
console.log(`    Estimated full scan (${allDocs.length} docs): ${((fullScanTime / 10) * allDocs.length / 1000).toFixed(1)}s`);

// ============================================
// Summary
// ============================================
console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

console.log(`\nDocument loading: ${loadTime.toFixed(0)}ms`);
console.log(`Index building: ${indexTime.toFixed(0)}ms`);
console.log(`Candidate finding: ${candidateTime.toFixed(2)}ms`);
console.log(`Fuzzy matching (${candidates.length} candidates): ${totalFuzzyTime.toFixed(0)}ms`);

if (fuzzyResults.length > 0) {
  const best = fuzzyResults.sort((a, b) => b.confidence - a.confidence)[0];
  console.log(`\nBest match: ${best.docId}`);
  console.log(`Confidence: ${(best.confidence * 100).toFixed(1)}%`);
  console.log(`Time: ${best.time.toFixed(0)}ms`);
  console.log(`Preview: "${best.matchedText}..."`);
}

// Check if expected source was found
const expectedFound = fuzzyResults.some(r => r.docId.toLowerCase().includes(TEST_SOURCE.toLowerCase().replace(/\d+/g, '')));
if (expectedFound) {
  console.log(`\n✓ Expected source (${TEST_SOURCE}) was found!`);
} else {
  console.log(`\n✗ Expected source (${TEST_SOURCE}) was NOT found in top candidates`);
  console.log(`  This may indicate the quote text differs from the source or the source file is named differently`);
  
  // Try to find the actual text in the expected source
  const expectedDoc = allDocs.find(d => d.name.toLowerCase().includes(TEST_SOURCE.toLowerCase().replace(/\d+/g, '')));
  if (expectedDoc) {
    console.log(`\n  Searching for similar text in ${expectedDoc.name.substring(0, 50)}...`);
    
    // Look for key phrases from the quote
    const keyPhrases = ['very small sets of genes', 'preserving predictive accuracy', 'gene selection'];
    for (const phrase of keyPhrases) {
      const idx = expectedDoc.content.toLowerCase().indexOf(phrase.toLowerCase());
      if (idx !== -1) {
        const context = expectedDoc.content.substring(Math.max(0, idx - 50), idx + phrase.length + 100);
        console.log(`  Found "${phrase}" at position ${idx}:`);
        console.log(`    "...${context.replace(/\s+/g, ' ').trim()}..."`);
      }
    }
  }
}

// Bottleneck analysis
console.log('\n' + '-'.repeat(70));
console.log('BOTTLENECK ANALYSIS');
console.log('-'.repeat(70));

const avgFuzzyPerDoc = totalFuzzyTime / Math.max(candidates.length, 1);
console.log(`\nAverage fuzzy match time per document: ${avgFuzzyPerDoc.toFixed(0)}ms`);

if (avgFuzzyPerDoc > 500) {
  console.log(`⚠️  Fuzzy matching is slow (>${avgFuzzyPerDoc.toFixed(0)}ms/doc)`);
  console.log(`   Consider: Reducing document size, using region-based matching, or caching`);
}

if (candidates.length > 20) {
  console.log(`⚠️  Too many candidates (${candidates.length})`);
  console.log(`   Consider: Stricter ngram threshold or better rare ngram selection`);
}

if (candidates.length < 3 && fuzzyResults.length === 0) {
  console.log(`⚠️  Too few candidates (${candidates.length}) and no matches`);
  console.log(`   Consider: Relaxing ngram threshold or checking if quote exists in corpus`);
}

console.log('\nDone!');
