# Papers to Add to Zotero

This document lists papers found through research that need to be added to Zotero.

## 1. SVA (Surrogate Variable Analysis) - Leek & Storey

**Title**: Capturing heterogeneity in gene expression studies by surrogate variable analysis  
**Authors**: Leek, Jeffrey T; Storey, John D  
**Year**: 2007  
**Journal**: PLOS Genetics  
**DOI**: 10.1371/journal.pgen.0030161  
**URL**: https://journals.plos.org/plosgenetics/article?id=10.1371/journal.pgen.0030161

**Key Points**:
- Introduced SVA for modeling unknown, latent sources of variation in genomics data
- Extracts surrogate variables from high-dimensional data to capture unwanted effects
- Available in Bioconductor sva package

## 2. PLOS Computational Biology - Piccolo et al.

**Title**: The ability to classify patients based on gene-expression data varies by algorithm and performance metric  
**Authors**: Piccolo, Stephen R; Mecham, Avery; Golightly, Nathan P; Johnson, Jérémie L; Miller, Dustin B  
**Year**: 2022  
**Journal**: PLOS Computational Biology  
**DOI**: 10.1371/journal.pcbi.1009926  
**URL**: https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1009926

**Key Points**:
- Performance for classifying patients using gene-expression data depends strongly on algorithm and metric
- Number of samples and genes did not strongly correlate with classification performance
- Hyperparameter tuning substantially affects performance

## 3. Harmony - Korsunsky et al.

**Title**: Fast, sensitive and accurate integration of single-cell data with Harmony  
**Authors**: Korsunsky, Ilya; Millard, Nghia; Fan, Jean; Slowikowski, Kamil; Zhang, Fan; Wei, Kevin; Baglaenko, Yuriy; Brenner, Michael; Loh, Po-Ru; Raychaudhuri, Soumya  
**Year**: 2019  
**Journal**: Nature Methods  
**DOI**: 10.1038/s41592-019-0619-0

**Key Points**:
- Harmony integrates single-cell datasets by removing batch effects while preserving biological structure
- Works in PC space with iterative batch-centroid correction
- Fast and scalable (can handle ~1 million cells)

## 4. LIGER - Welch Lab

**Title**: Single-cell multi-omic integration compares and contrasts features of brain cell identity  
**Authors**: Welch, Joshua D; Kozareva, Velina; Ferreira, Ashley; Vanderburg, Charles; Martin, Carly; Macosko, Evan Z  
**Year**: 2019  
**Journal**: Cell  
**DOI**: 10.1016/j.cell.2019.05.031

**Key Points**:
- Uses integrative non-negative matrix factorization (iNMF)
- Separates shared factors (biological) from dataset-specific factors (technical)
- Performs well when batches have non-identical cell type compositions

## 5. Seurat v3 - Stuart & Butler

**Title**: Comprehensive Integration of Single-Cell Data  
**Authors**: Stuart, Tim; Butler, Andrew; Hoffman, Paul; Hafemeister, Christoph; Papalexi, Efthymia; Mauck, William M; Hao, Yuhan; Stoeckius, Marlon; Smibert, Peter; Satija, Rahul  
**Year**: 2019  
**Journal**: Cell  
**DOI**: 10.1016/j.cell.2019.05.031

**Key Points**:
- Anchor-based integration using mutual nearest neighbors (MNNs)
- Uses CCA to project datasets into shared space
- Good at preserving cell-type structure

## 6. BatchQC - Kauffmann et al.

**Title**: BatchQC: interactive software for evaluating sample and batch effects in genomic data  
**Authors**: Kauffmann, Audrey; Gentleman, Robert; Huber, Wolfgang  
**Year**: 2016  
**Journal**: Bioinformatics  
**DOI**: 10.1093/bioinformatics/btw538

**Key Points**:
- Interactive Shiny app for batch effect detection and visualization
- Provides PCA, heatmaps, dendrograms, and other diagnostics
- Supports multiple batch correction methods (ComBat, ComBat-Seq, limma, SVA)
- Includes kBET for quantifying batch mixing

## 7. Batch Adjustment vs Meta-Analysis - Taminau et al.

**Title**: Comparison of Merging and Meta-Analysis as Alternative Approaches for Integrative Gene Expression Analysis  
**Authors**: Taminau, Jonatan; Lazar, Cosmin; Meganck, Stijn; Nowé, Ann  
**Year**: 2012  
**Journal**: PLOS ONE  
**DOI**: 10.1371/journal.pone.0045975

**Key Points**:
- Merging (batch correction + pooled analysis) identified more differentially expressed genes than meta-analysis
- Meta-analysis still found robust DEGs
- Choice depends on data availability, heterogeneity, and goals

## 8. Jeff Leeks - GEO and Large-Scale Genomics

**Key Papers**:
- recount3: 23-year update of NCBI GEO resource (2024, Nucleic Acids Research)
- STARGEO: precision annotation of digital samples in GEO
- "Tackling the Widespread and Critical Impact of Batch Effects in High-Throughput Data"

**Key Points**:
- recount3 provides harmonized RNA-Seq expression summaries across thousands of experiments
- Enables large-scale integrative analyses and meta-studies
- STARGEO improves sample metadata annotation across GEO studies

## Instructions

1. Add each paper to Zotero using the Zotero browser connector or manual entry
2. Update the Source ID Registry in `01_Knowledge_Base/claims_matrix.md` with the new Source IDs
3. Extract claims from each paper and add to the Claims table
4. Update the manuscript with proper citations
