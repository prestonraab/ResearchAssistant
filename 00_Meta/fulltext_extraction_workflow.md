# Full Text Extraction Workflow

This document describes the automated workflow for extracting full texts from Zotero PDFs.

## Overview

The workflow extracts full texts from PDFs stored in Zotero and saves them to `literature/ExtractedText/` for use in manuscript drafting and claims verification.

## Automated Scripts

### 1. `extract_zotero_fulltexts.py`

**Purpose**: Identifies PDFs in Zotero collections/storage that need extraction.

**Usage**:
```bash
# Identify PDFs in a collection (requires MCP for full functionality)
uv run python3 extract_zotero_fulltexts.py --collection "BookChapter"

# Process specific item keys
uv run python3 extract_zotero_fulltexts.py --items N27S4JWC 67VRP96X

# Dry run to see what would be processed
uv run python3 extract_zotero_fulltexts.py --collection "BookChapter" --dry-run
```

**What it does**:
- Queries Zotero MCP (when available) or searches storage directory
- Finds PDF attachments for each item
- Checks if text already extracted (skips duplicates)
- Generates output filenames
- Provides summary of what needs extraction

**Output**: List of PDFs ready for extraction with suggested filenames

### 2. `extract_with_docling.py`

**Purpose**: Extracts text from PDFs using docling library directly (when MCP not available).

**Usage**:
```bash
# Extract all PDFs in a directory
uv run python3 extract_with_docling.py --pdf-dir ~/Zotero/storage

# Extract single PDF
uv run python3 extract_with_docling.py --pdf /path/to/file.pdf --output output.txt
```

**What it does**:
- Uses docling library to convert PDFs to markdown/text
- Saves extracted texts to `literature/ExtractedText/`
- Skips already-extracted files

## Recommended Workflow (Using AI Assistant with MCP)

1. **Identify PDFs to extract**:
   ```bash
   uv run python3 extract_zotero_fulltexts.py --collection "BookChapter" --dry-run
   ```

2. **Use AI assistant to extract**:
   - Ask: "Extract full texts for all PDFs in the BookChapter collection"
   - The assistant will:
     a. Get collection items via Zotero MCP
     b. Get attachment information for each item
     c. Find PDFs in Zotero storage
     d. Convert each PDF using docling MCP: `mcp_docling_convert_document_into_docling_document()`
     e. Export to markdown: `mcp_docling_export_docling_document_to_markdown()`
     f. Save to `literature/ExtractedText/` with proper naming

3. **Verify extraction**:
   - Check `literature/ExtractedText/` for new files
   - Review extracted texts for quality

4. **Update knowledge base**:
   - Extract claims from new texts
   - Update `claims_matrix.md` following Claims Matrix Protocol
   - Update other knowledge base files as needed

## File Naming Convention

Extracted texts are named using the format:
```
{ZoteroItemKey}_{FirstAuthor}{Year}_{ShortTitle}.txt
```

Example: `N27S4JWC_Welch2019_SingleCellMultiOmic.txt`

If metadata is unavailable, fallback to: `{ZoteroItemKey}.txt`

## Storage Locations

- **Zotero PDFs**: `~/Zotero/storage/{attachment_key}/filename.pdf`
- **Extracted texts**: `literature/ExtractedText/{item_key}_{descriptive_name}.txt`

## Integration with Claims Matrix

After extracting full texts:

1. Review the extracted text files
2. Extract factual claims following the Claims Matrix Protocol
3. Add claims to `01_Knowledge_Base/claims_matrix.md`
4. Update Source ID Registry if the item is new
5. Cross-reference with other knowledge base files

## Troubleshooting

### PDFs not found
- Check that PDFs exist in `~/Zotero/storage/`
- Verify item keys match Zotero library
- Use MCP tools to get attachment keys for more accurate matching

### Extraction fails
- Ensure docling is installed: `pip install docling` or via `uv`
- Check PDF file is not corrupted
- Try extracting with `extract_with_docling.py` as alternative

### Duplicate extractions
- Script automatically skips files that already exist
- Check `literature/ExtractedText/` before running extraction

## Automation Benefits

- **Less hardcoding**: Scripts automatically discover PDFs and generate filenames
- **Configurable**: Can process specific collections or items
- **Idempotent**: Skips already-extracted files
- **Traceable**: Clear workflow documented in `.cursorrules`
- **Flexible**: Works with MCP tools or library directly
