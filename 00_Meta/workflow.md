# Research and Writing Workflow

This document outlines the standardized workflow for research, citation management, and manuscript drafting.

## Core Workflow: Search → Add to Zotero → Update Claims Matrix → Update Knowledge Base → Cite

### Step 1: Search for Sources

When a source is needed:
- Use web search to find relevant academic papers
- Search by paper title, author names, or research topics
- Look for papers on PubMed, arXiv, bioRxiv, or other academic databases
- Verify the source is peer-reviewed and appropriate for the manuscript

### Step 2: Add to Zotero

Once a relevant source is found:
- **Option A**: Use `add_paper.py` script from project root
- **Option B**: Use Zotero MCP tools
- **Option C**: Manually add via Zotero application

**Do not proceed to citation until the source is in Zotero.**

### Step 3: Update Claims Matrix (MANDATORY)

**This step is mandatory and cannot be skipped.**

After adding to Zotero:

1. **Assign Source ID**
   - Check the Source ID Registry in `01_Knowledge_Base/claims_matrix.md`
   - Assign the next sequential Source ID (e.g., if last was Source 6, new is Source 7)

2. **Update Source ID Registry**
   - Add entry to the Source ID Registry table in `claims_matrix.md`
   - Include: Source ID, Zotero Item Key, Author(s), Year, Title, Notes

3. **Extract Initial Claim**
   - Read the source and identify at least one key factual claim
   - Add to claims matrix table with:
     - Unique claim ID (C_XX format)
     - Category
     - Clear statement of claim/fact
     - Source ID reference
     - Context/nuance

4. **Extract Additional Claims as Needed**
   - As you read the source, extract any claims you plan to use
   - Add each to the claims matrix before using in the manuscript

### Step 4: Update Other Knowledge Base Files

As needed, update:
- `01_Knowledge_Base/evidence_quotes.md` - for verbatim quotes
- `01_Knowledge_Base/definitions_technical.md` - for technical definitions
- `01_Knowledge_Base/biomarker_bank.md` - for biomarker information (if applicable)

### Step 5: Cite in Manuscript

Only after Steps 1-4 are complete:
- Reference the claim using the Source ID from the claims matrix
- Use BibTeX format: `\cite{AuthorYear}`
- Include source comment: `<!-- Source: C_XX -->` for traceability

## When to Update Claims Matrix

The claims matrix **MUST** be updated in these situations:

### Mandatory Updates

1. **When adding a new source to Zotero**
   - Assign Source ID, add to registry, extract initial claim

2. **When extracting claims from a source**
   - Add claim to matrix before using in manuscript

3. **Before citing a source in the manuscript**
   - Verify claim exists in matrix first
   - If not, extract and add it

4. **When verifying claims during draft review**
   - Add any missing claims
   - Update or remove incorrect claims

5. **When adding technical definitions**
   - Add to claims matrix
   - Also update `definitions_technical.md`

### Update Checklist

When updating the claims matrix, verify:
- [ ] Source ID is assigned and added to registry
- [ ] At least one claim is extracted from the source
- [ ] Claim ID is unique (C_XX format, sequential)
- [ ] Category is appropriate
- [ ] Claim statement is clear and verifiable
- [ ] Source ID reference is correct
- [ ] Context/nuance is included to prevent misinterpretation

## Quality Control

### Before Citing Any Source

1. Is the source in Zotero? → If no, add it first
2. Is the source in the Source ID Registry? → If no, add it
3. Is the claim in the claims matrix? → If no, extract and add it
4. Is the Source ID correct? → Verify against registry

### During Draft Review

1. Check all citations have corresponding claims in the matrix
2. Verify Source IDs match the registry
3. Ensure claims are accurately represented
4. Update context/nuance if needed

## Common Mistakes to Avoid

- ❌ Citing a source before adding it to Zotero
- ❌ Citing a source before updating the claims matrix
- ❌ Using a claim in the manuscript that isn't in the claims matrix
- ❌ Skipping the Source ID assignment step
- ❌ Forgetting to update the Source ID Registry
- ❌ Not extracting claims when reading sources

## Benefits of This Workflow

1. **Prevents hallucinations**: Forces verification before citation
2. **Maintains traceability**: Every claim links to a source
3. **Enables verification**: Claims can be traced back to original sources
4. **Reduces errors**: Systematic process catches mistakes early
5. **Improves consistency**: Standardized approach across all sources

## References

- Detailed claims matrix procedures: `01_Knowledge_Base/claims_matrix.md`
- Citation protocol: `.cursorrules`
- Bibliography setup: `02_Bibliography/README.md`
