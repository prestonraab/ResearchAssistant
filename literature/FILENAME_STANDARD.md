# ExtractedText Filename Standard

## Standard Format

All extracted text files in `literature/ExtractedText/` follow this naming convention:

```
{Author} et al. - {Year} - {Title}.txt
```

### Examples

- `Johnson et al. - 2007 - Adjusting batch effects in microarray expression data using empirical Bayes methods.txt`
- `Zhang et al. - 2020 - ComBat-seq batch effect adjustment for RNA-seq count data.txt`
- `Breiman - 2001 - Random Forests.txt` (single author, no "et al.")

### Rules

1. **Author format**: 
   - Single author: `LastName - Year - Title.txt`
   - Multiple authors: `FirstAuthor et al. - Year - Title.txt`

2. **Separator**: Use ` - ` (space-dash-space) between components

3. **Title**: 
   - Use the full paper title
   - Preserve capitalization from the original
   - Truncate if necessary (filesystem limits), but keep meaningful

4. **Extension**: Always `.txt`

## Source ID Mapping

Papers referenced in the claims matrix have assigned Source IDs (e.g., Source 1, Source 2). The mapping between Source IDs and filenames is maintained in:

```
01_Knowledge_Base/claims_matrix.md
```

### Example Mapping

| Source ID | Filename |
|-----------|----------|
| 1 | Johnson et al. - 2007 - Adjusting batch effects in microarray expression data using empirical Bayes methods.txt |
| 2 | Zhang et al. - 2020 - ComBat-seq batch effect adjustment for RNA-seq count data.txt |
| 3 | Soneson et al. - 2014 - Batch Effect Confounding Leads to Strong Bias in Performance Estimates Obtained by Cross-Validation.txt |

## Automated Extraction

The extraction scripts (`extract_with_docling.py`, `extract_zotero_fulltexts.py`) automatically generate filenames in this standard format based on metadata from Zotero.

## Historical Note

Previously, some files used a `SourceXX_ITEMKEY_ShortTitle.txt` format. These have been standardized to the current format as of January 2026. The Zotero item keys are preserved in the claims matrix Source ID Registry.
