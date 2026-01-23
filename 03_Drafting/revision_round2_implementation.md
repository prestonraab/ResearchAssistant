# Revision Round 2 Implementation Report
## Date: January 21, 2026

## Summary
Successfully implemented all revisions from revision_report.md following the guidelines for maintaining truth and accuracy. All changes preserve factual accuracy while improving narrative flow and technical precision.

## Changes Implemented

### 1. Narrativized Dataset Selection ✓
**Location**: Experimental Design and Methods > Tuberculosis Gene Expression Datasets

**Change**: Transformed bulleted list into flowing narrative that explains *why* these datasets were chosen.

**Key additions**:
- "To rigorously evaluate the impact of batch effects on classifier performance, we selected tuberculosis gene expression datasets that provided a natural stress test for batch correction methods."
- "To ensure geographic diversity and varying technical backgrounds..."
- "This collection of datasets, ranging from adolescent cohorts in South Africa to adult sputum samples processed across multiple continents, provided the technical and biological heterogeneity necessary..."

**Truth preservation**: All factual claims about datasets remain unchanged; only narrative framing added.

### 2. Refined ComBat/ComBat-Seq Explanation ✓
**Location**: Batch Correction Methods > The ComBat Framework

**Change**: Added nuanced explanation of log-transformation practice and trade-offs.

**Key addition**:
"While standard ComBat assumes a Gaussian distribution—a condition often violated by the raw, over-dispersed nature of RNA-seq counts—practitioners frequently apply it to log-transformed data to approximate normality. However, this transformation can stabilize variance at the cost of distorting the underlying count structure. ComBat-Seq offers a superior alternative by modeling the data directly via a negative binomial distribution, thus preserving the integer nature of the counts and providing a more principled approach for modern sequencing pipelines."

**Truth preservation**: Added context about common practice without contradicting existing claims. Sources: revision_report.md, SY5YRHHX.

### 3. Deepened Interaction Effects Interpretation ✓
**Location**: Results > Interaction Effects Between Adjusters and Classifiers

**Change**: Added mechanistic explanation of why logistic regression is robust and KNN is sensitive.

**Key addition**:
"The observed robustness of logistic regression likely stems from its global linear decision boundary, which is less sensitive to local distributional shifts. In contrast, the high sensitivity of KNN to batch adjustment—particularly supervised methods—highlights the danger of 'local' learning. When supervised adjustment shifts samples to satisfy class-based mean/variance constraints, it creates high-density clusters in feature space. KNN 'sees' these technical artifacts as biological proximity, leading to the 'hall of mirrors' effect where internal validation metrics soar while cross-study generalizability collapses."

**Truth preservation**: Mechanistic explanation consistent with observed results. Source: revision_report.md.

### 4. Improved Figure 3 Caption ✓
**Location**: The Perils of Supervised Batch Correction

**Old caption**: "The catastrophic failure of supervised batch adjustment. ComBat-supervised creates artificial separation that prevents generalization to independent test sets."

**New caption**: "Generalization Failure of Supervised Adjustment. The negative MCC values for KNN (red) demonstrate that supervised correction can actually perform worse than random chance when technical artifacts are mistaken for biological signal in imbalanced settings."

**Truth preservation**: More specific and informative without changing factual content. Source: revision_report.md.

### 5. Polished Conclusion ✓
**Location**: The Horizon of Batch Effect Mitigation

**Change**: Expanded conclusion to emphasize clinical translation and feature selection utility.

**Key additions**:
- "The utility of machine learning in genomics extends beyond pure prediction to biological discovery."
- "By utilizing the feature importance metrics of random forests or the sparsity-inducing weights of elastic net, researchers can distill thousands of genes into a 'minimal signature' suitable for cost-effective clinical assays."
- "Ultimately, the successful mitigation of batch effects ensures that these signatures represent genuine disease biology rather than the technical idiosyncrasies of a specific laboratory."
- "...providing a reliable bridge from the digital repository of GEO to the bedside of the patient."

**Truth preservation**: Synthesizes existing claims about feature selection (C_75-C_78) with clinical goals. Sources: revision_report.md, C_75, C_76, C_77, C_78, 28.

### 6. Fixed LaTeX Formatting ✓
**Location**: Throughout manuscript.md

**Changes**:
- `(p < 1e-05)` → `($p < 10^{-5}$)`
- `(p < 0.05)` → `($p < 0.05$)`
- All p-values now properly formatted with LaTeX math notation

**Truth preservation**: Formatting change only, no content altered.

## Files Updated

### chapter_draft.md
- ✓ Narrativized dataset selection
- ✓ Refined ComBat explanation
- ✓ Deepened interaction effects interpretation
- ✓ Improved Figure 3 caption
- ✓ Polished conclusion

### manuscript.md
- ✓ All changes from chapter_draft.md
- ✓ Added source tracking comments for new content
- ✓ Fixed LaTeX formatting for p-values
- ✓ Maintained Q&A structure with [ANSWERED] tags
- ✓ Preserved traceability to claims_matrix.md

## Truth and Accuracy Guidelines Followed

### 1. No New Factual Claims Without Sources ✓
All new content either:
- Explains existing claims in more detail (mechanistic interpretations)
- Provides narrative framing (dataset selection rationale)
- Synthesizes existing claims (conclusion)

### 2. Source Tracking Maintained ✓
All new content tagged with sources:
- `<!-- Source: revision_report.md -->` for narrative improvements
- `<!-- Source: C_75, C_76, C_77, C_78, 28 -->` for feature selection claims
- `<!-- Source: SY5YRHHX, revision_report.md -->` for ComBat refinements

### 3. Existing Claims Preserved ✓
No factual claims were removed or contradicted. All changes are additive or clarifying.

### 4. Results Data Unchanged ✓
All empirical findings (MCC values, p-values, performance metrics) remain exactly as reported.

### 5. Citations Maintained ✓
All existing citations preserved. No new citations needed as changes are narrative/interpretive.

## Compliance with .cursorrules

### Citation Protocol ✓
- All factual claims trace to claims_matrix.md or revision_report.md
- No new sources added (narrative improvements only)
- Source IDs maintained in comments

### Two-Document Workflow ✓
- manuscript.md: Working document with Q&A and source tracking
- chapter_draft.md: Polished narrative output
- Both maintain same factual content with full traceability

### Traceability ✓
- Every change documented with source comments
- Revision report referenced for all narrative improvements
- Claims matrix referenced for all factual content

## Remaining Items from Revision Report

### Completed ✓
1. Narrativize dataset selection
2. Refine ComBat/ComBat-Seq explanation
3. Deepen interaction effects interpretation
4. Improve figure captions (Figure 3)
5. Polish conclusion
6. Fix LaTeX formatting

### Not Applicable
- Figure 4 caption: Figure 4 already has appropriate caption
- Reference audit: All [RESEARCH NEEDED] items already completed (see citation_review_report.md)
- Consistency check: ComBat-Seq and ComBat-supervised already consistently capitalized
- Figure placement: Text already explicitly references figures

## Conclusion

All revisions from revision_report.md have been successfully implemented in both manuscript.md and chapter_draft.md. The changes improve narrative flow, technical precision, and reader engagement while maintaining complete factual accuracy and traceability to source materials.

The manuscripts are now ready for the next phase of review with:
- Enhanced narrative structure
- Deeper mechanistic explanations
- Improved figure captions
- Polished conclusion linking to clinical goals
- Proper LaTeX formatting throughout
- Complete source tracking and traceability maintained
