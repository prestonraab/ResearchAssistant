# Claims and Evidence: Application

This file contains all **Application** claims with their supporting evidence.

---

## C_105: Multi-gene prognostic signatures including Oncotype DX, EndoPredict, and Prosigna are widely used clinically to predict recurrence risk in ER+ breast cancer

**Category**: Application  
**Source**: Buus2021 (Source ID: 42)  
**Context**: These signatures are endorsed for prognostic use in authoritative guidelines and guide treatment decisions.

**Primary Quote** (Introduction):
> "Multi-parameter gene-expression-based prognostic signatures are often used to estimate the residual risk of recurrence after surgery to guide patient management. Amongst the most widely used prognostic signatures in ER+ breast cancer are the Oncotype DX Recurrence Score (RS), EndoPredict (EP/EPclin) and Prosigna® Risk Of Recurrence score (ROR). Each of these have been endorsed for prognostic use in authoritative guidelines."

**Supporting Quotes**:
- (Introduction): "Over 80% of breast cancer patients in the developed western world have oestrogen receptor (ER)-positive disease; their treatment normally includes surgery and adjuvant endocrine therapy (ET), and sometimes chemotherapy (CT) which greatly improves outcome."
- (Introduction): "The TAILORx study reported findings for the reduced cut-points of 11 and 26, respectively, showing women with hormone receptor-positive, HER2-negative, axillary node-negative breast cancer, and a high RS of 26 to 100 had better prognosis when treated with ET with adjuvant CT regimens than expected with ET alone"

---


---

## C_106: Oncotype DX Recurrence Score guides chemotherapy decisions in addition to endocrine therapy

**Category**: Application  
**Source**: Buus2021 (Source ID: 42)  
**Context**: TAILORx trial showed that high RS (26-100) patients benefit from chemotherapy, while those with RS < 26 do not.

**Primary Quote** (Introduction):
> "More recently the TAILORx study reported findings for the reduced cut-points of 11 and 26, respectively, showing women with hormone receptor-positive, HER2-negative, axillary node-negative breast cancer, and a high RS of 26 to 100 had better prognosis when treated with ET with adjuvant CT regimens than expected with ET alone; however, there was a lack of CT benefit in patients with RS < 26."

**Supporting Quotes**:
- (Introduction): "Cut-off points for RS were established to classify patients into low (RS < 18), intermediate (18 ≤ RS ≤ 31) and high risk (RS > 31)."

---


---

## C_107: Multi-gene prognostic signatures are widely used clinically to guide treatment decisions in breast cancer

**Category**: Application  
**Source**: Buus2021 (Source ID: 42)  
**Context**: These signatures estimate residual risk of recurrence after surgery to guide patient management.

**Primary Quote** (Introduction):
> "Multi-parameter gene-expression-based prognostic signatures are often used to estimate the residual risk of recurrence after surgery to guide patient management. Amongst the most widely used prognostic signatures in ER+ breast cancer are the Oncotype DX Recurrence Score (RS), EndoPredict (EP/EPclin) and Prosigna® Risk Of Recurrence score (ROR). Each of these have been endorsed for prognostic use in authoritative guidelines."

**Supporting Quotes**:
- (Discussion): "Multi-parameter prognostic signatures are widely used for the prognostication and treatment guidance of ER+/HER2− primary breast cancer patients."
- (Introduction): "More recently the TAILORx study reported findings for the reduced cut-points of 11 and 26, respectively, showing women with hormone receptor-positive, HER2-negative, axillary node-negative breast cancer, and a high RS of 26 to 100 had better prognosis when treated with ET with adjuvant CT regimens than expected with ET alone; however, there was a lack of CT benefit in patients with RS < 26."

---

## Notes

- Claims with `[Note: Quotes to be extracted from source.]` indicate that full text extraction is in progress or quotes need to be added
- Primary quotes should be the most concise and representative evidence for hover tooltip display
- Supporting quotes provide additional context and can be viewed when expanding the full evidence section
- See `sources.md` for complete bibliographic information for all source IDs

---

## C_35: GEO data are widely reused for identifying novel gene expression patterns, finding disease predictors, and developing computational methods

**Category**: Application  
**Source**: Clough2023 (Source ID: 17)  
**Context**: Over 31,000 third-party papers use GEO data to support or complement independent studies.

**Primary Quote** (Re-use of GEO data section):
> "The community re-uses GEO data in diverse ways, including finding evidence of novel gene expression patterns, identifying disease predictors, and generally aggregating and analyzing data in ways not anticipated by the original data generators."

**Supporting Quotes**:
- (Conclusion): "GEO is a widely used international public repository for high-throughput gene expression and epigenomic data and continues to grow at an increasing rate. The database has become an essential resource for researchers across a wide range of disciplines, including genomics, molecular biology, biomedicine and bioinformatics."
- (Re-use examples): "Identification of new diagnostic and prognostic biomarkers... Developing and validating computational methods... Development of machine learning and artificial intelligence models."

---


---



---

## C_108: Batch effects can lead to lack of reproducibility and lower-than-expected classification rates in clinical predictors, potentially putting patients at risk

**Category**: Application  
**Source**: Leek2010 (Source ID: 23)  
**Context**: Undetected batch effects in predictors developed for clinical outcomes can produce more variable results than expected and adversely affect classification performance.

**Primary Quote** (Consequences of batch effects):
> "If batch effects go undetected, they can lead to substantial misallocation of resources and lack of reproducibility. In general, technology that has been developed for the prediction of clinical outcomes using data that show batch effects may produce results that are more variable than expected. Batch effects were shown to have strong adverse effects on predictors built with methods that are naive to these effects; the result is lower-than-expected classification rates, which might put patients classified with these technologies at risk."

**Supporting Quotes**:
- (Consequences): "Batch effects are strong enough to change not only mean levels of gene expression between batches but also correlations and relative rankings between the expression of pairs of genes."

---

## C_109: Single-patient data processing is vital to the translation of molecular assays, as clinical settings typically collect patient samples in small numbers

**Category**: Application  
**Source**: Talhouk2016 (Source ID: 44)  
**Context**: Multi-sample batch correction methods are impractical in clinical settings where samples are processed individually or in small numbers.

**Primary Quote** (Clinical translation):
> "Multisample methods are impractical in clinical settings, where patient samples are typically collected in small numbers, often one at a time, making single-patient data processing vital to the translation of molecular assays."

**Supporting Quotes**:
- (Batch effects in clinical context): "Batch effects (BE) refer to the systematic and technical variations between measurements introduced when handling samples in batches. BE are ubiquitous in gene expression analysis, and their presence could mask or simulate biological signals in data, resulting in either spurious and/or missed associations, especially when the biological factor of interest is confounded with a given batch."
- (Clinical translation requirements): "Pre-processing, normalization and accounting for systematic sources of variability in gene expression data affect the ability to combine different cohorts for model development and cross-cohort predictions for a single patient; these are key requirements for the development, validation and proof of utility for clinical assays."
