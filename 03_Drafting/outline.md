## Impacts of batch effects on the performance of machine learning classifiers across multiple studies
#### In "Artificial Intelligence and Machine Learning in Genomics and Precision Medicine"

## Abstract
- How should the abstract be structured for narrative flow?
- What is the opening framing for the chapter?
- When is it useful to combine datasets?
- What is the central problem introduced?
- How are predictors impacted by batch effects between datasets?
- What is the chapter's scope?

---

## Background and Significance

### Classification in Precision Medicine
- What is the opening topic sentence for classification?
- What is classification?
- Why is classification useful for biomedical tasks?
- What data is used for biomedical classification?

### The Clinical Stakes
- Why does batch effect mitigation matter clinically?

### The Imperative to Combine Datasets
- What is the transition to dataset combination?
- When is it useful/necessary to combine datasets?
- How should GEO be introduced?
- What is the key insight about data reuse?

### The Challenge of Batch Effects
- How should batch effects be introduced as a challenge?
- All of these types of data have batch effects between datasets
- Predictors on any of these types of data are impacted by batch effects
- Batch effects can be remedied using adjusters

### Focus on Gene Expression Data
- **MERGE with "Gene Expression in Precision Medicine" to eliminate redundancy**
- How should the focus on gene expression be introduced?
- This chapter will focus on gene expression data as a key example
- How is gene expression data generated and used within biological/biomedical research?
- When is classification for gene expression useful in the context of precision medicine?
- What is the key framing about gene expression and batch effects?
- **Define RNA-seq and GEO ONCE, not multiple times**
- How should dataset integration be revisited for gene expression?
- Revisit combining datasets
- What is the key insight about batch effect magnitude?
- What specific effects do batches have on gene expression?
- How do batch effects affect classifier performance?

### Unknown Batch Effects
- How should unknown batch effects be positioned?
- Touch on unknown batch effects (within datasets). Point to SVA
- **First mention of SVA: Define the problem** - Sometimes we don't know the batch labels (especially with public data)
- Briefly introduce SVA as a method to identify unknown batch effects
- Note: This is scoped as beyond the chapter's focus on known batch correction
- **Second mention will appear in "The Horizon"** - Advanced application of SVA in automated pipelines
- Transition to classifiers

---

## Machine Learning Classifiers for Gene Expression Data

- How should the classifiers section be framed?
- What is the opening framing for classifiers?
- Explain great performing classifiers in general
- ML, traditional, broad strokes, direction of field in usage
- What specific classifiers do well with gene expression?

### Classifier Architectures
- How should classifiers be organized?

#### Regularized Linear Models
- What is the key insight about regularization?
- How should elastic net be described for genomics?
- Explain each type of classifier
- Logistic regression with/without regularization

#### Ensemble Methods
- What is the key characteristic of ensemble methods for genomics?
- Random forests
- How should XGBoost be described?

#### Non-linear Geometric Models
- What distinguishes geometric models in the genomic context?
- Support vector machines
- Neural networks
- Very general way, the kinds of genomics data that they are useful for
- https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1009926

### The Role of Data Scale
- How should data scale be discussed?
- Neural Net if you have enough data, which sometimes happens (some kinds of genomics data)
- Such as all of GEO or > 1000

---

## Batch Correction Methods

- How should the adjusters section be framed?
- Gene expression gives us an excellent insight into how batch effects can be modeled and removed

### A Taxonomy of Batch Correction Methods
- How can batch correction methods be categorized?
- Scale/Location Methods
- Matrix Factorization Methods
- Nearest Neighbor Methods

### The ComBat Framework
- The ComBat model works well for bulk RNA
- Where else does ComBat work well?
- Why learn about ComBat?

### Methods for Other Modalities
- In other modalities, what other techniques are used?
- Single-cell methods: Harmony, LIGER, Seurat

### The Failure of Mutual Nearest Neighbors for Bulk RNA-Seq
- We will explore the use of MNN for bulk RNA, and show it doesn't work well
- Why does MNN fail for bulk RNA-seq? The "Islands vs. Continent" Problem

### The Link Between Adjustment and Classifier Performance
- Why does classifier performance depend on adjustment?
- Why is cross study performance a good indicator of both biological preservation and batch reduction?
- What are some common evaluation metrics, and why are they not as good? (Limitations)
- PCA
- Things in BatchQC

### Clinical Portability: The Single Sample Problem
- What is the single sample problem in precision medicine?
- What are the implications for clinical deployment?
- What solutions exist for single sample correction?

---

## Case Study: Cross-Study Tuberculosis Classification

- How should the TB results be framed?

### Datasets: A Natural Stress Test for Batch Correction
- Why were these specific TB datasets chosen to represent "Real World Noise"?
- How does the heterogeneity (adolescent/adult, blood/sputum, three continents) serve as a feature, not a limitation?
- What is the common biological thread across datasets that makes them comparable?
- What technical details should be captured in a summary table?
  - Study, Region, Population, Sample Type, Design, Key Characteristics
- How does this collection test cross-population generalizability?
- What makes this a "stress test" rather than a limitation?

### Classifier Performance Rankings: Lessons Learned
- What is the key finding about classifier hierarchy?
- How should Figure 1 be described?
- Methods
- Results (Figure 1)
- What does Figure 1 reveal about classifier rankings?
- Why does elastic net's regularization specifically ignore technical noise?
- What is the mechanism: L1/L2 mechanics?
- Discussion on classifier complexity

### Interaction Effects Between Adjusters and Classifiers
- Why might adjusters and classifiers have interaction effects?
- Do specific classifiers do better with specific adjusters, or is performance independent?
- Results (Figure 2) - emphasize the "delta" (change in MCC) compared to baseline
- What does Figure 2 reveal about the change in performance?
- How should the visual emphasis on "delta" be described?
- What patterns emerge from Figure 2?
- Show a few places where interactions occur, but mostly independent performance
- What is the mechanism of adjuster-classifier interactions?

---

## The Perils of Supervised Batch Correction

- How should the supervised adjustment warning be presented?

### A Critical Warning for Practitioners
- What is the fundamental truth about supervised correction?
- Imbalanced data
- Using labels, or known groups for batch adjustment
- Results (Figure 3) - emphasize the catastrophic negative delta for supervised adjustment with KNN

### The Mechanism of Failure
- What is the specific mechanism of supervised adjustment failure?
- How does KNN's performance "tank" in supervised vs unsupervised settings?
- What is the visual story in Figure 3 about catastrophic failure?
- Shows that supervised adjustment fails to generalize

### Appropriate Unsupervised Correction
- Show something about imbalanced training data

---

## Considerations for Cross-Study Validation

- What is the key message about cross-validation?

### The Limitations of Internal Cross-Validation
- Why comparing to internal cross validation performance may be misleading
- Results aggregated over classifiers (Figure 4) - emphasize the "optimism delta" between within-study and cross-study validation
- What does the "optimism delta" reveal about performance inflation?
- How should Figure 4 visually communicate this gap?

### Batch Adjustment Versus Meta-Analysis
- Adjustment vs meta analysis

---

## Summary of Recommendations for Practitioners

- What actionable guidance emerges from these results?
- How should recommendations be structured for maximum utility?

### Decision Matrix for Batch Correction and Classifier Selection
- **Format as "If/Then" structure for maximum utility**
- For bulk RNA-seq data integration:
  1. **If goal is clinical deployment (Single Sample)** → Then use Reference-based normalization (e.g., Frozen Robust Multi-array Analysis logic) and avoid KNN
  2. **If goal is biological discovery across GEO** → Then use ComBat-Seq + Elastic Net
  3. **If goal is within-study analysis** → Then prioritize validation strategy over batch correction
  4. **If integrating across platforms** → Then use rank-based normalization or quantile methods
  5. **If batch labels are unknown** → Then consider SVA or other latent factor methods
- Each recommendation should be actionable with specific method names
- Include brief rationale for each recommendation

### Red Flags: When Batch Correction Has Failed
- Warning signs that batch correction may have introduced artifacts
- What specific metrics or patterns indicate failure?
- How can practitioners diagnose correction problems?

### The Hierarchy of Concerns
- When building cross-study classifiers, prioritize in this order
- What is the priority ordering and why?

---

## The Horizon of Batch Effect Mitigation

- How should future directions be framed?
- What is the forward-looking framing?

### Modern Approaches: Self-Supervised Learning and Batch-Aware Training
- How are foundation models changing the batch effect landscape?
- What is the advantage of pre-training on uncorrected data?
- **The Risk of Batch as a Latent Feature (Shortcut Learning)**
  - **Connect to broader ML research:** This is often referred to as "Shortcut Learning" - the model takes the shortcut of learning the batch (easy to identify) rather than the biology (hard)
  - How might SSL models inadvertently encode batch identity?
  - What happens when batch becomes a primary latent dimension?
  - What are the implications for evaluation and deployment?
  - How does this add sophistication to the foundation model discussion?
- What are batch-aware training strategies?
- What is the utility of ML beyond prediction?
- What is the ultimate goal?

### Generalizability to Other Omics
- **IMPORTANT: Book title is "Genomics" (plural) - this section is vital**
- **Highlight distribution differences across modalities:**
  - RNA-seq: Negative Binomial distribution
  - DNA Methylation: Beta distribution (use limma or ComBat on M-values)
  - Protein abundance (Mass Spec): Often log-normal
- **Key insight: While the math changes, the strategy of location/scale adjustment is foundational**
- What core principles apply universally across omics?
  - Systematic technical variation exists in all high-throughput data
  - Location/scale adjustment principles remain constant
  - The need to preserve biological signal while removing technical noise
- How do batch effects in other omics compare to transcriptomics?
- How does this broaden the chapter's utility for precision medicine?
- Format as prominent section (not just an afterthought) to match book scope

### Feature Selection and Biological Interpretation
- **Frame as prerequisite relationship:** "Batch effect mitigation is the prerequisite for reliable feature selection"
- Why this matters: If data is poorly corrected, the "features" selected will be technical noise, not biomarkers
- In context of Precision Medicine: Feature selection enables minimal diagnostic signatures
- How to use each classifier to find important genes
- Two main reasons why reducing genes is helpful:
  - Reduce cost and complexity (fewer genes = cheaper assays)
  - Interpretation (sheds light on the biology involved)
- **Emphasize:** Without proper batch correction first, feature selection identifies batch artifacts instead of biological signals

### The Impact of Unmeasured Factors and Surrogate Variable Analysis
- **Second mention of SVA: Advanced application**
- How SVA is being integrated into modern automated pipelines
- Unmeasured factors and their impact
- SVA methodology and benefits
- The evolution from manual batch correction to automated detection of latent factors

### Domain Adaptation in Biological Datasets
- Domain adaptation challenges and solutions
- Specific challenges for biological data
- Negative transfer considerations

---