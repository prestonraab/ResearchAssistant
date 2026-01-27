# Claims and Evidence: Phenomenon

This file contains all **Phenomenon** claims with their supporting evidence.

---

## C_101: Shortcut learning occurs when deep neural networks exploit spurious correlations in training data

**Category**: Phenomenon  
**Context**: Models learn decision rules based on easy-to-identify features rather than intended causal relationships.

**Primary Quote**:
> "Likewise, a language model may appear to have learned to reason-but drops to chance performance when superficial correlations are removed from the dataset"


---


## C_102: Batch effects in genomic data can mask or simulate biological signals, leading models to encode technical artifacts

**Category**: Phenomenon  
**Context**: When batch effects are confounded with outcomes of interest, models may select and encode batch-related features rather than true biological signals.

**Primary Quote**:
> "We have shown that in the presence of batch effects that are confounded with the signal of interest, many of the highly ranked variables are associated only with the batch effect and not truly differentially expressed between the interesting groups. Consequently, they are unlikely to hold up as statistically, as well as biologically, significant discriminators in any other study."


---


## C_103: Models trained on genomic data may encode batch identity as a primary feature when batch effects explain substantial variance

**Category**: Phenomenon  
**Context**: When batch effects are confounded with biological outcomes, classifiers may learn to discriminate based on batch identity, achieving high internal performance while failing to generalize to external data.

**Primary Quote**:
> "Confounding factors like these may affect certain genes in such a way that we observe a difference between the two sample groups in the training data, which are not truly related to the factor we are interested in (above, the difference between the two drugs). This means that it may very well be possible to build a classifier that works well on this specific data set, but since these variables are not truly linked to the differences between the drugs, but rather to technical effects, they are unlikely to hold up as good discriminators in another data set."


---


## C_104: Batch effects arise from technical sources including laboratory conditions, reagent lots, and personnel differences

**Category**: Phenomenon  
**Context**: High-throughput technologies are affected by systematic technical variations that occur during sample processing and measurement.

**Primary Quote**:
> "measurements are affected by laboratory conditions, reagent lots and personnel differences"


---


## C_105: Batch effects are systematic technical variations introduced when handling samples in batches

**Category**: Phenomenon  
**Context**: Batch effects represent systematic and technical variations that arise during sample collection and processing, distinct from biological variation.

**Primary Quote**:
> "Batch effects (BE) refer to the systematic and technical variations between measurements introduced when handling samples in batches."


---


## C_106: Equipment variations and calibration differences introduce systematic biases that manifest as batch effects

**Category**: Phenomenon  
**Context**: Different equipment or variations in equipment performance over time create systematic technical biases in omics data.

**Primary Quote**:
> "Different equipment used for sample processing or data acquisition, or variations in the performance and calibration of the same equipment over time, can introduce systematic biases that manifest as batch effects."


---


