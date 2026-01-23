# Claims and Evidence

This document contains all claims with their supporting evidence, organized by Claim ID for easy reference and citation.

## Format

Each claim section includes:
- **Claim ID and full claim text** as the header
- **Category**: Type of claim (Method, Result, Challenge, Data Source, etc.)
- **Source**: AuthorYear identifier and Source ID (see sources.md for full citations)
- **Context**: Additional nuance or clarification
- **Primary Quote**: The most representative evidence (used for hover tooltips)
- **Supporting Quotes**: Additional evidence from the source (optional)

---

## C_01: ComBat uses Empirical Bayes to estimate location and scale parameters

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  
**Context**: Assumes Gaussian distribution.

**Primary Quote** (Section 3.1, Step 2):
> "We propose parametric and non-parametric empirical Bayes frameworks for adjusting data for batch effects that is robust to outliers in small sample sizes"

**Supporting Quotes**:
- (Section 2.3): "Location and scale (L/S) adjustments can be defined as a wide family of adjustments in which one assumes a model for the location (mean) and/or scale (variance) of the data within batches and then adjusts the batches to meet assumed model specifications. Therefore, L/S batch adjustments assume that the batch effects can be modeled out by standardizing means and variances across batches."
- (Section 2.3): "The γ ig and δ ig represent the additive and multiplicative batch effects of batch i for gene g, respectively."
- (Section 3.1, Step 2): "we assume the parametric forms for prior distributions on the batch effect parameters to be... The hyperparameters γ i, τ 2 i, λ i, θ i are estimated empirically from standardized data using the method of moments"
- (Section 3.1, Step 2): "the EB estimates for batch effect parameters, γ ig and δ 2 ig, are given (respectively) by the conditional posterior means"

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

**Primary Quote** (Abstract):
> "However, technical differences ('batch effects') as well as differences in sample composition between the data sets may significantly affect the ability to draw generalizable conclusions from such studies."

**Supporting Quotes**:
- (Lines 228-229): "truly related to the disease, and that thus may fail to generalize or be replicated in other studies."
- (Lines 476-482): "In this study we focus on the additional biases that may result if the data set used to build the classifier (and thus used as the basis for the cross-validation) is not representative of the collection of new data sets to which the classifier will eventually be applied. In this case, as we will see, the performance estimate obtained from the cross-validation can be far from the actual performance of the classifier on a new independent data set."
- (Lines 282-291): "We find that in data sets where there are no genes that are truly differentially expressed between the two groups, the internal cross-validation performance estimate is only approximately unbiased when the batch effect is completely non-confounded with the class labels. Eliminating the batch effects can not correct the bias found in other settings. For data sets where some genes are truly differentially expressed, we can use the cross-validation performance estimate as a surrogate for the true performance as long as the level of confounding is not too large."

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

**Primary Quote** (Abstract):
> "This study reviews recent progress in gene expression analysis for cancer classification using machine learning methods. Both conventional and deep learning-based approaches are reviewed, with an emphasis on the application of deep learning models due to their comparative advantages for identifying gene patterns that are distinctive for various types of cancers."

---

## C_06: For gene expression data, support vector machines, random forests, logistic regression with regularization, and neural networks show particular utility

**Category**: Method  
**Source**: Alharbi2023 (Source ID: 4)  
**Context**: Each classifier type has distinct characteristics for different scenarios.

**Primary Quote** (Lines 1223-1224):
> "Conventional machine learning methods, such as Support Vector Machines (SVM), k-Nearest Neighbor (kNN), Naïve Bayes (NB), Random Forest (RF), and related methods have been widely applied for gene expression analysis."

**Supporting Quotes**:
- (Lines 243-248): "DL-based methods have generally outperformed conventional ML methods, and it can be expected that most future models for gene expression analysis will be based on DL networks. Currently, several approaches that employed MLP or CNN networks in combination with efficient feature engineering and transfer learning techniques have achieved test accuracies upwards of 90%."

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

## C_08: ComBat was originally developed for microarray data and has been successfully applied to bulk RNA-seq data after appropriate transformation

**Category**: Method  
**Source**: Johnson2007 (Source ID: 1)  
**Context**: Requires transformation for count data.

**Primary Quote** (Summary):
> "Non-biological experimental variation or 'batch effects' are commonly observed across multiple batches of microarray experiments, often rendering the task of combining data from these batches difficult."

**Supporting Quotes**:
- (Section 1. INTRODUCTION): "With the many applications of gene expression microarrays, biologists are able to efficiently extract hypotheses that can later be tested experimentally in a lab setting."

**Additional Context from Zhang2020** (Source ID: 2):
- (Lines 111-112): "For example, ComBat (4) remains one of the most popular batch effect adjustment methods when the effects come from known sources."

---

## C_09: For single-cell RNA sequencing data, methods such as Harmony, LIGER, and Seurat address unique challenges including sparsity and high dimensionality

**Category**: Method  
**Source**: Tran2020 (Source ID: 5)  
**Context**: These methods are not appropriate for bulk RNA-seq data.

**Primary Quote** (Abstract, Conclusion):
> "Based on our results, Harmony, LIGER, and Seurat 3 are the recommended methods for batch integration. Due to its significantly shorter runtime, Harmony is recommended as the first method to try, with the other methods as viable alternatives."

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

**Primary Quote** (Lines 155-162, from Tran2020 benchmark):
> "Harmony [13], first employs PCA for dimensionality reduction. In the PCA space, Harmony iteratively removes batch effects present. At each iteration, it clusters similar cells from different batches while maximizing the diversity of batches within each cluster and then calculates a correction factor for each cell to be applied. This approach is fast and can accurately detect the true biological connection across datasets."

---

## C_13: LIGER uses integrative non-negative matrix factorization (iNMF) to separate shared biological factors from dataset-specific technical factors

**Category**: Method  
**Source**: Welch2019 (Source ID: 9)  
**Context**: Performs well when batches have non-identical cell type compositions.

**Primary Quote** (Lines 164-179, from Tran2020 benchmark):
> "LIGER is a newly developed method to handle a perceived shortcoming of other methods, which is the assumption that differences between datasets are entirely due to technical variations and not of biological origins, thus aiming to remove all of them [14]. LIGER uses integrative non-negative matrix factorization to first obtain a low-dimensional representation of the input data. The representation is composed of two parts: a set of batch-specific factors and a set of shared factors."

---

## C_14: Seurat v3 uses anchor-based integration with mutual nearest neighbors (MNNs) to correct batch effects while preserving cell-type structure

**Category**: Method  
**Source**: Stuart2019 (Source ID: 10)  
**Context**: Uses CCA to project datasets into shared space before finding anchors.

**Primary Quote** (Lines 150-154, from Tran2020 benchmark):
> "The Seurat MultiCCA method from the popular Seurat package... newer version, Seurat Integration (Seurat 3) [12], first uses CCA to project the data into a subspace to identify correlations across datasets. The MNNs are then computed in the CCA subspace and serve as 'anchors' to correct the data."

---

## C_15: BatchQC provides interactive software for evaluating sample and batch effects with PCA, heatmaps, dendrograms, and other diagnostics

**Category**: Method  
**Source**: Kauffmann2016 (Source ID: 11)  
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

**Primary Quote**:
> [Note: Full text extraction completed. Specific quotations to be added after review of extracted text.]

---

## C_18: recount3 provides harmonized RNA-Seq expression summaries across thousands of experiments, enabling large-scale integrative analyses

**Category**: Method  
**Source**: Wilks2021 (Source ID: 14)  
**Context**: Comprises over 750,000 individual sequencing runs from SRA, GTEx, and TCGA, enables cross-dataset comparisons.

**Primary Quote**:
> [Note: Full text extraction completed. Specific quotations to be added after review of extracted text.]

---

## C_19: A hybrid model integrating data mining and machine learning methods can evaluate proximity metrics in high-dimensional gene expression data for disease diagnosis

**Category**: Method  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Focuses on selecting and evaluating proximity metrics for clustering and classification tasks.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_20: Correlation distance, mutual information-based metrics, and Wasserstein distance are well-suited for gene expression analysis

**Category**: Method  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Selected for their theoretical soundness and practical relevance in transcriptomics.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_21: The proposed hybrid model achieved classification accuracy exceeding 95.9% and a weighted F1-score above 95.8% on the TCGA dataset

**Category**: Result  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Dataset included over 6,000 patient samples covering 13 cancer types.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_22: External validation of the hybrid model on Alzheimer's and Type 2 Diabetes datasets confirmed its generalizability

**Category**: Result  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Accuracies reached 96.28% and 97.43% respectively.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_23: A stacking model, with Random Forest base learners and a logistic regression meta-classifier, can enhance classification robustness

**Category**: Method  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Hyperparameters optimized using Bayesian optimization.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_24: The K-Medoids clustering algorithm is suitable for gene expression data analysis

**Category**: Method  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Minimizes sum of distances between points and cluster medoids.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_25: For gene expression data, Wasserstein distance and correlation metrics consistently outperform mutual information-based metrics

**Category**: Result  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Wasserstein metric showed better balance between classification quality and cluster uniformity in multi-cluster structures.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_26: Meta-analysis in gene expression studies combines results from independent but related datasets to increase statistical power

**Category**: Method  
**Source**: Campain2010 (Source ID: 16)  
**Context**: Aids in finding effects that exist and important subtle variations.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_27: Challenges in microarray meta-analysis include overcoming different study aims, designs, and populations

**Category**: Challenge  
**Source**: Campain2010 (Source ID: 16)  
**Context**: Differing platforms and probe mapping make comparisons difficult; laboratory effects like experimental procedures and sample preparation also contribute.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_28: The meta differential expression via distance synthesis (mDEDS) method is a meta-analysis approach

**Category**: Method  
**Source**: Campain2010 (Source ID: 16)  
**Context**: Designed to be resilient to varying complexity levels in meta-analysis and robust against measure-specific and platform-specific bias.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_29: Meta-analysis methods can be categorized into 'relative' and 'absolute' approaches

**Category**: Method  
**Source**: Campain2010 (Source ID: 16)  
**Context**: 'Relative' methods include Fisher's inverse chi-square, GeneMeta, and RankProd; 'absolute' methods are exemplified by the 'simple' meta method.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_30: Fisher's inverse chi-square method combines p-values from independent datasets

**Category**: Method  
**Source**: Campain2010 (Source ID: 16)  
**Context**: Tests the null hypothesis of no differences in expression means between groups for a given gene.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_31: The Gene Expression Omnibus (GEO) is an international public repository archiving gene expression and epigenomics data

**Category**: Data Source  
**Source**: Clough2023 (Source ID: 17)  
**Context**: Handles over 200,000 studies and 6.5 million samples, all indexed, searchable, and downloadable.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_32: GEO generates consistently computed gene expression count matrices for thousands of RNA-seq studies

**Category**: Method  
**Source**: Clough2023 (Source ID: 17)  
**Context**: New interactive graphical plots help users identify differentially expressed genes and assess data set quality.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_33: Over the last decade, next-generation sequencing (NGS) data, particularly RNA-seq, has grown to make up the bulk (85%) of GEO submissions

**Category**: Data Trend  
**Source**: Clough2023 (Source ID: 17)  
**Context**: RNA-seq studies have represented over half of all studies submitted each year since 2018.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_34: Single-cell RNA-seq studies have significantly increased in GEO, comprising 21% of all RNA-seq studies released in 2022

**Category**: Data Trend  
**Source**: Clough2023 (Source ID: 17)  
**Context**: Reflects the growing focus on single-cell transcriptomes.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_35: GEO data are widely reused for identifying novel gene expression patterns, finding disease predictors, and developing computational methods

**Category**: Application  
**Source**: Clough2023 (Source ID: 17)  
**Context**: Over 31,000 third-party papers use GEO data to support or complement independent studies.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_36: Unmeasured or unmodeled factors can introduce widespread and detrimental effects on gene expression studies

**Category**: Impact  
**Source**: Leek2010 (Source ID: 18)  
**Context**: This phenomenon is true even for well-designed, randomized studies.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_37: Surrogate Variable Analysis (SVA) is a method to identify, estimate, and utilize components of expression heterogeneity

**Category**: Method  
**Source**: Leek2010 (Source ID: 18)  
**Context**: Can be applied in conjunction with standard analysis techniques to accurately capture the relationship between expression and any modeled variables of interest.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_38: SVA increases the biological accuracy and reproducibility of analyses in genome-wide expression studies

**Category**: Result  
**Source**: Leek2010 (Source ID: 18)  
**Context**: Achieves operating characteristics nearly equivalent to what one would obtain with no expression heterogeneity at all.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_39: Expression heterogeneity can lead to extra variability in expression levels, spurious signals due to confounding, and long-range dependence in noise

**Category**: Impact  
**Source**: Leek2010 (Source ID: 18)  
**Context**: Occurs even if measured factors like age act on distinct sets of genes or interact with unobserved factors.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_40: SVA improves the accuracy and stability of gene ranking for differential expression

**Category**: Method  
**Source**: Leek2010 (Source ID: 18)  
**Context**: Achieved by adjusting for surrogate variables that capture unmodeled factors, reducing spurious differential expression.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_41: GMMchi is a Python package leveraging Gaussian Mixture Modeling to detect and characterize bimodal gene expression patterns

**Category**: Method  
**Source**: Liu2022 (Source ID: 19)  
**Context**: Designed to analyze correlations between dichotomous gene expression shifts and driver mutations.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_42: GMMchi robustly and reliably extracts bimodal patterns from both colorectal cancer cell line-derived microarray and tumor-derived RNA-Seq data

**Category**: Result  
**Source**: Liu2022 (Source ID: 19)  
**Context**: Confirmed previously reported gene expression correlates of well-characterized CRC phenotypes.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_43: GMMchi achieved 85% accuracy with a sample size of n=90 in simulated data, and exceeds 90% accuracy with a sample size of about 1000

**Category**: Result  
**Source**: Liu2022 (Source ID: 19)  
**Context**: Demonstrates accuracy in categorizing simulated distributions.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_44: The "tail problem" in Gaussian Mixture Modeling (GMM) refers to non-normally distributed tails of outliers in gene expression data

**Category**: Challenge  
**Source**: Liu2022 (Source ID: 19)  
**Context**: GMMchi addresses this by iteratively removing data points from the extreme end of the tail while fitting the remaining points with GMM and using Chi-square fitting.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_45: Domain adaptation (DA), a subfield of transfer learning, addresses the problem of models not generalizing across datasets

**Category**: Method  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: Alleviates issues caused by technical and biological differences between datasets.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_46: Most state-of-the-art domain adaptation methods face challenges when applied to biological datasets

**Category**: Challenge  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: Biological datasets are expensive to collect and have complex feature spaces.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_47: Specific challenges for applying domain adaptation to biological data include poor sample-to-feature ratios and complex feature spaces

**Category**: Challenge  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: These factors can substantially hinder data aggregation and model performance.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_48: Effective domain adaptation for biological datasets requires methods that work with limited data in individual cohorts

**Category**: Method  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: Emphasizes the need for DA research to focus on data-scarce regimes.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_49: Failure of adaptability between source and target domains in domain adaptation can lead to negative transfer

**Category**: Impact  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: Highlights a critical theoretical limitation of DA.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_50: CycleMix is a novel scalable cell-cycle classification algorithm based on Gaussian Mixture Modeling

**Category**: Method  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: Addresses heterogeneity of the cell cycle in single-cell RNAseq and spatial transcriptomics.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_51: CycleMix can flexibly assign cells to any number of states and accurately distinguish cycling from non-cycling cells

**Category**: Result  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: Benchmarked on low-throughput scRNAseq datasets and found to be the best performing method on high-throughput datasets.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_52: CycleMix uses a weighted average of log-normalized expression from positive and negative marker genes

**Category**: Method  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: Marker gene lists from multiple sources are available within CycleMix, including those used by Seurat and Tirosh et al. (2016).

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_53: Benchmarking on high-throughput droplet-based scRNAseq datasets showed CycleMix accurately assigned over 90% of quiescent cells to a non-cycling phase

**Category**: Result  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: This was consistent with Seurat exhibiting much higher false-positive rates for S and G2M cell-type assignments.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_54: CycleMix can regress out cell-cycle phase differences using discrete classifications

**Category**: Method  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: This partial regression model helps to distinguish problematic cell-cycle variability from biologically relevant cell-type variability.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_55: PhenoGMM is an automated model-based fingerprinting approach based on Gaussian mixture models

**Category**: Method  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: It processes large amounts of quantitative single-cell data generated by cytometry.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_56: PhenoGMM successfully quantifies changes in microbial community structure based on flow cytometry data

**Category**: Result  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: Evaluated using data sets from both synthetic and natural ecosystems.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_57: Microbial cytometry data present different characteristics compared to immunophenotyping data

**Category**: Challenge  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: This necessitates specialized data analysis pipelines like PhenoGMM.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_58: Traditional cytometric fingerprinting approaches for bacterial communities have drawbacks including being laborious and operator-dependent

**Category**: Method  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: PhenoGMM addresses these shortcomings by modeling the full multivariate parameter space at once.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_59: PhenoGMM models the full parameter space of multivariate flow cytometry data

**Category**: Method  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: This allows for the description of potentially many overlapping cell populations.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_60: In synthetic microbial communities, PhenoGMM showed moderate to highly correlated alpha-diversity estimations

**Category**: Result  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: This indicates that PhenoGMM captures community structure rather than identity.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_61: PhenoGMM successfully quantified the community structure of most natural freshwater microbial communities

**Category**: Result  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: Its ability depended on the ecosystem of study and its specific implementation.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_69: The Zak et al. [2016] study identified a 16-gene blood RNA signature to predict progression to active tuberculosis disease

**Category**: Data Source  
**Source**: Zak2016 (Source ID: 23)  
**Context**: Used as training dataset A in the analysis of domain adaptation in small-scale and heterogeneous biological datasets.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_70: The Suliman et al. [2018] study investigated active vs latent tuberculosis in South Africa, The Gambia, and Ethiopia

**Category**: Data Source  
**Source**: Suliman2018 (Source ID: 24)  
**Context**: Added manually. Abstract failed to add via script. Book_chapter.md lists year as 2014, DOI metadata as 2018.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_71: The Leong et al. [2018] study investigated active vs latent tuberculosis in South Indian populations

**Category**: Data Source  
**Source**: Leong2018 (Source ID: 25)  
**Context**: N/A

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_72: The Walter et al. [2016] study investigated active vs latent tuberculosis in United States populations

**Category**: Data Source  
**Source**: Walter2016 (Source ID: 26)  
**Context**: Placeholder. Paper not found via web search with specified characteristics. Needs further investigation.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_73: The Kaforou et al. [2013] study (GSE37250_SA) investigated active vs latent tuberculosis in South African populations

**Category**: Data Source  
**Source**: Kaforou2013 (Source ID: 27)  
**Context**: Book_chapter.md lists year as 2013, add_paper.py metadata lists year as 2023.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_74: The Kaforou et al. [2013] study (GSE37250_M) investigated active vs latent tuberculosis in Malawian populations

**Category**: Data Source  
**Source**: Kaforou2013 (Source ID: 27)  
**Context**: Book_chapter.md lists year as 2013, add_paper.py metadata lists year as 2023.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_75: Random forests provide feature importance measures that can identify key predictive genes in gene expression classification tasks

**Category**: Method  
**Source**: DiazUriarte2006 (Source ID: 28)  
**Context**: Variable importance measures have been suggested as screening tools for gene expression studies.

**Primary Quote** (Abstract):
> "random forest is a classification algorithm well suited for microarray data: it shows excellent performance even when most predictive variables are noise, can be used when the number of variables is much larger than the number of observations and in problems involving more than two classes, and returns measures of variable importance."

**Supporting Quotes**:
- (Background): "Classification algorithms that directly provide measures of variable importance (related to the relevance of the variable in the classification) are of great interest for gene selection, specially if the classification algorithm itself presents features that make it well suited for the types of problems frequently faced with microarray data. Random forest is one such algorithm."

---

## C_76: Logistic regression with L1 regularization (lasso) performs automatic feature selection

**Category**: Method  
**Source**: DiazUriarte2006 (Source ID: 28)  
**Context**: L1 penalty enables sparse solutions suitable for high-dimensional gene expression data.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_77: Support vector machines can identify support vectors that define decision boundaries

**Category**: Method  
**Source**: DiazUriarte2006 (Source ID: 28)  
**Context**: SVMs are well-suited for high-dimensional problems where the number of features exceeds the number of samples.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_78: Random forest gene selection yields very small sets of genes while preserving predictive accuracy

**Category**: Result  
**Source**: DiazUriarte2006 (Source ID: 28)  
**Context**: Demonstrated using simulated and nine microarray datasets.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_79: Elastic net combines L1 (lasso) and L2 (ridge) regularization penalties to perform both variable selection and regularization

**Category**: Method  
**Source**: Zou2005 (Source ID: 29)  
**Context**: Particularly useful when the number of predictors (p) is much larger than the number of observations (n).

**Primary Quote** (Abstract):
> "The elastic net is particularly useful when the number of predictors (p) is much bigger than the number of observations (n). By contrast, the lasso is not a very satisfactory variable selection method in the p >> n case."

**Supporting Quotes**:
- (Introduction): "We propose a new regularization technique which we call the elastic net. Similar to the lasso, the elastic net simultaneously does automatic variable selection and continuous shrinkage, and it can select groups of correlated variables."
- (Section 2.1): "We call the function (1-α)|β|₁ + α|β|₂ the elastic net penalty, which is a convex combination of the lasso and ridge penalty."

---

## C_80: Elastic net encourages a grouping effect, where strongly correlated predictors tend to be in or out of the model together

**Category**: Method  
**Source**: Zou2005 (Source ID: 29)  
**Context**: Addresses limitations of lasso in the p >> n case.

**Primary Quote** (Abstract):
> "In addition, the elastic net encourages a grouping effect, where strongly correlated predictors tend to be in or out of the model together."

**Supporting Quotes**:
- (Section 2.3): "Qualitatively speaking, a regression method exhibits the grouping effect if the regression coefficients of a group of highly correlated variables tend to be equal (up to a change of sign if negatively correlated)."
- (Theorem 1): "If xᵢ and xⱼ are highly correlated, i.e. ρ ≈ 1 (if ρ ≈ -1 then consider -xⱼ), theorem 1 says that the difference between the coefficient paths of predictor i and predictor j is almost 0."

---

## C_81: XGBoost is a scalable end-to-end tree boosting system that uses a novel sparsity-aware algorithm for sparse data

**Category**: Method  
**Source**: Chen2016 (Source ID: 30)  
**Context**: Widely used by data scientists to achieve state-of-the-art results on machine learning challenges.

**Primary Quote** (Abstract):
> "Tree boosting is a highly effective and widely used machine learning method. In this paper, we describe a scalable end-to-end tree boosting system called XGBoost, which is used widely by data scientists to achieve state-of-the-art results on many machine learning challenges. We propose a novel sparsity-aware algorithm for sparse data"

**Supporting Quotes**:
- (Introduction): "Among the 29 challenge winning solutions published at Kaggle's blog during 2015, 17 solutions used XGBoost. Among these solutions, eight solely used XGBoost to train the model, while most others combined XGBoost with neural nets in ensembles."

---

## C_82: XGBoost provides insights on cache access patterns, data compression, and sharding to build scalable tree boosting systems

**Category**: Method  
**Source**: Chen2016 (Source ID: 30)  
**Context**: Enables efficient handling of large-scale datasets.

**Primary Quote** (Abstract):
> "More importantly, we provide insights on cache access patterns, data compression and sharding to build a scalable tree boosting system. By combining these insights, XGBoost scales beyond billions of examples using far fewer resources than existing systems."

**Supporting Quotes**:
- (Introduction): "The scalability of XGBoost is due to several important systems and algorithmic optimizations. These innovations include: a novel tree learning algorithm is for handling sparse data; a theoretically justified weighted quantile sketch procedure enables handling instance weights in approximate tree learning. Parallel and distributed computing makes learning faster which enables quicker model exploration. More importantly, XGBoost exploits out-of-core computation"

---

## C_83: Random forests are a combination of tree predictors where each tree depends on values of a random vector sampled independently

**Category**: Method  
**Source**: Breiman2001 (Source ID: 31)  
**Context**: The generalization error converges as the number of trees increases.

**Primary Quote** (Abstract):
> "Random forests are a combination of tree predictors such that each tree depends on the values of a random vector sampled independently and with the same distribution for all trees in the forest. The generalization error for forests converges a.s. to a limit as the number of trees in the forest becomes large."

**Supporting Quotes**:
- (Definition 1.1): "A random forest is a classifier consisting of a collection of tree-structured classifiers {h(x,Θₖ), k=1,...} where the {Θₖ} are independent identically distributed random vectors and each tree casts a unit vote for the most popular class at input x."

---

## C_84: Random forests provide robustness to noise and can handle high-dimensional data where the number of features exceeds the number of samples

**Category**: Method  
**Source**: Breiman2001 (Source ID: 31)  
**Context**: Ensemble approach aggregates predictions across multiple trees.

**Primary Quote** (Section 2.1):
> "This result explains why random forests do not overfit as more trees are added, but produce a limiting value of the generalization error."

**Supporting Quotes**:
- (Abstract): "Using a random selection of features to split each node yields error rates that compare favorably to Adaboost, but are more robust with respect to noise."

---

## C_85: Support vector machines with recursive feature elimination (SVM-RFE) can perform gene selection for cancer classification

**Category**: Method  
**Source**: Guyon2002 (Source ID: 32)  
**Context**: Genes selected by SVM-RFE yield better classification performance and are biologically relevant to cancer.

**Primary Quote** (Abstract):
> "Using available training examples from cancer and normal patients, we build a classifier suitable for genetic diagnosis, as well as drug discovery. Previous attempts to address this problem select genes with correlation techniques. We propose a new method of gene selection utilizing Support Vector Machine methods based on Recursive Feature Elimination (RFE). We demonstrate experimentally that the genes selected by our techniques yield better classification performance and are biologically relevant to cancer."

**Supporting Quotes**:
- (Abstract): "In patients with leukemia our method discovered 2 genes that yield zero leave-one-out error, while 64 genes are necessary for the baseline method to get the best result (one leave-one-out error). In the colon cancer database, using only 4 genes our method is 98% accurate, while the baseline method is only 86% accurate."

---

## C_86: SVMs are particularly effective for high-dimensional gene expression data where the number of features often exceeds the number of samples

**Category**: Method  
**Source**: Guyon2002 (Source ID: 32)  
**Context**: The kernel trick allows SVMs to capture non-linear relationships.

**Primary Quote** (Section 2.2):
> "A known problem in classification specifically, and machine learning in general, is to find ways to reduce the dimensionality n of the feature space F to overcome the risk of 'overfitting'. Data overfitting arises when the number n of features is large (in our case thousands of genes) and the number ℓ of training patterns is comparatively small (in our case a few dozen patients)."

**Supporting Quotes**:
- (Introduction): "These data sets present multiple challenges, including a large number of gene expression values per experiment (several thousands to tens of thousands), and a relatively small number of experiments (a few dozen)."

---

## C_87: Neural networks outperform state-of-the-art methods only for very large training set sizes in gene expression classification

**Category**: Result  
**Source**: Hanczar2022 (Source ID: 33)  
**Context**: For small training sets, transfer learning may strongly improve model performance.

**Primary Quote** (Abstract):
> "We show that neural networks outperform the state-of-the-art methods only for very large training set size. For a small training set, we show that transfer learning is possible and may strongly improve the model performance in some cases."

**Supporting Quotes**:
- (Background): "The most challenging problems are the high dimensionality of the gene expression data, the insufficient number of training examples that lead to overfitting during training, and lack of robustness of the results."

---

## C_88: Deep learning requires sufficient data to achieve superior performance on gene expression classification tasks

**Category**: Method  
**Source**: Hanczar2022 (Source ID: 33)  
**Context**: The n << p property (few samples, many features) has historically prevented effective use of deep learning for gene expression data.

**Primary Quote** (Background):
> "The most challenging problems are the high dimensionality of the gene expression data, the insufficient number of training examples that lead to overfitting during training, and lack of robustness of the results."

**Supporting Quotes**:
- (Abstract): "We show that neural networks outperform the state-of-the-art methods only for very large training set size."

---

## C_89: Frozen RMA (fRMA) allows microarrays to be analyzed individually or in small batches

**Category**: Method  
**Source**: McCall2010 (Source ID: 40)  
**Context**: Addresses the clinical need to process samples individually without requiring a batch.

**Primary Quote** (Abstract):
> "We propose a preprocessing algorithm, frozen RMA (fRMA), which allows one to analyze microarrays individually or in small batches and then combine the data for analysis. This is accomplished by utilizing information from the large publicly available microarray databases."

**Supporting Quotes**:
- (Introduction): "Although multiarray methods typically outperform single-array ones, they come at a price. For example, a logistics problem arises from the need to analyze all samples at once which implies that data sets that grow incrementally need to be processed every time an array is added. More importantly, as we demonstrate later, artifacts are introduced when groups of arrays are processed separately."

---

## C_90: RMA cannot be used in clinical settings where samples must be processed individually or in small batches

**Category**: Challenge  
**Source**: McCall2010 (Source ID: 40)  
**Context**: This is a fundamental limitation of multiarray methods for clinical deployment.

**Primary Quote** (Introduction):
> "Furthermore, for microarrays to be used in clinical diagnostics, they must provide information based on single array."

**Supporting Quotes**:
- (Introduction): "The dependence on multiple arrays has 2 drawbacks: (1) RMA cannot be used in clinical settings where samples must be processed individually or in small batches and (2) data sets preprocessed separately are not comparable."

---

## C_91: Reference-based normalization adjusts a single sample against a pre-computed reference distribution from training data

**Category**: Method  
**Source**: McCall2010, Talhouk2016 (Source IDs: 40, 41)  
**Context**: Critical for clinical deployment where each patient sample may constitute its own "batch."

**Primary Quote** (Abstract, McCall2010):
> "In particular, estimates of probe-specific effects and variances are precomputed and frozen. Then, with new data sets, these are used in concert with information from the new arrays to normalize and summarize the data."

**Supporting Quotes**:
- (Introduction): "Katz and others (2006) proposed performing these tasks by running RMA on a reference database of biologically diverse samples. The resulting probe-effect estimates, φ̂, and the reference distribution used in the quantile normalization step were stored or 'frozen' for future use."

---

## C_92: fRMA is comparable to RMA when data are analyzed as a single batch and outperforms RMA when analyzing multiple batches

**Category**: Result  
**Source**: McCall2010 (Source ID: 40)  
**Context**: Demonstrates that reference-based approaches maintain quality while enabling flexibility.

**Primary Quote** (Abstract):
> "We find that fRMA is comparable to RMA when the data are analyzed as a single batch and outperforms RMA when analyzing multiple batches."

---

## C_93: Beta values for DNA methylation are bounded between 0 and 1 and approximately follow a beta distribution

**Category**: Method  
**Source**: Du2010 (Source ID: 34)  
**Context**: This necessitates transformation to M-values before applying standard batch correction.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_94: M-values (log2 ratio of methylated to unmethylated intensities) are approximately normally distributed and unbounded

**Category**: Method  
**Source**: Du2010 (Source ID: 34)  
**Context**: The M-value has better statistical properties for differential methylation analysis.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_95: The M-value is more statistically valid for differential analysis of methylation levels, while the beta-value has more intuitive biological interpretation

**Category**: Result  
**Source**: Du2010 (Source ID: 34)  
**Context**: Recommendation: use M-values for analysis, report beta-values for interpretation.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_96: Mass spectrometry-based proteomics data are inherently biased due to sample handling and instrumentation differences

**Category**: Challenge  
**Source**: Valikangas2018 (Source ID: 35)  
**Context**: Batch effects in proteomics manifest as systematic shifts in ionization efficiency and instrument sensitivity.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_97: Quantile normalization, median normalization, and variance stabilization normalization (VSN) are commonly used for proteomics data

**Category**: Method  
**Source**: Valikangas2018 (Source ID: 35)  
**Context**: The choice of normalization method significantly impacts downstream analysis results.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_98: No single normalization method performs best across all proteomics datasets

**Category**: Result  
**Source**: Valikangas2018 (Source ID: 35)  
**Context**: Systematic evaluation across multiple datasets reveals context-dependent performance.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_99: The Precision Medicine Initiative aims to enable prevention and treatment strategies that account for individual variability

**Category**: Impact  
**Source**: Collins2015 (Source ID: 36)  
**Context**: Launched in 2015 to accelerate biomedical discoveries and provide clinicians with new tools.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_100: Precision medicine requires integration of large-scale genomic data with clinical information

**Category**: Impact  
**Source**: Collins2015, Ginsburg2018 (Source IDs: 36, 37)  
**Context**: Data integration is fundamental to realizing the promise of precision medicine.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_101: Shortcut learning occurs when deep neural networks exploit spurious correlations in training data

**Category**: Phenomenon  
**Source**: Geirhos2020 (Source ID: 38)  
**Context**: Models learn decision rules based on easy-to-identify features rather than intended causal relationships.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_102: In genomic data, shortcut learning can cause models to encode batch identity as a primary latent dimension

**Category**: Phenomenon  
**Source**: Geirhos2020 (Source ID: 38)  
**Context**: This creates models that appear to learn rich representations but actually distinguish technical artifacts.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_103: Domain-adversarial training uses gradient reversal layers to learn features that are discriminative for the main task but indiscriminate with respect to domain shift

**Category**: Method  
**Source**: Ganin2016 (Source ID: 39)  
**Context**: Forces the network to learn batch-invariant representations through adversarial training.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## C_104: Gradient Reversal Layer (GRL) enables domain adaptation by reversing gradients during backpropagation

**Category**: Method  
**Source**: Ganin2016 (Source ID: 39)  
**Context**: This approach can be implemented with minimal modifications to standard neural network architectures.

**Primary Quote**:
> [Note: Quotes to be extracted from source.]

---

## Notes

- Claims with `[Note: Quotes to be extracted from source.]` indicate that full text extraction is in progress or quotes need to be added
- Primary quotes should be the most concise and representative evidence for hover tooltip display
- Supporting quotes provide additional context and can be viewed when expanding the full evidence section
- See `sources.md` for complete bibliographic information for all source IDs
