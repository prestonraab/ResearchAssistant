# Claims and Evidence: Method - Batch Correction

This file contains **Method** claims related to batch correction methods and basic ML classifiers (C_01 through C_20).

---

## C_01: ComBat uses Empirical Bayes to estimate location and scale parameters

**Category**: Method  
**Source**: Soneson2014 (Source ID: 3)  
**Context**: Assumes Gaussian distribution.

**Primary Quote** (Data preprocessing section):
> "ComBat [23], which employs an empirical Bayes approach to estimate a location and scale parameter for each gene in each batch separately, and adjusts the observed expression values based on the estimated parameters."

**Supporting Quotes**:
- (Johnson2007, Section 2.3): "Location and scale (L/S) adjustments can be defined as a wide family of adjustments in which one assumes a model for the location (mean) and/or scale (variance) of the data within batches and then adjusts the batches to meet assumed model specifications. Therefore, L/S batch adjustments assume that the batch effects can be modeled out by standardizing means and variances across batches."
- (Johnson2007, Section 2.3): "The γ ig and δ ig represent the additive and multiplicative batch effects of batch i for gene g, respectively."
- (Johnson2007, Section 3.1, Step 2): "we assume the parametric forms for prior distributions on the batch effect parameters to be... The hyperparameters γ i, τ 2 i, λ i, θ i are estimated empirically from standardized data using the method of moments"
- (Johnson2007, Section 3.1, Step 2): "the EB estimates for batch effect parameters, γ ig and δ 2 ig, are given (respectively) by the conditional posterior means"

---

## C_02: ComBat-Seq preserves integer counts for RNA-Seq data

**Category**: Method  
**Source**: Zhang2020 (Source ID: 2)  
**Context**: Uses Negative Binomial regression.

**Primary Quote** (Abstract):
> "We developed a batch correction method, ComBat-seq, using a negative binomial regression model that retains the integer nature of count data in RNA-seq studies, making the batch adjusted data compatible with common differential expression software packages that require integer counts."

**Supporting Quotes**:
- (Lines 67-68): "using a negative binomial regression model that retains the integer nature of count data in RNA-seq studies"

---

## C_03: Batch effects can substantially degrade classifier performance when applied to new batches

**Category**: Method  
**Source**: Soneson2014 (Source ID: 3)  
**Context**: Classifiers may learn to distinguish batches rather than biological conditions.

**Primary Quote** (Introduction):
> "the performance estimate obtained by the cross-validation is in fact far from the performance we can expect if we apply the classifier to an external data set, and thus rather misleading."

**Supporting Quotes**:
- (Introduction): "the fact that the patients and the healthy volunteers come from different data sets may introduce apparent differences between them that are not truly related to the disease, and that thus may fail to generalize or be replicated in other studies."
- (Abstract): "However, technical differences ('batch effects') as well as differences in sample composition between the data sets may significantly affect the ability to draw generalizable conclusions from such studies."
- (Results): "As expected, in all cases, the performance of the classifiers when applied to the external validation set is not better than chance, with an average misclassification rate close to 50%."
- (Discussion): "Unless the batch effect is heavily confounded with the outcome of interest, eliminating the batch effect typically improves the performance of the resulting classifier."

---

## C_04: Cross-validation within a single study may give optimistic performance estimates because classifiers can learn batch-specific patterns

**Category**: Method  
**Source**: Soneson2014 (Source ID: 3)  
**Context**: Batch effects confound performance estimates.

**Primary Quote** (Lines 547-548):
> "the performance estimate obtained from the inner cross-validation is biased. It is an overoptimistic estimate of the actual performance of the classifier."

**Supporting Quotes**:
- (Lines 1165-1178): "We have shown that in the presence of a batch effect with at least moderate level of confounding with the main grouping variable, the performance estimates obtained by cross-validation are highly biased."
- (Lines 1184-1189): "However, the bias in the cross-validation performance estimates is not eliminated by the batch effect removal, and consequently the cross-validation performance estimates obtained after batch effect elimination are not more reliable measures of the true performance than those obtained without batch effect elimination."

---

## C_05: Machine learning classifiers have demonstrated strong performance for gene expression classification tasks

**Category**: Method  
**Source**: Alharbi2023 (Source ID: 4)  
**Context**: Includes SVM, random forests, logistic regression, and neural networks.

**Primary Quote** (Lines 55):
> "Currently, several approaches that employed MLP or CNN networks in combination with efficient feature engineering and transfer learning techniques have achieved test accuracies upwards of 90%."

**Supporting Quotes**:
- (Lines 257): "For instance, Segal et al. [86] proposed a genome-based SVM strategy for the classification of clear cell sarcoma... The classifier accurately identified 75 out of 76 instances in leave-one-out cross-validation."
- (Lines 284): "Lai et al. [94] designed an MLP network that combined diverse data sources of gene expression and clinical data to successfully predict the overall survival of non-small cell lung cancer (NSCLC) patients... and achieved 0.8163 AUC and 75.44% accuracy."
- (Lines 321): "Xiao et al. [117] presented a CNN-based ensemble method, which was applied to three public RNA-Seq datasets of three kinds of cancers, including Lung Adenocarcinoma, Stomach Adenocarcinoma, and Breast Invasive Carcinoma, and attained a precision of 98%."

---

## C_06: For gene expression data, support vector machines, random forests, logistic regression with regularization, and neural networks show particular utility

**Category**: Method  
**Source**: Piccolo2022 (Source ID: 13)  
**Context**: Benchmark studies have identified algorithms that perform relatively well on gene expression data.

**Primary Quote** (Results section):
> "Later benchmark studies highlighted two types of algorithm-SVM and random forests-that performed relatively well on gene-expression data. Statnikov, et al. examined 22 datasets and specifically compared the predictive capability of these two algorithm types. Overall, they found that SVMs significantly outperformed random forests, although random forests outperformed SVMs in some cases."

**Supporting Quotes**:
- (Díaz-Uriarte2006): "Random forest has excellent performance in classification tasks, comparable to support vector machines."
- (Alharbi2023, Lines 55): "Currently, several approaches that employed MLP or CNN networks in combination with efficient feature engineering and transfer learning techniques have achieved test accuracies upwards of 90%."
- (Gao2023, Lines 49): "Many machine learning algorithms including linear regression, logistic regression, penalized regression, support vector machines (SVM), random forests (RF), neural networks (NN) and deep neural networks (DNN) have been used to predict phenotypes from omics data."

---

## C_07: RNA-seq data are typically skewed and over-dispersed counts, making Gaussian assumptions inappropriate

**Category**: Method  
**Source**: Zhang2020 (Source ID: 2)  
**Context**: Complicates batch correction methods that assume Gaussian distributions.

**Primary Quote** (Abstract and Line 61):
> "However in RNA-seq studies the data are typically skewed, over-dispersed counts, so this assumption is not appropriate and may lead to erroneous results."

**Supporting Quotes**:
- (Line 280): "Distributions of counts are skewed and over-dispersed, i.e. the variance is often larger than the mean of gene expression and genes with smaller counts tend to have larger variances."
- (Lines 271-278): "many popular adjustment methods, including ComBat, assume Gaussian distributions for the underlying distribution of the data, which is not an appropriate distributional assumption for counts."

---

## C_08: ComBat was originally developed for microarray data and has been successfully applied to RNA-seq data after appropriate transformation

**Category**: Method  
**Source**: Tran2020 (Source ID: 5)  
**Context**: Requires transformation for count data; has been applied to both single-cell and bulk RNA-seq.

**Primary Quote** (Methods section):
> "ComBat was originally developed for microarray gene expression data [1], but had been successfully employed on scRNA-seq data [6]."

**Supporting Quotes**:
- (Piccolo2022, Data preparation): "For these datasets, the gene-expression data were generated using Affymetrix microarrays...and batch-adjusted (where applicable) using ComBat. For the remaining 5 datasets, we used RNA-Sequencing data from The Cancer Genome Atlas (TCGA)."
- (Zhang2020, Lines 125): "We also included another commonly used method in practice, which is to transform the count matrix to logCPM, then use the batch correction methods designed for Gaussian distributed data, such as the original ComBat method."
- (Yu2024): "ComBat is one of the most widely used BECAs in transcriptomics [118, 119] proteomics [120], and metabolomics [121]."

---

## C_09: For single-cell RNA sequencing data, methods such as Harmony, LIGER, and Seurat address unique challenges including sparsity and high dimensionality

**Category**: Method  
**Source**: Yu2024 (Source ID: 16)  
**Context**: Single-cell data has more severe batch effects than bulk RNA-seq due to technical characteristics.

**Primary Quote** (Introduction):
> "scRNA-seq methods have lower RNA input, higher dropout rates, and a higher proportion of zero counts, low-abundance transcripts, and cell-to-cell variations than bulk RNA-seq. These factors make batch effects more severe in single-cell data than in bulk data."

**Supporting Quotes**:
- (Tran2020, Conclusion): "Based on our results, Harmony, LIGER, and Seurat 3 are the recommended methods for batch integration. Due to its significantly shorter runtime, Harmony is recommended as the first method to try, with the other methods as viable alternatives."
- (Haghverdi2018, Abstract): "Our approach does not rely on predefined or equal population compositions across batches; instead, it requires only that a subset of the population be shared between batches...in the high-dimensional expression space."
- (Xu2023, Lines 104): "technical factors still cause considerable noise in data generated in scRNA-seq experiments, including amplification deviation, library size difference, and extremely low capture rate. In particular, the extremely low RNA capture rate leads to undetectable, albeit expressed, genes, namely 'dropout' events...Given the sparse expression metrics, traditional analytic tools cannot achieve scientific rigor"

---

## C_10: Alternative empirical Bayes models have been developed for adjusting batch effects in genomic studies

**Category**: Method  
**Source**: Zhang2018 (Source ID: 6)  
**Context**: Includes methods for cases with reference batches.

**Primary Quote** (Abstract):
> "Here we contribute multiple methods and software tools for improved combination and analysis of data from multiple batches. In particular, we provide batch effect solutions for cases where the severity of the batch effects is not extreme, and for cases where one high-quality batch can serve as a reference, such as the training set in a biomarker study."

**Supporting Quotes**:
- (Lines 249-260): "we present an approach that allows the user to select a reference batch, or a batch that is left static after batch adjustment, and to which all the other batches are adjusted. This approach makes sense in situations where one batch or dataset is of better quality or less variable. In addition, this approach will be particularly helpful for biomarker studies, where one dataset is used for training a fixed biomarker, then the fixed biomarker is applied on multiple different batches or datasets, even at different times."

---

## C_103: Domain-adversarial training uses gradient reversal layers to learn features that are discriminative for the main task but indiscriminate with respect to domain shift

**Category**: Method  
**Source**: Ganin2017 (Source ID: 39)  
**Context**: Forces the network to learn batch-invariant representations through adversarial training.

**Primary Quote** (Introduction):
> "As training progresses, the approach promotes the emergence of features that are (i) discriminative for the main learning task on the source domain and (ii) indiscriminate with respect to the shift between the domains."

---

## C_104: Gradient Reversal Layer (GRL) enables domain adaptation by reversing gradients during backpropagation

**Category**: Method  
**Source**: Ganin2017 (Source ID: 39)  
**Context**: This approach can be implemented with minimal modifications to standard neural network architectures.

**Primary Quote** (Methods):
> "The Gradient Reversal Layer has no parameters associated with it. During the forward propagation, the GRL acts as an identity transformation. During the backpropagation however, the GRL takes the gradient from the subsequent level and changes its sign, i.e.multiplies it by -λ"

---

## C_11: Surrogate Variable Analysis (SVA) identifies and adjusts for unknown, latent sources of variation in genomics data

**Category**: Method  
**Source**: Leek2007 (Source ID: 7)  
**Context**: Extracts surrogate variables from high-dimensional data to capture unwanted effects.

**Primary Quote** (Abstract):
> "We introduce 'surrogate variable analysis' (SVA) to overcome the problems caused by heterogeneity in expression studies. SVA can be applied in conjunction with standard analysis techniques to accurately capture the relationship between expression and any modeled variables of interest."

**Supporting Quotes**:
- (Introduction): "We show that failing to incorporate these sources of heterogeneity into an analysis can have widespread and detrimental effects on the study. Not only can this reduce power or induce unwanted dependence across genes, but it can also introduce sources of spurious signal to many genes."
- (Results): "The SVA approach flexibly captures signatures of EH, including highly irregular patterns not following any simple model, by estimating the signatures of EH in the expression data themselves rather than attempting to estimate specific unmodeled factors such as age or gender."

---

## C_12: Harmony integrates single-cell datasets by removing batch effects while preserving biological structure through iterative batch-centroid correction in PC space

**Category**: Method  
**Source**: Korsunsky2019 (Source ID: 8)  
**Context**: Fast and scalable, can handle ~1 million cells.

**Primary Quote** (Results):
> "Harmony iteratively learns a cell-specific linear correction function. Harmony begins with a low-dimensional embedding of cells, such as principal components analysis (PCA), (Supplementary Note 1 and Methods). Using this embedding, Harmony first groups cells into multi-dataset clusters (Fig. 1a). We use soft clustering to assign cells to potentially multiple clusters, to account for smooth transitions between cell states."

**Supporting Quotes**:
- (Results): "After clustering, each dataset has cluster-specific centroids (Fig. 1b) that are used to compute cluster-specific linear correction factors (Fig. 1c). Since clusters correspond to cell types and states, cluster-specific correction factors correspond to individual cell-type and cell-state specific correction factors."
- (Results): "Finally, each cell is assigned a cluster-weighted average of these terms and corrected by its cell-specific linear factor (Fig. 1d). Since each cell may be in multiple clusters, each cell has a potentially unique correction factor. Harmony iterates these four steps until cell cluster assignments are stable."

---

## C_13: LIGER uses integrative non-negative matrix factorization (iNMF) to separate shared biological factors from dataset-specific technical factors

**Category**: Method  
**Source**: Welch2019 (Source ID: 9)  
**Context**: Performs well when batches have non-identical cell type compositions.

**Primary Quote** (Comparing and contrasting single-cell datasets with shared and dataset-specific factors):
> "LIGER takes as input multiple single-cell datasets, which may be scRNA-seq experiments from different individuals, time points, or species-or measurements from different molecular modalities, such as single-cell epigenome data or spatial gene expression data (Figure 1A). LIGER then employs integrative non-negative matrix factorization (iNMF) (Yang and Michailidis, 2016) to learn a low-dimensional space in which each cell is defined by one set of dataset-specific factors, or metagenes, and another set of shared metagenes (Figure 1B)."

**Supporting Quotes**:
- (Methods): "Each factor often corresponds to a biologically interpretable signal-like the genes that define a particular cell type. A tuning parameter, λ, allows adjusting the size of dataset-specific effects to reflect the divergence of the datasets being analyzed."

---

## C_14: Seurat v3 uses anchor-based integration with mutual nearest neighbors (MNNs) to correct batch effects while preserving cell-type structure

**Category**: Method  
**Source**: Stuart2019 (Source ID: 10)  
**Context**: Uses CCA to project datasets into shared space before finding anchors.

**Primary Quote** (Discussion):
> "Our integration strategy builds upon previous work in the application of CCA to identify shared sources of variation across experiments (Butler et al., 2018) and the concept of mutual nearest neighbors to identify biologically matched cells in a pair of datasets (Haghverdi et al., 2018). Furthermore, we leverage ideas from the construction of SNN graphs to score, identify, and downweight the contribution of inaccurate anchors to substantially increase integration robustness."

**Supporting Quotes**:
- (Abstract): "We introduce an analytical strategy for integrating scRNA-seq datasets based on common sources of variation, enabling the identification of shared populations across datasets and downstream comparative analysis."

---

## C_15: BatchQC provides interactive software for evaluating sample and batch effects with PCA, heatmaps, dendrograms, and other diagnostics

**Category**: Method  
**Source**: Manimaran2016 (Source ID: 11)  
**Context**: Supports multiple batch correction methods including ComBat, ComBat-Seq, limma, and SVA.

**Primary Quote** (Abstract):
> "We present a software pipeline, BatchQC, which addresses these issues using interactive visualizations and statistics that evaluate the impact of batch effects in a genomic dataset. BatchQC can also apply existing adjustment tools and allow users to evaluate their benefits interactively."

**Supporting Quotes**:
- (Section 2.3): "BatchQC conducts PCA on the dataset and produces an interactive plot for displaying the user's choice of any two components at the same time, with the points colored by the choice of condition or batch"
- (Section 2.2): "BatchQC also provides heatmap plots for gene-level values and a sample-level circular dendrogram that clusters the samples using the choice of several different agglomeration measures."
- (Section 2.4): "BatchQC can interactively adjust the data for batch effects using ComBat or Surrogate Variable Analysis (SVA)."

---

## C_16: Merging (batch correction + pooled analysis) identified more differentially expressed genes than meta-analysis approaches

**Category**: Method  
**Source**: Taminau2014 (Source ID: 12)  
**Context**: Meta-analysis still found robust DEGs, choice depends on data availability and goals.

**Primary Quote** (Results section):
> "If we compare the final DEGs for the meta-analysis approach with the list obtained in the merging approach we can conclude that significantly more DEGs are identified through merging. Moreover, all 25 identified DEGs through meta-analysis are also identified in the merging approach."

**Supporting Quotes**:
- (Abstract): "Within this study, we investigate the hypothesis that analyzing large cohorts of samples resulting in merging independent data sets designed to study the same biological problem results in lower false discovery rates than analyzing the same data sets within a more conservative meta-analysis approach."

---

## C_17: Classification performance for gene-expression data depends strongly on algorithm choice and performance metric

**Category**: Method  
**Source**: Piccolo2022 (Source ID: 13)  
**Context**: Number of samples and genes did not strongly correlate with classification performance.

**Primary Quote** (Abstract):
> "The ability to classify patients based on gene-expression data varies by algorithm and performance metric"

**Supporting Quotes**:
- (Results): "the performance rankings differed considerably depending on which evaluation metric we used"
- (Results): "conclusions drawn from benchmark comparisons depend heavily on which metric(s) are considered important"

---

## C_18: recount3 provides harmonized RNA-Seq expression summaries across thousands of experiments, enabling large-scale integrative analyses

**Category**: Method  
**Source**: Wilks2021 (Source ID: 14)  
**Context**: Comprises over 750,000 individual sequencing runs from SRA, GTEx, and TCGA, enables cross-dataset comparisons.

**Primary Quote** (Abstract):
> "We present recount3, a resource consisting of over 750,000 publicly available human and mouse RNA sequencing (RNA-seq) samples uniformly processed by our new Monorail analysis pipeline."

**Supporting Quotes**:
- (From web source): "Monorail can be used to process local and/or private data, allowing results to be directly compared to any study in recount3. Taken together, our tools help biologists maximize the utility of publicly available RNA-seq data, especially to improve their understanding of newly collected data." [Source: [https://link.springer.com/10.1186/s13059-021-02533-6](https://link.springer.com/10.1186/s13059-021-02533-6)]
- (From web source): "This tool makes it easy to reproduce published analyses or create a meta-analysis from multiple datasets." [Source: [https://www.raynaharris.com/blog/recount3/](https://www.raynaharris.com/blog/recount3/)]

Content was rephrased for compliance with licensing restrictions.

---

## C_19: A hybrid model integrating data mining and machine learning methods can evaluate proximity metrics in high-dimensional gene expression data for disease diagnosis

**Category**: Method  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Focuses on selecting and evaluating proximity metrics for clustering and classification tasks.

**Primary Quote** (Abstract):
> "This study presents the development and application of a hybrid model for evaluating proximity metrics in high-dimensional gene expression data, integrating data mining and machine learning methods within a comprehensive framework."

---

## C_20: Correlation distance, mutual information-based metrics, and Wasserstein distance are well-suited for gene expression analysis

**Category**: Method  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Selected for their theoretical soundness and practical relevance in transcriptomics.

**Primary Quote** (Introduction):
> "correlation, mutual information, and Wasserstein distance are well-suited for gene expression analysis. Correlation captures linear relationships and is widely used in co-expression networks. Mutual information captures non-linear dependencies, while Wasserstein distance compares entire distributions and is robust in high-dimensional spaces."

---
