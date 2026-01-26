# Claims and Evidence: Result

This file contains all **Result** claims with their supporting evidence.

---

## C_21: The proposed hybrid model achieved classification accuracy exceeding 95.9% and a weighted F1-score above 95.8% on the TCGA dataset

**Category**: Result  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Dataset included over 6,000 patient samples covering 13 cancer types.

**Primary Quote**:
> "In the initial modeling stage using gene expression data from over 6,000 patient samples covering 13 cancer types (TCGA dataset), the proposed model achieved classification accuracy exceeding 95.9% and a weighted F1-score above 95.8%."

**Supporting Quotes**:
- "For the internal dataset consisting of 6344 samples across 13 cancer types, the hybrid model yielded a mean accuracy of 95.9% and a weighted F1-score of 95.8% under a two-cluster structure."


---


## C_22: External validation of the hybrid model on Alzheimer's and Type 2 Diabetes datasets confirmed its generalizability

**Category**: Result  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Accuracies reached 96.28% and 97.43% respectively.

**Primary Quote**:
> "External validation using Alzheimer's (GSE174367) and Type 2 Diabetes (GSE81608) datasets confirmed the model's generalizability, with accuracy values reaching 96.28% and 97.43%, and weighted F1-scores of 96.26% and 97.41%, respectively."

**Supporting Quotes**:
- "For Alzheimer's disease data (GSE174367), accuracy reached 96.28% (Wasserstein) and 96.25% (Correlation), while for Type 2 Diabetes data (GSE81608), accuracy peaked at 97.43% (Correlation) and 97.38% (Wasserstein)."


---


## C_25: For gene expression data, Wasserstein distance and correlation metrics consistently outperform mutual information-based metrics

**Category**: Result  
**Source**: Babichev2025 (Source ID: 15)  
**Context**: Demonstrated across multiple cluster structures (2-10 clusters) and validated on independent Alzheimer's and Type 2 Diabetes datasets.

**Primary Quote**:
> "Fig. 4 shows the results for a two-cluster structure, representing the simplest division of data. Even at this level, the Wasserstein (WST) and correlation metrics outperform mutual information-based metrics (EMI, JF) in terms of classification accuracy. Figs. 5-7 (three to five clusters) illustrate that the advantage of WST and correlation metrics remains consistent, with a slight improvement in performance as the number of clusters increases."

**Supporting Quotes**:
- "The results of model validation on both independent datasets confirm the initial hypothesis regarding the superior effectiveness of correlation-based and Wasserstein distance metrics compared to information-theoretic proximity measures. Across both transcriptomic contexts -neurodegeneration and metabolic disease -these two metrics consistently yielded the highest classification performance."
- "In the Alzheimer's disease dataset, the model achieved its best performance using the Wasserstein (WST) and Correlation metrics, with accuracy scores of 96.28% and 96.25%, respectively, and corresponding Weighted F1-scores of 96.26% and 96.24%. In contrast, the proximity metrics based on mutual information estimation-namely, EMI and JF-produced lower accuracy (94.14% and 93.62%) and F1-scores."


---


## C_38: SVA increases the biological accuracy and reproducibility of analyses in genome-wide expression studies

**Category**: Result  
**Source**: Leek2007 (Source ID: 7)  
**Context**: Achieves operating characteristics nearly equivalent to what one would obtain with no expression heterogeneity at all.

**Primary Quote**:
> "We show that SVA increases the biological accuracy and reproducibility of analyses in genome-wide expression studies."

**Supporting Quotes**:
- "SVA-adjusted analyses provide gene rankings comparable to the scenario where there is no heterogeneity, whereas an unadjusted analysis allows for incorrect and highly variable gene rankings."
- "These results suggest that SVA would yield results reproducible on the level that we would expect given that the primary variable is the only source of signal."


---


## C_42: GMMchi robustly and reliably extracts bimodal patterns from both colorectal cancer cell line-derived microarray and tumor-derived RNA-Seq data

**Category**: Result  
**Source**: Liu2022 (Source ID: 19)  
**Context**: Confirmed previously reported gene expression correlates of well-characterized CRC phenotypes.

**Primary Quote**:
> "We confirm that GMMchi robustly and reliably extracts bimodal patterns from both colorectal cancer (CRC) cell line-derived microarray and tumor-derived RNA-Seq data and verify previously reported gene expression correlates of some well-characterized CRC phenotypes."


---


## C_43: GMMchi achieved 85% accuracy with a sample size of n=90 in simulated data, and exceeds 90% accuracy with a sample size of about 1000

**Category**: Result  
**Source**: Liu2022 (Source ID: 19)  
**Context**: Demonstrates accuracy in categorizing simulated distributions across varying sample sizes.

**Primary Quote**:
> "GMMchi performs well with a minimum sample size, n, of about 100 and continues to do well with increasing sample size, exceeding 90% accuracy with a sample size of about 1000."

**Supporting Quotes**:
- "Using well-defined simulated data, we were able to confirm the robust performance of GMMchi, reaching 85% accuracy with a sample size of n = 90."
- "In the current data landscape, with many datasets having sample sizes well above 100 and often approaching 1000, such as the TCGA CRC data on 637 samples, GMMchi should provide good data models for the objective analysis of observed mRNA expression level distributions."


---


## C_51: CycleMix can flexibly assign cells to any number of states and accurately distinguish cycling from non-cycling cells

**Category**: Result  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: Benchmarked on both gold-standard and silver-standard datasets across different single-cell RNA-seq technologies.

**Primary Quote**:
> "We present CycleMix, a novel scalable cell-cycle classification algorithm based on Gaussian Mixture modeling. Briefly, this approach uses a weighted average log-normalized expression to combine positive and negative gene markers to generate stage-specific scores which are binarized into discrete classifications by fitting a mixture of Gaussian distributions and using the BIC to select the optimal model (Figure 1). This enabled it to more accurately distinguish cycling vs. non-cycling cells than the most commonly used approaches, while maintaining a high degree of scalability."

**Supporting Quotes**:
- "Here we propose CycleMix, an alternative cell-cycle assignment algorithm that can flexibly assign cells into any number of states provided sufficient marker genes as well as being capable of identifying when cells are not cycling."
- "However, only CycleMix accurately assigned more than >90% of quiescent cells to a non-cycling phase, whereas Seurat assigned 25%-50% of quiescent cells to S/G2M."


---


## C_53: Benchmarking on high-throughput droplet-based scRNAseq datasets showed CycleMix accurately assigned over 90% of quiescent cells to a non-cycling phase

**Category**: Result  
**Source**: Peplinski2025 (Source ID: 21)  
**Context**: This was consistent with Seurat exhibiting much higher false-positive rates for S and G2M cell-type assignments.

**Primary Quote**:
> "However, only CycleMix accurately assigned more than >90% of quiescent cells to a non-cycling phase, whereas Seurat assigned 25%-50% of quiescent cells to S/G2M."

**Supporting Quotes**:
- "These results were consistent with Seurat exhibiting much higher false-positive rates for S and G2M cell-type assignments as we observed in the gold-standard datasets."


---


## C_56: PhenoGMM successfully quantifies changes in microbial community structure based on flow cytometry data

**Category**: Result  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: Evaluated using data sets from both synthetic and natural ecosystems.

**Primary Quote**:
> "The method successfully quantifies changes in microbial community structure based on flow cytometry data, which can be expressed in terms of cytometric diversity. We evaluate the performance of PhenoGMM using data sets from both synthetic and natural ecosystems"

**Supporting Quotes**:
- "The α-diversity of the microbial communities in Muskegon Lake could be successfully retrieved as well."
- "Estimations of β-diversity (i.e., intercommunity diversity) could be successfully quantified as well, by calculating Bray-Curtis dissimilarities between the cytometric fingerprints of different communities."


---


## C_60: In synthetic microbial communities, PhenoGMM showed moderate to highly correlated alpha-diversity estimations

**Category**: Result  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: This indicates that PhenoGMM captures community structure rather than identity.

**Primary Quote**:
> "PhenoGMM resulted in moderate to highly correlated a-diversity estimations and showed a better correspondence to the predefined community compositions compared to PhenoGrid. Estimations were just above the significance level ( P =0.05) for the latter. The performance mainly depended on the sensitivity parameter q . Estimations resulted in higher correlations for PhenoGMM when q . 0, i.e., when more weight was given to more abundant strains. This means that PhenoGMM captured the structure rather than the identity of a microbial community."


---


## C_61: PhenoGMM successfully quantified the community structure of most natural freshwater microbial communities

**Category**: Result  
**Source**: Rubbens2021 (Source ID: 22)  
**Context**: Performance varied by ecosystem but was successful for most considered natural communities.

**Primary Quote**:
> "To summarize, PhenoGMM successfully quantified the community structure of most considered natural communities, but its ability depended on the ecosystem of study and its specific implementation."

**Supporting Quotes**:
- "Diversity estimations were highly significant for the cooling water microbiome for both approaches. The α-diversity of the microbial communities in Muskegon Lake could be successfully retrieved as well."
- "In the second experiment, we evaluated whether and to what extent it was possible to quantify the diversity of natural freshwater microbial communities using FCM in combination with PhenoGMM."


---


## C_78: Random forest gene selection yields very small sets of genes while preserving predictive accuracy

**Category**: Result  
**Source**: Díaz-Uriarte and Alvarez de Andrés 2006 (Source ID: 28)  
**Context**: Demonstrated using simulated and nine microarray datasets.

**Primary Quote**:
> "Our method returns very small sets of genes compared to alternative variable selection methods, while retaining predictive performance."

**Supporting Quotes**:
- "the variable selection procedure leads to small (< 50) sets of predictor genes, often much smaller than those from competing approaches"


---


## C_87: Neural networks outperform state-of-the-art methods only for very large training set sizes in gene expression classification

**Category**: Result  
**Source**: Hanczar2022 (Source ID: 33)  
**Context**: For small training sets, transfer learning may strongly improve model performance.

**Primary Quote**:
> "We show that neural networks outperform the state-of-the-art methods only for very large training set size. For a small training set, we show that transfer learning is possible and may strongly improve the model performance in some cases."

**Supporting Quotes**:
- "The most challenging problems are the high dimensionality of the gene expression data, the insufficient number of training examples that lead to overfitting during training, and lack of robustness of the results."


---


## C_92: fRMA is comparable to RMA when data are analyzed as a single batch and outperforms RMA when analyzing multiple batches

**Category**: Result  
**Source**: McCall2010 (Source ID: 40)  
**Context**: Demonstrates that reference-based approaches maintain quality while enabling flexibility.

**Primary Quote**:
> "We find that fRMA is comparable to RMA when the data are analyzed as a single batch and outperforms RMA when analyzing multiple batches."


---


## C_98: No single normalization method performs best across all proteomics datasets

**Category**: Result  
**Source**: Valikangas2016 (Source ID: 35)  
**Context**: Systematic evaluation across multiple datasets (UPS1, CPTAC, SGSD) reveals context-dependent performance, though Vsn performed consistently well overall.

**Primary Quote**:
> "While no single method gave the highest AUC in every two-group comparison, the Vsn normalization performed consistently well, giving high AUCs throughout all data sets."

**Supporting Quotes**:
- "Webb-Robertson et al. stated that a single method cannot account for the bias in different data sets; rather it is crucial for reliable downstream analysis to select the appropriate normalization method for each data set."
- "In most of the two-group comparisons in the CPTAC data, no significant differences in the AUCs produced by the best ranking normalization method and the other methods were observed (Delong's test P > 0.05), with few exceptions."


---


