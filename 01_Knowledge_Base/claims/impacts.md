# Claims and Evidence: Impact

This file contains all **Impact** claims with their supporting evidence.

---

## C_36: Unmeasured or unmodeled factors can introduce widespread and detrimental effects on gene expression studies

**Category**: Impact  
**Source**: Leek2007  
**Context**: This phenomenon is true even for well-designed, randomized studies.

**Primary Quote**:
> "Large-scale gene expression studies allow one to characterize transcriptional variation with respect to measured variables of interest, such as differing environments, treatments, time points, phenotypes, or clinical outcomes. However, a number of unmeasured or unmodeled factors may also influence the expression of any particular gene. Besides inducing widespread dependence in measurements across genes, these influential factors create additional sources of differential expression, which, unlike gene-specific fluctuations, represent common sources of variation in gene expression that can be observed among multiple genes."


---


## C_39: Expression heterogeneity can lead to extra variability in expression levels, spurious signals due to confounding, and long-range dependence in noise

**Category**: Impact  
**Source**: Leek2007  
**Context**: Occurs even if measured factors like age act on distinct sets of genes or interact with unobserved factors.

**Primary Quote**:
> "If age is not included in the model when identifying differential expression with respect to disease state, we show that this may (a) induce extra variability in the expression levels due to the effect of age, decreasing our power to detect associations with disease state, (b) introduce spurious signal due to the fact that the effect of age on expression may be confounded with disease state, or (c) induce long-range dependence in the apparent 'noise' of the expression data, complicating any assessment of statistical significance for differential expression."


---


## C_49: Failure of adaptability between source and target domains in domain adaptation can lead to negative transfer

**Category**: Impact  
**Source**: Orouji2024  
**Context**: Highlights a critical theoretical limitation of DA.

**Primary Quote**:
> "In these worst-case scenarios, applying DA can result in what is known as negative transfer, which is when the application of knowledge from a source domain negatively affects the performance of a model in a target domain ( 89 , 93 ). For instance, Wang and colleagues ( 93 ) applied a domain-adversarial neural network ( 94 ) to transfer knowledge from product images as source domain to real-world images as target domain but found that the models' accuracy on the target domain decreased by 10% because of divergence in lighting, angles, and photo backgrounds between domains. Crucially, the potential for negative transfer can be amplified when working with biological data due to its already-heterogeneous nature and the smaller sample size of each dataset, and due to unknown adaptability between biological domains."


---


## C_99: The Precision Medicine Initiative aims to enable prevention and treatment strategies that account for individual variability

**Category**: Impact  
**Source**: Collins2015  
**Context**: Launched in 2015 to accelerate biomedical discoveries and provide clinicians with new tools.

**Primary Quote**:
> "President Obama has long expressed a strong conviction that science offers great potential for improving health. Now, the President has announced a research initiative that aims to accelerate progress toward a new era of precision medicine (www.whitehouse.gov/precisionmedicine). We believe that the time is right for this visionary initiative, and the National Institutes of Health (NIH) and other partners will work to achieve this vision."


---


## C_100: Precision medicine requires integration of large-scale genomic data with clinical information

**Category**: Impact  
**Context**: Data integration is fundamental to realizing the promise of precision medicine.

**Supporting Quotes**:
- "Data Sharing And Integration Precision medicine will require access to large-scale, detailed, and highly integrated patient data. Many initiatives are focused on increasing the interoperability of systems that generate and manage patient data and enhancing those systems for use at the point of care. 38 Although great strides have made in recent years toward achieving a paperless health care system based on EMRs, much more needs to be done to integrate data across systems and to mine data that already exist but remain in silos. The National Institutes of Health (NIH) needs to facilitate cross-site data integration for research, while health systems must do the same for the optimization of patient care. Many different sectors and activities have to coalesce to promote the implementation and adoption of precision medicine, including the appropriate education, data systems, coverage andreimbursementpolicies, healthsystemprocesses, and health policies."
- "This will bring systematic approach to healing, allowing for rapid disease detection at an early stage, accurate characterization of disease, and assign preventive measures needed before the disease even appears. Also, timely discovery and association of genetic variants with diseases will help develop a more effective therapy tailored to an individual's precise genetic makeup, reducing adverse drug reactions. As biological data accumulates at larger scales and at exponential rates, because of higher-throughput and lower-cost DNA sequencing technologies, it has become essential to develop innovative, smart, and modern bioinformatics applications to help improve research quality and data sharing. New tools will provide a progressive understanding of heterogeneous genomics and clinical findings and facilitate increases in clinical utilization of information in these databases and translation to healthcare."


---


## C_110: Integrating batches of genomic data increases statistical power for discovering relevant biology

**Category**: Impact  
**Source**: Zhang2020  
**Context**: Fundamental motivation for combining datasets despite batch effect challenges.

**Primary Quote**:
> "The benefit of integrating batches of genomic data to increase statistical power is often hindered by batch effects, or unwanted variation in data caused by differences in technical factors across batches."


---


## C_111: Combining datasets increases sample size, statistical power, and enables more general and reliable conclusions

**Category**: Impact  
**Source**: Taminau2014  
**Context**: Core benefit of integrative analysis in gene expression studies.

**Primary Quote**:
> "By increasing the number of samples the statistical power is increased and more general and reliable conclusions can be drawn."


---


## C_112: Gene signatures often fail to generalize to independent cohorts

**Category**: Impact  
**Source**: Warsinske2019  
**Context**: Critical challenge for translating gene expression classifiers across studies.

**Primary Quote**:
> "Despite extensive efforts, none of these TB gene signatures has been translated into a point of care (POC) diagnostic for several reasons. First, none of these signatures except 1 has been validated in prospective independent cohorts."


---


## C_113: Integrating individual datasets increases training samples, providing larger and more diverse datasets that prevent overfitting

**Category**: Impact  
**Source**: Orouji2024  
**Context**: Domain adaptation benefit for mitigating poor sample-to-feature ratios.

**Primary Quote**:
> "integrate individual datasets to increase the number of training samples, providing a larger and more diverse dataset and preventing overfitting."


---


