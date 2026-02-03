import https from 'https';

const RATE_LIMITS = {
  crossref: 1000,        // 1 request per second
  pubmed: 333,           // ~3 requests per second
  arxiv: 1000,           // 1 request per second
  semanticscholar: 3000, // 0.33 requests per second
};

const SEARCH_TIMEOUT = 10000;

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Research-Assistant/1.0',
      },
      timeout: SEARCH_TIMEOUT,
    }, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        if (response.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function testAPI(name, url) {
  try {
    const start = Date.now();
    const response = await httpsGet(url);
    const elapsed = Date.now() - start;
    console.log(`✓ ${name.padEnd(18)} ${elapsed}ms`);
    return true;
  } catch (error) {
    console.log(`✗ ${name.padEnd(18)} ${error.message}`);
    return false;
  }
}

async function run() {
  console.log('\n📊 Testing APIs with tuned rate limits\n');
  console.log('Rate limits (ms between requests):');
  Object.entries(RATE_LIMITS).forEach(([api, ms]) => {
    console.log(`  ${api.padEnd(18)} ${ms}ms (${(1000/ms).toFixed(2)} req/sec)`);
  });
  
  console.log('\n🔍 Running 3 sequential queries per API:\n');
  
  const query = 'batch effects';
  const encodedQuery = encodeURIComponent(query);
  
  // Test each API 3 times
  for (let i = 1; i <= 3; i++) {
    console.log(`\nRound ${i}:`);
    
    const start = Date.now();
    
    await testAPI('CrossRef', `https://api.crossref.org/works?query=${encodedQuery}&rows=1`);
    await new Promise(r => setTimeout(r, RATE_LIMITS.crossref));
    
    await testAPI('PubMed', `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmax=1&retmode=json`);
    await new Promise(r => setTimeout(r, RATE_LIMITS.pubmed));
    
    await testAPI('arXiv', `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&max_results=1`);
    await new Promise(r => setTimeout(r, RATE_LIMITS.arxiv));
    
    await testAPI('Semantic Scholar', `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=1`);
    await new Promise(r => setTimeout(r, RATE_LIMITS.semanticscholar));
    
    const elapsed = Date.now() - start;
    console.log(`  Total: ${elapsed}ms`);
  }
  
  console.log('\n✅ Done\n');
}

run().catch(console.error);
