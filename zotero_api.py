#!/usr/bin/env python3
"""
Zotero API helper script for adding papers to collections.
"""

import sys
import requests
import json
from typing import Optional, Dict, List, Union

class ZoteroAPI:
    def __init__(self, api_key: str, user_id: str):
        """
        Initialize Zotero API client.
        
        Args:
            api_key: Your Zotero API key
            user_id: Your numeric Zotero User ID (not username)
        """
        self.api_key = api_key
        self.user_id = user_id
        self.base_url = "https://api.zotero.org"
        self.headers = {
            "Zotero-API-Key": api_key,
            "Zotero-API-Version": "3",
            "Content-Type": "application/json"
        }
    
    def get_collections(self) -> List[Dict]:
        """Get all collections."""
        url = f"{self.base_url}/users/{self.user_id}/collections"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def get_collection_by_name(self, name: str) -> Optional[Dict]:
        """Get a collection by name."""
        collections = self.get_collections()
        for coll in collections:
            if coll.get('data', {}).get('name') == name:
                return coll
        return None
    
    def create_item(self, item_data: Dict, collection_keys: Optional[List[str]] = None) -> Dict:
        """
        Create a new item in Zotero.
        
        Args:
            item_data: Item data (itemType, title, creators, etc.)
            collection_keys: List of collection keys to add item to
        
        Returns:
            Created item data
        """
        if collection_keys:
            item_data["collections"] = collection_keys
        
        url = f"{self.base_url}/users/{self.user_id}/items"
        payload = [item_data]
        
        response = requests.post(url, headers=self.headers, json=payload)
        response.raise_for_status()
        return response.json()
    
    def create_journal_article(self, title: str, creators: List[Dict], 
                               collection_keys: Optional[List[str]] = None,
                               collection_names: Optional[List[str]] = None,
                               **kwargs) -> Dict:
        """
        Create a journal article item.
        
        Args:
            title: Article title
            creators: List of creator dicts, e.g. [{"creatorType": "author", "firstName": "John", "lastName": "Doe"}]
            collection_keys: List of collection keys (optional)
            collection_names: List of collection names to look up (optional)
            **kwargs: Additional fields (date, DOI, abstract, etc.)
        
        Returns:
            Created item data
        """
        # Resolve collection names to keys if provided
        final_collection_keys = collection_keys or []
        if collection_names:
            for name in collection_names:
                coll = self.get_collection_by_name(name)
                if coll:
                    final_collection_keys.append(coll['key'])
        
        item_data = {
            "itemType": "journalArticle",
            "title": title,
            "creators": creators,
            **kwargs
        }
        return self.create_item(item_data, final_collection_keys if final_collection_keys else None)
    
    def _parse_authors_and_create_article(self, title: str, authors: Union[str, List[Dict]], 
                                  collection_names: Optional[List[str]] = None,
                                  **kwargs) -> Dict:
        """
        Convenience method to add a paper to the BookChapter collection.
        
        Args:
            title: Paper title
            authors: Either a string like "Smith, John; Doe, Jane" or a list of creator dicts
            **kwargs: Additional fields (date, DOI, abstract, publicationTitle, etc.)
        
        Returns:
            Created item data
        """
        # Parse authors if string
        if isinstance(authors, str):
            creators = []
            for author in authors.split(';'):
                author = author.strip()
                if ',' in author:
                    parts = [p.strip() for p in author.split(',', 1)]
                    creators.append({
                        "creatorType": "author",
                        "lastName": parts[0],
                        "firstName": parts[1] if len(parts) > 1 else ""
                    })
                else:
                    parts = author.split()
                    if len(parts) >= 2:
                        creators.append({
                            "creatorType": "author",
                            "lastName": parts[-1],
                            "firstName": " ".join(parts[:-1])
                        })
                    else:
                        creators.append({
                            "creatorType": "author",
                            "lastName": author,
                            "firstName": ""
                        })
        else:
            creators = authors
        
        return self.create_journal_article(
            title=title,
            creators=creators,
            collection_names=collection_names,
            **kwargs
        )

    def get_collection_items(self, collection_key: str) -> List[Dict]:
        """
        Get all items in a specific collection.
        """
        url = f"{self.base_url}/users/{self.user_id}/collections/{collection_key}/items"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def add_paper(self, collection_name: str, title: str, authors: Union[str, List[Dict]], **kwargs) -> Dict:
        """
        Add a paper to a specified Zotero collection.
        """
        return self._parse_authors_and_create_article(
            title=title,
            authors=authors,
            collection_names=[collection_name],
            **kwargs
        )


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    # Load environment variables from .env file
    load_dotenv()
    
    # Configuration
    API_KEY = os.getenv("ZOTERO_API_KEY")
    USER_ID = os.getenv("ZOTERO_USER_ID")
    
    if not API_KEY or not USER_ID:
        print("Error: ZOTERO_API_KEY and ZOTERO_USER_ID must be set in environment variables or .env file")
        print("Create a .env file with:")
        print("  ZOTERO_API_KEY=your_api_key_here")
        print("  ZOTERO_USER_ID=your_user_id_here")
        sys.exit(1)
    
    print("Testing Zotero API connection...")
    client = ZoteroAPI(API_KEY, USER_ID)
    
    try:
        collections = client.get_collections()
        print(f"✓ Connected successfully!")
        print(f"\n✓ Found {len(collections)} collections:")
        for coll in collections:
            name = coll.get('data', {}).get('name')
            key = coll.get('key')
            num_items = coll.get('meta', {}).get('numItems', 0)
            print(f"  - {name} (key: {key}, {num_items} items)")
        
        # Test adding a paper
        print("\n" + "="*50)
        print("Example: Adding a test paper to BookChapter...")
        print("="*50)
        
            
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

    import argparse

    parser = argparse.ArgumentParser(description="Zotero API helper script.")
    parser.add_argument("--list-collections", action="store_true", help="List all Zotero collections.")
    parser.add_argument("--list-collection-items", type=str, help="List items in a specific collection by key.")
    parser.add_argument("--add-paper", action="store_true", help="Add a new paper (requires --title, --authors, --collection-name).")
    parser.add_argument("--title", type=str, help="Title of the paper to add.")
    parser.add_argument("--authors", type=str, help="Authors of the paper (e.g., 'Smith, John; Doe, Jane').")
    parser.add_argument("--collection-name", type=str, help="Name of the collection to add the paper to.")
    parser.add_argument("--date", type=str, help="Publication date of the paper.")
    parser.add_argument("--doi", type=str, help="DOI of the paper.")
    parser.add_argument("--publication-title", type=str, help="Publication title (e.g., journal name).")

    args = parser.parse_args()

    client = ZoteroAPI(API_KEY, USER_ID)

    if args.list_collections:
        try:
            collections = client.get_collections()
            print(f"\n✓ Found {len(collections)} collections:")
            for coll in collections:
                name = coll.get('data', {}).get('name')
                key = coll.get('key')
                num_items = coll.get('meta', {}).get('numItems', 0)
                print(f"  - {name} (key: {key}, {num_items} items)")
        except Exception as e:
            print(f"✗ Error listing collections: {e}")

    elif args.list_collection_items:
        try:
            items = client.get_collection_items(args.list_collection_items)
            print(f"\n✓ Found {len(items)} items in collection {args.list_collection_items}:")
            for item in items:
                title = item.get('data', {}).get('title', 'No Title')
                item_key = item.get('key')
                print(f"  - {title} (key: {item_key})")
        except Exception as e:
            print(f"✗ Error listing collection items: {e}")

    elif args.add_paper:
        if not all([args.title, args.authors, args.collection_name]):
            print("Error: --title, --authors, and --collection-name are required to add a paper.")
            sys.exit(1)
        try:
            result = client.add_paper(
                collection_name=args.collection_name,
                title=args.title,
                authors=args.authors,
                date=args.date,
                DOI=args.doi,
                publicationTitle=args.publication_title
            )
            if result.get('successful'):
                item_key = result['successful']['0']['key']
                print(f"✓ Successfully added paper! Key: {item_key}")
                print(f"  View at: https://www.zotero.org/prestonraab/items/{item_key}")
            else:
                print("✗ Failed to add paper")
                print(json.dumps(result, indent=2))
        except Exception as e:
            print(f"✗ Error adding paper: {e}")
    else:
        print("No action specified. Use --list-collections, --list-collection-items, or --add-paper.")
