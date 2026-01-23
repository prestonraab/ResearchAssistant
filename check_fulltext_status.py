#!/usr/bin/env python3
"""
Check which sources from claims_matrix.md have extracted full texts.

This script cross-references the Source ID Registry with files in
literature/ExtractedText/ to show extraction status.
"""

from pathlib import Path
import re

def parse_claims_matrix():
    """Extract Source ID Registry from claims_matrix.md"""
    claims_file = Path("01_Knowledge_Base/claims_matrix.md")
    
    if not claims_file.exists():
        print(f"Error: {claims_file} not found")
        return []
    
    content = claims_file.read_text()
    
    # Find the Source ID Registry section
    registry_match = re.search(r'## Source ID Registry\s+\|.*?\n\|[-|]+\|\s*\n(.*?)(?=\n##|\Z)', 
                               content, re.DOTALL)
    
    if not registry_match:
        print("Error: Could not find Source ID Registry")
        return []
    
    registry_text = registry_match.group(1)
    sources = []
    
    for line in registry_text.strip().split('\n'):
        if not line.strip() or line.startswith('|---'):
            continue
        
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 7:
            source_id = parts[1]
            item_key = parts[3]
            authors = parts[4]
            year = parts[5]
            title = parts[6]
            
            sources.append({
                'source_id': source_id,
                'item_key': item_key,
                'authors': authors,
                'year': year,
                'title': title
            })
    
    return sources

def check_extracted_texts():
    """Check which extracted text files exist"""
    extracted_dir = Path("literature/ExtractedText")
    
    if not extracted_dir.exists():
        print(f"Error: {extracted_dir} not found")
        return []
    
    return list(extracted_dir.glob("*.txt"))

def find_matching_file(source, extracted_files):
    """Try to find a matching extracted text file for a source"""
    # Try matching by author and year
    author_last = source['authors'].split(',')[0].split(';')[0].strip()
    year = source['year']
    
    for file in extracted_files:
        filename = file.name
        # Check if author and year appear in filename
        if author_last.lower() in filename.lower() and year in filename:
            return file
    
    return None

def main():
    print("Full Text Extraction Status Report")
    print("=" * 70)
    print()
    
    sources = parse_claims_matrix()
    extracted_files = check_extracted_texts()
    
    print(f"Total sources in registry: {len(sources)}")
    print(f"Total extracted text files: {len(extracted_files)}")
    print()
    
    found = []
    not_found = []
    
    for source in sources:
        matching_file = find_matching_file(source, extracted_files)
        
        if matching_file:
            found.append((source, matching_file))
        else:
            not_found.append(source)
    
    print(f"✓ Sources with extracted texts: {len(found)}")
    print(f"✗ Sources without extracted texts: {len(not_found)}")
    print()
    
    if found:
        print("=" * 70)
        print("SOURCES WITH EXTRACTED TEXTS")
        print("=" * 70)
        for source, file in found:
            print(f"Source {source['source_id']:>2}: {source['authors'][:40]:40} ({source['year']})")
            print(f"           → {file.name}")
            print()
    
    if not_found:
        print("=" * 70)
        print("SOURCES NEEDING EXTRACTION")
        print("=" * 70)
        for source in not_found:
            print(f"Source {source['source_id']:>2}: {source['authors'][:40]:40} ({source['year']})")
            print(f"           Item Key: {source['item_key']}")
            print(f"           Title: {source['title'][:60]}")
            print()
    
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Extraction coverage: {len(found)}/{len(sources)} ({100*len(found)//len(sources)}%)")
    print()
    print("To extract missing texts:")
    print("  1. Use extract_zotero_fulltexts.py to identify PDFs")
    print("  2. Use extract_with_docling.py or docling MCP to extract")
    print("  3. Save to literature/ExtractedText/ with standard naming")

if __name__ == "__main__":
    main()
