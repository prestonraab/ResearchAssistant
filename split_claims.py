#!/usr/bin/env python3
"""
Split claims_and_evidence.md into category-based files.
"""

import re
from pathlib import Path
from collections import defaultdict

def parse_claims_file(filepath):
    """Parse the claims file and extract claims by category."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Split by claim headers
    claim_pattern = r'^## (C_\d+):'
    claims = re.split(claim_pattern, content, flags=re.MULTILINE)
    
    # First element is the header before any claims
    header = claims[0]
    
    # Group claims by category
    claims_by_category = defaultdict(list)
    claim_index = {}  # Map claim_id -> category
    
    for i in range(1, len(claims), 2):
        claim_id = claims[i]
        claim_content = claims[i + 1] if i + 1 < len(claims) else ""
        
        # Extract category
        category_match = re.search(r'\*\*Category\*\*:\s*(.+?)\s*\n', claim_content)
        if category_match:
            category = category_match.group(1).strip()
            full_claim = f"## {claim_id}:{claim_content}"
            claims_by_category[category].append((claim_id, full_claim))
            claim_index[claim_id] = category
    
    return header, claims_by_category, claim_index

def create_category_files(claims_by_category, output_dir):
    """Create separate files for each category."""
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True)
    
    # Map categories to filenames
    category_to_filename = {
        'Method': 'methods.md',
        'Result': 'results.md',
        'Challenge': 'challenges.md',
        'Data Source': 'data_sources.md',
        'Data Trend': 'data_trends.md',
        'Application': 'applications.md',
        'Impact': 'impacts.md',
        'Phenomenon': 'phenomena.md',
    }
    
    files_created = {}
    
    for category, claims in sorted(claims_by_category.items()):
        filename = category_to_filename.get(category, f"{category.lower().replace(' ', '_')}.md")
        filepath = output_dir / filename
        
        # Create file header
        content = f"# Claims and Evidence: {category}\n\n"
        content += f"This file contains all **{category}** claims with their supporting evidence.\n\n"
        content += "---\n\n"
        
        # Add all claims for this category
        for claim_id, claim_content in sorted(claims):
            content += claim_content
            content += "\n---\n\n"
        
        # Write file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        files_created[category] = {
            'filename': filename,
            'count': len(claims),
            'claim_ids': [claim_id for claim_id, _ in sorted(claims)]
        }
        
        print(f"Created {filename} with {len(claims)} claims")
    
    return files_created

def create_master_index(header, files_created, output_file):
    """Create master index file."""
    content = header
    content += "\n## Claim Categories and Files\n\n"
    content += "Claims have been organized into separate files by category for easier navigation and maintenance.\n\n"
    
    # Create table
    content += "| Category | File | Claim Count | Claim IDs |\n"
    content += "|----------|------|-------------|----------|\n"
    
    for category in sorted(files_created.keys()):
        info = files_created[category]
        claim_range = f"{info['claim_ids'][0]} - {info['claim_ids'][-1]}"
        content += f"| {category} | [`{info['filename']}`](claims/{info['filename']}) | {info['count']} | {claim_range} |\n"
    
    content += "\n## Quick Reference: Claim ID to File Mapping\n\n"
    
    # Create claim ID index
    all_claims = []
    for category, info in files_created.items():
        for claim_id in info['claim_ids']:
            all_claims.append((claim_id, category, info['filename']))
    
    all_claims.sort(key=lambda x: int(x[0].split('_')[1]))
    
    content += "| Claim ID | Category | File |\n"
    content += "|----------|----------|------|\n"
    
    for claim_id, category, filename in all_claims:
        content += f"| {claim_id} | {category} | [`{filename}`](claims/{filename}) |\n"
    
    content += "\n---\n\n"
    content += "## Notes\n\n"
    content += "- Each category file contains complete claim information including primary quotes and supporting quotes\n"
    content += "- The citation hover extension will automatically locate claims across these files\n"
    content += "- See `sources.md` for complete bibliographic information for all source IDs\n"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"\nCreated master index: {output_file}")

def main():
    input_file = "01_Knowledge_Base/claims_and_evidence.md"
    output_dir = "01_Knowledge_Base/claims"
    master_index = "01_Knowledge_Base/claims_and_evidence.md"
    
    print("Parsing claims file...")
    header, claims_by_category, claim_index = parse_claims_file(input_file)
    
    print(f"\nFound {len(claims_by_category)} categories:")
    for category, claims in sorted(claims_by_category.items()):
        print(f"  - {category}: {len(claims)} claims")
    
    print("\nCreating category files...")
    files_created = create_category_files(claims_by_category, output_dir)
    
    print("\nCreating master index...")
    create_master_index(header, files_created, master_index)
    
    print("\n✓ Done! Files created in 01_Knowledge_Base/claims/")
    print(f"✓ Master index updated: {master_index}")

if __name__ == "__main__":
    main()
