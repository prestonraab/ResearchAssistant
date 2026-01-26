# Claims and Evidence: Impact

This file contains all **Impact** claims with their supporting evidence.

---

## C_36: Unmeasured or unmodeled factors can introduce widespread and detrimental effects on gene expression studies

**Category**: Impact  
**Source**: Leek2007 (Source ID: 17)  
**Context**: This phenomenon is true even for well-designed, randomized studies.

**Primary Quote**:
> "Large-scale gene expression studies allow one to characterize transcriptional variation with respect to measured variables of interest, such as differing environments, treatments, time points, phenotypes, or clinical outcomes. However, a number of unmeasured or unmodeled factors may also influence the expression of any particular gene. Besides inducing widespread dependence in measurements across genes, these influential factors create additional sources of differential expression, which, unlike gene-specific fluctuations, represent common sources of variation in gene expression that can be observed among multiple genes."

**Supporting Quotes**:
- "We show that failing to incorporate these sources of heterogeneity into an analysis can have widespread and detrimental effects on the study. Not only can this reduce power or induce unwanted dependence across genes, but it can also introduce sources of spurious signal to many genes. This phenomenon is true even for well-designed, randomized studies."
- "Batch effects are sub-groups of measurements that have qualitatively different behaviour across conditions and are unrelated to the biological or scientific variables in a study."


---


## C_39: Expression heterogeneity can lead to extra variability in expression levels, spurious signals due to confounding, and long-range dependence in noise

**Category**: Impact  
**Source**: Leek2007 (Source ID: 17)  
**Context**: Occurs even if measured factors like age act on distinct sets of genes or interact with unobserved factors.

**Primary Quote**:
> "If age is not included in the model when identifying differential expression with respect to disease state, we show that this may (a) induce extra variability in the expression levels due to the effect of age, decreasing our power to detect associations with disease state, (b) introduce spurious signal due to the fact that the effect of age on expression may be confounded with disease state, or (c) induce long-range dependence in the apparent 'noise' of the expression data, complicating any assessment of statistical significance for differential expression."

**Supporting Quotes**:
- "Furthermore, even measured factors such as age may act on distinct sets of genes in different ways, or may interact with an unobserved factor, making the effect of age on expression difficult to model. 'Expression heterogeneity' (EH) is used here to describe patterns of variation due to any unmodeled factor."
- "In the most benign cases, batch effects will lead to increased variability and decreased power to detect a real biological signal. Of more concern are cases in which batch effects are confounded with an outcome of interest and result in misleading biological or clinical conclusions."


---


## C_49: Failure of adaptability between source and target domains in domain adaptation can lead to negative transfer

**Category**: Impact  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: Highlights a critical theoretical limitation of DA.

**Primary Quote**:
> "In these worst-case scenarios, applying DA can result in what is known as negative transfer, which is when the application of knowledge from a source domain negatively affects the performance of a model in a target domain ( 89 , 93 ). For instance, Wang and colleagues ( 93 ) applied a domain-adversarial neural network ( 94 ) to transfer knowledge from product images as source domain to real-world images as target domain but found that the models' accuracy on the target domain decreased by 10% because of divergence in lighting, angles, and photo backgrounds between domains. Crucially, the potential for negative transfer can be amplified when working with biological data due to its already-heterogeneous nature and the smaller sample size of each dataset, and due to unknown adaptability between biological domains."

**Supporting Quotes**:
- "DA can only be successful if the source and target domains are adaptable- i.e., theoretically joinable ( 89 - 92 ). Adaptability ( 89 , 91 ) is highly understudied in biology, and failures of adaptability can lead to negative transfer, or cases where DA causes more harm than benefit ( 89 , 90 , 93 )."


---


## C_99: The Precision Medicine Initiative aims to enable prevention and treatment strategies that account for individual variability

**Category**: Impact  
**Source**: Collins2015 (Source ID: 36)  
**Context**: Launched in 2015 to accelerate biomedical discoveries and provide clinicians with new tools.

**Primary Quote**:
> "President Obama has long expressed a strong conviction that science offers great potential for improving health. Now, the President has announced a research initiative that aims to accelerate progress toward a new era of precision medicine. We believe that the time is right for this visionary initiative, and the National Institutes of Health (NIH) and other partners will work to achieve this vision. The concept of precision medicine - prevention and treatment strategies that take individual variability into account - is not new; blood typing, for instance, has been used to guide blood transfusions for more than a century."

**Supporting Quotes**:
- "What is needed now is a broad research program to encourage creative approaches to precision medicine, test them rigorously, and ultimately use them to build the evidence base needed to guide clinical practice."
- "The proposed initiative has two main components: a near-term focus on cancers and a longer-term aim to generate knowledge applicable to the whole range of health and disease."


---


## C_100: Precision medicine requires integration of large-scale genomic data with clinical information

**Category**: Impact  
**Source**: Ginsburg2018 (Source ID: 37)  
**Context**: Data integration is fundamental to realizing the promise of precision medicine.

**Primary Quote**:
> "Precision medicine will require access to large-scale, detailed, and highly integrated patient data. Many initiatives are focused on increasing the interoperability of systems that generate and manage patient data and enhancing those systems for use at the point of care."

**Supporting Quotes**:
- "We explore the intersection of data science, analytics, and precision medicine in the formation of health systems that carry out research in the context of clinical care and that optimize the tools and information used to deliver improved patient outcomes."
- "The assembly of genomic, environmental, digital health, and patient-reported data from a variety of sources serves as the foundation for a powerful precision medicine platform that, when coupled to other national and global data and clinical networks, will lead to the dissemination of knowledge that will enable other health care delivery systems to benefit."


---


## C_110: Integrating batches of genomic data increases statistical power for discovering relevant biology

**Category**: Impact  
**Source**: Zhang2020 (Source ID: 2)  
**Context**: Fundamental motivation for combining datasets despite batch effect challenges.

**Primary Quote**:
> "The benefit of integrating batches of genomic data to increase statistical power is often hindered by batch effects, or unwanted variation in data caused by differences in technical factors across batches."

**Supporting Quotes**:
- "The presence of batch effects often reduces the benefits of integrating batches of data to increase the inferential power to discover relevant biology from the combined data."
- "Integrating this vast amount of data originating from different but independent studies could be beneficial for the discovery of new biological insights by increasing the statistical power of gene expression analysis."


---


## C_111: Combining datasets increases sample size, statistical power, and enables more general and reliable conclusions

**Category**: Impact  
**Source**: Taminau2014 (Source ID: 12)  
**Context**: Core benefit of integrative analysis in gene expression studies.

**Primary Quote**:
> "By increasing the number of samples the statistical power is increased and more general and reliable conclusions can be drawn."

**Supporting Quotes**:
- "Combining information from multiple existing studies can increase the reliability and generalizability of results. Through the integrative analysis of microarray data the sample size increases and with it the statistical power to obtain a more precise estimate of gene expression results."
- "This immediately overcomes the problem of low sample sizes, which is the main limitation for individual microarray studies."


---


## C_112: Gene signatures often fail to generalize to independent cohorts

**Category**: Impact  
**Source**: Warsinske2019 (Source ID: 46)  
**Context**: Critical challenge for translating gene expression classifiers across studies.

**Primary Quote**:
> "Despite extensive efforts, none of these TB gene signatures has been translated into a point of care (POC) diagnostic for several reasons. First, none of these signatures except 1 has been validated in prospective independent cohorts."

**Supporting Quotes**:
- "several signatures did not generalize to independent cohorts with culture-confirmed diagnosis of ATB. Arguably, the lack of generalizability in these signatures may be expected for several reasons."
- "As more gene signatures have been described, there has been a dearth of studies comparing these signatures with each other to verify if host-response-based signatures can be validated in independent cohorts."


---


## C_113: Integrating individual datasets increases training samples, providing larger and more diverse datasets that prevent overfitting

**Category**: Impact  
**Source**: Orouji2024 (Source ID: 20)  
**Context**: Domain adaptation benefit for mitigating poor sample-to-feature ratios.

**Primary Quote**:
> "integrate individual datasets to increase the number of training samples, providing a larger and more diverse dataset and preventing overfitting."

**Supporting Quotes**:
- "it is increasingly urgent that we acknowledge the strengths and challenges of combining datasets."
- "To best extract generalizable insights while making use of all collected data from varying sources-especially in biological disciplines where data are expensive-and to apply these insights to newly collected data, we must find how to best leverage the use of all existing and continuously growing small biological datasets."


---


