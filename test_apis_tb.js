import https from 'https';

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
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
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

async function testQuery(query) {
  console.log(`\n📚 Testing with query: "${query}"\n`);
  
  // CrossRef
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=3`;
    const response = await httpsGet(url);
    const data = JSON.parse(response);
    const count = data.message?.items?.length || 0;
    console.log(`✓ CrossRef: ${count} papers`);
    data.message?.items?.slice(0, 2).forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.title?.[0]?.substring(0, 70)}`);
    });
  } catch (error) {
    console.log(`✗ CrossRef: ${error.message}`);
  }

  // PubMed
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmax=3&retmode=json`;
    const searchResponse = await httpsGet(searchUrl);
    const searchData = JSON.parse(searchResponse);
    const pmids = searchData.esearchresult?.idlist || [];
    console.log(`✓ PubMed: ${pmids.length} papers`);
    if (pmids.length > 0) {
      const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.slice(0, 2).join(',')}&retmode=json`;
      const fetchResponse = await httpsGet(fetchUrl);
      const fetchData = JSON.parse(fetchResponse);
      pmids.slice(0, 2).forEach((pmid, i) => {
        const item = fetchData.result?.[pmid];
        if (item) {
          console.log(`    ${i + 1}. ${item.title?.substring(0, 70)}`);
        }
      });
    }
  } catch (error) {
    console.log(`✗ PubMed: ${error.message}`);
  }

  // Semantic Scholar
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=3&fields=title,year`;
    const response = await httpsGet(url);
    const data = JSON.parse(response);
    const count = data.data?.length || 0;
    console.log(`✓ Semantic Scholar: ${count} papers`);
    data.data?.slice(0, 2).forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.title?.substring(0, 70)} (${item.year})`);
    });
  } catch (error) {
    console.log(`✗ Semantic Scholar: ${error.message}`);
  }
}

async function run() {
  await testQuery('tuberculosis gene expression');
  await testQuery('batch effects RNA-seq');
  await testQuery('ComBat normalization');
}

run().catch(console.error);
