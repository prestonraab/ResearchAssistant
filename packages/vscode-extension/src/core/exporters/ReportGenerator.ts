import type { Claim, OutlineSection } from '@research-assistant/core';
import type { CoverageMetrics } from '../coverageAnalyzer';

/**
 * Handles report generation for various export formats
 */
export class ReportGenerator {
  /**
   * Generate coverage report as markdown
   */
  public static generateCoverageMarkdown(
    metrics: CoverageMetrics[],
    sections: OutlineSection[]
  ): string {
    const lines: string[] = [];
    
    lines.push('# Coverage Analysis Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    // Summary statistics
    const totalSections = metrics.length;
    const sectionsWithCoverage = metrics.filter(m => m.coverageLevel !== 'none').length;
    const coveragePercentage = totalSections > 0 
      ? Math.round((sectionsWithCoverage / totalSections) * 100)
      : 0;
    const gaps = metrics.filter(m => m.claimCount < 2).length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Sections: ${totalSections}`);
    lines.push(`- Sections with Coverage: ${sectionsWithCoverage}`);
    lines.push(`- Coverage Percentage: ${coveragePercentage}%`);
    lines.push(`- Gaps (< 2 claims): ${gaps}`);
    lines.push('');

    // Coverage by level
    const byLevel = {
      none: metrics.filter(m => m.coverageLevel === 'none').length,
      low: metrics.filter(m => m.coverageLevel === 'low').length,
      moderate: metrics.filter(m => m.coverageLevel === 'moderate').length,
      strong: metrics.filter(m => m.coverageLevel === 'strong').length
    };

    lines.push('## Coverage Distribution');
    lines.push('');
    lines.push(`- None (0 claims): ${byLevel.none}`);
    lines.push(`- Low (1-3 claims): ${byLevel.low}`);
    lines.push(`- Moderate (4-6 claims): ${byLevel.moderate}`);
    lines.push(`- Strong (7+ claims): ${byLevel.strong}`);
    lines.push('');

    // Detailed section breakdown
    lines.push('## Section Details');
    lines.push('');

    metrics.forEach(metric => {
      const section = sections.find(s => s.id === metric.sectionId);
      if (!section) {
        return;
      }

      const levelEmoji = {
        none: '❌',
        low: '⚠️',
        moderate: '✅',
        strong: '🌟'
      }[metric.coverageLevel];

      lines.push(`### ${levelEmoji} ${section.title}`);
      lines.push('');
      lines.push(`- **Claims**: ${metric.claimCount}`);
      lines.push(`- **Coverage Level**: ${metric.coverageLevel}`);
      lines.push(`- **Last Updated**: ${metric.lastUpdated.toISOString()}`);
      
      if (metric.suggestedQueries.length > 0) {
        lines.push('- **Suggested Queries**:');
        metric.suggestedQueries.forEach(q => lines.push(`  - ${q}`));
      }
      
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate claims report as markdown
   */
  public static generateClaimsMarkdown(claims: Claim[], includeMetadata: boolean): string {
    const lines: string[] = [];
    
    lines.push('# Claims Export');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Total Claims: ${claims.length}`);
    lines.push('');

    claims.forEach(claim => {
      lines.push(`## ${claim.id}`);
      lines.push('');
      lines.push(`**Text**: ${claim.text}`);
      lines.push('');
      lines.push(`**Category**: ${claim.category}`);
      lines.push(`**Source**: ${claim.primaryQuote?.source || 'Unknown'}`);
      
      if (includeMetadata) {
        lines.push(`**Verified**: ${claim.verified ? 'Yes' : 'No'}`);
        lines.push(`**Sections**: ${claim.sections.join(', ')}`);
        lines.push(`**Created**: ${claim.createdAt?.toISOString() || 'Unknown'}`);
      }
      
      lines.push('');
      lines.push('**Primary Quote**:');
      lines.push('');
      lines.push(`> ${claim.primaryQuote?.text || ''}`);
      lines.push('');

      if (claim.supportingQuotes.length > 0) {
        lines.push('**Supporting Quotes**:');
        lines.push('');
        claim.supportingQuotes.forEach((quote, i) => {
          lines.push(`${i + 1}. > ${quote.text}`);
          lines.push('');
        });
      }

      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Generate reading progress report as markdown
   */
  public static generateReadingProgressMarkdown(statuses: unknown[]): string {
    const lines: string[] = [];
    
    lines.push('# Reading Progress Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    const total = statuses.length;
    const read = statuses.filter(s => {
      const sObj = s as Record<string, unknown>;
      return sObj.status === 'read';
    }).length;
    const reading = statuses.filter(s => {
      const sObj = s as Record<string, unknown>;
      return sObj.status === 'reading';
    }).length;
    const toRead = statuses.filter(s => {
      const sObj = s as Record<string, unknown>;
      return sObj.status === 'to-read';
    }).length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- Total Papers: ${total}`);
    lines.push(`- Read: ${read} (${Math.round((read / total) * 100)}%)`);
    lines.push(`- Currently Reading: ${reading}`);
    lines.push(`- To Read: ${toRead}`);
    lines.push('');

    // Group by status
    ['read', 'reading', 'to-read'].forEach(status => {
      const papers = statuses.filter(s => {
        const sObj = s as Record<string, unknown>;
        return sObj.status === status;
      });
      if (papers.length === 0) {
        return;
      }

      lines.push(`## ${status.charAt(0).toUpperCase() + status.slice(1)}`);
      lines.push('');

      papers.forEach(paper => {
        const paperObj = paper as Record<string, unknown>;
        lines.push(`- ${paperObj.itemKey}`);
        if (paperObj.readingStarted) {
          lines.push(`  - Started: ${new Date(paperObj.readingStarted as string).toLocaleDateString()}`);
        }
        if (paperObj.readingCompleted) {
          lines.push(`  - Completed: ${new Date(paperObj.readingCompleted as string).toLocaleDateString()}`);
        }
      });

      lines.push('');
    });

    return lines.join('\n');
  }
}
