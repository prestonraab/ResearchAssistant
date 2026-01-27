import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Shared schema definitions to reduce duplication
 */
const paperMetadataSchema = {
  type: 'object',
  properties: {
    itemKey: { type: 'string', description: 'Zotero item key or unique identifier' },
    title: { type: 'string', description: 'Paper title' },
    authors: { type: 'array', items: { type: 'string' }, description: 'List of author names' },
    year: { type: 'number', description: 'Publication year' },
    abstract: { type: 'string', description: 'Paper abstract text' },
    citationCount: { type: 'number', description: 'Number of citations (optional)' },
    pageCount: { type: 'number', description: 'Number of pages (optional)' },
    wordCount: { type: 'number', description: 'Word count (optional)' }
  },
  required: ['itemKey', 'title', 'authors', 'year']
};

const claimSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Claim ID' },
    text: { type: 'string', description: 'Claim text' },
    category: { type: 'string', description: 'Claim category' },
    source: { type: 'string', description: 'Source identifier' },
    verified: { type: 'boolean', description: 'Quote verification status' },
    primaryQuote: { type: 'string', description: 'Primary supporting quote' },
    supportingQuotes: { type: 'array', items: { type: 'string' }, description: 'Additional supporting quotes' },
    sections: { type: 'array', items: { type: 'string' }, description: 'Associated section IDs' }
  },
  required: ['id', 'text', 'category', 'source', 'verified', 'primaryQuote', 'supportingQuotes', 'sections']
};

const sectionSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', description: 'Section ID' },
    title: { type: 'string', description: 'Section title' },
    level: { type: 'number', description: 'Heading level (1-6)' },
    lineStart: { type: 'number', description: 'Start line number' },
    lineEnd: { type: 'number', description: 'End line number' },
    content: { type: 'array', items: { type: 'string' }, description: 'Section content lines' }
  },
  required: ['id', 'title', 'level', 'lineStart', 'lineEnd', 'content']
};

/**
 * Tool definitions for the MCP server.
 * 
 * Each tool defines:
 * - name: Unique tool identifier
 * - description: User-friendly description
 * - inputSchema: JSON Schema for input validation
 */
export const tools: Tool[] = [
  {
    name: 'search_by_question',
    description: 'Search for claims relevant to a research question using semantic similarity. Returns claims ranked by relevance with similarity scores. Use this to find existing evidence before writing new content.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The research question or topic to search for'
        },
        threshold: {
          type: 'number',
          description: 'Optional: Minimum similarity threshold (0-1). Default is 0.3',
          minimum: 0,
          maximum: 1
        }
      },
      required: ['question']
    }
  },
  {
    name: 'search_by_draft',
    description: 'Search for claims matching draft manuscript text. Analyzes each sentence to find supporting evidence and identifies gaps. Use this after writing a draft to find citations.',
    inputSchema: {
      type: 'object',
      properties: {
        draft_text: {
          type: 'string',
          description: 'The draft manuscript text to analyze'
        },
        mode: {
          type: 'string',
          enum: ['paragraph', 'sentence'],
          description: 'Analysis mode: "paragraph" treats text as one unit, "sentence" analyzes each sentence independently'
        },
        threshold: {
          type: 'number',
          description: 'Optional: Minimum similarity threshold (0-1). Default is 0.3',
          minimum: 0,
          maximum: 1
        }
      },
      required: ['draft_text', 'mode']
    }
  },
  {
    name: 'find_multi_source_support',
    description: 'Find multiple independent sources supporting a statement. Use this for claims with generalization keywords (often, typically, generally, etc.) that require multiple sources.',
    inputSchema: {
      type: 'object',
      properties: {
        statement: {
          type: 'string',
          description: 'The statement that needs multiple source support'
        },
        min_sources: {
          type: 'number',
          description: 'Optional: Minimum number of independent sources required. Default is 2',
          minimum: 1
        }
      },
      required: ['statement']
    }
  },
  {
    name: 'analyze_section_coverage',
    description: 'Analyze literature coverage for a specific section at the sentence level. Returns which sentences are supported by claims, which need citations, and generates targeted search queries for unsupported sentences.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'The section ID to analyze (e.g., "2.1", "introduction")'
        }
      },
      required: ['section_id']
    }
  },
  {
    name: 'analyze_manuscript_coverage',
    description: 'Analyze literature coverage for the entire manuscript. Returns coverage statistics for all sections and identifies the weakest sections that need more supporting evidence.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'calculate_claim_strength',
    description: 'Calculate how strongly a claim is supported by multiple independent sources. Returns a strength score, list of supporting claims from different sources, and any contradictory claims. Use this to identify well-established findings versus isolated claims.',
    inputSchema: {
      type: 'object',
      properties: {
        claim_id: {
          type: 'string',
          description: 'The claim ID to analyze (e.g., "C_01", "C_02a")'
        }
      },
      required: ['claim_id']
    }
  },
  {
    name: 'calculate_claim_strength_batch',
    description: 'Calculate claim strength for multiple claims efficiently in a single operation. Returns a map of claim IDs to their strength results. Use this when analyzing multiple claims at once to minimize API calls.',
    inputSchema: {
      type: 'object',
      properties: {
        claim_ids: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of claim IDs to analyze (e.g., ["C_01", "C_02", "C_03"])'
        }
      },
      required: ['claim_ids']
    }
  },
  {
    name: 'rank_papers_for_section',
    description: 'Rank papers by relevance to a specific section. Calculates semantic similarity between paper abstracts and section content, applies citation boost for highly-cited papers, and estimates reading time. Returns papers sorted by relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: { type: 'string', description: 'The section ID to rank papers for (e.g., "2.1", "introduction")' },
        papers: { type: 'array', items: paperMetadataSchema, description: 'Array of paper metadata objects to rank' }
      },
      required: ['section_id', 'papers']
    }
  },
  {
    name: 'rank_papers_for_query',
    description: 'Rank papers by relevance to a query string. Calculates semantic similarity between paper abstracts and the query, applies citation boost for highly-cited papers, and estimates reading time. Returns papers sorted by relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The query text to rank papers against' },
        papers: { type: 'array', items: paperMetadataSchema, description: 'Array of paper metadata objects to rank' }
      },
      required: ['query', 'papers']
    }
  },
  {
    name: 'extract_claims_from_text',
    description: 'Extract potential claims from paper text. Identifies declarative sentences, calculates confidence scores, categorizes by type, and includes surrounding context. Use this to identify important statements to add to the claims database.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The paper text to extract claims from'
        },
        source: {
          type: 'string',
          description: 'Source identifier (e.g., "Smith2020")'
        }
      },
      required: ['text', 'source']
    }
  },
  {
    name: 'suggest_sections_for_claim',
    description: 'Suggest relevant outline sections for a claim using semantic similarity. Returns top 1-3 sections ranked by relevance. Use this to help organize evidence effectively.',
    inputSchema: {
      type: 'object',
      properties: {
        claim_text: { type: 'string', description: 'The claim text to find sections for' },
        sections: { type: 'array', items: sectionSchema, description: 'Array of outline sections' }
      },
      required: ['claim_text', 'sections']
    }
  },
  {
    name: 'group_claims_by_theme',
    description: 'Group claims by theme using semantic clustering. Returns a map of theme labels to claim arrays. Use this to organize related claims before synthesis.',
    inputSchema: {
      type: 'object',
      properties: {
        claims: { type: 'array', items: claimSchema, description: 'Array of claims to group' },
        threshold: { type: 'number', description: 'Optional: Similarity threshold for clustering (0-1). Default is 0.6', minimum: 0, maximum: 1 }
      },
      required: ['claims']
    }
  },
  {
    name: 'generate_paragraph',
    description: 'Generate a coherent paragraph from multiple claims. Supports narrative, analytical, and descriptive styles. Preserves citations and adds transition phrases. Use this to draft literature review paragraphs.',
    inputSchema: {
      type: 'object',
      properties: {
        claims: { type: 'array', items: claimSchema, description: 'Array of claims to synthesize' },
        style: { type: 'string', enum: ['narrative', 'analytical', 'descriptive'], description: 'Writing style: narrative (tells story), analytical (compares/contrasts), descriptive (lists/enumerates)' },
        include_citations: { type: 'boolean', description: 'Whether to include citation references in (AuthorYear) format' },
        max_length: { type: 'number', description: 'Optional: Maximum paragraph length in characters. Default is 0 (no limit)', minimum: 0 }
      },
      required: ['claims', 'style', 'include_citations']
    }
  },
  {
    name: 'generate_search_queries',
    description: 'Generate 2-5 targeted search queries for a section based on title and content. Extracts key terms, converts questions to queries, and ensures uniqueness. Use this to find relevant papers efficiently.',
    inputSchema: {
      type: 'object',
      properties: {
        section_id: {
          type: 'string',
          description: 'The section ID to generate queries for (e.g., "2.1", "introduction")'
        }
      },
      required: ['section_id']
    }
  },
  {
    name: 'zotero_search_items',
    description: 'Search for items in your Zotero library by title, creator, or year.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (title, author, or year)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'zotero_get_item_fulltext',
    description: 'Get the full text content of a Zotero item by its key.',
    inputSchema: {
      type: 'object',
      properties: {
        item_key: {
          type: 'string',
          description: 'The Zotero item key'
        }
      },
      required: ['item_key']
    }
  },
  {
    name: 'docling_convert_document',
    description: 'Convert a document (PDF, Word, etc.) from a URL or local path to structured markdown format.',
    inputSchema: {
      type: 'object',
      properties: {
        source: {
          type: 'string',
          description: 'The URL or local file path to the document'
        }
      },
      required: ['source']
    }
  },
  {
    name: 'docling_export_to_markdown',
    description: 'Export a previously converted Docling document to markdown format.',
    inputSchema: {
      type: 'object',
      properties: {
        document_key: {
          type: 'string',
          description: 'The unique identifier of the document in the local cache'
        },
        max_size: {
          type: 'number',
          description: 'Maximum number of characters to return (optional)'
        }
      },
      required: ['document_key']
    }
  },
  {
    name: 'extract_pdf_with_docling',
    description: 'Extract text from a PDF file using the docling library directly.',
    inputSchema: {
      type: 'object',
      properties: {
        pdf_path: {
          type: 'string',
          description: 'Path to the PDF file to extract'
        },
        output_path: {
          type: 'string',
          description: 'Optional path to save extracted text (markdown format)'
        }
      },
      required: ['pdf_path']
    }
  },
  {
    name: 'zotero_add_paper',
    description: 'Add a new paper to a Zotero collection.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_name: {
          type: 'string',
          description: 'Name of the Zotero collection to add the paper to'
        },
        title: {
          type: 'string',
          description: 'Title of the paper'
        },
        authors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' }
            },
            required: ['lastName']
          },
          description: 'List of authors with firstName and lastName'
        },
        date: {
          type: 'string',
          description: 'Publication date (optional)'
        },
        doi: {
          type: 'string',
          description: 'DOI of the paper (optional)'
        },
        publication_title: {
          type: 'string',
          description: 'Journal or publication name (optional)'
        }
      },
      required: ['collection_name', 'title', 'authors']
    }
  },
  {
    name: 'zotero_get_collections',
    description: 'Get all collections from your Zotero library.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'zotero_get_collection_items',
    description: 'Get all items in a specific Zotero collection.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_key: {
          type: 'string',
          description: 'The Zotero collection key'
        }
      },
      required: ['collection_key']
    }
  },
  {
    name: 'verify_all_claims',
    description: 'Verify all claims in the knowledge base by searching for their primary quotes in the extracted literature files. Returns a report with verification status, similarity scores, and any problematic claims that need manual review.',
    inputSchema: {
      type: 'object',
      properties: {
        include_supporting_quotes: {
          type: 'boolean',
          description: 'Whether to also verify supporting quotes (optional, default: false)'
        },
        similarity_threshold: {
          type: 'number',
          description: 'Minimum similarity threshold for verification (0-1, default: 0.8)',
          minimum: 0,
          maximum: 1
        }
      }
    }
  }
];
