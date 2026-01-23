# Literature Directory

This directory contains extracted full texts from academic papers.

## Structure

```
literature/
├── ExtractedText/          # Extracted full texts from PDFs
├── PDFs/                   # PDF files (if stored locally)
├── FILENAME_STANDARD.md    # Naming convention documentation
└── README.md               # This file
```

## Checking Extraction Status

To see which sources have extracted texts and which are missing:

```bash
python3 check_fulltext_status.py
```

This script cross-references the Source ID Registry in `01_Knowledge_Base/claims_matrix.md` with files in `ExtractedText/` and shows:
- Which sources have extracted texts
- Which sources need extraction
- Overall extraction coverage percentage

## Extracting Full Texts

### Method 1: Using Extraction Scripts

1. **Identify PDFs to extract**:
   ```bash
   python3 extract_zotero_fulltexts.py --collection "BookChapter" --dry-run
   ```

2. **Extract using docling**:
   ```bash
   python3 extract_with_docling.py --pdf-dir ~/Zotero/storage
   ```

### Method 2: Using AI Assistant with MCP

Ask the AI assistant to extract texts from specific papers. The assistant will use docling MCP tools to convert PDFs and save them with proper naming.

### Method 3: Manual Extraction

For papers not in Zotero or requiring special handling, manually extract and save to `ExtractedText/` following the naming standard in `FILENAME_STANDARD.md`.

## File Naming Standard

All extracted texts follow this format:
```
{Author} et al. - {Year} - {Title}.txt
```

See `FILENAME_STANDARD.md` for complete details.

## Integration with Knowledge Base

After extracting full texts:

1. Review the extracted text
2. Extract factual claims following the Claims Matrix Protocol
3. Add claims to `01_Knowledge_Base/claims_matrix.md`
4. Update Source ID Registry if needed
5. Extract quotes to `01_Knowledge_Base/evidence_quotes.md` as needed

## Workflows

- **Full text extraction workflow**: See `00_Meta/fulltext_extraction_workflow.md`
- **General research workflow**: See `00_Meta/workflow.md`
- **Citation protocol**: See `.cursorrules` in project root
