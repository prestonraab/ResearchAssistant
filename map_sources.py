#!/usr/bin/env python3
"""
Map Zotero item keys from BookChapter collection to Source IDs in claims_matrix.md
"""

# Mapping based on titles and authors
ZOTERO_TO_SOURCE = {
    # Source 1: ComBat (Johnson 2007)
    "ITTIHHQV": {"source_id": 1, "zotero_key_claims": "LM86I2Q4", "title": "Adjusting batch effects"},
    
    # Source 2: ComBat-seq (already extracted as Source02)
    "SY5YRHHX": {"source_id": 2, "already_extracted": True},
    
    # Source 3: Batch effect confounding (already extracted as Source03)
    "4CFFLXQX": {"source_id": 3, "already_extracted": True},
    
    # Source 4: ML cancer classification (already extracted as Source04)
    "Z35ZGFFP": {"source_id": 4, "already_extracted": True},
    
    # Source 5: Single-cell batch correction (already extracted as Source05)
    "YN23WTL4": {"source_id": 5, "already_extracted": True},
    
    # Source 6: Alternative empirical Bayes (already extracted as Source06)
    "3SB9HQZP": {"source_id": 6, "already_extracted": True},
    
    # Source 7: SVA (Leek & Storey 2007)
    "WIEF6X93": {"source_id": 7, "zotero_key_claims": "I6B7QCEJ", "title": "Capturing Heterogeneity"},
    
    # Source 8: Harmony
    "IFSEGNGC": {"source_id": 8, "zotero_key_claims": "R7IDT2E2", "title": "Harmony"},
    
    # Source 9: LIGER
    "N27S4JWC": {"source_id": 9, "zotero_key_claims": "VS53N7PA", "title": "Single-cell multi-omic"},
    
    # Source 10: Seurat
    "9Q65WVD3": {"source_id": 10, "zotero_key_claims": "7PZXDBIM", "title": "Comprehensive Integration"},
    
    # Source 11: BatchQC
    "6DQ8W7IE": {"source_id": 11, "zotero_key_claims": "3FJTRHUG", "title": "BatchQC"},
    
    # Source 12: Merging vs meta-analysis (already extracted as Source12)
    "JD37VSP5": {"source_id": 12, "already_extracted": True},
    
    # Source 13: Classification performance
    "ZLDKT466": {"source_id": 13, "zotero_key_claims": "MDWK5PSU", "title": "classification performance"},
    
    # Source 14: recount3
    "67VRP96X": {"source_id": 14, "zotero_key_claims": "SZXCSGGX", "title": "recount3"},
}

print("Zotero Item Key → Source ID Mapping:")
for zotero_key, info in ZOTERO_TO_SOURCE.items():
    status = "✓ Extracted" if info.get("already_extracted") else "Need extraction"
    print(f"  {zotero_key} → Source {info['source_id']} ({status})")
