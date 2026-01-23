#!/usr/bin/env python3
"""
Remove old Source ID format files from literature/ExtractedText.

These files have been superseded by the standard Author-Year-Title format.
The Source ID mappings are maintained in 01_Knowledge_Base/claims_matrix.md.
"""

from pathlib import Path

# Files to remove (old Source ID format)
FILES_TO_REMOVE = [
    "Source02_SY5YRHHX_ComBat-seq.txt",
    "Source03_4CFFLXQX_BatchEffectConfounding.txt",
    "Source04_Z35ZGFFP_MLCancerClassification.txt",
    "Source05_YN23WTL4_SingleCellBatchCorrection.txt",
    "Source06_3SB9HQZP_AlternativeEmpiricalBayes.txt",
]

def main():
    literature_dir = Path(__file__).parent / "literature" / "ExtractedText"
    
    if not literature_dir.exists():
        print(f"Error: Directory not found: {literature_dir}")
        return
    
    print(f"Cleaning up old Source ID format files in: {literature_dir}\n")
    
    removed_count = 0
    not_found_count = 0
    
    for filename in FILES_TO_REMOVE:
        file_path = literature_dir / filename
        
        if not file_path.exists():
            print(f"⏭  Skipping {filename} (already removed)")
            not_found_count += 1
            continue
        
        try:
            file_path.unlink()
            print(f"✓ Removed: {filename}")
            removed_count += 1
        except Exception as e:
            print(f"✗ Error removing {filename}: {e}")
    
    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Removed: {removed_count}")
    print(f"  Already removed: {not_found_count}")
    print()
    
    if removed_count > 0:
        print("All files now use standard naming format:")
        print("  Author et al. - YYYY - Title.txt")
        print()
        print("Source ID mappings are maintained in:")
        print("  01_Knowledge_Base/claims_matrix.md")

if __name__ == "__main__":
    main()
