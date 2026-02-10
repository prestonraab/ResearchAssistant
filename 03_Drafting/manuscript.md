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

> [!question]- What are adjusters? (status:: undefined)
> Statistical adjustment methods, also referred to as adjusters or batch correction methods, aim to remove technical variation while preserving biological signal.

> [!question]- How do adjusters work? (status:: undefined)
> Adjusters can work by modeling the technical variation and removing it, or by modeling the biological variation and removing all other variation. This has implications for the preservation of biological signal. If an adjuster that models biology fails to capture some variation, then that signal will be removed from the data. If an adjuster that models batch effect attributes too much variation to the batch, the same problem occurs. These methods operate under the assumption that the underlying biological signal is consistent across batches, and that technical variation can be separated from biological variation.

> [!question]- Why do some adjusters work better in some contexts? (status:: DRAFT)
> The effectiveness of adjusters depends on the data type. Adjusters must make assumptions when modeling batch effects or biology, and these will vary by data type. Differences in modeling assumptions can be seen by examining adjusters for two types of gene expression measurements.

> [!question]- How can gene expression measurements be categorized? (status:: undefined)
> These measurements can be categorized into those which measure the bulk gene expression in a large sample of cells and those which take measurements for individual cells.

> [!question]- How does Combat adjust bulk data? (status:: undefined)
> For bulk data, a common adjusting approach is ComBat. ComBat adjusts for batch effects by modeling batch-specific shifts and scaling factors for each gene. ComBat models the batch effect to remove it. The transformation that ComBat applies is linear: each expression value for a particular gene is shifted and scaled the same as each other expression value for that gene. This transformation works well for bulk gene expression data, which varies continuously due to the random proportions of cell types represented in the sample. [source:: C_01]

> [!question]- What is used to adjust single cell data? (status:: undefined)
> Single cell data requires a different kind of adjustment. Single cell gene expression is characterized by distinct expression signatures for each cell type, with internal variation caused by various cell states at measurement time.  If bulk data spans a continent of continuous variation, single cell data occupies islands of specialized differentiation.

> [!question]- How is single cell data adjusted? (status:: undefined)
> Single cell adjusters may assume that samples of similar cell types will exhibit similar expression patterns, even in the presence of batch effects. By finding "nearerst neighbors", or the samples that have the most similar expression between batches, adjusters such as Harmony and Seurat can identify how to move cross-batch neighbors closer together to bring the batches into alignment. Harmony and Seurat model the biological space, then eliminate the batch differences. Since neighbors are found using many genes, and the transformation is sample-specific, the adjustment of single cell data is typically nonlinear.

> [!question]- Feature space correction vs latent space alignment? (status:: DRAFT)
> ComBat and the single cell methods have a difference in approach more fundamental than modeling batch or biology. ComBat is a feature-space correction method: it attempts to fix the original data and output new values for each sample and gene. Harmony and Seurat are latent-space alignment methods: they represent each sample using fewer variables, which represent simple ways the data can vary within a single batch, and adjust in that space. These new variables are called latent, or hidden, because they were not among the original genes yet hold most of the information.



## Confounding

> [!question]- What is confounding? (status:: undefined)
> Batch effects can mimic or mask real differences in expression levels and covariance structures between batches. Not all differences between datasets are due to technical artifacts; not all differences should be removed. For example, two studies might have the same split of positive and negative cases, but different proportions of females. It might be difficult to determine whether the differences in gene expression between batches are technical artifacts that should be removed, or true differences due to the sex imbalance between datasets. We might say that the batch effect is "confounded" with sex—the effect of the batch on gene expression is somewhat tied up with the effect of the sex imbalance.

> [!question]- How can confounding be resolved? (status:: undefined)
> Confounding can often be removed if the values of the confounding variables are known.

> [!question]- How specifically does Combat account for confounding? (status:: undefined)
> Combat, when provided with additional metadata for each sample, can temporarily remove the associations between the metadata and the gene expression, then remove the remaining batch effects, and finally add back the metadata associations.

> [!question]- When is confounding difficult to overcome? (status:: undefined)
> However, if these other variables are not known, due to poor recording or unknown population differences, correcting for confounding can be more difficult. In the multi-study context, these additional variables, or metadata, are rarely consistently recorded. One variable might be important to one study, but left out in another. These unshared variables are typically unable to be used for merging datasets.

> [!question]- How can dataset differences be preserved? (status:: undefined)
> Some datasets are fully confounded—one dataset could be fully healthy, and another fully diseased; one could be from human tissue, and another from mouse tissue. Some methods, like LIGER, have been developed to deal with this problem for single cell data. LIGER uses matrix factorization to identify shared and dataset-specific features of cell identity. Once differences are identified, they can be preserved, minimizing false alignment of the datasets.

> [!question]- How to deal with unknown batches? (status:: undefined)
> A separate but related problem occurs when the batches are not known. This is not a primary difficulty when combining datasets. Methods such as surrogate variable analysis (SVA) can identify and adjust for unknown batch effects by extracting surrogate variables that capture unwanted effects.

> [!question]- How important is single-patient data? (status:: undefined)
> For precision medicine, single-patient data can also pose a problem to batch correction. Single-patient data processing is vital to the translation of molecular assays, as patient samples in clinical settings are typically collected in small numbers, often one at a time. However, many correction techniques rely on several samples to characterize the distribution of the new batch. It is difficult to know if a single sample is an outlier if the distribution is not known. If at all possible, it is best to process several samples at the same time or use recent data identically collected to define the distribution of the new data.

> [!question]- What if I only have single-patient data? (status:: DRAFT)
> If this is not possible, some transformations are available to shift the data into a batch-independent space. This includes within-sample gene ranking and using Variational Autoencoders to encode the sample using latent variables.

> [!question]- Transition (status:: undefined)
> To understand the effects of adjustment on classification, we will first describe the landscape of modern classification.



## Machine Learning Classifiers for Gene Expression Data

> [!question]- ML, traditional, broad strokes, direction of field in usage (status:: undefined)
> Classification has evolved from traditional statistical methods (logistic regression, linear discriminant analysis) toward modern machine learning approaches (support vector machines, random forests, neural networks). The direction increasingly favors flexible methods that can capture complex, non-linear patterns in high-dimensional data. Modern techniques often use iterative and random (stochastic) training, improving the model in small steps to classify the training data correctly.[source:: C_05]

> [!question]- Compare stats and ML models (status:: undefined)
> Simple, rigid models use strong assumptions about how the inputs relate to the labels. This bias provides protection against variable data: the predicted model will not change much in response to small changes in the data. More complex machine learning models are less constrained, which can lead to highly variable models. Many machine learning algorithms use some form of regularization, or assumptions of simple relationships that help to constrain the models. This can improve generalization, or the ability to classify unseen data.

> [!question]- What specific classifiers do well with gene expression? (status:: undefined)
> For gene expression data specifically, benchmark studies have identified several classifier types that perform particularly well: support vector machines (SVM) and random forests have been highlighted as top performers. Logistic regression with regularization (elastic net, lasso, ridge) and neural networks (when sufficient data are available) also show strong performance. XGBoost, a tree-based algorithm with strong performance on many datasets, can also be used. Each classifier type has distinct characteristics that make it suitable for different scenarios and data types. [source:: C_06(Piccolo2022)]

---

> [!question]- Why is regularization useful? (status:: undefined)
> Even for simple models, regularization is vital for high-dimensional gene expression data. Unregularized logistic regression succumbs to the noise of tens of thousands of genes when training, using small contributions from many genes to fit the training data exactly.

> [!question]- What is Elastic Net? (status:: undefined)
> Elastic net accounts for this tendency by effectively limiting the number of genes the model can used. This is called feature selection. Feature selection, done manually or incorportated into models, is important whenever the number of features far exceeds the number of samples used for training. This is  characteristic of gene expression data, where thousands of genes vastly outnumber samples. Elastic net uses two common types of regularization, referred to as L1 and L2 regularization.   The L1 penalty drives coefficients of irrelevant genes to exactly zero, creating models that use few features. This results in interpretable and computationally efficient models. The L2 penalty penalizes large coefficients, which encodes the idea that genes with low variation should not have a large effect on classification. This regularization helps models generalize to new data.  [source:: C_79]

---

> [!question]- What are ensemble methods? (status:: undefined)
> Ensemble methods are robust to the high-dimensional, noisy nature of gene expression data because they aggregate predictions across multiple models, each trained on different subsets of samples and features. This averaging effect reduces sensitivity to outliers. Random forests construct ensembles of decision trees, where each tree is trained on a bootstrap sample of the data and a random subset of features. For gene expression data, this means each tree sees a different combination of genes and samples, preventing small deviations from patterns from dominating the model. The final prediction aggregates votes across all trees, providing robustness to noise and the ability to capture complex interactions between genes. Random forests also provide measures of feature importance, which can aid in biological interpretation by identifying which genes contribute most to classification decisions. [source:: C_84]

> [!question]- How should XGBoost be described? (status:: undefined)
> XGBoost, a gradient boosting implementation, builds trees sequentially to correct errors from previous iterations, often achieving excellent performance on structured data. It benefits from the same regularization methods as random forests. [source:: C_81]



---

> [!question]- What distinguishes geometric models in the genomic context? (status:: undefined)
> Support vector machines identify decision boundaries in high-dimensional gene expression space using geometric principles. For gene expression data, where biological classes may not be linearly separable due to complex regulatory networks and pathway interactions, the ability to learn non-linear boundaries is crucial. Support vector machines identify optimal decision boundaries by maximizing the margin between classes. SVMs are particularly effective for the few-sample problem in gene expression data because they focus on support vectors—the most informative samples near the decision boundary—rather than attempting to model all samples equally. [source:: C_86]

--- 

> [!question]- New question? (status:: undefined)
> Neural networks, including multi-layer perceptrons and more sophisticated architectures, can achieve excellent performance when sufficient data are available. For gene expression data, neural networks can learn hierarchical representations where early layers capture individual gene patterns and deeper layers integrate these into pathway-level or systems-level features. Neural networks outperform other methods only when training set sizes are very large, as the high-dimensional nature of gene expression data (many features, few samples) has historically limited deep learning effectiveness. Deep learning approaches have shown particular promise for identifying complex, non-linear patterns that may be missed by simpler methods.


## The Link Between Adjustment and Classifier Performance

> [!question]- Why does classifier performance depend on adjustment? (status:: undefined)
> Batch effects can introduce systematic biases that classifiers learn to exploit, leading to inflated performance on training data but poor generalization. Effective batch correction removes these technical artifacts, allowing classifiers to focus on biological signals and improving cross-study performance.

> [!question]- Why is cross study performance a good indicator of both biological preservation and batch reduction? (status:: undefined)
> Cross-study performance serves as a good indicator of both biological preservation and batch reduction because it directly tests whether a classifier can generalize to independent datasets with potentially different technical characteristics. High cross-study performance suggests that batch effects have been successfully removed while biological signal has been preserved.

> [!question]- What are some common evaluation metrics, and why are they not as good? (Limitations) (status:: undefined)
> Common evaluation metrics such as within-study cross-validation can be misleading in the presence of batch effects. Cross-validation within a single study may give optimistic performance estimates because the classifier can learn batch-specific patterns that do not generalize. 

> [!question]- PCA and Visualization-Based Evaluation (status:: undefined)
> Principal component analysis (PCA) and other visualization methods can help identify batch effects but do not directly measure their impact on classifier performance. While PCA can confirm that batches now 'overlap' visually, it cannot guarantee that the biological signal needed for classification has been preserved. Neighbor mixing metrics identify the proportions of nearest neigbors that share a batch or a metadata label. Ideally, samples are well mixed by batch and well seperated by label. This gives some insight into whether a classifier may perform well across datasets, but this is not guaranteed for non-KNN classifiers. BatchQC provides interactive software for evaluating sample and batch effects with multiple diagnostic approaches including PCA, heatmaps, dendrograms, and statistical metrics. These visualizations help researchers assess whether batch effects have been successfully removed while preserving biological structure, though visual overlap alone is insufficient. Cross-study validation is essential. [source:: C_15]


## Datasets: A Natural Stress Test for Batch Correction

> [!question]- Why were these specific TB datasets chosen to represent "Real World Noise"? (status:: undefined)
> To rigorously evaluate the impact of batch effects on classifier performance, we selected tuberculosis gene expression datasets that represent "Real World Noise"—the ultimate test of cross-population generalizability. Rather than choosing datasets that are technically similar, we deliberately selected studies that juxtapose adolescent and adult prospective cohorts with pediatric and adult case-control studies, household contact studies with clinical diagnostic studies, whole blood samples with sputum specimens, and data collected across four continents using different sequencing platforms. This heterogeneity is not a limitation but a feature: if batch correction methods can preserve biological signal while removing technical artifacts across this diversity, they are likely to succeed in real-world precision medicine applications.


> [!question]- What is the common biological thread across datasets that makes them comparable? (status:: undefined)
> While most datasets focus on the classification task of distinguishing active tuberculosis from latent infection, the collection also includes studies examining TB progression risk. This diversity of biological questions, while introducing additional complexity, tests whether batch correction methods can preserve distinct biological signals across different experimental designs and research objectives. [source:: C_69, C_70]

> [!question]- What technical details should be captured in a summary table? (status:: undefined)
> The study details are summarized in this table: | Study | Region | Population | Sample Type | Design | Key Characteristics | |-------|--------|------------|-------------|--------|---------------------| | Zak et al. (2016) | South Africa | Adolescents (12-18 years) | Whole blood | Prospective cohort | Longitudinal sampling every 6 months to predict progression  | | Suliman et al. (2018) | South Africa, Gambia, Ethiopia | Adults | Whole blood | Prospective cohort | Household contacts, RISK4 four-gene signature for TB progression  | | Anderson et al. (2014) | South Africa, Malawi, Kenya | Children | Whole blood | Case-control | Childhood TB diagnosis, 51-transcript signature  | | Leong et al. (2018) | India | Adults | Whole blood | Case-control | South Indian population, active vs latent  | | Kaforou et al. (2013) | South Africa | Adults (Xhosa, 18+) | Whole blood | Case-control | HIV-infected and -uninfected cohorts  | [source:: C_69, C_70, C_68, C_71, C_73]

## Classifier Performance Rankings: Lessons Learned

> [!question]- What is the key finding about classifier hierarchy? (status:: undefined)
> The results show that regularization is essential for classifying high-dimensional gene expression data.

> [!question]- Methods (status:: undefined)
> The analysis evaluated classifier performance across multiple tuberculosis gene expression datasets using leave-one-study-out cross-validation. Nine machine learning classifiers were tested: elastic net (regularized logistic regression), k-nearest neighbors (KNN), logistic regression, neural networks, random forests, shrinkage linear discriminant analysis (LDA), support vector machines (SVM), and XGBoost. Ten batch adjustment methods were compared: ComBat, ComBat with mean-only adjustment, ComBat-Seq supervised adjustment, naive merging (unadjusted), mutual nearest neighbors (MNN), FastMNN, nonparanormal transformation (NPN), rank-based normalization applied twice, rank-based normalization of samples, and within-study cross-validation as a baseline. Performance was assessed using Matthews correlation coefficient (MCC). MCC performance is decreased if a classifier has poor sensitivity, specificity, positive predictive value, or negative predictive value. MCC cannot therefore be gamed by only choosing the most common label. The experimental design included 3 to 6 datasets per analysis configuration, with test studies including GSE37250_SA (South Africa), GSE37250_M (Malawi), GSE39941_M (Malawi), India, USA, and Africa cohorts.

> [!question]- Results (Figure 1) (status:: undefined)
> ![Figure 1: Average Rank by Classifier](figures/average_rank_by_classifier.png) *Figure 1: Figure description.*

> [!question]- What does Figure 1 reveal about classifier rankings? (status:: undefined)
> Summarize performance.


> [!question]- Discussion on classifier complexity (status:: undefined)
> Classifier complexity relates to the model's capacity to capture patterns in the data. More complex models (e.g., neural networks) may overfit when sample sizes are small, while simpler models (e.g., logistic regression) may underfit when patterns are non-linear. The results demonstrate that moderately complex classifiers with built-in regularization (elastic net, random forests) achieved the best balance between model flexibility and generalization. Simple logistic regression without regularization performed poorly in this high-dimensional setting, while elastic net's L1/L2 regularization enabled effective feature selection and robust performance. Random forests' ensemble approach provided robustness to noise and batch effects. Neural networks and SVM, despite their complexity, also performed well. This required increasing regularization parameter on the neural net.


## Interaction Effects Between Adjusters and Classifiers

> [!question]- Why might adjusters and classifiers have interaction effects? (status:: undefined)
> Different batch correction methods may preserve or remove different aspects of the data structure, which could interact with how different classifiers learn decision boundaries. For example, some adjusters may preserve non-linear relationships better than others, potentially favoring classifiers that can exploit such patterns.

> [!question]- Do specific classifiers do better with specific adjusters, or is performance independent? (status:: undefined)
> The analysis reveals that classifier performance is largely independent of the specific batch adjustment method used, with some notable exceptions. 

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




## Clinical Portability: The Single Sample Problem

> [!question]- What is the single sample problem in precision medicine? (status:: undefined)
> Most batch correction methods require a "batch" of samples to estimate and remove technical variation—they need multiple samples from each batch to calculate batch-specific parameters. In precision medicine, however, we often face the "batch of one" scenario: a single patient sample arrives at the clinic, processed on whatever equipment is available that day, by whichever technician is on duty. How do we apply a classifier trained on batch-corrected research data to this new, single sample that constitutes its own unique "batch"? [source:: C_89, C_91]

> [!question]- What are the implications for clinical deployment? (status:: undefined)
> This single sample problem has profound implications for translating research classifiers into clinical practice. A classifier trained on ComBat-adjusted data from multiple research cohorts cannot apply ComBat to a single incoming patient sample—there is no batch to correct. The classifier must either be robust to the technical variation of the new sample's processing conditions, or we must develop alternative strategies such as reference-based normalization methods that can adjust a single sample against a pre-defined reference distribution. This challenge underscores why cross-study validation, which tests generalization to new technical conditions, is a better proxy for clinical performance than within-study cross-validation. [source:: C_89, C_109]

> [!question]- What solutions exist for single sample correction? (status:: undefined)
> Emerging approaches to address the single sample problem include reference-based normalization, where a single sample is adjusted against a pre-computed reference distribution from training data. Frozen robust multiarray analysis (fRMA) pioneered this approach for microarrays by precomputing probe-specific effects and variances from large public databases, allowing individual arrays to be normalized without requiring a batch. Similar reference-based strategies have been developed for other platforms, including NanoString nCounter data, demonstrating that single-patient molecular testing is feasible with appropriate normalization methods. The choice of classifier architecture also matters: methods with strong built-in regularization, like elastic net, may be more robust to technical variation in single samples than methods that rely heavily on local structure, like KNN. [source:: C_91]


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


