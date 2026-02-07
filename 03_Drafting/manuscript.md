## Precision Medicine Using Data From Multiple Studies

> [!question]- How much data does prescision medicine require? (status:: undefined)
> Precision medicine relies on accurate predictions for patients across the spectrum of human diversity. This diversity is best captured and accounted for using large datasets acquired at great cost. [source:: C_1770304648471, C_100]

> [!question]- How can dataset size be increased? (status:: undefined)
> Adding data from independent cohorts has the potential to improve dataset diversity, statistical power, and information via the increase in sample size. These benefits convey to learners increased ability to detect patterns and generalize to new data.

> [!question]- What is the central challenge to combining datasets? (status:: undefined)
> This potential is frequently undermined by "batch effects"—systematic technical variations that can lead a learner to distinguish between experimental batches rather than meaningful biological conditions. Batch effects can substantially degrade predictor performance when applied to new individuals.

> [!question]- What is the chapter's scope in addressing these challenges? (status:: undefined)
> This chapter examines how batch effects impact predictor performance and explores statistical adjustment methods designed to mitigate these artifacts while preserving biological signal.

> [!question]- Leftover sentences: (status:: undefined)
> Using external data is also helpful when validation across independent cohorts is needed.



## Classification in Precision Medicine

> [!question]- To what extent is classification relevant to precision medicine, and what is it? (status:: undefined)
> Classification—the task of assigning observations to predefined categories based on their features—is vital to biomedical research and the implementation of precision medicine.

> [!question]- Why is classification useful for biomedical tasks? (status:: undefined)
> For instance, machine learning classifiers have demonstrated strong performance for cancer classification tasks using gene expression data, even being approved and implemented clinically to predict personalized recurrence risk for breast cancer and guide chemotherapy decisions. [source:: C_05, C_1770403547313(Buus2021)]

> [!question]- What are some specific examples of clinically used classifiers? (status:: undefined)
> This includes several multi-gene prognostic signatures  [source:: C_1770403547313(Buus2021)]



## Batch Effect Sources Across Data Types

> [!question]- What data is used for biomedical classification? (status:: undefined)
> Biomedical classification tasks are not limited to gene expression, but can utilize diverse data types, including protein abundance measurements, genomic sequences, clinical variables, and imaging data. Each of these data modalities provides complementary information about biological systems and disease mechanisms. [source:: C_05]

> [!question]- How do batch effects sources vary by data type? (status:: undefined)
> No modality is immune to batch effects, though many clinical variables (height, etc.) are resilient. Batch effects arise from differences in experimental protocols, equipment type and condition, reagent lots, environmental conditions, and other technical factors that vary between studies or even within studies over time. [source:: C_01, C_02]

> [!question]- What type of data will this chapter focus on? (status:: undefined)
> For our purposes, and without loss of generality, we will focus on RNA sequencing (RNA-seq) data, which has become the dominant technology for measuring gene expression. [source:: C_31]

> [!question]- Why gene expression? (status:: undefined)
> Gene expression data provide an excellent context for understanding how batch effects can be modeled and removed, as the technical variation introduced by sequencing technologies is well-characterized and substantial. Insights from gene expression are extensible to other modalities. [source:: C_07]



## Focus on Gene Expression Data

> [!question]- How are gene expression data generated and used within biological/biomedical research? (status:: undefined)
> Gene expression data are generated through high-throughput sequencing technologies that quantify the abundance of RNA transcripts in biological samples. These measurements provide a snapshot of cellular activity, reflecting which genes are actively transcribed under specific conditions, disease states, or in response to treatments. Gene expression data enable the identification of disease-associated pathways, the discovery of therapeutic targets, and the development of diagnostic and prognostic biomarkers. [source:: C_02]

> [!question]- How can researchers access gene expression data? (status:: undefined)
> The Gene Expression Omnibus (GEO) serves as a critical international public repository for such data, with over 200,000 studies and 6.5 million samples. For each molecular sample, data submitters also provide relevant clinical variables, enabling association between the variables [source:: C_31]

> [!question]- How is public gene expression data used? (status:: undefined)
> Due to the ease of access, GEO data is widely reused for diverse applications, including identifying novel gene expression patterns, finding disease predictors, and developing computational methods. [source:: C_35]

> [!question]- Why integrate gene expression datasets? (status:: undefined)
> Integrating gene expression data across multiple studies offers substantial benefits over single-study analysis: increased sample sizes improve the robustness of classifiers, independent validation cohorts provide evidence of generalizability, and meta-analyses can reveal consistent patterns across diverse populations.

> [!question]- How sensitive is gene expression to batch effects? (status:: undefined)
> However, batch effects pose particular challenges for gene expression data due to the sensitivity of sequencing technologies to technical variation. These technical artifacts can be substantial—often comparable to or larger than the biological signals of interest—making them a primary concern when combining datasets. [source:: C_07]

> [!question]- What specific effects do batches have on gene expression? (status:: undefined)
> Batch effects manifest in gene expression data as systematic shifts in expression levels between batches, differences in variance structure, and alterations in the relationships between genes. [source:: C_07]

> [!question]- What about changes to distributional shape? When might this arise? (status:: undefined)
> Batch effects can also manifest as changes in distributional shape for features shared between datasets. For gene expression data, this difficulty arises if a researcher wants to combine RNA-seq data and gene expression measured using microarrays, an older technology. Microarray measurements of  expression for a gene tend to be bell shaped, or normally distributed, taking on continuous values. RNA-seq measurements are discrete counts, with a  heavily right-skewed distribution.



## Adjusters for Gene Expression

> [!question]- What are adjusters? (status:: DRAFT)
> Statistical adjustment methods, commonly referred to as adjusters or batch correction methods, aim to remove technical variation while preserving biological signal. The balance between these objectives varies across methods and contexts.

> [!question]- How do adjusters work? (status:: undefined)
> Adjusters work by modeling and removing systematic technical variation introduced by batch effects, thereby improving the ability of downstream classifiers to distinguish true biological differences without influence from technical artifacts. These methods operate under the assumption that the underlying biological signal is consistent across batches, and that technical variation can be separated from biological variation.

> [!question]- How can gene expression measurements be categorized? (status:: undefined)
> The effectiveness of adjusters depends on the data type. For instance, gene expression measurements can be categorized into those which measure the bulk gene expression in a large sample, and those which measure the gene expression for thousands of individual cells.

> [!question]- How does Combat adjust bulk data? (status:: undefined)
> For bulk data, a common adjusting approach is ComBat, developed in 2007. Combat adjusts for batch effects by modeling batch-specific shifts and scaling factors for each gene.  The transformation that Combat applies is linear: each expression value for a particular gene is shifted and scaled the same as each other expression value for that gene. While the transformation acts on each gene seperately, the calculation of the correct transformation uses statistics across all genes to mitigate the effects of outliers. This transformation works well for bulk gene expression data, which varies continuously due to the continuous proportions of cell types represented in the sample. [source:: C_01]

> [!question]- What is used to adjust single cell data? (status:: undefined)
> Single cell data requires a different kind of adjustment. Single cell gene expression is characterized by distinct expression signatures for each cell type, with internal variation caused by various cell states at measurement time.  If bulk data is a continent of continuous variation, single cell data occupies islands of specialized differentiation.

> [!question]- How is single cell data adjusted? (status:: undefined)
> Single cell adjusters may assume that samples of similar cell types will exhibit similar expression patterns, even in the presence of batch effects. By finding "nearerst neighbors", or the samples that have the most similar expression between batches, adjusters such as Harmony and Seurat can identify how to move cross-batch neighbors closer together to bring the batches into alignment. Since neighbors are found using many genes, and the transformation is sample-specific, the adjustment of single cell data is typically nonlinear.



## Confounding

> [!question]- What is confounding? (status:: undefined)
> Batch effects can mimic or mask real differences in expression levels and covariance structures between batches. Not all differences between datasets are due to technical artifacts; not all differences should be removed. For example, two studies might have the same split of positive and negative cases, but different proportions of females. It might be difficult to determine whether the differences in gene expression between batches are technical artifacts that should be removed, or true differences due to the sex imbalance between datasets. We might say that the batch effect is "confounded" with sex—the effect of the batch on gene expression is somewhat tied up with the effect of the sex imbalance.

> [!question]- How can confounding be resolved? (status:: undefined)
> Confounding can often be removed if the values of the confounding variables are known.

> [!question]- How specifically does Combat account for confounding? (status:: undefined)
> Combat, when provided with additional metadata for each sample, can temporarily remove the associations between the metadata and the gene expression, remove the remaining batch effects, then add back the metadata associations.

> [!question]- When is confounding difficult to overcome? (status:: undefined)
> However, if these other variables are not known, due to poor recording or unknown population differences, correcting for confounding can be more difficult.

> [!question]- How can dataset differences be preserved? (status:: undefined)
> Some methods, like LIGER, have been developed to deal with this problem. LIGER uses matrix factorization of single cell data to identify shared and dataset-specific features of cell identity. Once differences are identified, they can be preserved, minimizing false alignment of the datasets.

> [!question]- How to deal with unknown batches? (status:: undefined)
> A separate but related problem occurs when the batches are not known. Methods such as surrogate variable analysis (SVA) can identify and adjust for unknown batch effects by extracting surrogate variables that capture unwanted effects.

> [!question]- Why does batch effect mitigation matter clinically? (status:: undefined)
> Batch effects must by identified and accounted for. If batch effects go undetected, predictors developed for clinical outcomes may produce results that are more variable than expected, resulting in lower-than-expected classification rates that might put patients at risk. Even modest drops in classifier performance due to batch effects can mean the difference between accurate diagnosis and misclassification.

> [!question]- Transition (status:: DRAFT)
> To understand the effects of adjustment on classification, we will first describe the landscape of modern classification.



## Extras

> [!question]- How important is single-patient data? (status:: DRAFT)
> Single-patient data processing is vital to the translation of molecular assays, as patient samples in clinical settings are typically collected in small numbers, often one at a time, making batch effect correction essential for clinical translation. However, many correction techniques rely on several samples to characterize the distribution of the new batch.



## Machine Learning Classifiers for Gene Expression Data

> [!question]- ML, traditional, broad strokes, direction of field in usage (status:: undefined)
> Classification has evolved from traditional statistical methods (logistic regression, linear discriminant analysis) toward modern machine learning approaches (support vector machines, random forests, neural networks). The direction increasingly favors flexible methods that can capture complex, non-linear patterns in high-dimensional data. Modern techniques often use iterative and random (stochastic) training, improving the model in small steps to classify the training data correctly.[source:: C_05]

> [!question]- Compare stats and ML models (status:: DRAFT)
> Simpler, rigid models use strong assumptions about how the inputs relate to the labels. This bias provides protection against variable data: the predicted model is not likely to change much in response to small changes in the data. More complex machine learning models are less constrained, which can lead to highly variable models. Many machine learning algorithms use some form of regularization, or assumptions of simple relationships that help to constrain the models. This can improve generalization, or the ability to classify unseen data.



## Classifier Architectures

> [!question]- What specific classifiers do well with gene expression? (status:: undefined)
> For gene expression data specifically, benchmark studies have identified several classifier types that perform particularly well: support vector machines (SVM) and random forests have been highlighted as top performers. Logistic regression with regularization (elastic net, lasso, ridge) and neural networks (when sufficient data are available) also show strong performance. XGBoost, a tree-based algorithm with strong performance on many datasets, can also be used. Each classifier type has distinct characteristics that make it suitable for different scenarios and data types. [source:: C_06(Piccolo2022)]



## Regularized Linear Models

> [!question]- What is the key insight about regularization? (status:: undefined)
> Built-in regularization is vital for high-dimensional gene expression data; without it, simpler models like standard logistic regression succumb to technical noise in batch-affected datasets.

> [!question]- How should elastic net be described for genomics? (status:: undefined)
> Elastic net is particularly well-suited to the $p \gg n$ problem characteristic of gene expression data, where thousands of genes (features) vastly outnumber samples. By combining L1 and L2 regularization, elastic net simultaneously performs feature selection (identifying which genes matter) and shrinkage (preventing overfitting to noise). The L1 penalty drives coefficients of irrelevant genes to exactly zero, creating sparse models that are interpretable and computationally efficient. The L2 penalty encourages a grouping effect where correlated genes—common in biological pathways—tend to be selected or excluded together, preserving biological coherence. This dual regularization is particularly effective at ignoring technical noise from batch effects while retaining biological signal, as demonstrated by elastic net's superior performance across adjustment methods in our results. [source:: C_79]

> [!question]- Explain each type of classifier (status:: undefined)
> Logistic regression without regularization struggles in the $p \gg n$ regime because it attempts to fit a coefficient for every gene, leading to overfitting and instability. When combined with regularization techniques such as L1 (lasso) or L2 (ridge) penalties, logistic regression becomes viable for gene expression data by constraining the solution space and preventing overfitting. The L1 penalty (lasso) performs automatic feature selection by driving coefficients to exactly zero, while the L2 penalty (ridge) shrinks coefficients toward zero without eliminating them.



## Ensemble Methods

> [!question]- What is the key characteristic of ensemble methods for genomics? (status:: undefined)
> Ensemble methods are robust to the high-dimensional, noisy nature of gene expression data because they aggregate predictions across multiple models, each trained on different subsets of samples and features. This averaging effect reduces sensitivity to outliers and technical artifacts, including batch effects. Random forests construct ensembles of decision trees, where each tree is trained on a bootstrap sample of the data and a random subset of features. For gene expression data, this means each tree sees a different combination of genes and samples, preventing any single technical artifact from dominating the model. The final prediction aggregates votes across all trees, providing robustness to noise and the ability to capture complex interactions between genes. Random forests also provide measures of feature importance, which can aid in biological interpretation by identifying which genes contribute most to classification decisions. [source:: C_84]

> [!question]- How should XGBoost be described? (status:: undefined)
> XGBoost, a gradient boosting implementation, builds trees sequentially to correct errors from previous iterations, often achieving excellent performance on structured data. The method uses a sparsity-aware algorithm for sparse data and provides efficient handling of large-scale datasets through optimized cache access patterns and data compression. [source:: C_81]



## Non-linear Geometric Models

> [!question]- What distinguishes geometric models in the genomic context? (status:: undefined)
> These models identify decision boundaries in high-dimensional gene expression space using geometric principles. For gene expression data, where biological classes may not be linearly separable due to complex regulatory networks and pathway interactions, the ability to learn non-linear boundaries is crucial. Support vector machines identify optimal decision boundaries by finding hyperplanes that maximize the margin between classes. SVMs are particularly effective for the $p \gg n$ problem in gene expression data because they focus on support vectors—the most informative samples near the decision boundary—rather than attempting to model all samples equally. The kernel trick allows SVMs to implicitly map gene expression profiles into higher-dimensional spaces where complex, non-linear biological patterns become linearly separable, making them versatile for diverse biological patterns (Guyon 2002). Neural networks, including multi-layer perceptrons and more sophisticated architectures, can achieve excellent performance when sufficient data are available. For gene expression data, neural networks can learn hierarchical representations where early layers capture individual gene patterns and deeper layers integrate these into pathway-level or systems-level features. Neural networks outperform other methods only when training set sizes are very large, as the high-dimensional nature of gene expression data (many features, few samples) has historically limited deep learning effectiveness. Deep learning approaches have shown particular promise for identifying complex, non-linear patterns in gene expression data that may be missed by simpler methods. [source:: C_86]

> [!question]- Very general way, the kinds of genomics data that they are useful for (status:: undefined)
> These classifiers are useful across various types of genomics data beyond gene expression, including DNA methylation profiles, copy number variations, and protein expression data, though the specific characteristics of each data type may favor certain classifier types.

> [!question]- The importance of algorithm and metric selection (status:: undefined)
> Piccolo et al. (2022) demonstrated that classification performance for gene-expression data varies substantially by algorithm and performance metric. Critically, the performance rankings differed considerably depending on which evaluation metric was used, and conclusions drawn from benchmark comparisons depend heavily on which metrics are considered important. Surprisingly, the number of samples and genes did not strongly correlate with classification performance, suggesting that data quality and appropriate method selection matter more than raw dataset size. Hyperparameter tuning substantially affects performance, emphasizing that fair comparisons require consistent optimization across methods. This finding underscores the importance of: (1) testing multiple algorithms rather than relying on a single approach, (2) evaluating performance using multiple complementary metrics (accuracy, MCC, AUC, etc.), and (3) conducting proper hyperparameter optimization for each method. [source:: C_17]



## The Role of Data Scale

> [!question]- How should data scale be discussed? (status:: undefined)
> Transition from classifier architectures to the role of data scale, particularly for neural networks.

> [!question]- Neural Net if you have enough data, which sometimes happens (some kinds of genomics data) (status:: undefined)
> Neural networks can achieve excellent performance when sufficient data are available, though they outperform other methods only when training set sizes are very large. For genomics data, this requirement is sometimes met, for example, when combining all available data from public repositories like the Gene Expression Omnibus (GEO), which contains millions of samples across thousands of studies. The availability of consistently computed RNA-seq count matrices from resources like GEO facilitates the application of deep learning approaches that can identify complex, non-linear patterns in large-scale gene expression data. [source:: C_87]

> [!question]- Such as all of Geo (Jeff Leeks) or > 1000 (status:: undefined)
> This is addressed by the previous point. [source:: C_31, C_32]



## Batch Correction Methods

> [!question]- How should the adjusters section be framed? (status:: undefined)
> Frame batch correction as a principled approach to removing technical variation while preserving biological signal, with gene expression providing an excellent exemplar system.

> [!question]- Gene expression gives us an excellent insight into how batch effects can be modeled and removed. (status:: undefined)
> Gene expression data provide an excellent context for understanding how batch effects can be modeled and removed, as the technical variation introduced by sequencing technologies is well-characterized and substantial. The sensitivity of sequencing technologies to technical variation makes batch effects particularly pronounced in gene expression data. [source:: C_07]



## A Taxonomy of Batch Correction Methods

> [!question]- How can batch correction methods be categorized? (status:: undefined)
> Batch correction methods can be organized into three main categories based on their underlying approach: Scale/Location methods, Matrix Factorization methods, and Nearest Neighbor methods. **Scale/Location Methods** adjust the mean (location) and variance (scale) of features across batches, assuming batch effects manifest as systematic shifts in these parameters. ComBat and its variants (ComBat-Seq, ComBat with mean-only adjustment) exemplify this approach, using Empirical Bayes methods to estimate and remove batch-specific location and scale parameters. These methods work well when batch effects primarily affect the first two moments of the distribution. **Matrix Factorization Methods** decompose the data into biological and technical components, attempting to separate signal from noise through dimensionality reduction. Methods like LIGER use non-negative matrix factorization to identify shared biological factors while isolating dataset-specific technical factors. Surrogate Variable Analysis (SVA) also falls into this category, extracting latent variables that capture unwanted variation. These methods are particularly useful when batch effects are complex and cannot be adequately modeled by simple location/scale adjustments. **Nearest Neighbor Methods** identify corresponding samples or features across batches and use these correspondences to align datasets. MNN and FastMNN exemplify this approach, finding mutual nearest neighbors between batches and using these anchors to correct batch effects. While effective for single-cell data with discrete cell populations, these methods struggle with the continuous variation characteristic of bulk RNA-seq data, as demonstrated by our results.



## The ComBat Framework

> [!question]- The ComBat model works well for bulk RNA. (status:: undefined)
> The ComBat model works particularly well for bulk RNA sequencing data, where it has become a standard method for batch correction (Johnson2007). ComBat uses Empirical Bayes methods to estimate location and scale parameters for each batch, borrowing information across genes when estimating batch effects—making it robust even when the number of samples per batch is small (Johnson2007). This approach assumes the data follow a Gaussian distribution, which is appropriate for log-transformed expression values but problematic for raw count data.

> [!question]- Where else does ComBat work well? (status:: undefined)
> ComBat was originally developed for microarray data and has been successfully applied to RNA-seq data, including both single-cell and bulk RNA-seq (Johnson2007). However, RNA-seq count data are typically skewed and over-dispersed, violating the Gaussian assumptions of standard ComBat (Zhang2020). Practitioners frequently apply ComBat to log-transformed data to approximate normality, though this transformation can stabilize variance at the cost of distorting the underlying count structure. ComBat-Seq addresses this limitation by modeling the data directly via a negative binomial distribution, preserving the integer nature of count data and making the batch-adjusted data compatible with differential expression software that requires integer counts (Zhang2020). This makes ComBat-Seq a more principled approach for modern RNA-seq pipelines.

> [!question]- Why learn about ComBat? (status:: undefined)
> Beyond its effectiveness for bulk RNA data, ComBat exemplifies the Empirical Bayes approach to batch correction, which has influenced the development of many subsequent methods (Johnson2007; Zhang2018). Understanding ComBat provides insight into the general principles of batch correction: identifying systematic technical variation, estimating its magnitude, and removing it while preserving biological signal. The location/scale adjustment framework pioneered by ComBat remains foundational across many batch correction methods.



## Methods for Other Modalities

> [!question]- In other modalities, what other techniques are used? (status:: undefined)
> For single-cell RNA sequencing data, methods such as Harmony, LIGER, and Seurat have been developed to address the unique challenges of single-cell data, including sparsity, high dimensionality, higher dropout rates, and the need to preserve cell type identity. Single-cell data suffers from more severe batch effects than bulk RNA-seq due to lower RNA input, higher dropout rates, and greater cell-to-cell variation. Harmony integrates single-cell datasets by removing batch effects while preserving biological structure through iterative batch-centroid correction in PC space, and is fast and scalable. LIGER uses integrative non-negative matrix factorization (iNMF) to separate shared biological factors from dataset-specific technical factors, performing well when batches have non-identical cell type compositions. Seurat v3 uses anchor-based integration with mutual nearest neighbors (MNNs) to correct batch effects while preserving cell-type structure. However, these methods were developed specifically for single-cell RNA sequencing data and are not appropriate for bulk RNA-seq data, where samples represent continuous mixtures of cell types rather than discrete cell populations. [source:: C_09, C_12, C_13, C_14]



## The Failure of Mutual Nearest Neighbors for Bulk RNA-Seq

> [!question]- We will explore the use of MNN for bulk RNA, and show it doesn't work well. (status:: undefined)
> The analysis included both MNN (mutual nearest neighbors) and FastMNN as batch correction methods for bulk RNA-seq data. FastMNN showed consistently poor performance across all classifiers, with mean MCC differences from baseline ranging from -0.148 (XGBoost) to -0.441 (shrinkage LDA), all highly significant ($p < 10^{-5}$). Standard MNN also showed significant performance decreases, though less severe than FastMNN, with mean differences ranging from -0.114 (KNN) to -0.281 (shrinkage LDA). These results suggest that mutual nearest neighbor-based correction methods, while effective for discrete cell populations in single-cell data, may disrupt continuous biological variation patterns in bulk RNA-seq data.

> [!question]- Why does MNN fail for bulk RNA-seq? The "Islands vs. Continent" Problem (status:: undefined)
> MNN was designed for single-cell data where discrete cell populations exist as "islands"—distinct cell types with clear boundaries in expression space (Stuart 2019). The method works by finding mutual nearest neighbors between these islands across batches, assuming that the same cell types exist in both datasets (Stuart 2019). Bulk RNA-seq data, in contrast, represent a "continent"—continuous variation across samples with no discrete boundaries. Each bulk sample is an aggregate of multiple cell types, creating a smooth gradient of expression rather than distinct clusters. When MNN attempts to find "nearest neighbors" in this continuous space, it creates artificial discontinuities by forcing samples into discrete correspondence, disrupting the biological gradients that classifiers need to learn. This fundamental mismatch between the method's assumptions (discrete populations) and the data structure (continuous variation) explains why MNN-based approaches consistently degrade classifier performance on bulk RNA-seq data.



## The Link Between Adjustment and Classifier Performance

> [!question]- We will explore the use of MNN for bulk RNA, and show it doesn't work well. (status:: undefined)
> The analysis included both MNN (mutual nearest neighbors) and FastMNN as batch correction methods for bulk RNA-seq data. FastMNN showed consistently poor performance across all classifiers, with mean MCC differences from baseline ranging from -0.148 (XGBoost) to -0.441 (shrinkage LDA), all highly significant ($p < 10^{-5}$). Standard MNN also showed significant performance decreases, though less severe than FastMNN, with mean differences ranging from -0.114 (KNN) to -0.281 (shrinkage LDA). These results suggest that mutual nearest neighbor-based correction methods, while effective for discrete cell populations in single-cell data, may disrupt continuous biological variation patterns in bulk RNA-seq data.

> [!question]- Why does classifier performance depend on adjustment? (status:: undefined)
> Batch effects can introduce systematic biases that classifiers learn to exploit, leading to inflated performance on training data but poor generalization. Effective batch correction removes these technical artifacts, allowing classifiers to focus on biological signals and improving cross-study performance.

> [!question]- Why is cross study performance a good indicator of both biological preservation and batch reduction? (status:: undefined)
> Cross-study performance serves as a good indicator of both biological preservation and batch reduction because it directly tests whether a classifier can generalize to independent datasets with potentially different technical characteristics. High cross-study performance suggests that batch effects have been successfully removed while biological signal has been preserved.

> [!question]- What are some common evaluation metrics, and why are they not as good? (Limitations) (status:: undefined)
> Common evaluation metrics such as within-study cross-validation can be misleading in the presence of batch effects. Cross-validation within a single study may give optimistic performance estimates because the classifier can learn batch-specific patterns that do not generalize. These limitations highlight the importance of using cross-study validation to obtain realistic performance estimates.

> [!question]- PCA and Visualization-Based Evaluation (status:: undefined)
> Principal component analysis (PCA) and other visualization methods can help identify batch effects but do not directly measure their impact on classifier performance. **A common pitfall:** While PCA can confirm that batches now 'overlap' visually, it cannot guarantee that the biological signal needed for classification has been preserved. Successful batch mixing in a 2D PCA plot is a necessary but insufficient condition for a generalizable classifier. BatchQC provides interactive software for evaluating sample and batch effects with multiple diagnostic approaches including PCA, heatmaps, dendrograms, and statistical metrics. The tool supports multiple batch correction methods including ComBat, ComBat-Seq, limma, and SVA, allowing users to interactively apply adjustments and evaluate their benefits. BatchQC's interactive visualizations help researchers assess whether batch effects have been successfully removed while preserving biological structure, though as noted above, visual overlap alone is insufficient—cross-study validation remains essential. [source:: C_15]



## Clinical Portability: The Single Sample Problem

> [!question]- What is the single sample problem in precision medicine? (status:: undefined)
> Most batch correction methods require a "batch" of samples to estimate and remove technical variation—they need multiple samples from each batch to calculate batch-specific parameters. In precision medicine, however, we often face the "batch of one" scenario: a single patient sample arrives at the clinic, processed on whatever equipment is available that day, by whichever technician is on duty. How do we apply a classifier trained on batch-corrected research data to this new, single sample that constitutes its own unique "batch"? [source:: C_89, C_91]

> [!question]- What are the implications for clinical deployment? (status:: undefined)
> This single sample problem has profound implications for translating research classifiers into clinical practice. A classifier trained on ComBat-adjusted data from multiple research cohorts cannot apply ComBat to a single incoming patient sample—there is no batch to correct. The classifier must either be robust to the technical variation of the new sample's processing conditions, or we must develop alternative strategies such as reference-based normalization methods that can adjust a single sample against a pre-defined reference distribution. This challenge underscores why cross-study validation, which tests generalization to new technical conditions, is a better proxy for clinical performance than within-study cross-validation. [source:: C_89, C_109]

> [!question]- What solutions exist for single sample correction? (status:: undefined)
> Emerging approaches to address the single sample problem include reference-based normalization, where a single sample is adjusted against a pre-computed reference distribution from training data. Frozen robust multiarray analysis (fRMA) pioneered this approach for microarrays by precomputing probe-specific effects and variances from large public databases, allowing individual arrays to be normalized without requiring a batch. Similar reference-based strategies have been developed for other platforms, including NanoString nCounter data, demonstrating that single-patient molecular testing is feasible with appropriate normalization methods. The choice of classifier architecture also matters: methods with strong built-in regularization, like elastic net, may be more robust to technical variation in single samples than methods that rely heavily on local structure, like KNN. [source:: C_91]



## Case Study: Cross-Study Tuberculosis Classification

> [!question]- How should the TB results be framed? (status:: undefined)
> Rather than presenting this as a standalone experimental section, frame it as a case study that illustrates the concepts discussed earlier—demonstrating how batch effects, adjustment methods, and classifier choice interact in a real-world scenario.



## Datasets: A Natural Stress Test for Batch Correction

> [!question]- Why were these specific TB datasets chosen to represent "Real World Noise"? (status:: undefined)
> To rigorously evaluate the impact of batch effects on classifier performance, we selected tuberculosis gene expression datasets that represent "Real World Noise"—the ultimate test of cross-population generalizability. Rather than choosing datasets that are technically similar, we deliberately selected studies that juxtapose adolescent and adult prospective cohorts with pediatric and adult case-control studies, household contact studies with clinical diagnostic studies, whole blood samples with sputum specimens, and data collected across four continents using different sequencing platforms. This heterogeneity is not a limitation but a feature: if batch correction methods can preserve biological signal while removing technical artifacts across this diversity, they are likely to succeed in real-world precision medicine applications.

> [!question]- How does the heterogeneity (adolescent/adult, blood/sputum, multiple continents) serve as a feature, not a limitation? (status:: undefined)
> The technical heterogeneity—different laboratories, sequencing platforms, RNA extraction protocols, and processing dates—creates the batch effects that batch correction methods must address. The biological heterogeneity—age, HIV status, sample type, and population genetics—represents the diversity that classifiers must generalize across. If a classifier trained on South African adolescent blood samples can accurately predict tuberculosis status in Indian adult blood samples, we have achieved the cross-population generalizability that precision medicine demands.

> [!question]- What is the common biological thread across datasets that makes them comparable? (status:: undefined)
> While most datasets focus on the classification task of distinguishing active tuberculosis from latent infection, the collection also includes studies examining TB progression risk. This diversity of biological questions, while introducing additional complexity, tests whether batch correction methods can preserve distinct biological signals across different experimental designs and research objectives. The primary classification task—active versus latent TB—remains constant across most datasets, providing a common thread for evaluating classifier generalization. [source:: C_69, C_70]

> [!question]- What technical details should be captured in a summary table? (status:: undefined)
> The table should capture Study, Region, Population, Sample Type, Design, and Key Characteristics to provide a comprehensive view of the heterogeneity. | Study | Region | Population | Sample Type | Design | Key Characteristics | |-------|--------|------------|-------------|--------|---------------------| | Zak et al. (2016) | South Africa | Adolescents (12-18 years) | Whole blood | Prospective cohort | Longitudinal sampling every 6 months to predict progression  | | Suliman et al. (2018) | South Africa, Gambia, Ethiopia | Adults | Whole blood | Prospective cohort | Household contacts, RISK4 four-gene signature for TB progression  | | Anderson et al. (2014) | South Africa, Malawi, Kenya | Children | Whole blood | Case-control | Childhood TB diagnosis, 51-transcript signature  | | Leong et al. (2018) | India | Adults | Whole blood | Case-control | South Indian population, active vs latent  | | Kaforou et al. (2013) | South Africa | Adults (Xhosa, 18+) | Whole blood | Case-control | HIV-infected and -uninfected cohorts  | [source:: C_69, C_70, C_68, C_71, C_73]

> [!question]- How does this collection test cross-population generalizability? (status:: undefined)
> This collection spans adolescent and adult prospective cohorts, pediatric and adult case-control studies, whole blood samples, and four continents (Africa, Asia, North America) with diverse genetic backgrounds and HIV co-infection patterns. The combination tests whether classifiers can generalize across age groups, sample types, geographic populations, and study designs—the full spectrum of variation encountered in real-world clinical deployment. [source:: C_68, C_69, C_70, C_71, C_73]

> [!question]- What makes this a "stress test" rather than a limitation? (status:: undefined)
> By deliberately maximizing heterogeneity, we create the most challenging possible scenario for batch correction and classifier generalization. Success in this stress test provides strong evidence that the methods will work in less extreme real-world scenarios. Failure reveals which methods are fragile and which are robust to real-world complexity.



## Classifier Performance Rankings: Lessons Learned

> [!question]- What is the key finding about classifier hierarchy? (status:: undefined)
> Despite the variety of adjustment methods, a clear hierarchy emerges with elastic net and random forests consistently outperforming other methods, demonstrating the importance of built-in regularization for high-dimensional gene expression data.

> [!question]- How should Figure 1 be described? (status:: undefined)
> Despite the variety of adjustment methods, a clear hierarchy of classifiers emerges in Figure 1.

> [!question]- Methods (status:: undefined)
> The analysis evaluated classifier performance across multiple tuberculosis gene expression datasets using leave-one-study-out cross-validation. Nine machine learning classifiers were tested: elastic net (regularized logistic regression), k-nearest neighbors (KNN), logistic regression, neural networks, random forests, shrinkage linear discriminant analysis (LDA), support vector machines (SVM), and XGBoost. Ten batch adjustment methods were compared: ComBat, ComBat with mean-only adjustment, ComBat-Seq supervised adjustment, naive merging (unadjusted), mutual nearest neighbors (MNN), FastMNN, nonparanormal transformation (NPN), rank-based normalization applied twice, rank-based normalization of samples, and within-study cross-validation as a baseline. Performance was assessed using multiple metrics including Matthews correlation coefficient (MCC), accuracy, balanced accuracy, area under the ROC curve (AUC), sensitivity, and specificity. The experimental design included 3 to 6 datasets per analysis configuration, with test studies including GSE37250_SA (South Africa), GSE37250_M (Malawi), GSE39941_M (Malawi), India, USA, and Africa cohorts.

> [!question]- Results (Figure 1) (status:: undefined)
> ![Figure 1: Average Rank by Classifier](figures/average_rank_by_classifier.png) *Figure 1: Classifier performance rankings aggregated across all batch adjustment methods. Elastic net and random forests consistently outperform other methods, demonstrating the importance of built-in regularization for high-dimensional gene expression data.*

> [!question]- What does Figure 1 reveal about classifier rankings? (status:: undefined)
> Across all batch adjustment methods, elastic net and random forest classifiers demonstrated the strongest overall performance, followed closely by neural networks, SVM, and XGBoost. KNN showed moderate performance, while logistic regression without regularization performed poorly, likely due to the high-dimensional nature of gene expression data. These rankings remained relatively stable across different adjustment methods, suggesting that classifier choice has a substantial impact on performance independent of batch correction approach.

> [!question]- Why does elastic net's regularization specifically ignore technical noise? (status:: undefined)
> Elastic net's superior performance stems from its dual regularization mechanism that is particularly well-suited to distinguishing biological signal from technical noise. The L1 penalty performs automatic feature selection, driving coefficients of genes that vary primarily due to batch effects toward zero, since these genes will not consistently predict the outcome across different batches. The L2 penalty stabilizes the solution by grouping correlated genes, which is crucial because biologically meaningful genes often work in coordinated pathways, while batch-affected genes tend to vary independently. This combination means that elastic net naturally "ignores" technical noise—genes whose expression varies due to batch effects fail to receive consistent non-zero weights across cross-validation folds, while genes with genuine biological signal receive stable, non-zero coefficients. This explains why elastic net maintains strong performance even with imperfect batch correction: its regularization provides an additional layer of protection against technical artifacts. [source:: C_79, C_80]

> [!question]- What is the mechanism: L1/L2 mechanics? (status:: undefined)
> The L1 penalty (lasso) drives coefficients to exactly zero, performing automatic feature selection by eliminating genes that don't consistently predict across batches. The L2 penalty (ridge) shrinks coefficients toward zero without eliminating them, and encourages grouping of correlated features—biologically related genes in pathways tend to be selected or excluded together. Together, these mechanics create a model that is sparse (few genes), stable (correlated genes grouped), and robust to technical noise (batch-specific genes eliminated). [source:: C_79]

> [!question]- Discussion on classifier complexity (status:: undefined)
> Classifier complexity relates to the model's capacity to capture patterns in the data. More complex models (e.g., neural networks) may overfit when sample sizes are small, while simpler models (e.g., logistic regression) may underfit when patterns are non-linear. The results demonstrate that moderately complex classifiers with built-in regularization (elastic net, random forests) achieved the best balance between model flexibility and generalization. Simple logistic regression without regularization performed poorly in this high-dimensional setting, while elastic net's L1/L2 regularization enabled effective feature selection and robust performance. Random forests' ensemble approach provided robustness to noise and batch effects. Neural networks and SVM, despite their complexity, also performed well, suggesting that the sample sizes across combined studies were sufficient to train these more flexible models.



## Interaction Effects Between Adjusters and Classifiers

> [!question]- Why might adjusters and classifiers have interaction effects? (status:: undefined)
> Different batch correction methods may preserve or remove different aspects of the data structure, which could interact with how different classifiers learn decision boundaries. For example, some adjusters may preserve non-linear relationships better than others, potentially favoring classifiers that can exploit such patterns.

> [!question]- Do specific classifiers do better with specific adjusters, or is performance independent? (status:: undefined)
> The analysis reveals that classifier performance is largely independent of the specific batch adjustment method used, with some notable exceptions. Statistical testing comparing each adjuster to within-study cross-validation baseline showed consistent patterns across classifiers, with most adjusters showing significant performance differences ($p < 0.05$) compared to the baseline.

> [!question]- Results (Figure 2) (status:: undefined)
> ![Figure 2: Adjusters on Classifiers Relative Aggregated](figures/adjusters_on_classifiers_relative_aggregated.png) *Figure 2: Change in classifier performance with batch adjustment. Each panel shows the delta (Δ, change in MCC) when applying a specific batch adjustment method compared to within-study baseline. Positive values indicate improvement; negative values indicate degradation. A negative delta indicates that the model is no longer exploiting batch-specific artifacts present in the training data, revealing the true difficulty of the biological task. The dramatic negative delta for supervised adjustment with KNN (bottom left) reveals the catastrophic failure mode when correction methods use class labels. Most other adjuster-classifier combinations show modest negative deltas, indicating that cross-study generalization is inherently more challenging than within-study validation, regardless of batch correction approach.*

> [!question]- What does Figure 2 reveal about the change in performance? (status:: undefined)
> Figure 2 reveals that most batch adjustment methods result in negative deltas (performance decreases) compared to within-study baseline, indicating that cross-study generalization is inherently more challenging than within-study validation. The magnitude of these deltas varies substantially across adjuster-classifier combinations.

> [!question]- How should the visual emphasis on "delta" be described? (status:: undefined)
> The figure emphasizes the change (delta) in MCC rather than absolute performance, making it immediately clear which combinations improve or degrade performance relative to baseline. The dramatic negative delta for supervised adjustment with KNN stands out visually, highlighting the catastrophic failure mode.

> [!question]- What patterns emerge from Figure 2? (status:: undefined)
> For elastic net, all adjustment methods except naive merging showed significantly reduced performance compared to within-study cross-validation ($p < 0.01$), with mean MCC differences ranging from -0.049 (naive) to -0.161 (rank samples). ComBat-supervised adjustment showed particularly poor performance (mean difference: -0.104, $p < 0.001$).

> [!question]- Show a few places where interactions occur, but mostly independent performance (status:: undefined)
> While performance generally decreased consistently across adjusters for most classifiers, ComBat-supervised adjustment showed a particularly severe interaction with KNN (mean difference: -1.119, $p < 10^{-10}$), far worse than its effect on other classifiers. This suggests that KNN's distance-based learning mechanism is particularly sensitive to the specific transformations introduced by supervised batch correction. In contrast, logistic regression showed relative robustness to most adjustment methods, with only ComBat-supervised causing significant degradation. FastMNN showed consistently poor performance across all classifiers (mean differences ranging from -0.148 to -0.441), suggesting this method may not be well-suited for bulk RNA-seq data despite its success in single-cell applications.

> [!question]- What is the mechanism of adjuster-classifier interactions? (status:: undefined)
> The observed robustness of logistic regression likely stems from its global linear decision boundary, which is less sensitive to local distributional shifts. In contrast, the high sensitivity of KNN to batch adjustment—particularly supervised methods—highlights the danger of "local" learning. When supervised adjustment shifts samples to satisfy class-based mean/variance constraints, it creates high-density clusters in feature space. KNN "sees" these technical artifacts as biological proximity, leading to the "hall of mirrors" effect where internal validation metrics soar while cross-study generalizability collapses. The severe interaction between ComBat-supervised and KNN arises because supervised adjustment uses class labels during batch correction, potentially creating artificial separation in feature space that KNN's distance-based approach exploits, leading to overfitting. The poor performance of FastMNN across all classifiers suggests that mutual nearest neighbor-based correction, while effective for discrete cell populations in single-cell data, may disrupt continuous biological variation patterns in bulk RNA-seq data.



## The Perils of Supervised Batch Correction

> [!question]- How should the supervised adjustment warning be presented? (status:: undefined)
> This should be a prominent "Warning Box" or strongly titled section emphasizing the catastrophic failure of supervised adjustment. The mechanism should be explained clearly: supervised adjustment forces separation in training data that distance-based classifiers exploit, creating a "hall of mirrors" where internal validation looks perfect while real-world performance fails.



## A Critical Warning for Practitioners

> [!question]- What is the fundamental truth about supervised correction? (status:: undefined)
> Technical "corrections" that utilize the target variable can create a hall of mirrors, where internal validation looks perfect while real-world performance fails. This is the most important finding for practitioners.

> [!question]- Imbalanced data (status:: undefined)
> Imbalanced training data can introduce biases that are amplified by batch effects. When one class is underrepresented, batch effects may disproportionately affect that class, leading to poor generalization.

> [!question]- Using labels, or known groups for batch adjustment (status:: undefined)
> Using class labels or known groups for batch adjustment—supervised adjustment—can lead to overfitting and poor generalization. The adjustment process may inadvertently remove biological signal along with batch effects when class labels are used. ComBat-supervised adjustment demonstrated this failure mode dramatically in the unbalanced data analysis. ed, batch effects can further confound the relationship between features and outcomes, leading to classifiers that perform poorly on balanced test sets. The unbalanced tuberculosis analysis examined classifier performance when training data had imbalanced class ratios (train_imbalance_ratio = 1.0, indicating equal representation during training) but test sets had varying imbalance ratios ranging from 0.74 to 1.46.

> [!question]- Using labels, or known groups for batch adjustment (status:: undefined)
> Using class labels or known groups for batch adjustment—supervised adjustment—can lead to overfitting and poor generalization. The adjustment process may inadvertently remove biological signal along with batch effects when class labels are used. ComBat-supervised adjustment demonstrated this failure mode dramatically in the unbalanced data analysis.

> [!question]- Results (Figure 3) (status:: undefined)
> ![Figure 3: Unbalanced TB Analysis](figures/unbalanced_tb_analysis.png) *Figure 3: The catastrophic delta of supervised adjustment. This figure shows the change in performance (MCC) for different classifier-adjuster combinations on imbalanced test data. The large negative deltas for KNN with supervised adjustment (red bars extending far below zero, reaching MCC of -0.47) demonstrate performance worse than random chance—a delta of approximately -0.7 from reasonable performance. This dramatic negative change occurs because supervised correction creates artificial separation in training data that completely fails to generalize, illustrating the "hall of mirrors" effect where internal validation appears perfect while real-world performance collapses.*



## The Mechanism of Failure

> [!question]- What is the specific mechanism of supervised adjustment failure? (status:: undefined)
> Supervised adjustment "forces" a separation between classes within the training batch. A distance-based classifier like KNN then learns these artificial boundaries, which vanish entirely when the model is applied to an independent test set.

> [!question]- How does KNN's performance "tank" in supervised vs unsupervised settings? (status:: undefined)
> KNN with supervised adjustment achieved negative MCC values in most test cases (ranging from -0.470 to -0.160), indicating performance worse than random chance. In contrast, KNN with unsupervised ComBat maintained reasonable performance, demonstrating that the failure is specific to supervised correction, not inherent to KNN.

> [!question]- What is the visual story in Figure 3 about catastrophic failure? (status:: undefined)
> Figure 3 shows large negative deltas (red bars extending far below zero) for KNN with supervised adjustment, reaching MCC of -0.47—a delta of approximately -0.7 from reasonable performance. This visual representation makes the catastrophic nature of the failure immediately apparent.

> [!question]- Shows that supervised adjustment fails to generalize (status:: undefined)
> ComBat-supervised adjustment showed catastrophic failure with KNN across all test studies, achieving negative MCC values in most cases (ranging from -0.470 to -0.160), indicating performance worse than random chance. For the GSE37250_M test set, ComBat-supervised with KNN achieved an MCC of -0.470 and accuracy of only 25.6%, with specificity of just 31.4%. This dramatic failure occurred despite the training data being balanced, demonstrating that supervised adjustment creates artifacts that prevent generalization. Other classifiers also showed degraded performance with ComBat-supervised, though less severe: elastic net showed MCC values ranging from -0.013 to 0.865 across test sets, with particularly poor performance on GSE37250_M (MCC = -0.013). Random forests with ComBat-supervised showed highly variable performance, ranging from MCC of -0.156 (GSE37250_M) to 0.833 (GSE37250_SA).



## Appropriate Unsupervised Correction

> [!question]- Show something about imbalanced training data (status:: undefined)
> In contrast to supervised adjustment, standard ComBat adjustment maintained reasonable performance across imbalanced test sets. For elastic net with ComBat, MCC values ranged from 0.452 (Africa) to 0.886 (India), with accuracies between 73.5% and 94.2%. Random forests with ComBat showed MCC values from 0.444 (Africa) to 0.857 (USA), demonstrating robust performance despite test set imbalance. The unadjusted (naive) approach showed extreme variability, with some classifiers achieving MCC of 0 (indicating complete failure) on certain test sets, while others maintained moderate performance. For example, unadjusted elastic net achieved MCC values ranging from 0 (GSE37250_SA) to 0.866 (USA), highlighting the unpredictable nature of batch effects on imbalanced data. These results demonstrate that while class imbalance poses challenges, appropriate unsupervised batch correction methods can maintain classifier performance, whereas supervised methods that use class labels during adjustment create severe overfitting that prevents generalization.



## Considerations for Cross-Study Validation

> [!question]- What is the key message about cross-validation? (status:: undefined)
> Internal cross-validation can be misleading because classifiers can learn batch-specific patterns that do not generalize, emphasizing the importance of independent validation cohorts for realistic performance estimates. [source:: C_04]



## The Limitations of Internal Cross-Validation

> [!question]- Why comparing to internal cross validation performance may be misleading (status:: undefined)
> Comparing internal cross-validation performance to cross-study performance reveals important limitations of standard evaluation approaches. Cross-validation within a single study may give optimistic performance estimates because the classifier can learn batch-specific patterns that do not generalize. This finding emphasizes the importance of independent validation cohorts for obtaining realistic performance estimates. [source:: C_03]

> [!question]- Results aggregated over classifiers (Figure 4) (status:: undefined)
> ![Figure 4: Ranking Comparison Balanced vs Unbalanced](figures/ranking_comparison_balanced_vs_unbalanced.png) *Figure 4: The optimism delta of within-study validation. Comparing within-study cross-validation (left) to cross-study validation (right) reveals a systematic positive delta in the former—classifiers appear to perform better when tested on the same batch they were trained on, even with cross-validation. This "optimism delta" occurs because within-study validation allows classifiers to exploit batch-specific patterns. Cross-study performance shows the true delta when these technical patterns are absent, providing a more realistic (and typically lower) estimate of how classifiers will perform on new data with different technical characteristics. This delta between validation strategies is the best predictor of clinical performance, where each patient sample represents a new "batch."*

> [!question]- What does the "optimism delta" reveal about performance inflation? (status:: undefined)
> The optimism delta quantifies how much within-study cross-validation overestimates true generalization performance. Classifiers appear to perform better on within-study validation because they can exploit batch-specific patterns that don't generalize to independent datasets. This systematic inflation of performance estimates is a critical consideration for practitioners. [source:: C_04]

> [!question]- How should Figure 4 visually communicate this gap? (status:: undefined)
> Figure 4 should show side-by-side comparisons of within-study and cross-study performance, making the systematic positive delta (higher performance for within-study) immediately visible. The visual gap between the two validation strategies emphasizes the magnitude of performance inflation.



## Batch Adjustment Versus Meta-Analysis

> [!question]- When should you merge datasets versus perform meta-analysis? (status:: undefined)
> The choice between batch adjustment (merging datasets) and meta-analysis represents a fundamental decision in multi-study integration. While batch adjustment allows direct combination of datasets into a single pooled analysis, meta-analysis approaches combine statistical results across studies without merging the raw data. [source:: C_16]

> [!question]- What are the trade-offs? (status:: undefined)
> Taminau et al. (2014) found that merging (batch correction + pooled analysis) identified significantly more differentially expressed genes than meta-analysis approaches. Specifically, all 25 DEGs identified through meta-analysis were also identified in the merging approach, but merging found many additional genes. This suggests that merging provides greater statistical power for gene discovery when batch effects can be adequately corrected. However, meta-analysis has advantages when: - Raw data are not available or cannot be shared due to privacy constraints - Studies use fundamentally different platforms or technologies that are difficult to harmonize - Batch effects are so severe that correction would remove biological signal - The goal is to identify only the most robust, consistently replicated findings across studies **For classifier development specifically:** Merging with batch correction is generally preferred because classifiers require access to individual sample-level data to learn decision boundaries. Meta-analysis of classifier performance across studies can complement this by assessing consistency, but cannot replace the need for integrated training data. The choice depends on data availability, the severity of batch effects, sample sizes, and analytical goals (differential expression vs pathway analysis vs biomarker discovery). [source:: C_16, C_16]



## Summary of Recommendations for Practitioners

> [!question]- What actionable guidance emerges from these results? (status:: undefined)
> The empirical results from the tuberculosis case study, combined with the theoretical understanding of batch effects and classifier architectures, yield clear guidance for practitioners building cross-study gene expression classifiers.

> [!question]- How should recommendations be structured for maximum utility? (status:: undefined)
> Structure recommendations as a decision matrix with clear priorities, followed by warning signs of failure, and a hierarchy of concerns. Use numbered lists and specific actionable statements rather than general principles.



## Decision Matrix for Batch Correction and Classifier Selection

> [!question]- Format as "If/Then" structure for maximum utility (status:: undefined)
> Structure recommendations using clear "If/Then" logic to guide practitioners based on their specific goals. **For bulk RNA-seq data integration:** 1. **If goal is clinical deployment (Single Sample)** → **Then use Reference-based normalization and avoid KNN** - **Rationale:** Most batch correction methods require multiple samples per batch to estimate parameters. Clinical samples arrive individually, constituting their own unique "batch." - **Recommended:** Classifiers with strong regularization (elastic net) that are robust to technical variation; reference-based normalization approaches that can adjust a single sample against a pre-defined reference distribution - **Avoid:** KNN and other distance-based methods that rely heavily on local structure - **Evaluate:** Test generalization to new technical conditions during development 2. **If goal is biological discovery across GEO** → **Then use ComBat-Seq + Elastic Net** - **Rationale:** Large-scale integration across public repositories requires robust batch correction that preserves count structure and classifiers that naturally ignore technical noise. - **Recommended:** ComBat-Seq (preserves count structure) or standard ComBat on log-transformed data for batch correction; elastic net or random forests as first-line classifiers - **Why:** Built-in regularization provides robustness to residual batch effects; elastic net's L1/L2 penalties naturally ignore technical noise - **Alternative:** Neural networks or SVM if sample sizes are large (>1000 samples) 3. **If goal is within-study analysis** → **Then prioritize validation strategy over batch correction** - **Rationale:** Within-study cross-validation can give optimistic performance estimates by allowing classifiers to learn batch-specific patterns. - **Required:** Leave-one-study-out cross-validation for realistic performance estimates - **Insufficient:** Within-study cross-validation alone (gives optimistic estimates) - **Goal:** Cross-study performance is the best proxy for clinical portability 4. **If integrating across platforms** → **Then use rank-based normalization or quantile methods** - **Rationale:** Different platforms (microarray vs. RNA-seq, different sequencing technologies) have fundamentally different distributional properties. - **Recommended:** Rank-based normalization or unsupervised scale/location methods that don't assume specific distributional forms - **Avoid:** Methods that assume specific distributional forms (e.g., negative binomial) when platforms differ substantially 5. **If batch labels are unknown** → **Then consider SVA or other latent factor methods** - **Rationale:** When working with public data where experimental metadata may be incomplete, batch labels may be unknown or only partially known. - **Recommended:** Surrogate Variable Analysis (SVA) to identify and adjust for unknown, latent sources of variation in genomics data - **How it works:** SVA extracts surrogate variables from high-dimensional data that capture unwanted effects, including unknown batch effects, without requiring batch labels - **Note:** This extends beyond the scope of supervised batch correction but is increasingly important for large-scale data integration [source:: C_02, C_79, C_80, C_02, C_79, C_80, C_87, C_88, C_11, C_11]

> [!question]- Each recommendation is actionable with specific method names (status:: undefined)
> Each recommendation includes specific method names, clear rationale (why), and explicit guidance on what to avoid. This removes ambiguity and provides concrete next steps.

> [!question]- Include brief rationale for each recommendation (status:: undefined)
> The rationale explains the underlying mechanism or challenge that makes each recommendation appropriate for its specific use case.



## Red Flags: When Batch Correction Has Failed

> [!question]- What specific metrics or patterns indicate failure? (status:: undefined)
> - KNN or distance-based classifiers show dramatically better performance than regularized methods (suggests artificial clustering) - Within-study cross-validation performance is much higher than cross-study performance (suggests batch confounding) - Supervised adjustment was used and performance seems "too good" (hall of mirrors effect) - Performance degrades catastrophically on a single held-out study (suggests batch-specific overfitting)

> [!question]- How can practitioners diagnose correction problems? (status:: undefined)
> - Compare within-study and cross-study validation performance—large gaps indicate batch confounding - Check if distance-based methods (KNN) outperform regularized methods (elastic net)—this reversal suggests artificial structure - Examine performance on each held-out study individually—catastrophic failure on one study indicates batch-specific overfitting - Verify that unsupervised methods were used—supervised adjustment is a red flag



## The Hierarchy of Concerns

> [!question]- What is the priority ordering and why? (status:: undefined)
> 1. **Classifier architecture:** Choose methods with built-in regularization (elastic net, random forests) — This has the largest impact on performance 2. **Validation strategy:** Use cross-study validation, not within-study cross-validation — This determines whether performance estimates are realistic 3. **Batch correction method:** Use unsupervised methods appropriate for your data type — This matters, but less than classifier choice 4. **Avoid supervised correction:** Never use class labels during batch adjustment — This prevents catastrophic failure modes 5. **Evaluate generalization:** Test on truly independent cohorts with different technical characteristics — This validates real-world applicability This hierarchy reflects a key insight from the results: classifier choice and validation strategy matter more than the specific batch correction method, as long as you avoid catastrophic failures (supervised adjustment with KNN, MNN on bulk data).



## The Horizon of Batch Effect Mitigation

> [!question]- How should future directions be framed? (status:: undefined)
> Frame this as "The Horizon of Batch Effect Mitigation" rather than a list of forgotten topics. Emphasize the movement toward larger-scale integration, foundation models, and the ultimate goal of ensuring molecular profiles translate from bench to bedside.

> [!question]- What is the forward-looking framing? (status:: undefined)
> As we move toward larger-scale integration, such as the use of the entire GEO repository for "foundation models" in genomics, the field must look beyond static batch correction. Future workflows will likely integrate Surrogate Variable Analysis (SVA) to capture latent, unmeasured heterogeneity alongside Domain Adaptation techniques that allow neural networks to "learn" to be batch-invariant.



## Modern Approaches: Self-Supervised Learning and Batch-Aware Training

> [!question]- How are foundation models changing the batch effect landscape? (status:: undefined)
> The emergence of foundation models in genomics—large neural networks pre-trained on massive datasets like the entire GEO repository—introduces new considerations for batch effect mitigation. These models are typically trained using self-supervised learning, where the model learns representations from unlabeled data before being fine-tuned for specific tasks. A critical question arises: should we pre-train on batch-corrected or uncorrected data?

> [!question]- What is the advantage of pre-training on uncorrected data? (status:: undefined)
> Pre-training on uncorrected data may allow the model to learn robust representations that are inherently invariant to technical variation, rather than relying on explicit batch correction. If the model sees enough diverse batches during pre-training, it may learn to distinguish biological signal (which is consistent across batches) from technical noise (which varies randomly across batches). This approach could produce models that generalize better to new, unseen technical conditions—including the single-sample clinical scenario.

> [!question]- The Risk of Batch as a Latent Feature (Shortcut Learning) (status:: undefined)
> However, a critical risk emerges in self-supervised learning: if the model is not explicitly de-biased during training, it may learn to represent "batch" as one of its primary latent dimensions. This phenomenon is known as "Shortcut Learning" in the machine learning literature—the model takes the shortcut of learning the batch (which is easy to identify) rather than the biology (which is hard) (Geirhos 2020). Since batch effects often explain substantial variance in genomic data, an unsupervised model optimizing for reconstruction or contrastive objectives may inadvertently encode batch identity as a core feature (Geirhos 2020). This creates a subtle failure mode where the model appears to learn rich representations but has actually learned to distinguish technical artifacts rather than biological patterns (Geirhos 2020). [source:: C_101]

> [!question]- How might SSL models inadvertently encode batch identity? (status:: undefined)
> When SSL models are trained to maximize reconstruction accuracy or contrastive similarity, they naturally learn to represent the largest sources of variance in the data. If batch effects explain substantial variance—as they often do in genomic data—the model may encode batch identity as a primary latent dimension because doing so improves the training objective. The model has no inherent way to distinguish "biological variance" from "technical variance" without explicit supervision or constraints.

> [!question]- What happens when batch becomes a primary latent dimension? (status:: undefined)
> When batch identity becomes a primary latent dimension, the model's learned representations are dominated by technical artifacts rather than biological patterns. Downstream tasks that use these representations will inherit this bias, leading to classifiers that perform well within batches but fail catastrophically across batches. This is particularly insidious because the model may appear to learn rich, high-quality representations during pre-training, with the failure only becoming apparent during cross-batch evaluation.

> [!question]- What are the implications for evaluation and deployment? (status:: undefined)
> Detecting this failure requires careful evaluation: the model may perform well on within-batch tasks while failing catastrophically on cross-batch generalization. This underscores the importance of batch-aware evaluation metrics even for foundation models, and suggests that explicit batch-adversarial training (such as gradient reversal layers) may be necessary to prevent batch identity from dominating the learned representations. For clinical deployment, this means foundation models must be evaluated specifically for cross-batch generalization, not just overall performance.

> [!question]- How does this add sophistication to the foundation model discussion? (status:: undefined)
> This consideration adds a layer of sophistication by revealing that foundation models, despite their scale and power, are not immune to batch effects—they may simply encode them in more subtle ways. The discussion moves beyond "should we use foundation models?" to "how do we ensure foundation models learn biology, not batch?"  This framing positions batch effect mitigation as an ongoing concern even in the era of large-scale pre-training.

> [!question]- What are batch-aware training strategies? (status:: undefined)
> Batch-aware training strategies explicitly incorporate batch information during model training to learn batch-invariant representations. Gradient Reversal Layers (GRL) add an adversarial component to the neural network that tries to predict the batch label from the learned representations, while the main network tries to prevent this prediction (Ganin 2017). This adversarial training forces the network to learn features that are useful for the biological task but uninformative about batch identity—effectively making the model "forget" the batch during training (Ganin 2017). Domain adaptation techniques similarly aim to align the feature distributions across batches, allowing models trained on one set of technical conditions to generalize to others (Ganin 2017). These approaches represent a paradigm shift from correcting the data before training to training models that are inherently robust to batch effects. [source:: C_103]

> [!question]- What is the utility of ML beyond prediction? (status:: undefined)
> The utility of machine learning in genomics extends beyond pure prediction to biological discovery. By utilizing the feature importance metrics of random forests or the sparsity-inducing weights of elastic net, researchers can distill thousands of genes into a "minimal signature" suitable for cost-effective clinical assays.

> [!question]- What is the ultimate goal? (status:: undefined)
> Ultimately, the successful mitigation of batch effects ensures that these signatures represent genuine disease biology rather than the technical idiosyncrasies of a specific laboratory. The molecular profiles we identify in the lab must be the same ones that guide clinical decisions at the bedside, regardless of which machine or reagent kit was used to generate the data. The molecular signatures discovered through careful batch correction and robust machine learning must translate from bench to bedside, maintaining their predictive power across the technical heterogeneity inherent in real-world clinical settings, providing a reliable bridge from the digital repository of GEO to the bedside of the patient.



## Generalizability to Other Omics

> [!question]- IMPORTANT: Book title is "Genomics" (plural) - this section is vital (status:: undefined)
> While this chapter focuses on RNA-seq data as an exemplar, the book's title—"Artificial Intelligence and Machine Learning in Genomics and Precision Medicine"—signals a broader scope. This section is therefore vital, not peripheral, as it demonstrates how the principles learned from RNA-seq extend across the full spectrum of genomic and multi-omic data types used in precision medicine.

> [!question]- Highlight distribution differences across modalities (status:: undefined)
> The specific statistical properties differ across modalities, requiring modality-specific adaptations of batch correction methods, yet the underlying principles remain constant.

> [!question]- RNA-seq: Negative Binomial distribution (status:: undefined)
> RNA-seq count data follow a negative binomial distribution, characterized by over-dispersion where the variance exceeds the mean. This distributional property motivates methods like ComBat-Seq that explicitly model the negative binomial structure rather than assuming Gaussian distributions. The integer nature of counts and the mean-variance relationship are fundamental characteristics that batch correction methods must respect. [source:: C_07]

> [!question]- DNA Methylation: Beta distribution (use limma or ComBat on M-values) (status:: undefined)
> DNA methylation beta values are bounded between 0 and 1, representing the proportion of methylated sites, and approximately follow a beta distribution. This bounded nature violates the assumptions of methods designed for unbounded continuous or count data (Du 2010). Practitioners typically transform beta values to M-values (log2 ratio of methylated to unmethylated intensities) before applying ComBat or limma, as M-values have better statistical properties for differential methylation analysis (Du 2010). The recommended practice is to use M-values for statistical testing while reporting beta-values for biological interpretation, balancing statistical validity with interpretability (Du 2010). Specialized methods like GMQN (Gaussian Mixture Quantile Normalization) have been developed specifically for methylation data. [source:: C_93]

> [!question]- Protein abundance (Mass Spec): Often log-normal (status:: undefined)
> Mass spectrometry data for protein abundance are often log-normally distributed and may have substantial missingness due to detection limits. These data remain inherently biased due to sample handling and instrumentation differences (Välikangas 2016). ComBat's Gaussian assumptions may be more appropriate for log-transformed proteomics data than for RNA-seq counts, though the high degree of missingness requires specialized handling that differs from RNA-seq workflows (Välikangas 2016). [source:: C_96]

> [!question]- Key insight: While the math changes, the strategy of location/scale adjustment is foundational (status:: undefined)
> Despite these distributional differences, the fundamental strategy of location/scale adjustment remains constant across modalities. Whether adjusting the mean and variance of Gaussian-distributed M-values, the dispersion parameters of negative binomial counts, or the ionization efficiency of log-normal protein abundances, the core principle is the same: estimate systematic technical variation and remove it while preserving biological signal. The math changes—negative binomial models for RNA-seq, beta/M-value transformations for methylation, log-normal models for proteomics—but the conceptual framework of identifying and removing batch-specific location and scale parameters is foundational to understanding batch correction across all high-throughput omics technologies.

> [!question]- What core principles apply universally across omics? (status:: undefined)
> The core principles discussed in this chapter apply universally across omics modalities: - Systematic technical variation exists in all high-throughput data - Location/scale adjustment principles remain constant even as distributional assumptions change - The need to preserve biological signal while removing technical noise is universal - Validating through cross-study performance is essential regardless of data type - Avoiding supervised correction prevents catastrophic overfitting across all modalities

> [!question]- How do batch effects in other omics compare to transcriptomics? (status:: undefined)
> Batch effects in other omics modalities are comparable in magnitude and impact to those in transcriptomics. Protein abundance measurements from mass spectrometry face similar batch effects from instrument calibration, ionization efficiency, and sample processing. DNA methylation data from BeadChip arrays exhibit batch effects from array manufacturing lots, scanner settings, and bisulfite conversion efficiency. The fundamental challenge remains consistent: technical variation that can be comparable to or larger than biological signal.

> [!question]- How does this broaden the chapter's utility for precision medicine? (status:: undefined)
> By explicitly connecting RNA-seq principles to other omics modalities, the chapter becomes a reference for researchers working across the full spectrum of precision medicine data types. The lessons learned from RNA-seq—particularly about classifier choice, validation strategy, and the perils of supervised correction—provide actionable guidance for proteomics, metabolomics, and methylation studies. The classifier considerations—regularization, ensemble methods, distance-based approaches—similarly translate across omics, though the optimal choice may vary with data characteristics. The single sample problem, the optimism delta of within-study validation, and the catastrophic failure of supervised adjustment are universal concerns in precision medicine, regardless of the specific omics modality.

> [!question]- Format as prominent section (not just an afterthought) to match book scope (status:: undefined)
> This section is formatted as a prominent subsection within "The Horizon" to signal its importance and match the book's multi-omic scope. Rather than relegating multi-omic considerations to a brief "box" or footnote, this treatment acknowledges that readers working with methylation, proteomics, or other omics data will find the chapter's principles directly applicable to their work.



## Feature Selection and Biological Interpretation

> [!question]- Frame as prerequisite relationship: "Batch effect mitigation is the prerequisite for reliable feature selection" (status:: undefined)
> Batch effect mitigation is the prerequisite for reliable feature selection. Without proper batch correction first, feature selection identifies batch artifacts instead of biological signals. If the data is poorly corrected, the "features" selected will be technical noise, not biomarkers.

> [!question]- Why this matters: In context of Precision Medicine (status:: undefined)
> In the context of Precision Medicine, feature selection enables minimal diagnostic signatures—reducing thousands of genes to a small panel suitable for cost-effective clinical assays. However, this utility depends entirely on selecting genes that represent genuine disease biology rather than technical artifacts. A minimal signature derived from batch-confounded data will fail catastrophically when deployed in a clinical setting with different technical conditions.

> [!question]- How to use each classifier to find important genes (status:: undefined)
> Each classifier type can be used to identify important genes that drive classification decisions, but only after appropriate batch correction. Random forests provide feature importance measures that can identify key predictive genes, with variable importance measures serving as effective screening tools for gene expression studies. Logistic regression with L1 regularization (lasso) performs automatic feature selection by shrinking coefficients of less important features to zero, enabling sparse solutions suitable for high-dimensional data. Elastic net combines L1 and L2 regularization to perform feature selection while grouping correlated genes, making it particularly effective for identifying biologically coherent gene sets. Support vector machines with recursive feature elimination (SVM-RFE) can perform gene selection for cancer classification, with genes selected by this technique yielding better classification performance and biological relevance to cancer. Random forest gene selection has been shown to yield very small sets of genes while preserving predictive accuracy, often smaller than alternative methods. [source:: C_75]

> [!question]- Two main reasons why reducing genes is helpful (status:: undefined)
> Draft

> [!question]- Reduce cost and complexity (fewer genes = cheaper assays) (status:: undefined)
> Focusing on a smaller set of informative genes reduces the cost and complexity of diagnostic or prognostic tests. Smaller gene signatures can be implemented as cost-effective qPCR panels that are more practical for widespread clinical deployment than large-scale expression profiling.

> [!question]- Interpretation (sheds light on the biology involved) (status:: undefined)
> Identifying important genes provides biological interpretation by highlighting genes that shed light on the underlying biology. These genes often point to specific pathways or mechanisms involved in disease, enabling hypothesis generation for further research and potentially revealing therapeutic targets.

> [!question]- Emphasize: Without proper batch correction first, feature selection identifies batch artifacts instead of biological signals (status:: undefined)
> This prerequisite relationship cannot be overstated: feature selection applied to batch-confounded data will reliably identify genes whose expression varies between batches, not genes whose expression varies with disease. The resulting "biomarker panel" will perform well within the training cohort but fail completely on independent data processed under different technical conditions. This failure mode is particularly insidious because the feature selection process appears to work—producing sparse models with good internal validation performance—while actually encoding technical artifacts that prevent clinical translation.



## The Impact of Unmeasured Factors and Surrogate Variable Analysis

> [!question]- Second mention of SVA: Advanced application (status:: undefined)
> While the first mention of SVA (in the "Unknown Batch Effects" section) introduced the problem of unknown batch labels, here we examine how SVA is being integrated into modern automated pipelines for advanced applications.

> [!question]- How SVA is being integrated into modern automated pipelines (status:: undefined)
> Beyond known batch effects, unmeasured or unmodeled factors pose a significant challenge in gene expression studies, introducing widespread and detrimental effects such as reduced power, unwanted dependencies, and spurious signals, even in well-designed randomized studies. These unmodeled sources of heterogeneity can lead to extra variability in expression levels, spurious signals due to confounding, and long-range dependence in the apparent noise of the expression data. To address this, Surrogate Variable Analysis (SVA) was developed to identify, estimate, and utilize components of expression heterogeneity (EH) directly from the expression data itself. SVA can be applied in conjunction with standard analysis techniques to accurately capture the relationship between expression and any modeled variables of interest, ultimately increasing the biological accuracy and reproducibility of analyses in genome-wide expression studies. By adjusting for surrogate variables that capture these unmodeled factors, SVA improves the accuracy and stability of gene ranking for differential expression, leading to more powerful and reproducible results, which is crucial for making reliable biological inferences when selecting genes for further study. [source:: C_36]

> [!question]- The evolution from manual batch correction to automated detection of latent factors (status:: undefined)
> The integration of SVA into modern workflows represents an evolution from manual batch correction—where researchers explicitly identify and correct for known technical factors—to automated detection of latent factors that may include both known and unknown sources of variation. This is particularly important for large-scale data integration projects, such as building foundation models on the entire GEO repository, where manually curating batch labels for hundreds of thousands of samples is impractical. Automated pipelines that incorporate SVA can identify and adjust for systematic variation without requiring complete metadata, enabling more robust integration of heterogeneous public data. However, this automation comes with the caveat that SVA may identify and remove biological variation if it is confounded with technical factors, emphasizing the continued importance of careful experimental design and validation.



## Narrative Transformation Summary

> [!question]- How is traceability maintained? (status:: undefined)
> Every factual claim in chapter_draft.md traces back to verified claims in manuscript.md, which in turn reference claims_matrix.md and source documents. The two-document workflow allows narrative polish while maintaining verification integrity.

