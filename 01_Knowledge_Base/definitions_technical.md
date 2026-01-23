     1|# Technical Definitions
     2|
     3|This document contains mathematical formulas and technical definitions for batch correction methods and related concepts.
     4|
     5|## ComBat
     6|
     7|**Formula**: Uses Empirical Bayes to estimate location (L) and scale (S) parameters.
     8|
     9|**Assumptions**: 
    10|- Assumes Gaussian distribution
    11|- Requires continuous data
    12|
    13|**Reference**: Source ID 4
    14|
    15|## ComBat-Seq
    16|
    17|**Formula**: Uses Negative Binomial regression to preserve integer counts for RNA-Seq data.
    18|
    19|**Key Features**:
    20|- Preserves integer counts
    21|- Designed for count-based sequencing data
    22|- Uses Negative Binomial distribution
    23|
    24|**Reference**: Source ID 5
    25|
    26|## ComBat-Ref
    27|
    28|**Formula**: Improves power by anchoring to a low-dispersion batch.
    29|
    30|**Key Features**:
    31|- Reduces false positives compared to ComBat-Seq
    32|- Uses reference batch selection method
    33|- Unique feature: Reference batch selection (not in standard ComBat-Seq)
    34|
    35|**Reference**: Source ID 6
    36|
    37|## Mutual Information (MI)
    38|
    39|**Definition**: Quantifies the dependency between two random variables. If variables are completely independent, MI = 0; if one variable fully determines the other, MI reaches its maximum value.
    40|
    41|**Formula for discrete variables (Eq. 1 in source)**:
    42|<!-- formula-not-decoded -->
    43|
    44|**Shannon Entropy Relation (Eq. 2 in source)**:
    45|<!-- formula-not-decoded -->
    46|
    47|**Key Features**:
    48|- Captures non-linear dependencies.
    49|- Not a classical distance metric (does not satisfy triangle inequality).
    50|- Can be transformed into a distance metric (e.g., Information Metric Distance).
    51|
    52|**Reference**: Source ID 15
    53|
    54|## Pearson Correlation Coefficient
    55|
    56|**Definition**: Measures the strength and direction of the linear relationship between two vectors (gene expression profiles).
    57|
    58|**Formula (Eq. 13 in source)**:
    59|<!-- formula-not-decoded -->
    60|
    61|**Distance Transformation (Eq. 14 in source)**:
    62|<!-- formula-not-decoded -->
    63|
    64|**Key Features**:
    65|- Ranges from -1 (perfect negative linear dependence) to 1 (perfect positive linear dependence).
    66|- Fast and computationally simple.
    67|- Focuses on relationship between variations, disregarding absolute values.
    68|
    69|**Reference**: Source ID 15
    70|
    71|## Wasserstein Distance (Earth Mover's Distance)
    72|
    73|**Definition**: Measures the minimum amount of ''work'' required to transform one probability distribution into another.
    74|
    75|**Formula for one-dimensional probability distributions (Eq. 15 in source)**:
    76|<!-- formula-not-decoded -->
    77|
    78|**Key Features**:
    79|- Accounts for differences in expression levels of individual genes.
    80|- Robust to small variations and noise.
    81|- Considers geometric structure of the distribution.
    82|
    83|**Reference**: Source ID 15
    84|
    85|## K-Medoids Clustering
    86|
    87|**Definition**: A clustering algorithm that uses real data points (medoids) as cluster centers, minimizing the sum of distances between points in clusters and their medoids.
    88|
    89|**Assignment of Points (Eq. 16 in source)**:
    90|<!-- formula-not-decoded -->
    91|
    92|**Medoids Update (Eq. 17 in source)**:
    93|<!-- formula-not-decoded -->
    94|
    95|**Key Features**:
    96|- Works with any distance measures (e.g., non-Euclidean metrics like mutual information-based distance, correlation distance, or Wasserstein distance).
    97|- Does not require computation of mean values.
    98|- Medoids are always real points from the dataset, reducing outlier impact.
    99|
   100|**Reference**: Source ID 15
   101|
   102|## Gaussian Mixture Modeling (GMM)
   103|
   104|**Definition**: A probabilistic model that assumes data points are generated from a mixture of a finite number of Gaussian distributions with unknown parameters.
   105|
   106|**Model Selection**: Based on maximization of the Bayesian Information Criterion (BIC), which includes a penalty term to counteract overfitting.
   107|
   108|**Formula for BIC (Eq. 1 or 2 in source)**:
   109|<!-- formula-not-decoded -->
   110|**Reference**: Source ID 19
   111|
   112|## GMMchi
   113|
   114|**Definition**: A Python package that leverages Gaussian Mixture Modeling with an iterative Chi-square pipeline to detect and characterize bimodal gene expression patterns across cancer samples.
   115|
   116|**Key Features**:
   117|- Addresses the "tail problem" (non-normally distributed tails of outliers) by iteratively removing data points from the extreme end of the tail.
   118|- Uses dynamic binning to ensure sufficient observations per bin for valid Chi-square testing.
   119|- Optimizes for the best-fitting model using Chi-square values and BIC scores.
   120|- Robustly and reliably extracts bimodal patterns from microarray and RNA-Seq data.
   121|- Achieves high accuracy (e.g., 85% with n=90, over 90% with n=1000) in categorizing simulated distributions.
   122|
   123|**Reference**: Source ID 19
   124|
   125|## PhenoGMM
   126|
   127|**Definition**: An automated model-based fingerprinting approach based on Gaussian mixture models that quantifies changes in microbial community structure using flow cytometry data.
   128|
   129|**Key Features**:
   130|- Processes large amounts of quantitative single-cell data generated by cytometry.
   131|- Quantifies changes in microbial community structure, expressed in terms of cytometric diversity.
   132|- Addresses shortcomings of traditional fingerprinting approaches by modeling the full multivariate parameter space at once, reducing the number of community-describing variables.
   133|- Evaluated using data sets from both synthetic and natural ecosystems.
   134|
   135|**Reference**: Source ID 22
   136|
   137|## Flow Cytometry (FCM)
   138|
   139|**Definition**: A high-throughput technique that measures optical properties (scatter and fluorescence signals) of individual cells in mere seconds, resulting in multivariate data describing each cell.
   140|
   141|**Applications in Microbiology**: Used to study phenotypic identity and diversity of microbial communities.
   142|
   143|**Challenges with Microbial Data**: Bacterial cells are smaller, lack general antibody-based panels, and have highly overlapping cytometric distributions, complicating automated cell population identification.
   144|
   145|**Reference**: Source ID 22
