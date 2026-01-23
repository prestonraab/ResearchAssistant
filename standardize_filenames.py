#!/usr/bin/env python3
"""
Standardize filenames in literature/ExtractedText directory.

This script renames files from the Source ID format to the standard
Author-Year-Title format for consistency.
"""

from pathlib import Path
import re

# Mapping from current Source ID filenames to standard format
# Based on claims_matrix.md Source ID Registry
RENAME_MAP = {
    "Source02_SY5YRHHX_ComBat-seq.txt": 
        "Zhang et al. - 2020 - ComBat-seq batch effect adjustment for RNA-seq count data.txt",
    
    "Source03_4CFFLXQX_BatchEffectConfounding.txt": 
        "Soneson et al. - 2014 - Batch Effect Confounding Leads to Strong Bias in Performance Estimates Obtained by Cross-Validation.txt",
    
    "Source04_Z35ZGFFP_MLCancerClassification.txt": 
        "Alharbi and Vakanski - 2023 - Machine Learning Methods for Cancer Classification Using Gene Expression Data A Review.txt",
    
    "Source05_YN23WTL4_SingleCellBatchCorrection.txt": 
        "Tran et al. - 2020 - A benchmark of batch-effect correction methods for single-cell RNA sequencing data.txt",
    
    "Source06_3SB9HQZP_AlternativeEmpiricalBayes.txt": 
        "Zhang et al. - 2018 - Alternative empirical Bayes models for adjusting for batch effects in genomic studies.txt",
    
    "Source12_JD37VSP5_MergingVsMetaAnalysis.txt": 
        "Taminau et al. - 2014 - Comparison of Merging and Meta-Analysis as Alternative Approaches for Integrative Gene Expression Analysis.txt",
}

def main():
    literature_dir = Path(__file__).parent / "literature" / "ExtractedText"
    
    if not literature_dir.exists():
        print(f"Error: Directory not found: {literature_dir}")
        return
    
    print(f"Standardizing filenames in: {literature_dir}\n")
    
    renamed_count = 0
    skipped_count = 0
    
    for old_name, new_name in RENAME_MAP.items():
        old_path = literature_dir / old_name
        new_path = literature_dir / new_name
        
        if not old_path.exists():
            print(f"⏭  Skipping {old_name} (file not found)")
            skipped_count += 1
            continue
        
        if new_path.exists():
            print(f"⏭  Skipping {old_name} (target already exists: {new_name})")
            skipped_count += 1
            continue
        
        try:
            old_path.rename(new_path)
            print(f"✓ Renamed:")
            print(f"  From: {old_name}")
            print(f"  To:   {new_name}")
            print()
            renamed_count += 1
        except Exception as e:
            print(f"✗ Error renaming {old_name}: {e}")
            print()
    
    print(f"{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Renamed: {renamed_count}")
    print(f"  Skipped: {skipped_count}")
    print()
    
    if renamed_count > 0:
        print("All filenames are now in standard format:")
        print("  Author et al. - YYYY - Title.txt")
        print()
        print("Note: Source ID mappings are maintained in:")
        print("  01_Knowledge_Base/claims_matrix.md")

if __name__ == "__main__":
    main()
