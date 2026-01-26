#!/usr/bin/env python3
"""
Test script to measure output sizes of citation MCP tools.
This helps identify which tools consume the most context window space.
"""

import json
import sys
from typing import Dict, Any, List, Tuple


def measure_output_size(output: Any) -> Dict[str, int]:
    """Measure the size of tool output in various ways."""
    output_str = json.dumps(output) if not isinstance(output, str) else output
    
    return {
        "characters": len(output_str),
        "tokens_estimate": len(output_str) // 4,  # Rough estimate: 1 token ≈ 4 chars
        "lines": output_str.count('\n') + 1,
        "kb": len(output_str.encode('utf-8')) / 1024
    }


def format_size_report(tool_name: str, sizes: Dict[str, int]) -> str:
    """Format a size report for a tool."""
    return f"""
{tool_name}:
  Characters: {sizes['characters']:,}
  Tokens (est): {sizes['tokens_estimate']:,}
  Lines: {sizes['lines']:,}
  Size: {sizes['kb']:.2f} KB
"""


def main():
    """Run tests on citation MCP tools and report output sizes."""
    
    print("=" * 70)
    print("CITATION MCP TOOL OUTPUT SIZE TEST")
    print("=" * 70)
    print("\nThis test measures the output size of each citation MCP tool.")
    print("Tools that produce large outputs consume more context window space.\n")
    
    # We'll simulate the tools by importing and calling them
    # In practice, you'd call them through the MCP interface
    
    test_results: List[Tuple[str, Dict[str, int]]] = []
    
    # Test 1: search_quotes with a common term
    print("\n[1/8] Testing: search_quotes (common term)")
    print("Query: 'batch effect'")
    try:
        from citation_mcp_server.src.index import search_quotes
        result = search_quotes("batch effect", author_filter=None)
        sizes = measure_output_size(result)
        test_results.append(("search_quotes (common term)", sizes))
        print(format_size_report("search_quotes (common term)", sizes))
    except Exception as e:
        print(f"  Error: {e}")
        print("  Note: This test requires the citation MCP server to be importable")
    
    # Test 2: search_quotes with a rare term
    print("\n[2/8] Testing: search_quotes (rare term)")
    print("Query: 'ComBat-Seq'")
    try:
        result = search_quotes("ComBat-Seq", author_filter=None)
        sizes = measure_output_size(result)
        test_results.append(("search_quotes (rare term)", sizes))
        print(format_size_report("search_quotes (rare term)", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test 3: verify_quote
    print("\n[3/8] Testing: verify_quote")
    print("Quote: 'ComBat uses Empirical Bayes...'")
    try:
        from citation_mcp_server.src.index import verify_quote
        result = verify_quote(
            "ComBat uses Empirical Bayes to estimate location and scale parameters",
            "Soneson2014"
        )
        sizes = measure_output_size(result)
        test_results.append(("verify_quote", sizes))
        print(format_size_report("verify_quote", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test 4: list_sources
    print("\n[4/8] Testing: list_sources")
    try:
        from citation_mcp_server.src.index import list_sources
        result = list_sources()
        sizes = measure_output_size(result)
        test_results.append(("list_sources", sizes))
        print(format_size_report("list_sources", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test 5: get_source_text
    print("\n[5/8] Testing: get_source_text")
    print("Source: Soneson2014")
    try:
        from citation_mcp_server.src.index import get_source_text
        result = get_source_text("Soneson2014")
        sizes = measure_output_size(result)
        test_results.append(("get_source_text", sizes))
        print(format_size_report("get_source_text", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test 6: search_by_question
    print("\n[6/8] Testing: search_by_question")
    print("Question: 'How do batch effects impact classifier performance?'")
    try:
        from citation_mcp_server.src.index import search_by_question
        result = search_by_question(
            "How do batch effects impact classifier performance?",
            threshold=0.3
        )
        sizes = measure_output_size(result)
        test_results.append(("search_by_question", sizes))
        print(format_size_report("search_by_question", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test 7: search_by_draft (paragraph mode)
    print("\n[7/8] Testing: search_by_draft (paragraph mode)")
    draft_text = "Batch effects can substantially degrade classifier performance."
    try:
        from citation_mcp_server.src.index import search_by_draft
        result = search_by_draft(draft_text, mode="paragraph", threshold=0.3)
        sizes = measure_output_size(result)
        test_results.append(("search_by_draft (paragraph)", sizes))
        print(format_size_report("search_by_draft (paragraph)", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Test 8: verify_all_quotes
    print("\n[8/8] Testing: verify_all_quotes")
    try:
        from citation_mcp_server.src.index import verify_all_quotes
        result = verify_all_quotes()
        sizes = measure_output_size(result)
        test_results.append(("verify_all_quotes", sizes))
        print(format_size_report("verify_all_quotes", sizes))
    except Exception as e:
        print(f"  Error: {e}")
    
    # Summary report
    print("\n" + "=" * 70)
    print("SUMMARY: TOOLS RANKED BY OUTPUT SIZE")
    print("=" * 70)
    
    if test_results:
        # Sort by token estimate (descending)
        sorted_results = sorted(
            test_results,
            key=lambda x: x[1]['tokens_estimate'],
            reverse=True
        )
        
        print("\nRanked by estimated token count:\n")
        for i, (tool_name, sizes) in enumerate(sorted_results, 1):
            print(f"{i}. {tool_name}")
            print(f"   Tokens: {sizes['tokens_estimate']:,} (~{sizes['kb']:.2f} KB)")
        
        # Identify high-risk tools
        print("\n" + "-" * 70)
        print("HIGH CONTEXT CONSUMPTION TOOLS (>5000 tokens):")
        print("-" * 70)
        
        high_risk = [
            (name, sizes) for name, sizes in sorted_results
            if sizes['tokens_estimate'] > 5000
        ]
        
        if high_risk:
            for tool_name, sizes in high_risk:
                print(f"\n⚠️  {tool_name}")
                print(f"   Estimated tokens: {sizes['tokens_estimate']:,}")
                print(f"   Recommendation: Use sparingly or with filters")
        else:
            print("\n✓ No tools exceeded 5000 tokens in these tests")
        
        # Calculate total context used
        total_tokens = sum(sizes['tokens_estimate'] for _, sizes in test_results)
        print("\n" + "-" * 70)
        print(f"TOTAL CONTEXT USED IN THIS TEST: ~{total_tokens:,} tokens")
        print(f"Percentage of 200K context window: {(total_tokens/200000)*100:.1f}%")
        print("-" * 70)
    else:
        print("\nNo test results available.")
        print("Make sure the citation MCP server is properly installed.")
    
    print("\n" + "=" * 70)
    print("RECOMMENDATIONS")
    print("=" * 70)
    print("""
1. Use targeted searches with specific terms rather than broad queries
2. Apply author_filter when possible to reduce search_quotes results
3. Avoid get_source_text unless absolutely necessary (returns full papers)
4. Use verify_quote instead of search_quotes when you have the exact quote
5. Consider implementing max_results parameter for search tools
6. Use search_by_question for semantic search (may be more focused)
7. Batch multiple verifications into a single analysis phase
""")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
