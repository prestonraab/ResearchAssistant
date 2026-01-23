

Domain adaptation in small-scale and heterogeneous biological datasets
https://www.science.org/doi/10.1126/sciadv.adp6040


Batch effects (technical variates) cause problems within the training set and between the train and test sets
1. Within the training set
	1. = training heterogeneity
	2. This is a real situation when using public datasets for training
2. Between train and test
	1. = train-test shift
	2. = distribution shift
	3. This is modeled by using different public datasets for the training and test sets

Technical variates the model can use to distinguish batches:
- sequencing platforms, library preparation kits, patient demographics, other protocols

Test set batch correction helps with generalization if:
- The gene distribution is outside that seen in the training set

Training set batch correction helps with generalization if:
1. The batch is correlated with the label, and the batch can be learned from the data.
2. Batch subpopulations are correlated with the label, yet this correlation is reduced when the batches are aggregated, and both the batch and the subpopulations can be learned from the gene expression data.

Training set diversity, while potentially increasing generalization performance through domain exposure, can harm performance if training batches are confounded with biological signal. 

In general, RNA studies use a diversity of sequencing platforms, library preparation kits, patient demographics, and other protocols that can all introduce learnable effects into the training data. If these studies are used as training sets, but each have a different label compositions, then the labels will be correlated with the batch, resulting in shortcut learning. 

The problem can be more subtle in the case of hidden subpopulations with spurious correlations. Consider the following generic scenario. Both hospitals have the same sex ratio and negative/positive split, yet have reversed correlations between sex and outcome. If a model such as a decision tree was trained on the combined data, it could perform with better than random accuracy knowing only how to predict sex and the source hospital. However, if the data was adjusted to remove the tree's ability to predict the source hospital, then the biology-blind tree could perform no better than random. Note: datasets may have correlations with metadata that are aligned, rather than reversed. This cannot be rectified using batch adjustment. However, the more data that is accumulated, the more likely these correlations are to be true rather than spurious. False correlations should wash out after averaging over several datasets.


| Hospital A | N   | P   |     |     | Hospital B | N   | P   |     |
| ---------- | --- | --- | --- | --- | ---------- | --- | --- | --- |
| Male       | 29  | 11  | 40  |     | Male       | 11  | 29  | 40  |
| Female     | 21  | 39  | 60  |     | Female     | 39  | 21  | 60  |
|            | 50  | 50  | 100 |     |            | 50  | 50  | 100 |

| Combined | N   | P   |     |
| -------- | --- | --- | --- |
| Male     | 40  | 40  | 80  |
| Female   | 60  | 60  | 120 |
|          | 100 | 100 | 200 |

![[Decision tree example.svg]]





Batch correction aims to reduce technical variation, ideally without removing biological variation, between all domains. 

Bulk transcriptomics suffers from a small-dataset problem—few examples per dataset, though many datasets exist to learn from. 

The model can use "shortcut learning" if the batch or dataset confounded with biological variation.
Ensemble learning and batch correction are two approaches to reduce shortcut learning.

Shortcut learning leads to poor domain generalization.

Ideally, we want good domain generalization, the ability to perform well on a new domain (dataset or batch) not seen in training.

Normalization 


Distribution shift—where the data used to train a model is not representative of the data the model is tested on, or sees in real world usage—poses problems for ambitious bioinformatics studies. Distribution shift causes poor real world performance, and can invalidate results from training-time evaluation. In transcriptomics, distribution shift has been observed over time, between labs, and even between batches within a study. This can be for many reasons. (List all the ways that batch of effects can be introduced citing papers.) 

In addition to distribution shift, 
Given the mantra of machine learning, that training on more and diverse data yields better performance,  Differences between public data sets can be even larger than the differences between batches in a single study. 

Batch effects, distribution shift, or dataset heterogeneity may lead to poor performance in downstream tasks. Efforts have been made to reduce this variation through various batch effect correction algorithms. In bulk RNA these techniques are fairly well established. These techniques include combat, RUV, SVA. 

While batch effect correction techniques have been relatively stable, the field of machine learning has not. Over the past two decades, data scientists have been developing better models to fit data from any field. Classifiers in particular are relevant to the field of medical bioinformatics for diagnosis and prognosis.

Given these advancements, it is reasonable to ask whether batch effects have an impact on the classifiers of today. Perhaps modern classifiers are more resilient than older methods. We show that this is true, but that correcting for the batch effects is still beneficial. Further, do batch effect correction algorithms vary in their ability to help these classifiers? Are certain batch effect correction techniques more or less helpful for particular classifiers?

To investigate these questions, we use a particular experimental setup. The setup includes multiple data sets gathered by researchers in various geographical locations. These data sets investigate the effect of tuberculosis on the human transcriptome. The classification task we investigate is predicting whether the disease is actively progressing using gene expression. Additionally, we investigate whether training on a few of these data sets is effective in predicting disease progression in other data sets. This mimics the use case of a scientist who wishes to use public data sets to predict disease progression in patients whose disease status is unknown. 

Key to this investigation is the strength of the data set heterogeneity. This variation is captured in our simulated data through variations in the hyperparameters generating the batch effect, and is captured in our real data sets through differences in study demographics.

We use 6 populations, or subsets for comparison. Two populations come from the same study (Kaforou), but we will 

#### Dataset characteristics
Simulations:

A (Train) Zak et al. [2016]
B (Test) Suliman et al. [2018]


Application:

| Data<br>        | Test             | Geography                          | Demographics              | Reference                                                                 |
| --------------- | ---------------- | ---------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| A (Africa)<br>  | Progression      | South Africa                       | 12-18                     | [Zak et al. [2016]](https://doi.org/10.1016/S0140-6736(15)01316-1)        |
| C (GSE39941)    | Active vs latent | South Africa, the Gambia, Ethiopia | 18+                       | [Anderson et al. [2014]](https://doi.org/10.1164/rccm.201711-2340OC)      |
| D (India)       | Active vs latent |                                    | South Indian              | [Leong et al. [2018]](https://pubmed.ncbi.nlm.nih.gov/29559120/)          |
| E (USA)         | Active vs latent | United States                      | Latino, Asian, other, 18+ | [Walter et al. [2016]](https://pmc.ncbi.nlm.nih.gov/articles/PMC4733166/) |
| F (GSE37250_SA) | Active vs latent | South Africa                       | Xhosa, 18+                | [Kaforou et al. [2013]](https://pubmed.ncbi.nlm.nih.gov/24167453/)        |
| G (GSE37250_M)  | Active vs latent | Malawi                             | Malawi, 18+               | [Kaforou et al. [2013]](https://pubmed.ncbi.nlm.nih.gov/24167453/)        |
|                 |                  |                                    |                           |                                                                           |





Wondering if I need the same sections:
Abstract, Introduction, Methods and Materials, Results, Discussion

Length, structure, style




AI assistance:
https://gemini.google.com/app/6f02e7aa821f8e9f
https://gemini.google.com/app/eb7d2002a29f7e45



There are different types of normalization strategies that could have different effects on classifiers.

- Shift and scale
- Ranking
- Quantile normalization
- Gaussian process

Yet, we don't see differences.

Therefore, improvements in batch normalization likely are independent of classifier. Why?
- Because classification doesn't depend on interactions between genes?


![[Pasted image 20260109144719.png]]

![[Pasted image 20260103162720.png]]

![[Pasted image 20260109144825.png]]
/home/phr23/confounded_analysis/grp_batch_effects/outputs/book_chapter/adjusters_on_classifiers.png



There are different types of normalization strategies that could have different effects on classifiers.

- Per-gene Shift and scale
- Per-gene Ranking
- Ranking across genes and samples
- Per gene Quantile normalization
- Non linear Gaussian process

Which adjuster should I use?
- Combat is the best, though there is room for improvement.

Does the choice of adjuster depend on the classifier?
- No, Combat is best

Does the performance of a particular adjuster relative to the others change depending on the classifier?
- Yes, slightly. 
	- Supervised Combat, with knowledge of training labels, crashes for the KNN classifier.
	- MNN is slightly better in comparison on the KNN classifier
- But in general, the relative performance is predictable for each adjuster. 
- Therefore, adjusters have no large interactions with classifier type.  
- We predict that if there is a adjustment method better than Combat in a classification context, it will be generally better for all classifier types. 
- 

https://gemini.google.com/share/cd1c6d63ef4f


#### Introduction
The batch effect problem for classification using bulk rna data. 
Specifically, when the batches are known.
What are batch effects? 
Why are they a problem?
Why would someone want to use bulk rna for classification?
- For Tubercolosis, the goal has been to find a gene signature that works across geography. While not the 
- Cross study validation shows that the normalization techniques used are viable for integrating multiple studies for the purpose of learning from the combined data.

Goal of this study: determine how different BECAs impact classifier performance.
Main question: Do specific classifiers do better with specific BECAs, or is performance independent?

#### Normalization methods
Group methods into various categories.
Cite that review paper; these might be the same categories. 
https://pmc.ncbi.nlm.nih.gov/articles/PMC11447944/
- Location-scale
- Matrix Factorization
- Distance-neigborhood
- Deep learning



"Moreover, cross-batch prediction is a critical aspect of multiomics analysis, particularly when it comes to identifying and validating molecular expression signatures that can be used for diagnosis, prognosis, and prediction of diseases and subsequent biomarker development [[36](https://pmc.ncbi.nlm.nih.gov/articles/PMC11447944/#CR36)]. In many cases, a predictive model is built using a batch of samples (existing data), which is then applied to other batches of samples (future data)."
"Cross-batch prediction results can be compared with the truth (e.g., clinical endpoint) to evaluate the performance of prediction."

**Why might adjuster performance be dependent on classifier?**
Data transformations that modify the shape of the sample distribution within a gene could affect performance for particular classifiers. Transforming each gene expression value into a rank would not affect tree-based classifiers, since the within-feature order would remain constant, but it would affect the logits of a neural net or logistic regressor. 

We use MCC, a confusion-matrix metric to evaluate performance. All confusion matrix metrics are sensitive only to changes in the decision boundary, not to changes in confidence. However, confidence is a factor in the loss function of a neural net, so changes in the shape of the feature distributions can lead to a change in the decision boundary.  Using ranks would remove the skew of any distribution, Further transforming the ranks into a standard normal distribution—the outcome of nonparanormal normalization—would have a similar effect. 



While these methods may choose different parameters for the adjustment, they can be organized by the common parameters.

Consider a location-scale batch model interfacing with a logistic regression classifier. The classifier, trained on the training data, finds a hyperplane and zone of uncertainty to separate the classes. The unadjusted test data exists in this space, likely poorly aligned to the hyperplane. A location scale model will shift and scale each axis, hopefully such that the test data lie on the correct sides of the hyperplane. While different methods will choose different parameters for the shift and scale, we expect these methods to generally perform similarly since they share the same interface for affecting the logistic regression classifier.

The MNN batch model is fundamentally different; it has parameters for every gene and sample, which allows samples to move relative to their batch. In the logistic regression context, this could allow samples to move across the hyperplane, or into a zone of higher confidence, without the movement of the entire test batch. Freedom from the bias of the location-scale models implies additional variance in the model parameters with respect to the data. These differences allow for the possibility of classifier-dependent performance.



#### Results
Supervised Combat, with knowledge of training labels, crashes for the KNN classifier. 
We did not find a significant difference for most classifiers and adjusters. 

If the null hypothesis is that adjuster and classifier performance is independent, we did not disprove the null hypothesis. This suggests that generally, adjuster performance for one classifier is predictive of performance using another classifier. 



#### Discussion







https://pmc.ncbi.nlm.nih.gov/articles/PMC6478271/


