#!/usr/bin/env python3
"""
Save all extracted docling documents to text files with proper naming.
"""

from pathlib import Path
import json

# Mapping: (document_key, zotero_item_key, source_id, output_filename)
EXPORTS = [
    ("52cd2f58df7c819dd82a31a0d631d1a7", "ITTIHHQV", 1, "Source01_ITTIHHQV_ComBat.txt"),
    ("dd43e5d14d33a3ea4f8a7166c73af80d", "WIEF6X93", 7, "Source07_WIEF6X93_SVA.txt"),
    ("ef4bd21eb884b55be4346115160f0e4c", "IFSEGNGC", 8, "Source08_IFSEGNGC_Harmony.txt"),
    ("5cd8ff8414970d53763f705e978e0301", "N27S4JWC", 9, "Source09_N27S4JWC_LIGER.txt"),
    ("d1f9adafc0a6818548dd939a2fbf829a", "9Q65WVD3", 10, "Source10_9Q65WVD3_Seurat.txt"),
    ("d6b87b99cdcb448cd720eac92cf486ac", "6DQ8W7IE", 11, "Source11_6DQ8W7IE_BatchQC.txt"),
    ("097eda4d8afdd8508647a01f5d231281", "ZLDKT466", 13, "Source13_ZLDKT466_ClassificationPerformance.txt"),
    ("f86aa80918b7a7d3ad79cbd396031ae7", "67VRP96X", 14, "Source14_67VRP96X_recount3.txt"),
    ("054be32fd3c54f3bfbb17ccb0f79e888", "B8L2ZDRL", None, "B8L2ZDRL_svaPackage.txt"),  # sva package paper
]

LITERATURE_DIR = Path(__file__).parent / "literature" / "ExtractedText"
LITERATURE_DIR.mkdir(parents=True, exist_ok=True)

print(f"Saving {len(EXPORTS)} extracted texts to {LITERATURE_DIR}")
print("\nNote: This script prepares the mapping. Actual text extraction")
print("should be done via docling MCP tools and saved manually or via")
print("the docling save function.")
