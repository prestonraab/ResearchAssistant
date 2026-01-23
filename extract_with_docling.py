#!/usr/bin/env python3
"""
Extract full texts from PDFs using docling library directly.

This script can be used when docling MCP is not available or for batch processing.

Usage:
    # Extract all PDFs found by extract_zotero_fulltexts.py
    uv run python3 extract_with_docling.py --pdf-dir ~/Zotero/storage
    
    # Extract specific PDF
    uv run python3 extract_with_docling.py --pdf /path/to/file.pdf --output output.txt
"""

import argparse
import sys
from pathlib import Path
from typing import List, Optional

try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    DOCLING_AVAILABLE = True
except ImportError:
    DOCLING_AVAILABLE = False
    print("Warning: docling library not available. Install with: pip install docling")


def extract_pdf_to_text(pdf_path: Path, output_path: Optional[Path] = None) -> str:
    """Extract text from PDF using docling."""
    if not DOCLING_AVAILABLE:
        raise ImportError("docling library not available")
    
    converter = DocumentConverter()
    result = converter.convert(str(pdf_path))
    
    # Convert to markdown/text
    markdown = result.document.export_to_markdown()
    
    if output_path:
        output_path.write_text(markdown, encoding='utf-8')
        print(f"✓ Extracted to: {output_path}")
    
    return markdown


def main():
    parser = argparse.ArgumentParser(
        description="Extract text from PDFs using docling library"
    )
    
    parser.add_argument(
        '--pdf',
        type=Path,
        help='Single PDF file to extract'
    )
    parser.add_argument(
        '--pdf-dir',
        type=Path,
        help='Directory containing PDFs to extract'
    )
    parser.add_argument(
        '--output',
        type=Path,
        help='Output file path (for single PDF)'
    )
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=Path(__file__).parent / "literature" / "ExtractedText",
        help='Output directory for extracted texts'
    )
    
    args = parser.parse_args()
    
    if not DOCLING_AVAILABLE:
        print("Error: docling library not available")
        print("Install with: pip install docling")
        sys.exit(1)
    
    if args.pdf:
        # Single PDF
        output_path = args.output or (args.output_dir / f"{args.pdf.stem}.txt")
        args.output_dir.mkdir(parents=True, exist_ok=True)
        try:
            extract_pdf_to_text(args.pdf, output_path)
        except Exception as e:
            print(f"Error extracting {args.pdf}: {e}", file=sys.stderr)
            sys.exit(1)
    
    elif args.pdf_dir:
        # Batch processing
        pdfs = list(args.pdf_dir.glob("**/*.pdf"))
        print(f"Found {len(pdfs)} PDFs in {args.pdf_dir}")
        
        args.output_dir.mkdir(parents=True, exist_ok=True)
        
        for pdf in pdfs:
            output_path = args.output_dir / f"{pdf.stem}.txt"
            if output_path.exists():
                print(f"⏭  Skipping {pdf.name} (already extracted)")
                continue
            
            try:
                print(f"Processing {pdf.name}...")
                extract_pdf_to_text(pdf, output_path)
            except Exception as e:
                print(f"✗ Error extracting {pdf.name}: {e}", file=sys.stderr)
    
    else:
        parser.error("Must specify either --pdf or --pdf-dir")


if __name__ == "__main__":
    main()
