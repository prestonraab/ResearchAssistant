# Evidence Quotes

This document contains verbatim quotes from source materials to prevent misinterpretation.

## Format

Each quote should include: Source ID, page number (if available), verbatim text, and context.

---

## Source 3 (4CFFLXQX): Soneson et al. (2014)

**Claim**: C_03 - Batch effects can substantially degrade classifier performance when applied to new batches

**Location**: Abstract  
**Quote**: "However, technical differences ('batch effects') as well as differences in sample composition between the data sets may significantly affect the ability to draw generalizable conclusions from such studies."  
**Context**: Abstract describing the impact of batch effects on combining datasets

**Location**: Lines 228-229  
**Quote**: "truly related to the disease, and that thus may fail to generalize or be replicated in other studies."  
**Context**: Discussion of how batch effects can cause classifiers to fail on new data

**Location**: Lines 476-482  
**Quote**: "In this study we focus on the additional biases that may result if the data set used to build the classifier (and thus used as the basis for the cross-validation) is not representative of the collection of new data sets to which the classifier will eventually be applied. In this case, as we will see, the performance estimate obtained from the cross-validation can be far from the actual performance of the classifier on a new independent data set."  
**Context**: Methods section explaining how batch effects cause performance estimates to be biased

---

**Claim**: C_04 - Cross-validation within a single study may give optimistic performance estimates

**Location**: Lines 547-548  
**Quote**: "the performance estimate obtained from the inner cross-validation is biased. It is an overoptimistic estimate of the actual performance of the classifier."  
**Context**: Methods section explaining nested cross-validation and bias in performance estimates

---

**Location**: Lines 1165-1178  
**Quote**: "We have shown that in the presence of a batch effect with at least moderate level of confounding with the main grouping variable, the performance estimates obtained by cross-validation are highly biased."  
**Context**: Discussion summarizing key findings about batch effect confounding

---

**Location**: Lines 1184-1189  
**Quote**: "However, the bias in the cross-validation performance estimates is not eliminated by the batch effect removal, and consequently the cross-validation performance estimates obtained after batch effect elimination are not more reliable measures of the true performance than those obtained without batch effect elimination."  
**Context**: Discussion explaining that batch effect removal does not eliminate bias in performance estimates

**Location**: Lines 282-291  
**Quote**: "We find that in data sets where there are no genes that are truly differentially expressed between the two groups, the internal cross-validation performance estimate is only approximately unbiased when the batch effect is completely non-confounded with the class labels. Eliminating the batch effects can not correct the bias found in other settings. For data sets where some genes are truly differentially expressed, we can use the cross-validation performance estimate as a surrogate for the true performance as long as the level of confounding is not too large."  
**Context**: Results section describing when cross-validation estimates are biased

---

## Source 2 (SY5YRHHX): Zhang et al. (2020)

**Claim**: C_02 - ComBat-Seq preserves integer counts for RNA-Seq data

**Location**: Abstract  
**Quote**: "We developed a batch correction method, ComBat-seq, using a negative binomial regression model that retains the integer nature of count data in RNA-seq studies, making the batch adjusted data compatible with common differential expression software packages that require integer counts."  
**Context**: Abstract describing the main contribution of ComBat-seq

---

**Location**: Lines 67-68  
**Quote**: "using a negative binomial regression model that retains the integer nature of count data in RNA-seq studies"  
**Context**: Abstract restating the key feature of ComBat-seq

---

**Claim**: C_07 - RNA-seq data are typically skewed and over-dispersed counts

**Location**: Abstract and Line 61  
**Quote**: "However in RNA-seq studies the data are typically skewed, over-dispersed counts, so this assumption is not appropriate and may lead to erroneous results."  
**Context**: Abstract explaining why Gaussian assumptions are inappropriate for RNA-seq data

---

**Location**: Line 280  
**Quote**: "Distributions of counts are skewed and over-dispersed, i.e. the variance is often larger than the mean of gene expression and genes with smaller counts tend to have larger variances."  
**Context**: Introduction section describing properties of RNA-seq count data

---

**Location**: Lines 271-278  
**Quote**: "many popular adjustment methods, including ComBat, assume Gaussian distributions for the underlying distribution of the data, which is not an appropriate distributional assumption for counts."  
**Context**: Introduction explaining limitations of existing batch correction methods

---

**Claim**: C_08 - ComBat was originally developed for microarray data

**Location**: Lines 111-112  
**Quote**: "For example, ComBat (4) remains one of the most popular batch effect adjustment methods when the effects come from known sources."  
**Context**: Introduction discussing batch effect adjustment methods for RNA-seq

---

## Source 4 (Z35ZGFFP): Alharbi & Vakanski (2023)

**Claim**: C_05 - Machine learning classifiers have demonstrated strong performance for gene expression classification tasks

**Location**: Abstract  
**Quote**: "This study reviews recent progress in gene expression analysis for cancer classification using machine learning methods. Both conventional and deep learning-based approaches are reviewed, with an emphasis on the application of deep learning models due to their comparative advantages for identifying gene patterns that are distinctive for various types of cancers."  
**Context**: Abstract describing the scope and findings of the review

---

**Claim**: C_06 - For gene expression data, support vector machines, random forests, logistic regression with regularization, and neural networks show particular utility

**Location**: Lines 1223-1224  
**Quote**: "Conventional machine learning methods, such as Support Vector Machines (SVM), k-Nearest Neighbor (kNN), Naïve Bayes (NB), Random Forest (RF), and related methods have been widely applied for gene expression analysis."  
**Context**: Section discussing conventional ML methods for gene expression classification

---

**Location**: Lines 243-248  
**Quote**: "DL-based methods have generally outperformed conventional ML methods, and it can be expected that most future models for gene expression analysis will be based on DL networks. Currently, several approaches that employed MLP or CNN networks in combination with efficient feature engineering and transfer learning techniques have achieved test accuracies upwards of 90%."  
**Context**: Discussion summarizing performance achievements of deep learning methods

---

## Source 5 (YN23WTL4): Tran et al. (2020)

**Claim**: C_09 - For single-cell RNA sequencing data, methods such as Harmony, LIGER, and Seurat address unique challenges

**Location**: Abstract, Conclusion  
**Quote**: "Based on our results, Harmony, LIGER, and Seurat 3 are the recommended methods for batch integration. Due to its significantly shorter runtime, Harmony is recommended as the first method to try, with the other methods as viable alternatives."  
**Context**: Abstract and conclusion summarizing benchmark results

---

**Claim**: C_12 - Harmony integrates single-cell datasets by removing batch effects while preserving biological structure through iterative batch-centroid correction in PC space

**Location**: Lines 155-162  
**Quote**: "Harmony [13], first employs PCA for dimensionality reduction. In the PCA space, Harmony iteratively removes batch effects present. At each iteration, it clusters similar cells from different batches while maximizing the diversity of batches within each cluster and then calculates a correction factor for each cell to be applied. This approach is fast and can accurately detect the true biological connection across datasets."  
**Context**: Introduction describing Harmony method

---

**Claim**: C_13 - LIGER uses integrative non-negative matrix factorization (iNMF) to separate shared biological factors from dataset-specific technical factors

**Location**: Lines 164-179  
**Quote**: "LIGER is a newly developed method to handle a perceived shortcoming of other methods, which is the assumption that differences between datasets are entirely due to technical variations and not of biological origins, thus aiming to remove all of them [14]. LIGER uses integrative non-negative matrix factorization to first obtain a low-dimensional representation of the input data. The representation is composed of two parts: a set of batch-specific factors and a set of shared factors."  
**Context**: Introduction describing LIGER method

---

**Claim**: C_14 - Seurat v3 uses anchor-based integration with mutual nearest neighbors (MNNs) to correct batch effects while preserving cell-type structure

**Location**: Lines 150-154  
**Quote**: "The Seurat MultiCCA method from the popular Seurat package... newer version, Seurat Integration (Seurat 3) [12], first uses CCA to project the data into a subspace to identify correlations across datasets. The MNNs are then computed in the CCA subspace and serve as 'anchors' to correct the data."  
**Context**: Introduction describing Seurat v3 method

---

## Source 6 (3SB9HQZP): Zhang et al. (2018)

**Claim**: C_10 - Alternative empirical Bayes models have been developed for adjusting batch effects in genomic studies

**Location**: Abstract  
**Quote**: "Here we contribute multiple methods and software tools for improved combination and analysis of data from multiple batches. In particular, we provide batch effect solutions for cases where the severity of the batch effects is not extreme, and for cases where one high-quality batch can serve as a reference, such as the training set in a biomarker study."  
**Context**: Abstract describing alternative empirical Bayes approaches

---

**Location**: Lines 249-260  
**Quote**: "we present an approach that allows the user to select a reference batch, or a batch that is left static after batch adjustment, and to which all the other batches are adjusted. This approach makes sense in situations where one batch or dataset is of better quality or less variable. In addition, this approach will be particularly helpful for biomarker studies, where one dataset is used for training a fixed biomarker, then the fixed biomarker is applied on multiple different batches or datasets, even at different times."  
**Context**: Methods section describing reference batch approach

---

## Source 12 (JD37VSP5): Taminau et al. (2014)

**Claim**: C_16 - Merging (batch correction + pooled analysis) identified more differentially expressed genes than meta-analysis approaches

**Location**: Abstract  
**Quote**: "Within this study, we investigate the hypothesis that analyzing large cohorts of samples resulting in merging independent data sets designed to study the same biological problem results in lower false discovery rates than analyzing the same data sets within a more conservative meta-analysis approach."  
**Context**: Abstract stating the research hypothesis

---

**Location**: Results section  
**Quote**: "If we compare the final DEGs for the meta-analysis approach with the list obtained in the merging approach we can conclude that significantly more DEGs are identified through merging. Moreover, all 25 identified DEGs through meta-analysis are also identified in the merging approach."  
**Context**: Results section comparing meta-analysis and merging approaches

---

## Source 1 (ITTIHHQV): Johnson et al. (2007) - ComBat

**Claim**: C_01 - ComBat uses Empirical Bayes to estimate location (L) and scale (S) parameters

**Location**: Section 2.3, Model-based location/scale adjustments  
**Quote**: "Location and scale (L/S) adjustments can be defined as a wide family of adjustments in which one assumes a model for the location (mean) and/or scale (variance) of the data within batches and then adjusts the batches to meet assumed model specifications. Therefore, L/S batch adjustments assume that the batch effects can be modeled out by standardizing means and variances across batches."  
**Context**: Introduction to location/scale adjustment framework

**Location**: Section 2.3  
**Quote**: "The γ ig and δ ig represent the additive and multiplicative batch effects of batch i for gene g , respectively."  
**Context**: Mathematical model definition where γ represents location (additive) and δ represents scale (multiplicative) effects

**Location**: Section 3.1, Step 2  
**Quote**: "we assume the parametric forms for prior distributions on the batch effect parameters to be... The hyperparameters γ i , τ 2 i , λ i , θ i are estimated empirically from standardized data using the method of moments"  
**Context**: Description of Empirical Bayes estimation of batch effect parameters

**Location**: Section 3.1, Step 2  
**Quote**: "the EB estimates for batch effect parameters, γ ig and δ 2 ig , are given (respectively) by the conditional posterior means"  
**Context**: Empirical Bayes estimates for location (γ) and scale (δ²) parameters

**Location**: Summary  
**Quote**: "We propose parametric and non-parametric empirical Bayes frameworks for adjusting data for batch effects that is robust to outliers in small sample sizes"  
**Context**: Abstract summarizing the Empirical Bayes approach

**Claim**: C_08 - ComBat was originally developed for microarray data

**Location**: Summary  
**Quote**: "Non-biological experimental variation or 'batch effects' are commonly observed across multiple batches of microarray experiments, often rendering the task of combining data from these batches difficult."  
**Context**: Abstract stating the focus on microarray data

**Location**: Section 1. INTRODUCTION  
**Quote**: "With the many applications of gene expression microarrays, biologists are able to efficiently extract hypotheses that can later be tested experimentally in a lab setting."  
**Context**: Introduction establishing the microarray context

---

## Source 7 (WIEF6X93): Leek & Storey (2007) - SVA

**Claim**: C_11 - Surrogate Variable Analysis (SVA) identifies and adjusts for unknown, latent sources of variation in genomics data

**Note**: Full text extraction in progress. The method identifies surrogate variables that capture unwanted variation when batch labels are unknown.

---

## Source 11 (6DQ8W7IE): Manimaran et al. (2016) - BatchQC

**Claim**: C_15 - BatchQC provides interactive software for evaluating sample and batch effects with PCA, heatmaps, dendrograms, and other diagnostics

**Location**: Abstract  
**Quote**: "We present a software pipeline, BatchQC, which addresses these issues using interactive visualizations and statistics that evaluate the impact of batch effects in a genomic dataset. BatchQC can also apply existing adjustment tools and allow users to evaluate their benefits interactively."  
**Context**: Abstract describing BatchQC functionality

**Location**: Section 2.3  
**Quote**: "BatchQC conducts PCA on the dataset and produces an interactive plot for displaying the user's choice of any two components at the same time, with the points colored by the choice of condition or batch"  
**Context**: Description of PCA visualization feature

**Location**: Section 2.2  
**Quote**: "BatchQC also provides heatmap plots for gene-level values and a sample-level circular dendrogram that clusters the samples using the choice of several different agglomeration measures."  
**Context**: Description of heatmap and dendrogram features

**Location**: Section 2.4  
**Quote**: "BatchQC can interactively adjust the data for batch effects using ComBat or Surrogate Variable Analysis (SVA)."  
**Context**: Description of batch adjustment methods supported

---

## Source 13 (ZLDKT466): Piccolo et al. (2022)

**Claim**: C_17 - Classification performance for gene-expression data depends strongly on algorithm choice and performance metric

**Note**: Full text extraction completed. Specific quotations to be added after review of extracted text.

---

## Source 14 (67VRP96X): Wilks et al. (2021) - recount3

**Claim**: C_18 - recount3 provides harmonized RNA-Seq expression summaries across thousands of experiments, enabling large-scale integrative analyses

**Note**: Full text extraction completed. Specific quotations to be added after review of extracted text.
