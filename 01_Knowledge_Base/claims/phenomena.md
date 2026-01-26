# Claims and Evidence: Phenomenon

This file contains all **Phenomenon** claims with their supporting evidence.

---

## C_101: Shortcut learning occurs when deep neural networks exploit spurious correlations in training data

**Category**: Phenomenon  
**Source**: Geirhos2020 (Source ID: 38)  
**Context**: Models learn decision rules based on easy-to-identify features rather than intended causal relationships.

**Primary Quote**:
> "Likewise, a language model may appear to have learned to reason-but drops to chance performance when superficial correlations are removed from the dataset"

**Supporting Quotes**:
- "One central observation is that many failure cases are not independent phenomena, but are instead connected in the sense that DNNs follow unintended 'shortcut' strategies. While superficially successful, these strategies typically fail under slightly different circumstances."
- "For instance, a DNN may appear to classify cows perfectly well-but fails when tested on pictures where cows appear outside the typical grass landscape, revealing 'grass' as an unintended (shortcut) predictor for 'cow'"
- "Shortcuts are decision rules that perform well on standard benchmarks but fail to transfer to more challenging testing conditions, such as real-world scenarios."


---


## C_102: Batch effects in genomic data can mask or simulate biological signals, leading models to encode technical artifacts

**Category**: Phenomenon  
**Source**: Soneson2014 (Source ID: 43)  
**Context**: When batch effects are confounded with outcomes of interest, models may select and encode batch-related features rather than true biological signals.

**Primary Quote**:
> "We have shown that in the presence of batch effects that are confounded with the signal of interest, many of the highly ranked variables are associated only with the batch effect and not truly differentially expressed between the interesting groups. Consequently, they are unlikely to hold up as statistically, as well as biologically, significant discriminators in any other study."

**Supporting Quotes**:
- "As the level of confounding increases, the fraction of batch-related genes that are included in the final classifier increases, most rapidly for the Wilcoxon variable selection. Recall that these genes are not truly associated with the group discrimination, and that in fact they do not hold up as good discrimination rules when applied to a data set without this specific batch effect"
- "Worse yet, a machine classifier successfully detected pneumonia from X-ray scans of a number of hospitals, but its performance was surprisingly low for scans from novel hospitals: The model had unexpectedly learned to identify particular hospital systems with near-perfect accuracy (e.g. by detecting a hospital-specific metal token on the scan, see Figure 1). Together with the hospital's pneumonia prevalence rate it was able to achieve a reasonably good prediction-without learning much about pneumonia at all"
- "Batch effects (BE) refer to the systematic and technical variations between measurements introduced when handling samples in batches. BE are ubiquitous in gene expression analysis, and their presence could mask or simulate biological signals in data, resulting in either spurious and/or missed associations, especially when the biological factor of interest is confounded with a given batch"
- "In the most benign cases, batch effects will lead to increased variability and decreased power to detect a real biological signal. Of more concern are cases in which batch effects are confounded with an outcome of interest and result in misleading biological or clinical conclusions."


---


## C_103: Models trained on genomic data may encode batch identity as a primary feature when batch effects explain substantial variance

**Category**: Phenomenon  
**Source**: Soneson2014 (Source ID: 43)  
**Context**: When batch effects are confounded with biological outcomes, classifiers may learn to discriminate based on batch identity, achieving high internal performance while failing to generalize to external data.

**Primary Quote**:
> "Confounding factors like these may affect certain genes in such a way that we observe a difference between the two sample groups in the training data, which are not truly related to the factor we are interested in (above, the difference between the two drugs). This means that it may very well be possible to build a classifier that works well on this specific data set, but since these variables are not truly linked to the differences between the drugs, but rather to technical effects, they are unlikely to hold up as good discriminators in another data set."

**Supporting Quotes**:
- "As expected, in all cases, the performance of the classifiers when applied to the external validation set is not better than chance, with an average misclassification rate close to 50%. However, the cross-validation estimate (the 'internal' measure) depends strongly on the level of confounding between the batch and the group labels... with full confounding the cross-validation procedure estimates the misclassification rate to 0 (that is, all samples can be correctly classified). This is not surprising since in the case of full confounding, there is no way to discriminate the batch effect from a true group difference in the training data set."
- "We found batch effects for all of these data sets, and substantial percentages (32.1-99.5%) of measured features showed statistically significant associations with processing date, irrespective of biological phenotype. This suggests that batch effects influence a large percentage of the measurements from genomic technologies."
- "Instead, for all of the studied data sets, the surrogates for batch (date or processing group) were strongly correlated with one of the top principal components. In general, the correlation with the top principal components was not as high for the biological outcome as it was for the surrogates. This suggests that technical variability was more influential than biological variability across a range of experimental conditions and technologies."


---


## C_104: Batch effects arise from technical sources including laboratory conditions, reagent lots, and personnel differences

**Category**: Phenomenon  
**Source**: Leek2010 (Source ID: 24)  
**Context**: High-throughput technologies are affected by systematic technical variations that occur during sample processing and measurement.

**Primary Quote**:
> "measurements are affected by laboratory conditions, reagent lots and personnel differences"

**Supporting Quotes**:
- "The processing of samples using protocols that differ among laboratories has been linked to batch effects. In such cases, the samples that have been processed using the same protocol are known as processing groups. For example, multiple laboratory comparisons of microarray experiments have shown strong laboratory-specific effects. In addition, in nearly every gene expression study, large variations are associated with the processing date, and in microarray studies focusing on copy number variation, large effects are associated with DNA preparation groups. The processing group and date are therefore commonly used to account for batch effects. However, in a typical experiment these are probably only surrogates for other sources of variation, such as ozone levels, laboratory temperatures and reagent quality."


---


## C_105: Batch effects are systematic technical variations introduced when handling samples in batches

**Category**: Phenomenon  
**Source**: Talhouk2016 (Source ID: 9)  
**Context**: Batch effects represent systematic and technical variations that arise during sample collection and processing, distinct from biological variation.

**Primary Quote**:
> "Batch effects (BE) refer to the systematic and technical variations between measurements introduced when handling samples in batches."

**Supporting Quotes**:
- "Despite advances in molecular research, clinical adoption of gene expression assays has been slow. This is proposed to be, in part, due to the impact of technological and biological biases that arise during sample collection and processing, resulting in poor reproducibility."
- "Approaches for BE adjustment in multi-sample data generally assume homogeneity amongst populations across batches, which is often not the case in practice. In addition, multisample methods are impractical in clinical settings, where patient samples are typically collected in small numbers, often one at a time, making single-patient data processing vital to the translation of molecular assays."


---


## C_106: Equipment variations and calibration differences introduce systematic biases that manifest as batch effects

**Category**: Phenomenon  
**Source**: Yu2024 (Source ID: 64)  
**Context**: Different equipment or variations in equipment performance over time create systematic technical biases in omics data.

**Primary Quote**:
> "Different equipment used for sample processing or data acquisition, or variations in the performance and calibration of the same equipment over time, can introduce systematic biases that manifest as batch effects."

**Supporting Quotes**:
- "Variations in the quality, composition, or performance of reagents used during sample preparation, processing, and data acquisition can introduce systematic technical biases, leading to batch-specific patterns. Differences in reagent lots, manufacturers, or expiration dates can further exacerbate these issues, making careful selection and consistent usage of reagents across all samples essential to minimize batch effects."
- "Environmental factors such as temperature, humidity, and air quality within the laboratory can vary over time and across different lab spaces, potentially impacting sample stability, enzymatic reactions, and instrument performance."
- "When samples are processed by manual pipetting, there is a risk of personnel variability due to differences in pipetting techniques."


---


