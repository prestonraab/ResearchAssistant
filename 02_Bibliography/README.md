# Bibliography Directory

This directory contains reference management files and configuration for Zotero integration.

## Files

- `zotero_library_export.bib`: Backup BibTeX export from Zotero library
- `zotero_mcp_config.json`: Configuration for Zotero MCP server integration

## Setup Instructions

### Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Zotero credentials:
   ```
   ZOTERO_API_KEY=your_api_key_here
   ZOTERO_USER_ID=your_user_id_here
   ```

   - Get your API key from: https://www.zotero.org/settings/keys
   - Your User ID is the numeric ID in your Zotero profile URL

### Zotero MCP Integration

1. Install the zotero-mcp package:
   ```bash
   pip install zotero-mcp
   # or
   uv add zotero-mcp
   ```

2. Add the configuration from `zotero_mcp_config.json` to your Cursor configuration file:
   - Location: `mcp.json` or `claude_desktop_config.json`
   - The `ZOTERO_LOCAL=true` setting allows direct communication with the running Zotero application

3. Verify integration by asking Cursor to search your Zotero library

## Usage

- Export your Zotero library periodically to `zotero_library_export.bib` for backup
- Use the MCP integration to search and retrieve citations directly from Zotero

## Finding and Adding New Sources

**Workflow**: Search → Add to Zotero → Update Knowledge Base → Cite

1. **Search**: Use web search to find relevant academic papers (PubMed, arXiv, bioRxiv, etc.)

2. **Add to Zotero**: 
   - Use `add_paper.py` script (see usage in script header)
   - Use Zotero MCP tools
   - Or manually via Zotero application

3. **Update Knowledge Base** (MANDATORY):
   - **Assign new Source ID**: Sequential numbering (e.g., if last was Source 6, new is Source 7)
   - **Update `01_Knowledge_Base/claims_matrix.md`**:
     - Add source to Source ID Registry
     - Extract at least one initial claim from the source
     - Add claim to claims matrix table
   - **Extract quotes** to `01_Knowledge_Base/evidence_quotes.md` if needed
   - **Update technical definitions** in `01_Knowledge_Base/definitions_technical.md` if applicable

4. **Cite**: Only after source is in Zotero and claims matrix is updated

**Important**: The claims matrix update is mandatory and cannot be skipped. See `01_Knowledge_Base/claims_matrix.md` for detailed update procedures.

For detailed citation protocol, see `.cursorrules` in the project root.
