# Claims and Evidence: Method - Classifiers

This file contains all **Method - Classifiers** claims with their supporting evidence.

---

## C_75: Random forests provide feature importance measures that can identify key predictive genes in gene expression classification tasks

**Category**: Method  
**Source**: Díaz-Uriarte and Alvarez de Andrés 2006 (Source ID: 28)  
**Context**: Variable importance measures have been suggested as screening tools for gene expression studies.

**Primary Quote**:
> "random forest is a classification algorithm well suited for microarray data: it shows excellent performance even when most predictive variables are noise, can be used when the number of variables is much larger than the number of observations and in problems involving more than two classes, and returns measures of variable importance."

**Supporting Quotes**:
- "Classification algorithms that directly provide measures of variable importance (related to the relevance of the variable in the classification) are of great interest for gene selection, specially if the classification algorithm itself presents features that make it well suited for the types of problems frequently faced with microarray data. Random forest is one such algorithm."


---


## C_76: Logistic regression with L1 regularization (lasso) performs automatic feature selection

**Category**: Method  
**Source**: Zou2005 (Source ID: 29)  
**Context**: L1 penalty enables sparse solutions suitable for high-dimensional gene expression data.

**Primary Quote**:
> "Due to the nature of the L1-penalty, the lasso does both continuous shrinkage and automatic variable selection simultaneously."

**Supporting Quotes**:
- "Similar to the lasso, the elastic net simultaneously does automatic variable selection and continuous shrinkage, and it can select groups of correlated variables."
- "As an automatic variable selection method, the elastic net naturally overcomes the difficulty of p >> n and has the ability to do grouped selection."


---


## C_77: Support vector machines can identify support vectors that define decision boundaries

**Category**: Method  
**Source**: Guyon2002 (Source ID: 32)  
**Context**: SVMs are well-suited for high-dimensional problems where the number of features exceeds the number of samples.

**Primary Quote**:
> "A particularity of SVMs is that the weights w i of the decision function D ( x ) are a function only of a small subset of the training examples, called 'support vectors'. Those are the examples that are closest to the decision boundary and lie on the margin."

**Supporting Quotes**:
- "SVM (with linear kernel, as used here) try to find an optimal separating hyperplane between the classes. When the classes are linearly separable, the hyperplane is located so that it has maximal margin (i.e., so that there is maximal distance between the hyperplane and the nearest point of any of the classes) which should lead to better performance on data not yet seen by the SVM."
- "Random forest has excellent performance in classification tasks, comparable to support vector machines."


---


## C_79: Elastic net combines L1 (lasso) and L2 (ridge) regularization penalties to perform both variable selection and regularization

**Category**: Method  
**Source**: Zou2005 (Source ID: 29)  
**Context**: Particularly useful when the number of predictors (p) is much larger than the number of observations (n).

**Primary Quote**:
> "We call the function (1-α)|β|₁ + α|β|₂ the elastic net penalty, which is a convex combination of the lasso and ridge penalty. When α = 1, the naïve elastic net becomes simple ridge regression."

**Supporting Quotes**:
- "We propose a new regularization technique which we call the elastic net. Similar to the lasso, the elastic net simultaneously does automatic variable selection and continuous shrinkage, and it can select groups of correlated variables."
- "The elastic net is particularly useful when the number of predictors (p) is much bigger than the number of observations (n). By contrast, the lasso is not a very satisfactory variable selection method in the p >> n case."


---


## C_80: Elastic net encourages a grouping effect, where strongly correlated predictors tend to be in or out of the model together

**Category**: Method  
**Source**: Zou2005 (Source ID: 29)  
**Context**: Addresses limitations of lasso in the p >> n case.

**Primary Quote**:
> "In addition, the elastic net encourages a grouping effect, where strongly correlated predictors tend to be in or out of the model together."

**Supporting Quotes**:
- "Qualitatively speaking, a regression method exhibits the grouping effect if the regression coefficients of a group of highly correlated variables tend to be equal (up to a change of sign if negatively correlated)."
- "If xᵢ and xⱼ are highly correlated, i.e. ρ ≈ 1 (if ρ ≈ -1 then consider -xⱼ), theorem 1 says that the difference between the coefficient paths of predictor i and predictor j is almost 0."


---


## C_81: XGBoost is a scalable end-to-end tree boosting system that uses a novel sparsity-aware algorithm for sparse data

**Category**: Method  
**Source**: Chen2016 (Source ID: 30)  
**Context**: Widely used by data scientists to achieve state-of-the-art results on machine learning challenges.

**Primary Quote**:
> "Tree boosting is a highly effective and widely used machine learning method. In this paper, we describe a scalable end-to-end tree boosting system called XGBoost, which is used widely by data scientists to achieve state-of-the-art results on many machine learning challenges. We propose a novel sparsity-aware algorithm for sparse data"

**Supporting Quotes**:
- "Among the 29 challenge winning solutions published at Kaggle's blog during 2015, 17 solutions used XGBoost. Among these solutions, eight solely used XGBoost to train the model, while most others combined XGBoost with neural nets in ensembles."


---


## C_82: XGBoost provides insights on cache access patterns, data compression, and sharding to build scalable tree boosting systems

**Category**: Method  
**Source**: Chen2016 (Source ID: 30)  
**Context**: Enables efficient handling of large-scale datasets.

**Primary Quote**:
> "More importantly, we provide insights on cache access patterns, data compression and sharding to build a scalable tree boosting system. By combining these insights, XGBoost scales beyond billions of examples using far fewer resources than existing systems."

**Supporting Quotes**:
- "The scalability of XGBoost is due to several important systems and algorithmic optimizations. These innovations include: a novel tree learning algorithm is for handling sparse data; a theoretically justified weighted quantile sketch procedure enables handling instance weights in approximate tree learning. Parallel and distributed computing makes learning faster which enables quicker model exploration. More importantly, XGBoost exploits out-of-core computation"


---


## C_83: Random forests are a combination of tree predictors where each tree depends on values of a random vector sampled independently

**Category**: Method  
**Source**: Breiman2001 (Source ID: 31)  
**Context**: The generalization error converges as the number of trees increases.

**Primary Quote**:
> "Random forests are a combination of tree predictors such that each tree depends on the values of a random vector sampled independently and with the same distribution for all trees in the forest. The generalization error for forests converges a.s. to a limit as the number of trees in the forest becomes large."

**Supporting Quotes**:
- "A random forest is a classifier consisting of a collection of tree-structured classifiers {h(x,Θₖ), k=1,...} where the {Θₖ} are independent identically distributed random vectors and each tree casts a unit vote for the most popular class at input x."


---


## C_84: Random forests provide robustness to noise and can handle high-dimensional data where the number of features exceeds the number of samples

**Category**: Method  
**Source**: Breiman2001 (Source ID: 31)  
**Context**: Ensemble approach aggregates predictions across multiple trees.

**Primary Quote**:
> "Using a random selection of features to split each node yields error rates that compare favorably to Adaboost (Y. Freund & R. Schapire, Machine Learning: Proceedings of the Thirteenth International conference, ***, 148-156), but are more robust with respect to noise."

**Supporting Quotes**:
- "This result explains why random forests do not overfit as more trees are added, but produce a limiting value of the generalization error."
- "ensemble methods such as Bagging, Boosting Ensembles, and Random Forests were applied as flexible and robust alternatives for handling feature interactions in high-dimensional settings. Because ensemble methods use multiple weak classifiers...these methods have been shown to reduce overfitting and improve predictive performance in gene expression analysis."


---


## C_85: Support vector machines with recursive feature elimination (SVM-RFE) can perform gene selection for cancer classification

**Category**: Method  
**Source**: Guyon2002 (Source ID: 32)  
**Context**: Genes selected by SVM-RFE yield better classification performance and are biologically relevant to cancer.

**Primary Quote**:
> "Using available training examples from cancer and normal patients, we build a classifier suitable for genetic diagnosis, as well as drug discovery. Previous attempts to address this problem select genes with correlation techniques. We propose a new method of gene selection utilizing Support Vector Machine methods based on Recursive Feature Elimination (RFE). We demonstrate experimentally that the genes selected by our techniques yield better classification performance and are biologically relevant to cancer."

**Supporting Quotes**:
- "In patients with leukemia our method discovered 2 genes that yield zero leave-one-out error, while 64 genes are necessary for the baseline method to get the best result (one leave-one-out error). In the colon cancer database, using only 4 genes our method is 98% accurate, while the baseline method is only 86% accurate."


---


## C_86: SVMs are particularly effective for high-dimensional gene expression data where the number of features often exceeds the number of samples

**Category**: Method  
**Source**: Guyon2002 (Source ID: 32)  
**Context**: The kernel trick allows SVMs to capture non-linear relationships.

**Primary Quote**:
> "This application also illustrates new aspects of the applicability of Support Vector Machines (SVMs) in knowledge discovery and data mining. SVMs were already known as a tool that discovers informative patterns (Guyon, 1996). The present application demonstrates that SVMs are also very effective for discovering informative features or attributes (such as critically important genes). In a comparison with several other gene selection methods on Colon cancer data (Alon, 1999) we demonstrate that SVMs have both quantitative and qualitative advantages."

**Supporting Quotes**:
- "A known problem in classification specifically, and machine learning in general, is to find ways to reduce the dimensionality n of the feature space F to overcome the risk of 'overfitting'. Data overfitting arises when the number n of features is large (in our case thousands of genes) and the number ℓ of training patterns is comparatively small (in our case a few dozen patients)."
- "These data sets present multiple challenges, including a large number of gene expression values per experiment (several thousands to tens of thousands), and a relatively small number of experiments (a few dozen)."


---


## C_88: Deep learning requires sufficient data to achieve superior performance on gene expression classification tasks

**Category**: Method  
**Source**: Hanczar2022 (Source ID: 33)  
**Context**: The n << p property (few samples, many features) has historically prevented effective use of deep learning for gene expression data.

**Primary Quote**:
> "We show that neural networks outperform the state-of-the-art methods only for very large training set size. For a small training set, we show that transfer learning is possible and may strongly improve the model performance in some cases."

**Supporting Quotes**:
- "The most challenging problems are the high dimensionality of the gene expression data, the insufficient number of training examples that lead to overfitting during training, and lack of robustness of the results."


---


## C_89: Frozen RMA (fRMA) allows microarrays to be analyzed individually or in small batches

**Category**: Method  
**Source**: McCall2010 (Source ID: 40)  
**Context**: Addresses the clinical need to process samples individually without requiring a batch.

**Primary Quote**:
> "We propose a preprocessing algorithm, frozen RMA (fRMA), which allows one to analyze microarrays individually or in small batches and then combine the data for analysis. This is accomplished by utilizing information from the large publicly available microarray databases."

**Supporting Quotes**:
- "Although multiarray methods typically outperform single-array ones, they come at a price. For example, a logistics problem arises from the need to analyze all samples at once which implies that data sets that grow incrementally need to be processed every time an array is added. More importantly, as we demonstrate later, artifacts are introduced when groups of arrays are processed separately."


---


## C_91: Reference-based normalization adjusts a single sample against a pre-computed reference distribution from training data

**Category**: Method  
**Context**: Critical for clinical deployment where each patient sample may constitute its own "batch."

**Primary Quote**:
> "In particular, estimates of probe-specific effects and variances are precomputed and frozen. Then, with new data sets, these are used in concert with information from the new arrays to normalize and summarize the data."

**Supporting Quotes**:
- "Katz and others (2006) proposed performing these tasks by running RMA on a reference database of biologically diverse samples. The resulting probe-effect estimates, φ̂, and the reference distribution used in the quantile normalization step were stored or 'frozen' for future use."


---


## C_93: Beta values for DNA methylation are bounded between 0 and 1 but violate Gaussian distribution assumptions

**Category**: Method  
**Source**: Du2010 (Source ID: 34)  
**Context**: This necessitates transformation to M-values before applying standard batch correction.

**Primary Quote**:
> "The Beta-value range is from 0 and 1 and can be interpreted as an approximation of the percentage of methlyation. However, because the Beta-value has a bounded range, this statistic violates the Gaussian distribution assumption used by many statistical methods, including the very prevalent t-test."

**Supporting Quotes**:
- "The range of Beta-values is between 0 and 1, which can be interpreted as the approximation of the percentage of methylation for the population of a given CpG site in the sample."


---


## C_94: M-values (log2 ratio of methylated to unmethylated intensities) have better statistical properties for differential methylation analysis

**Category**: Method  
**Source**: Du2010 (Source ID: 34)  
**Context**: M-values are more statistically valid than Beta-values for parametric tests.

**Primary Quote**:
> "the M-value is more statistically valid for the differential analysis of methylation levels"

**Supporting Quotes**:
- "The M-value is calculated as the log2 ratio of the intensities of methylated probe versus unmethylated probe"
- "the M-value method is more statistically valid in differential and other statistic analysis as it is approximately homoscedastic"
- "The Beta-value range is from 0 and 1 and can be interpreted as an approximation of the percentage of methlyation. However, because the Beta-value has a bounded range, this statistic violates the Gaussian distribution assumption used by many statistical methods, including the very prevalent t-test."


---


## C_95: For DNA methylation analysis, M-values should be used for statistical testing while beta-values should be reported for biological interpretation

**Category**: Method  
**Source**: Du2010 (Source ID: 34)  
**Context**: This recommendation balances statistical validity with interpretability in methylation studies.

**Primary Quote**:
> "The Beta-value has a more intuitive biological interpretation, but the M-value is more statistically valid for the differential analysis of methylation levels. Therefore, we recommend using the M-value method for conducting differential methylation analysis and including the Beta-value statistics when reporting the results to investigators."

**Supporting Quotes**:
- "The Beta-value range is from 0 and 1 and can be interpreted as an approximation of the percentage of methlyation. However, because the Beta-value has a bounded range, this statistic violates the Gaussian distribution assumption used by many statistical methods, including the very prevalent t-test."
- "The M-value is calculated as the log2 ratio of the intensities of methylated probe versus unmethylated probe"


---


## C_97: Quantile normalization, median normalization, and variance stabilization normalization (VSN) are commonly used for proteomics data

**Category**: Method  
**Source**: Valikangas2016 (Source ID: 35)  
**Context**: Many normalization methods commonly used in proteomics have been adapted from DNA microarray techniques. The choice of normalization method significantly impacts downstream analysis results.

**Primary Quote**:
> "Their tool includes several popular normalization methods such as linear regression, local regression, total intensity, average intensity, median intensity, variance stabilization normalization (Vsn) and quantile normalization, together with several frequently used evaluation measures used to assess the performance of a normalization method such as the pooled coefficient of variation (PCV), the pooled median absolute deviation (PMAD) and the pooled estimate of variance (PEV)"

**Supporting Quotes**:
- "Many normalization methods commonly used in proteomics have been adapted from the DNAmicroarray techniques."
- "We found that variance stabilization normalization (Vsn) reduced variation the most between technical replicates in all examined data sets. Vsn also performed consistently well in the differential expression analysis. Linear regression normalization and local regression normalization performed also systematically well."


---


