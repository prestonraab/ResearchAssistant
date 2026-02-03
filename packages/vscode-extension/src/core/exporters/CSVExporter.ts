import type { Claim } from '@research-assistant/core';
import type { CoverageMetrics } from '../coverageAnalyzer';

/**
 * Handles CSV export functionality
 * Generates CSV reports for various data types
 */
export class CSVExporter {
  /**
   * Generate coverage report as CSV
   */
  public generateCoverageCSV(metrics: CoverageMetrics[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Section ID,Claim Count,Coverage Level,Last Updated');

    // Data rows
    metrics.forEach(metric => {
      lines.push([
        metric.sectionId,
        metric.claimCount,
        metric.coverageLevel,
        metric.lastUpdated.toISOString()
      ].join(','));
    });

    return lines.join('\n');
  }

  /**
   * Generate claims report as CSV
   */
  public generateClaimsCSV(claims: Claim[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push('ID,Text,Category,Source,Verified,Sections,Primary Quote');

    // Data rows
    claims.forEach(claim => {
      const row = [
        claim.id,
        this.escapeCsvField(claim.text),
        claim.category,
        claim.primaryQuote?.source || 'Unknown',
        claim.verified ? 'Yes' : 'No',
        this.escapeCsvField(claim.sections.join('; ')),
        this.escapeCsvField(claim.primaryQuote?.text || '')
      ];
      lines.push(row.join(','));
    });

    return lines.join('\n');
  }

  /**
   * Generate reading progress report as CSV
   */
  public generateReadingProgressCSV(statuses: unknown[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push('Paper ID,Status,Started,Completed');

    // Data rows
    statuses.forEach(status => {
      const statusObj = status as Record<string, unknown>;
      lines.push([
        statusObj.itemKey,
        statusObj.status,
        statusObj.readingStarted ? new Date(statusObj.readingStarted as string).toISOString() : '',
        statusObj.readingCompleted ? new Date(statusObj.readingCompleted as string).toISOString() : ''
      ].join(','));
    });

    return lines.join('\n');
  }

  /**
   * Escape CSV field
   */
  private escapeCsvField(field: string): string {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
