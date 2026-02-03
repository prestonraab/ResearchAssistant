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

async function testCrossRef(query) {
  console.log('\n=== Testing CrossRef ===');
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=5&select=DOI,title,author,published,abstract,container-title,URL`;
    
    const response = await httpsGet(url);
    const data = JSON.parse(response);
    
    if (data.message && data.message.items) {
      console.log(`✓ CrossRef returned ${data.message.items.length} results`);
      data.message.items.slice(0, 2).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title?.[0] || 'No title'}`);
      });
    } else {
      console.log('✗ No items in response');
    }
  } catch (error) {
    console.log(`✗ CrossRef failed: ${error.message}`);
  }
}

async function testPubMed(query) {
  console.log('\n=== Testing PubMed ===');
  try {
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodedQuery}&retmax=5&retmode=json`;
    
    const searchResponse = await httpsGet(searchUrl);
    const searchData = JSON.parse(searchResponse);
    
    const pmids = searchData.esearchresult?.idlist || [];
    if (pmids.length > 0) {
      console.log(`✓ PubMed search returned ${pmids.length} PMIDs`);
      
      const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.slice(0, 2).join(',')}&retmode=json`;
      const fetchResponse = await httpsGet(fetchUrl);
      const fetchData = JSON.parse(fetchResponse);
      
      pmids.slice(0, 2).forEach(pmid => {
        const item = fetchData.result?.[pmid];
        if (item) {
          console.log(`  - ${item.title}`);
        }
      });
    } else {
      console.log('✗ No PMIDs found');
    }
  } catch (error) {
    console.log(`✗ PubMed failed: ${error.message}`);
  }
}

async function testArxiv(query) {
  console.log('\n=== Testing arXiv ===');
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=5&sortBy=relevance&sortOrder=descending`;
    
    const response = await httpsGet(url);
    const entries = response.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    
    if (entries.length > 0) {
      console.log(`✓ arXiv returned ${entries.length} results`);
      entries.slice(0, 2).forEach((entry, i) => {
        const titleMatch = entry.match(/<title>(.*?)<\/title>/);
        console.log(`  ${i + 1}. ${titleMatch ? titleMatch[1].trim() : 'No title'}`);
      });
    } else {
      console.log('✗ No entries found');
    }
  } catch (error) {
    console.log(`✗ arXiv failed: ${error.message}`);
  }
}

async function testSemanticScholar(query) {
  console.log('\n=== Testing Semantic Scholar ===');
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodedQuery}&limit=5&fields=title,url,abstract,year,authors`;
    
    const response = await httpsGet(url);
    const data = JSON.parse(response);
    
    if (data.data && data.data.length > 0) {
      console.log(`✓ Semantic Scholar returned ${data.data.length} results`);
      data.data.slice(0, 2).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.title}`);
      });
    } else {
      console.log('✗ No data in response');
    }
  } catch (error) {
    console.log(`✗ Semantic Scholar failed: ${error.message}`);
  }
}

async function runTests() {
  const query = 'machine learning batch effects';
  console.log(`Testing APIs with query: "${query}"`);
  
  await testCrossRef(query);
  await testPubMed(query);
  await testArxiv(query);
  await testSemanticScholar(query);
  
  console.log('\n=== Done ===');
}

runTests().catch(console.error);
