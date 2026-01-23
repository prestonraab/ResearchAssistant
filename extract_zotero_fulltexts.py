#!/usr/bin/env python3
"""
Automated script to extract full texts from Zotero PDFs in a collection.

This script:
1. Queries Zotero MCP (via instructions) or uses local storage to find items
2. Locates PDF attachments in Zotero storage directory
3. Uses docling MCP to convert PDFs to text
4. Saves extracted texts to literature/ExtractedText/ directory

Usage:
    # Extract all PDFs from BookChapter collection
    uv run python3 extract_zotero_fulltexts.py --collection "BookChapter"
    
    # Extract from specific item keys
    uv run python3 extract_zotero_fulltexts.py --items N27S4JWC 67VRP96X
    
    # Dry run (show what would be processed)
    uv run python3 extract_zotero_fulltexts.py --collection "BookChapter" --dry-run
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import re

# Default paths
DEFAULT_ZOTERO_STORAGE = Path.home() / "Zotero" / "storage"
DEFAULT_LITERATURE_DIR = Path(__file__).parent / "literature" / "ExtractedText"


class ZoteroPDFExtractor:
    """Extract full texts from Zotero PDFs using docling."""
    
    def __init__(self, 
                 zotero_storage: Path = DEFAULT_ZOTERO_STORAGE,
                 literature_dir: Path = DEFAULT_LITERATURE_DIR,
                 dry_run: bool = False):
        self.zotero_storage = Path(zotero_storage)
        self.literature_dir = Path(literature_dir)
        self.literature_dir.mkdir(parents=True, exist_ok=True)
        self.dry_run = dry_run
        
        if not self.zotero_storage.exists():
            raise FileNotFoundError(f"Zotero storage directory not found: {self.zotero_storage}")
    
    def find_pdf_by_attachment_key(self, attachment_key: str) -> Optional[Path]:
        """Find PDF file using attachment key as directory name."""
        pdf_dir = self.zotero_storage / attachment_key
        if pdf_dir.exists():
            pdfs = list(pdf_dir.glob("*.pdf"))
            if pdfs:
                return pdfs[0]
        return None
    
    def find_pdf_by_item_key(self, item_key: str) -> Optional[Path]:
        """Find PDF by searching in storage directories."""
        # Try item key as directory
        pdf_dir = self.zotero_storage / item_key
        if pdf_dir.exists():
            pdfs = list(pdf_dir.glob("*.pdf"))
            if pdfs:
                return pdfs[0]
        
        # Search all PDFs for ones that might be related
        # This is a fallback - ideally we'd have attachment keys from MCP
        all_pdfs = list(self.zotero_storage.glob("**/*.pdf"))
        # Try to find PDFs in directories that might be related
        # (Zotero sometimes uses item key or attachment key as directory name)
        for pdf in all_pdfs:
            # Check if item key appears in the path
            if item_key in str(pdf.parent):
                return pdf
        return None
    
    def search_pdfs_by_filename(self, search_terms: List[str]) -> List[Path]:
        """Search for PDFs by filename patterns."""
        all_pdfs = list(self.zotero_storage.glob("**/*.pdf"))
        matches = []
        for pdf in all_pdfs:
            pdf_name_lower = pdf.name.lower()
            if any(term.lower() in pdf_name_lower for term in search_terms if len(term) > 3):
                matches.append(pdf)
        return matches
    
    def generate_output_filename(self, item_key: str, pdf_path: Optional[Path] = None, 
                                 metadata: Optional[Dict] = None) -> str:
        """Generate output filename from item key and metadata."""
        # Try to extract author and year from PDF filename or metadata
        if pdf_path:
            # Extract from PDF filename: "Author et al. - YYYY - Title.pdf"
            match = re.match(r"([^-]+)\s+-\s+(\d{4})\s+-\s+(.+)\.pdf", pdf_path.name)
            if match:
                author_part = match.group(1).strip()
                year = match.group(2)
                title_part = match.group(3).strip()[:50]
                # Get first author last name
                first_author = author_part.split(',')[0].split()[0] if ',' in author_part else author_part.split()[0]
                safe_title = "".join(c for c in title_part if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
                return f"{item_key}_{first_author}{year}_{safe_title}.txt"
        
        # Fallback to item key only
        return f"{item_key}.txt"
    
    def check_already_extracted(self, item_key: str) -> Optional[Path]:
        """Check if text already exists for this item."""
        existing = list(self.literature_dir.glob(f"*{item_key}*.txt"))
        if existing:
            return existing[0]
        return None
    
    def process_item(self, item_key: str, attachment_key: Optional[str] = None,
                    metadata: Optional[Dict] = None) -> Tuple[str, str, Optional[Path]]:
        """
        Process a single item.
        
        Returns:
            (status, message, pdf_path)
            status: 'skipped', 'found', 'not_found', 'error'
        """
        # Check if already extracted
        existing = self.check_already_extracted(item_key)
        if existing:
            return ('skipped', f"Already extracted: {existing.name}", None)
        
        # Find PDF
        pdf_path = None
        if attachment_key:
            pdf_path = self.find_pdf_by_attachment_key(attachment_key)
        
        if not pdf_path:
            pdf_path = self.find_pdf_by_item_key(item_key)
        
        if not pdf_path:
            return ('not_found', "PDF not found in storage", None)
        
        return ('found', f"Found PDF: {pdf_path.name}", pdf_path)
    
    def get_collection_items_via_mcp(self, collection_name: str) -> List[Dict]:
        """
        Get items from collection using Zotero MCP.
        Note: This requires MCP tools to be available.
        Returns empty list if MCP is not available (script will use storage search instead).
        """
        # This would need to be called via MCP interface
        # For now, return empty to indicate MCP not available
        return []
    
    def process_collection(self, collection_name: str) -> Dict:
        """
        Process all items in a collection.
        Note: This script works best when run with MCP tools available.
        Otherwise, it searches storage directory for PDFs.
        """
        print(f"Processing collection: {collection_name}")
        print(f"Zotero storage: {self.zotero_storage}")
        print(f"Output directory: {self.literature_dir}\n")
        
        # Try to get items via MCP (would need MCP interface)
        items = self.get_collection_items_via_mcp(collection_name)
        
        if not items:
            print("Note: MCP tools not available. Searching storage directory for PDFs...")
            # Search all PDFs and try to match them
            all_pdfs = list(self.zotero_storage.glob("**/*.pdf"))
            print(f"Found {len(all_pdfs)} PDFs in storage")
            print("\nTo process specific items, use --items flag with item keys")
            print("Or use MCP tools to get collection items first.")
            return {
                'processed': [],
                'skipped': [],
                'not_found': [],
                'errors': []
            }
        
        results = {
            'processed': [],
            'skipped': [],
            'not_found': [],
            'errors': []
        }
        
        for item in items:
            item_key = item.get('key', '')
            metadata = item.get('data', {})
            title = metadata.get('title', 'Unknown')
            
            print(f"\nProcessing: {title[:60]}...")
            print(f"  Item key: {item_key}")
            
            # Get attachments (would need MCP)
            # For now, try to find PDF
            status, message, pdf_path = self.process_item(item_key, metadata=metadata)
            print(f"  {message}")
            
            if status == 'skipped':
                results['skipped'].append((item_key, message))
            elif status == 'not_found':
                results['not_found'].append((item_key, message))
            elif status == 'found' and pdf_path:
                results['processed'].append((item_key, pdf_path, metadata))
        
        return results
    
    def process_item_keys(self, item_keys: List[str]) -> Dict:
        """Process specific item keys."""
        results = {
            'processed': [],
            'skipped': [],
            'not_found': [],
            'errors': []
        }
        
        for item_key in item_keys:
            print(f"\nProcessing item: {item_key}")
            status, message, pdf_path = self.process_item(item_key)
            print(f"  {message}")
            
            if status == 'skipped':
                results['skipped'].append((item_key, message))
            elif status == 'not_found':
                results['not_found'].append((item_key, message))
            elif status == 'found' and pdf_path:
                results['processed'].append((item_key, pdf_path, None))
        
        return results
    
    def print_summary(self, results: Dict):
        """Print summary of processing results."""
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"  Found PDFs: {len(results['processed'])}")
        print(f"  Already extracted: {len(results['skipped'])}")
        print(f"  Not found: {len(results['not_found'])}")
        print(f"  Errors: {len(results['errors'])}")
        
        if results['processed']:
            print(f"\nPDFs ready for docling extraction:")
            for item_key, pdf_path, metadata in results['processed']:
                output_name = self.generate_output_filename(item_key, pdf_path, metadata)
                print(f"  {item_key}: {pdf_path.name}")
                print(f"    → {output_name}")
        
        if results['not_found']:
            print(f"\nItems without PDFs:")
            for item_key, message in results['not_found']:
                print(f"  {item_key}: {message}")


def main():
    parser = argparse.ArgumentParser(
        description="Extract full texts from Zotero PDFs using docling",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract all PDFs from BookChapter collection (requires MCP)
  uv run python3 extract_zotero_fulltexts.py --collection "BookChapter"
  
  # Extract specific items
  uv run python3 extract_zotero_fulltexts.py --items N27S4JWC 67VRP96X
  
  # Dry run to see what would be processed
  uv run python3 extract_zotero_fulltexts.py --collection "BookChapter" --dry-run
  
Note: This script identifies PDFs and prepares them for extraction.
Actual extraction using docling MCP tools should be done via the AI assistant
or by using docling directly as a library.
        """
    )
    
    parser.add_argument(
        '--collection',
        type=str,
        help='Zotero collection name to process'
    )
    parser.add_argument(
        '--items',
        nargs='+',
        help='Specific Zotero item keys to process'
    )
    parser.add_argument(
        '--zotero-storage',
        type=Path,
        default=DEFAULT_ZOTERO_STORAGE,
        help=f'Zotero storage directory (default: {DEFAULT_ZOTERO_STORAGE})'
    )
    parser.add_argument(
        '--literature-dir',
        type=Path,
        default=DEFAULT_LITERATURE_DIR,
        help=f'Output directory for extracted texts (default: {DEFAULT_LITERATURE_DIR})'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be processed without extracting'
    )
    
    args = parser.parse_args()
    
    if not args.collection and not args.items:
        parser.error("Must specify either --collection or --items")
    
    try:
        extractor = ZoteroPDFExtractor(
            zotero_storage=args.zotero_storage,
            literature_dir=args.literature_dir,
            dry_run=args.dry_run
        )
        
        if args.items:
            results = extractor.process_item_keys(args.items)
        else:
            results = extractor.process_collection(args.collection)
        
        extractor.print_summary(results)
        
        if results['processed']:
            print("\n" + "="*60)
            print("NEXT STEPS:")
            print("="*60)
            if args.dry_run:
                print("This was a dry run. To actually extract texts:")
            print("\nOption 1: Use AI assistant with docling MCP tools")
            print("  Ask the assistant to extract texts from the identified PDFs")
            print("  The assistant will use:")
            print("    - mcp_docling_convert_document_into_docling_document()")
            print("    - mcp_docling_export_docling_document_to_markdown()")
            print("\nOption 2: Use docling library directly")
            print(f"  uv run python3 extract_with_docling.py --pdf-dir {args.zotero_storage}")
            print("  Or for specific PDFs, use the --pdf flag")
            print("\nOption 3: Manual extraction")
            print("  Use docling command-line tools or other PDF extraction methods")
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
