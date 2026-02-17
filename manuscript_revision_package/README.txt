MANUSCRIPT REVISION PACKAGE
===========================

This folder contains all relevant files for revising the manuscript table
describing the TB datasets used in the batch effects analysis.

FILES INCLUDED:
---------------

1. manuscript.md
   - Current manuscript draft with the table that needs revision (lines 200-220)

2. data_provenance_report.txt
   - Comprehensive report documenting all 6 datasets
   - Includes: sources, processing steps, sample counts, filtering criteria
   - Documents the origin of combined_sub.RData (Africa dataset)

3. dataset_summary_statistics.csv
   - Complete statistics for all datasets in tabular format
   - Includes: sample counts, gene counts, expression ranges, data quality metrics

4. dataset_summary_statistics.json
   - Same statistics in JSON format for easy parsing

5. manuscript_vs_actual_comparison.txt
   - Direct comparison between manuscript table and actual data
   - Lists all discrepancies and provides corrected table

6. 2_TB_getdata.R
   - R script that creates TB_real_data.RData
   - Shows exactly how data is loaded, filtered, and processed
   - Documents all filtering steps (HIV-negative, geographic subsets, etc.)

7. class_imbalance_report.csv
   - Report on class-imbalanced datasets (for reference)
   - Shows how training/test splits are created

KEY FINDINGS:
-------------

The manuscript table (lines 210-217) does NOT match the actual data:

MAJOR DISCREPANCIES:
1. India: Wrong GEO ID (GSE101705 → should be GSE107994)
2. USA: Wrong GEO ID (GSE19491/GSE42834 → should be GSE73408)
3. All datasets: Wrong sample counts
4. Africa: Labels might be progressors/non-progressors relabeled as active/latent
5. Missing info: HIV-negative filtering, geographic subsets
6. Two studies mentioned (GSE94438, GSE19491/GSE42834) are NOT used

ACTUAL DATA SUMMARY:
-------------------
Dataset         GEO       Samples  Active  Latent  Platform
Africa          GSE79362     181      77     104   RNA-seq
India           GSE107994    103      53      50   RNA-seq
GSE39941_M      GSE39941      70      20      50   Microarray
GSE37250_SA     GSE37250      94      46      48   Microarray
GSE37250_M      GSE37250      86      51      35   Microarray
USA             GSE73408      70      35      35   Microarray

Total: 604 samples, 10,695 common genes

FILTERING APPLIED:
- HIV-negative samples only
- Active TB vs Latent TB only (removed other disease states)
- Geographic subsets (GSE37250 split into SA and Malawi)
- Removed pneumonia cases (USA)

RECOMMENDATION:
---------------
Revise the manuscript table to accurately reflect the actual datasets used,
including proper GEO accessions, correct sample counts, and notes about
filtering criteria.

See manuscript_vs_actual_comparison.txt for detailed comparison and
corrected table format.
