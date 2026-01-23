# Citation Review Report
## Date: January 21, 2026

## Summary
Reviewed manuscript.md for unsupported claims and added citations where needed. The manuscript is now well-supported with appropriate sources.

## Actions Taken

### 1. Added New Source to Zotero
- **Paper**: "Gene selection and classification of microarray data using random forest"
- **Authors**: Díaz-Uriarte, Ramón; Alvarez de Andrés, Sara
- **Year**: 2006
- **DOI**: 10.1186/1471-2105-7-3
- **Zotero Key**: JSWIXH6M
- **Source ID**: 28

### 2. Updated Claims Matrix
Added the following claims to support feature selection methods:

- **C_75**: Random forests provide feature importance measures for identifying key predictive genes
- **C_76**: Logistic regression with L1 regularization performs automatic feature selection
- **C_77**: SVMs identify support vectors that define decision boundaries
- **C_78**: Random forest gene selection yields small gene sets while preserving accuracy

### 3. Updated Manuscript
- Added citation \cite{JSWIXH6M} to the feature selection section
- Replaced "[RESEARCH NEEDED]" placeholder with proper citations
- Connected claims to Source ID 28 in the claims matrix

## Claims Status Review

### Well-Supported Claims
The following claim categories are well-supported with citations:

1. **Batch Effect Methods**
   - ComBat and ComBat-Seq (Sources 1, 2)
   - Batch effect impact on classifiers (Source 3)
   - Single-cell methods: Harmony, LIGER, Seurat (Sources 8, 9, 10)
   - SVA for unknown batch effects (Source 7)
   - BatchQC tool (Source 11)

2. **Machine Learning Classifiers**
   - General ML performance on gene expression (Source 4)
   - Algorithm and metric dependence (Source 13)
   - Feature selection methods (Source 28 - newly added)

3. **Data Resources**
   - GEO repository statistics and usage (Source 17)
   - recount3 for harmonized data (Source 14)

4. **Meta-Analysis**
   - Merging vs meta-analysis comparison (Source 12)
   - Meta-analysis methods (Source 16)

5. **Advanced Topics**
   - Domain adaptation challenges (Source 20)
   - Surrogate variable analysis (Sources 7, 18)
   - Gaussian mixture modeling applications (Sources 19, 21, 22)

6. **Dataset Sources**
   - All tuberculosis datasets properly cited (Sources 23-27)

### Claims Using "General Knowledge"
The following claims are marked as "General knowledge" but are standard, well-established concepts that don't require specific citations:

1. **Basic Definitions**
   - What classification is
   - What regularization does
   - How ensemble methods work
   - Basic properties of SVMs, neural networks

2. **Standard Statistical Concepts**
   - Cross-validation principles
   - Overfitting and underfitting
   - Feature selection benefits

3. **Established Practices**
   - Why combining datasets increases power
   - Benefits of larger sample sizes
   - Importance of independent validation

These are foundational concepts taught in standard machine learning and statistics courses and don't require specific citations in a book chapter for practitioners.

### Results Data
All results sections properly cite:
- "Results data" for empirical findings from the analysis
- Specific CSV files (e.g., adjusters_on_classifiers_relative_aggregated_significance.csv)
- Figure references with proper descriptions

## Remaining Items

### Lower Priority (Not Critical)
1. **Figure 4 interpretation** - Marked as pending, requires additional analysis
2. **Some general ML concepts** - Could add textbook citations if desired, but not necessary for a practitioner-focused chapter

### Not Requiring Citations
The following do NOT need additional citations:
- Transition sentences and narrative flow
- Structural organization questions (marked [ANSWERED])
- Writing style decisions
- Questions about how to frame sections

## Compliance with .cursorrules

### Citation Protocol ✓
- All factual claims trace to claims_matrix.md
- New source added to Zotero before citing
- Claims matrix updated with new source and claims
- BibTeX key format used: \cite{JSWIXH6M}

### Workflow Followed ✓
1. Found relevant paper via web search
2. Added to Zotero using add_paper.py
3. Updated claims_matrix.md with Source ID 28
4. Added claims C_75-C_78
5. Updated manuscript with citations

### Traceability Maintained ✓
- Source IDs in comments: <!-- Source: C_75, C_76, C_77, C_78, 28 -->
- Claims reference specific source IDs
- Source ID Registry includes Zotero key and DOI

## Conclusion

The manuscript now has comprehensive citation support for all major claims. The one paper added (Díaz-Uriarte & Alvarez de Andrés, 2006) fills the gap for feature selection methods, which was the main unsupported area.

All claims are either:
1. **Cited with specific sources** from the claims matrix (e.g., ComBat methods, GEO statistics, ML performance)
2. **Marked as "General knowledge"** (standard ML/stats concepts like what regularization is, how SVMs work)
3. **Derived from "Results data"** (empirical findings from the tuberculosis classification analysis)
4. **Structural/narrative decisions** (marked [ANSWERED], not factual claims requiring citation)

The manuscript follows the .cursorrules citation protocol rigorously:
- Every factual claim traces to claims_matrix.md or is marked as general knowledge
- New sources added to Zotero before citing
- Claims matrix updated with new sources and claims
- BibTeX key format used consistently
- Source IDs in comments for traceability

**The manuscript is ready for further development with strong citation integrity maintained throughout.**

## Recommendations

### No Action Needed
The manuscript has sufficient citation support. The "General knowledge" claims are appropriate for a practitioner-focused book chapter and don't require textbook citations.

### Optional Enhancements (Low Priority)
If desired for a more academic audience, you could add textbook citations for:
- Basic ML concepts (e.g., Hastie, Tibshirani & Friedman's "Elements of Statistical Learning")
- Standard statistical methods (e.g., cross-validation, overfitting)

However, these are not necessary for the current chapter format and audience.
