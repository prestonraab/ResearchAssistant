# Claims and Evidence: Method - Batch Correction

This file contains all **Method - Batch Correction** claims with their supporting evidence.

---

## C_01: ComBat uses Empirical Bayes to estimate location and scale parameters

**Category**: Method  
**Context**: Assumes Gaussian distribution.

**Primary Quote**:
> "ComBat [23], which employs an empirical Bayes approach to estimate a location and scale parameter for each gene in each batch separately, and adjusts the observed expression values based on the estimated parameters."


---


## C_02: ComBat-Seq preserves integer counts for RNA-Seq data

**Category**: Method  
**Context**: Uses Negative Binomial regression.

**Primary Quote**:
> "We developed a batch correction method, ComBat-seq, using a negative binomial regression model that retains the integer nature of count data in RNA-seq studies, making the batch adjusted data compatible with common differential expression software packages that require integer counts."


---


## C_03: Batch effects can substantially degrade classifier performance when applied to new batches

**Category**: Method  
**Context**: Classifiers may learn to distinguish batches rather than biological conditions.

**Primary Quote**:
> "the performance estimate obtained by the cross-validation is in fact far from the performance we can expect if we apply the classifier to an external data set, and thus rather misleading."


---


## C_04: Cross-validation within a single study may give optimistic performance estimates because classifiers can learn batch-specific patterns

**Category**: Method  
**Context**: Batch effects confound performance estimates.

**Primary Quote**:
> "the performance estimate obtained from the inner cross-validation is biased. It is an overoptimistic estimate of the actual performance of the classifier."


---


## C_05: Machine learning classifiers have demonstrated strong performance for gene expression classification tasks

**Category**: Method  
**Context**: Includes SVM, random forests, logistic regression, and neural networks.

**Primary Quote**:
> "Currently, several approaches that employed MLP or CNN networks in combination with efficient feature engineering and transfer learning techniques have achieved test accuracies upwards of 90%."


---


## C_06: For gene expression data, support vector machines, random forests, logistic regression with regularization, and neural networks show particular utility

**Category**: Method  
**Context**: Benchmark studies have identified algorithms that perform relatively well on gene expression data.

**Primary Quote**:
> "Later benchmark studies highlighted two types of algorithm-SVM and random forests-that performed relatively well on gene-expression data. Statnikov, et al. examined 22 datasets and specifically compared the predictive capability of these two algorithm types. Overall, they found that SVMs significantly outperformed random forests, although random forests outperformed SVMs in some cases."


---


## C_07: RNA-seq data are typically skewed and over-dispersed counts, making Gaussian assumptions inappropriate

**Category**: Method  
**Context**: Complicates batch correction methods that assume Gaussian distributions.

**Primary Quote**:
> "However in RNA-seq studies the data are typically skewed, over-dispersed counts, so this assumption is not appropriate and may lead to erroneous results."


---


## C_08: ComBat was originally developed for microarray data and has been successfully applied to RNA-seq data after appropriate transformation

**Category**: Method  
**Context**: Requires transformation for count data; has been applied to both single-cell and bulk RNA-seq.

**Primary Quote**:
> "ComBat was originally developed for microarray gene expression data [1], but had been successfully employed on scRNA-seq data [6]."


---


## C_09: For single-cell RNA sequencing data, methods such as Harmony, LIGER, and Seurat address unique challenges including sparsity and high dimensionality

**Category**: Method  
**Context**: Single-cell data has more severe batch effects than bulk RNA-seq due to technical characteristics.

**Primary Quote**:
> "scRNA-seq methods have lower RNA input, higher dropout rates, and a higher proportion of zero counts, low-abundance transcripts, and cell-to-cell variations than bulk RNA-seq. These factors make batch effects more severe in single-cell data than in bulk data."


---


## C_10: Alternative empirical Bayes models have been developed for adjusting batch effects in genomic studies

**Category**: Method  
**Context**: Includes methods for cases with reference batches.

**Primary Quote**:
> "Here we contribute multiple methods and software tools for improved combination and analysis of data from multiple batches. In particular, we provide batch effect solutions for cases where the severity of the batch effects is not extreme, and for cases where one high-quality batch can serve as a reference, such as the training set in a biomarker study."


---


## C_11: Surrogate Variable Analysis (SVA) identifies and adjusts for unknown, latent sources of variation in genomics data

**Category**: Method  
**Context**: Extracts surrogate variables from high-dimensional data to capture unwanted effects.

**Primary Quote**:
> "We introduce 'surrogate variable analysis' (SVA) to overcome the problems caused by heterogeneity in expression studies. SVA can be applied in conjunction with standard analysis techniques to accurately capture the relationship between expression and any modeled variables of interest."


---


## C_12: Harmony integrates single-cell datasets by removing batch effects while preserving biological structure through iterative batch-centroid correction in PC space

**Category**: Method  
**Context**: Fast and scalable, can handle ~1 million cells.

**Primary Quote**:
> "Harmony iteratively learns a cell-specific linear correction function. Harmony begins with a low-dimensional embedding of cells, such as principal components analysis (PCA), (Supplementary Note 1 and Methods). Using this embedding, Harmony first groups cells into multi-dataset clusters (Fig. 1a). We use soft clustering to assign cells to potentially multiple clusters, to account for smooth transitions between cell states."


---


## C_13: LIGER uses integrative non-negative matrix factorization (iNMF) to separate shared biological factors from dataset-specific technical factors

**Category**: Method  
**Context**: Performs well when batches have non-identical cell type compositions.

**Primary Quote**:
> "LIGER takes as input multiple single-cell datasets, which may be scRNA-seq experiments from different individuals, time points, or species-or measurements from different molecular modalities, such as single-cell epigenome data or spatial gene expression data (Figure 1A). LIGER then employs integrative non-negative matrix factorization (iNMF) (Yang and Michailidis, 2016) to learn a low-dimensional space in which each cell is defined by one set of dataset-specific factors, or metagenes, and another set of shared metagenes (Figure 1B)."


---


## C_14: Seurat v3 uses anchor-based integration with mutual nearest neighbors (MNNs) to correct batch effects while preserving cell-type structure

**Category**: Method  
**Context**: Uses CCA to project datasets into shared space before finding anchors.

**Primary Quote**:
> "Our integration strategy builds upon previous work in the application of CCA to identify shared sources of variation across experiments (Butler et al., 2018) and the concept of mutual nearest neighbors to identify biologically matched cells in a pair of datasets (Haghverdi et al., 2018). Furthermore, we leverage ideas from the construction of SNN graphs to score, identify, and downweight the contribution of inaccurate anchors to substantially increase integration robustness."


---


## C_15: BatchQC provides interactive software for evaluating sample and batch effects with PCA, heatmaps, dendrograms, and other diagnostics

**Category**: Method  
**Context**: Supports multiple batch correction methods including ComBat, ComBat-Seq, limma, and SVA.

**Primary Quote**:
> "We present a software pipeline, BatchQC, which addresses these issues using interactive visualizations and statistics that evaluate the impact of batch effects in a genomic dataset. BatchQC can also apply existing adjustment tools and allow users to evaluate their benefits interactively."


---


## C_16: Merging (batch correction + pooled analysis) identified more differentially expressed genes than meta-analysis approaches

**Category**: Method  
**Context**: Meta-analysis still found robust DEGs, choice depends on data availability and goals.

**Primary Quote**:
> "If we compare the final DEGs for the meta-analysis approach with the list obtained in the merging approach we can conclude that significantly more DEGs are identified through merging. Moreover, all 25 identified DEGs through meta-analysis are also identified in the merging approach."


---


## C_17: Classification performance for gene-expression data depends strongly on algorithm choice and performance metric

**Category**: Method  
**Context**: Number of samples and genes did not strongly correlate with classification performance.

**Primary Quote**:
> "The ability to classify patients based on gene-expression data varies by algorithm and performance metric"


---


## C_18: recount3 provides harmonized RNA-Seq expression summaries across thousands of experiments, enabling large-scale integrative analyses

**Category**: Method  
**Context**: Comprises over 750,000 individual sequencing runs from SRA, GTEx, and TCGA, enables cross-dataset comparisons.

**Primary Quote**:
> "We present recount3, a resource consisting of over 750,000 publicly available human and mouse RNA sequencing (RNA-seq) samples uniformly processed by our new Monorail analysis pipeline."


---


## C_19: A hybrid model integrating data mining and machine learning methods can evaluate proximity metrics in high-dimensional gene expression data for disease diagnosis

**Category**: Method  
**Context**: Focuses on selecting and evaluating proximity metrics for clustering and classification tasks.

**Primary Quote**:
> "This study presents the development and application of a hybrid model for evaluating proximity metrics in high-dimensional gene expression data, integrating data mining and machine learning methods within a comprehensive framework."


---


## C_20: Correlation distance, mutual information-based metrics, and Wasserstein distance are well-suited for gene expression analysis

**Category**: Method  
**Context**: Selected for their theoretical soundness and practical relevance in transcriptomics.

**Primary Quote**:
> "correlation, mutual information, and Wasserstein distance are well-suited for gene expression analysis. Correlation captures linear relationships and is widely used in co-expression networks. Mutual information captures non-linear dependencies, while Wasserstein distance compares entire distributions and is robust in high-dimensional spaces."


---


## C_23: A stacking model, with Random Forest base learners and a logistic regression meta-classifier, can enhance classification robustness

**Category**: Method  
**Context**: Hyperparameters optimized using Bayesian optimization.

**Primary Quote**:
> "A stacking model was implemented to enhance classification robustness, compensating for potential clustering errors and delivering consistent performance across varying metrics and cluster structures."


---


## C_24: The K-Medoids clustering algorithm is suitable for gene expression data analysis

**Category**: Method  
**Context**: Minimizes sum of distances between points and cluster medoids.

**Primary Quote**:
> "The key advantage of the K-Medoids algorithm is its ability to work with any distance measures, including non-Euclidean metrics such as mutual information-based distance, correlation distance, or Wasserstein distance. This is crucial when working with gene expression profiles, where Euclidean or Manhattan distances may not always be appropriate."


---


## C_26: Meta-analysis in gene expression studies combines results from independent but related datasets to increase statistical power

**Category**: Method  
**Context**: Aids in finding effects that exist and important subtle variations.

**Primary Quote**:
> "Meta-analysis refers to an integrative data analysis method that traditionally is defined as a synthesis or at times review of results from datasets that are independent but related. Meta-analysis has ranging benefits. Power can be added to an analysis, obtained by the increase in sample size of the study. This aids the ability of the analysis to find effects that exist"


---


## C_29: Meta-analysis methods can be categorized into 'relative' and 'absolute' approaches

**Category**: Method  
**Context**: 'Relative' methods include Fisher's inverse chi-square, GeneMeta, and RankProd; 'absolute' methods are exemplified by the 'simple' meta method.

**Primary Quote**:
> "It is possible to consider meta-analysis at two levels, 'relative' and 'absolute' meta-analysis. 'Relative' metaanalysis looks at how genes or features correlate to a phenotype within a dataset. Multiple datasets are either aggregated or compared to obtain features which are commonly considered important. Meta-methods pertaining to this method include Fisher's inverse chisquare, GeneMeta, RankProd and the 'dataset cross-validation' meta. 'Absolute' meta-analysis seeks to combine the raw or transformed data from multiple experiments. By increasing the number of samples used, the statistical power of a test is increased. Traditional microarray analysis tools are then used on these larger datasets. The 'simple' meta method is an example of 'absolute' metaanalysis approach."


---


## C_30: Fisher's inverse chi-square method combines p-values from independent datasets

**Category**: Method  
**Context**: Tests the null hypothesis of no differences in expression means between groups for a given gene.

**Primary Quote**:
> "Fisher, in the 1930s developed a meta-analysis method that combines the p-values from independent datasets. One of a plethora of methods for combining the p-values, is the Fisher summary statistic, which tests the null hypothesis that for gene i, there is no differences in expression means between the two groups."


---


## C_32: GEO generates consistently computed gene expression count matrices for thousands of RNA-seq studies

**Category**: Method  
**Context**: Uses HISAT2 and featureCounts pipeline; matrices for over 23,000 studies available.

**Primary Quote**:
> "RNA-seq Counts Pipeline (described at https://www.ncbi.nlm.nih.gov/geo/info/rnaseqcounts.html) is a cloud-based bioinformatic analysis method based on HISAT2 and featureCounts implemented for processing public bulk RNA-seq reads into consistently computed expression counts. GEO has further processed the raw counts generated by SRA and transformed them into raw and normalized study-centric matrix counts files that are interoperable with common differential gene expression analysis tools, thereby expanding data re-use potential."


---


## C_37: Surrogate Variable Analysis (SVA) is a method to identify, estimate, and utilize components of expression heterogeneity

**Category**: Method  
**Context**: Can be applied in conjunction with standard analysis techniques to accurately capture the relationship between expression and any modeled variables of interest.

**Primary Quote**:
> "We introduce 'surrogate variable analysis' (SVA) to overcome the problems caused by heterogeneity in expression studies. SVA can be applied in conjunction with standard analysis techniques to accurately capture the relationship between expression and any modeled variables of interest."


---


## C_40: SVA improves the accuracy and stability of gene ranking for differential expression

**Category**: Method  
**Context**: Achieved by adjusting for surrogate variables that capture unmodeled factors, reducing spurious differential expression.

**Primary Quote**:
> "Perhaps most importantly, SVA also results in a more powerful and reproducible ranking of genes for differential expression. SVA-adjusted analyses provide gene rankings comparable to the scenario where there is no heterogeneity, whereas an unadjusted analysis allows for incorrect and highly variable gene rankings."


---


## C_45: Domain adaptation (DA), a subfield of transfer learning, addresses the problem of models not generalizing across datasets

**Category**: Method  
**Context**: Alleviates issues caused by technical and biological differences between datasets.

**Primary Quote**:
> "Domain adaptation, a type of transfer learning, alleviates this problem by aligning different datasets so that models can be applied across them."


---


## C_75: Random forests provide feature importance measures that can identify key predictive genes in gene expression classification tasks

**Category**: Method  
**Context**: Variable importance measures have been suggested as screening tools for gene expression studies.

**Primary Quote**:
> "random forest is a classification algorithm well suited for microarray data: it shows excellent performance even when most predictive variables are noise, can be used when the number of variables is much larger than the number of observations and in problems involving more than two classes, and returns measures of variable importance."


---


## C_76: Logistic regression with L1 regularization (lasso) performs automatic feature selection

**Category**: Method  
**Context**: L1 penalty enables sparse solutions suitable for high-dimensional gene expression data.

**Primary Quote**:
> "Due to the nature of the L1-penalty, the lasso does both continuous shrinkage and automatic variable selection simultaneously."


---


## C_77: Support vector machines can identify support vectors that define decision boundaries

**Category**: Method  
**Context**: SVMs are well-suited for high-dimensional problems where the number of features exceeds the number of samples.

**Primary Quote**:
> "A particularity of SVMs is that the weights w i of the decision function D ( x ) are a function only of a small subset of the training examples, called 'support vectors'. Those are the examples that are closest to the decision boundary and lie on the margin."


---


## C_79: Elastic net combines L1 (lasso) and L2 (ridge) regularization penalties to perform both variable selection and regularization

**Category**: Method  
**Context**: Particularly useful when the number of predictors (p) is much larger than the number of observations (n).

**Primary Quote**:
> "We call the function (1-α)|β|₁ + α|β|₂ the elastic net penalty, which is a convex combination of the lasso and ridge penalty. When α = 1, the naïve elastic net becomes simple ridge regression."


---


## C_80: Elastic net encourages a grouping effect, where strongly correlated predictors tend to be in or out of the model together

**Category**: Method  
**Context**: Addresses limitations of lasso in the p >> n case.

**Primary Quote**:
> "In addition, the elastic net encourages a grouping effect, where strongly correlated predictors tend to be in or out of the model together."


---


## C_81: XGBoost is a scalable end-to-end tree boosting system that uses a novel sparsity-aware algorithm for sparse data

**Category**: Method  
**Context**: Widely used by data scientists to achieve state-of-the-art results on machine learning challenges.

**Primary Quote**:
> "Tree boosting is a highly effective and widely used machine learning method. In this paper, we describe a scalable end-to-end tree boosting system called XGBoost, which is used widely by data scientists to achieve state-of-the-art results on many machine learning challenges. We propose a novel sparsity-aware algorithm for sparse data"


---


## C_82: XGBoost provides insights on cache access patterns, data compression, and sharding to build scalable tree boosting systems

**Category**: Method  
**Context**: Enables efficient handling of large-scale datasets.

**Primary Quote**:
> "More importantly, we provide insights on cache access patterns, data compression and sharding to build a scalable tree boosting system. By combining these insights, XGBoost scales beyond billions of examples using far fewer resources than existing systems."


---


## C_83: Random forests are a combination of tree predictors where each tree depends on values of a random vector sampled independently

**Category**: Method  
**Context**: The generalization error converges as the number of trees increases.

**Primary Quote**:
> "Random forests are a combination of tree predictors such that each tree depends on the values of a random vector sampled independently and with the same distribution for all trees in the forest. The generalization error for forests converges a.s. to a limit as the number of trees in the forest becomes large."


---


## C_84: Random forests provide robustness to noise and can handle high-dimensional data where the number of features exceeds the number of samples

**Category**: Method  
**Context**: Ensemble approach aggregates predictions across multiple trees.

**Primary Quote**:
> "Using a random selection of features to split each node yields error rates that compare favorably to Adaboost (Y. Freund & R. Schapire, Machine Learning: Proceedings of the Thirteenth International conference, ***, 148-156), but are more robust with respect to noise."


---


## C_85: Support vector machines with recursive feature elimination (SVM-RFE) can perform gene selection for cancer classification

**Category**: Method  
**Context**: Genes selected by SVM-RFE yield better classification performance and are biologically relevant to cancer.

**Primary Quote**:
> "Using available training examples from cancer and normal patients, we build a classifier suitable for genetic diagnosis, as well as drug discovery. Previous attempts to address this problem select genes with correlation techniques. We propose a new method of gene selection utilizing Support Vector Machine methods based on Recursive Feature Elimination (RFE). We demonstrate experimentally that the genes selected by our techniques yield better classification performance and are biologically relevant to cancer."


---


## C_86: SVMs are particularly effective for high-dimensional gene expression data where the number of features often exceeds the number of samples

**Category**: Method  
**Context**: The kernel trick allows SVMs to capture non-linear relationships.

**Primary Quote**:
> "This application also illustrates new aspects of the applicability of Support Vector Machines (SVMs) in knowledge discovery and data mining. SVMs were already known as a tool that discovers informative patterns (Guyon, 1996). The present application demonstrates that SVMs are also very effective for discovering informative features or attributes (such as critically important genes). In a comparison with several other gene selection methods on Colon cancer data (Alon, 1999) we demonstrate that SVMs have both quantitative and qualitative advantages."


---


## C_88: Deep learning requires sufficient data to achieve superior performance on gene expression classification tasks

**Category**: Method  
**Context**: The n << p property (few samples, many features) has historically prevented effective use of deep learning for gene expression data.

**Primary Quote**:
> "We show that neural networks outperform the state-of-the-art methods only for very large training set size. For a small training set, we show that transfer learning is possible and may strongly improve the model performance in some cases."


---


## C_89: Frozen RMA (fRMA) allows microarrays to be analyzed individually or in small batches

**Category**: Method  
**Context**: Addresses the clinical need to process samples individually without requiring a batch.

**Primary Quote**:
> "We propose a preprocessing algorithm, frozen RMA (fRMA), which allows one to analyze microarrays individually or in small batches and then combine the data for analysis. This is accomplished by utilizing information from the large publicly available microarray databases."


---


## C_91: Reference-based normalization adjusts a single sample against a pre-computed reference distribution from training data

**Category**: Method  
**Context**: Critical for clinical deployment where each patient sample may constitute its own "batch."

**Primary Quote**:
> "In particular, estimates of probe-specific effects and variances are precomputed and frozen. Then, with new data sets, these are used in concert with information from the new arrays to normalize and summarize the data."


---


## C_93: Beta values for DNA methylation are bounded between 0 and 1 but violate Gaussian distribution assumptions

**Category**: Method  
**Context**: This necessitates transformation to M-values before applying standard batch correction.

**Primary Quote**:
> "The Beta-value range is from 0 and 1 and can be interpreted as an approximation of the percentage of methlyation. However, because the Beta-value has a bounded range, this statistic violates the Gaussian distribution assumption used by many statistical methods, including the very prevalent t-test."


---


## C_94: M-values (log2 ratio of methylated to unmethylated intensities) have better statistical properties for differential methylation analysis

**Category**: Method  
**Context**: M-values are more statistically valid than Beta-values for parametric tests.

**Primary Quote**:
> "the M-value is more statistically valid for the differential analysis of methylation levels"


---


## C_95: For DNA methylation analysis, M-values should be used for statistical testing while beta-values should be reported for biological interpretation

**Category**: Method  
**Context**: This recommendation balances statistical validity with interpretability in methylation studies.

**Primary Quote**:
> "The Beta-value has a more intuitive biological interpretation, but the M-value is more statistically valid for the differential analysis of methylation levels. Therefore, we recommend using the M-value method for conducting differential methylation analysis and including the Beta-value statistics when reporting the results to investigators."


---


## C_97: Quantile normalization, median normalization, and variance stabilization normalization (VSN) are commonly used for proteomics data

**Category**: Method  
**Context**: Many normalization methods commonly used in proteomics have been adapted from DNA microarray techniques. The choice of normalization method significantly impacts downstream analysis results.

**Primary Quote**:
> "Their tool includes several popular normalization methods such as linear regression, local regression, total intensity, average intensity, median intensity, variance stabilization normalization (Vsn) and quantile normalization, together with several frequently used evaluation measures used to assess the performance of a normalization method such as the pooled coefficient of variation (PCV), the pooled median absolute deviation (PMAD) and the pooled estimate of variance (PEV)"


---


