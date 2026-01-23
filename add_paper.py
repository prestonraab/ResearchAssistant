import sys
import os
import argparse
import requests
from dotenv import load_dotenv
from zotero_api import ZoteroAPI

# Load environment variables from .env file
load_dotenv()

# Get Zotero credentials from environment variables
API_KEY = os.getenv("ZOTERO_API_KEY")
USER_ID = os.getenv("ZOTERO_USER_ID")

if not API_KEY or not USER_ID:
    print("Error: ZOTERO_API_KEY and ZOTERO_USER_ID must be set in environment variables or .env file")
    print("Create a .env file with:")
    print("  ZOTERO_API_KEY=your_api_key_here")
    print("  ZOTERO_USER_ID=your_user_id_here")
    sys.exit(1)

def get_crossref_metadata(doi: str) -> dict:
    """Fetches metadata from CrossRef API for a given DOI."""
    url = f"https://api.crossref.org/works/{doi}"
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()
    item = data['message']

    # Extracting relevant information
    title = item.get('title', [''])[0]
    authors_list = []
    for creator in item.get('author', []):
        if 'given' in creator and 'family' in creator:
            authors_list.append(f"{creator['family']}, {creator['given']}")
    authors = "; ".join(authors_list)
    
    date_parts = item.get('published', {}).get('date-parts', [[None]])[0]
    date = str(date_parts[0]) if date_parts and date_parts[0] else None
    
    publication_title = item.get('container-title', [''])[0] # Changed to publication_title
    abstract = item.get('abstract', '')

    result = {
        'title': title,
        'authors': authors,
        'date': date,
        'publicationTitle': publication_title, # Changed to publicationTitle
        'DOI': doi
    }
    
    # Only add abstract if it's not empty and doesn't contain XML/HTML tags
    if abstract and not ('<' in abstract and '>' in abstract):
        result['abstractNote'] = abstract
    
    return result

def get_pubmed_metadata(pmid: str) -> dict:
    """Fetches metadata from PubMed API for a given PMID."""
    url = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id={pmid}&retmode=json"
    response = requests.get(url)
    response.raise_for_status()
    data = response.json()
    
    result = data['result'][pmid]
    
    title = result.get('title', '')
    authors_list = []
    for author in result.get('authors', []):
        authors_list.append(f"{author['name']}")
    authors = "; ".join(authors_list)

    pub_date = result.get('pubdate', '')
    year = pub_date.split(' ')[0] if pub_date else None # Extract year from date string

    publication_title = result.get('source', '') # Changed to publication_title
    
    # PubMed summary doesn't always include abstract directly, so we skip it for now
    abstract = "" 

    return {
        'title': title,
        'authors': authors,
        'date': year,
        'publicationTitle': publication_title, # Changed to publicationTitle
        'PMID': pmid
    }

def main():
    parser = argparse.ArgumentParser(description='Add a paper to a Zotero collection')
    parser.add_argument('--title', help='Paper title')
    parser.add_argument('--authors', help='Authors (format: "Last, First; Last, First" or "First Last; First Last")')
    parser.add_argument('--doi', help='DOI')
    parser.add_argument('--date', help='Publication date')
    parser.add_argument('--journal', help='Journal name (publicationTitle)') # Keep as journal for argument parsing
    parser.add_argument('--abstract', help='Abstract')
    parser.add_argument('--url', help='URL')
    parser.add_argument('--pmid', help='PubMed ID')
    parser.add_argument('--collection', default='BookChapter', help='Zotero collection to add the paper to (defaults to "BookChapter")')
    
    args = parser.parse_args()
    
    kwargs = {}

    if args.doi:
        print(f"Fetching metadata for DOI: {args.doi} from CrossRef...")
        try:
            crossref_metadata = get_crossref_metadata(args.doi)
            kwargs.update(crossref_metadata)
            print("Successfully fetched metadata from CrossRef.")
        except requests.exceptions.RequestException as e:
            print(f"Error fetching metadata from CrossRef: {e}")
            sys.exit(1)
    elif args.pmid: 
        print(f"Fetching metadata for PMID: {args.pmid} from PubMed...")
        try:
            pubmed_metadata = get_pubmed_metadata(args.pmid)
            kwargs.update(pubmed_metadata)
            print("Successfully fetched metadata from PubMed.")
        except requests.exceptions.RequestException as e:
            print(f"Error fetching metadata from PubMed: {e}")
            sys.exit(1)
    
    # If title or authors were provided directly, they override fetched values
    if args.title:
        kwargs['title'] = args.title
    if args.authors:
        kwargs['authors'] = args.authors

    # Ensure title and authors are present before proceeding
    if 'title' not in kwargs or 'authors' not in kwargs:
        print("Error: Title and authors are required. Provide them manually or via --doi/--pmid.")
        sys.exit(1)

    # Build kwargs from optional arguments (overwrite if already set by CrossRef or PubMed)
    if args.date:
        kwargs['date'] = args.date
    if args.journal:
        kwargs['publicationTitle'] = args.journal
    if args.abstract:
        kwargs['abstractNote'] = args.abstract
    if args.url:
        kwargs['url'] = args.url
    
    client = ZoteroAPI(API_KEY, USER_ID)
    
    collection_name = args.collection
    print(f"Adding paper to {collection_name} collection...")
    print(f"Title: {kwargs.get('title', 'N/A')}") 
    print(f"Authors: {kwargs.get('authors', 'N/A')}")
    
    try:
        result = client.add_paper(collection_name, **kwargs)
        
        if result.get('successful'):
            item_key = result['successful']['0']['key']
            print(f"\n✓ Successfully added paper!")
            print(f"  Key: {item_key}")
            print(f"  View at: https://www.zotero.org/prestonraab/items/{item_key}")
        else:
            print("✗ Failed to add paper")
            print(result)
            sys.exit(1)
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()