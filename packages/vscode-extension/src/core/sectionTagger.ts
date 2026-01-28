/**
 * SectionTagger - Automatically tags claims with sections based on manuscript usage
 * Derives section tags from Q&A pairs in the manuscript
 */

import { QuestionAnswerParser, QuestionAnswerPair } from './questionAnswerParser';
import { ClaimsManager } from './claimsManagerWrapper';
import type { Claim } from '@research-assistant/core';

export interface SectionTaggingResult {
  claimsTagged: number;
  sectionsFound: number;
  claimSectionMap: Map<string, Set<string>>; // claimId -> section names
}

export class SectionTagger {
  constructor(
    private parser: QuestionAnswerParser,
    private claimsManager: ClaimsManager
  ) {}

  /**
   * Analyze manuscript to derive section tags for claims
   * Returns mapping of claims to sections without modifying claims
   */
  async analyzeManuscript(manuscriptText: string): Promise<SectionTaggingResult> {
    const pairs = this.parser.parseManuscript(manuscriptText);
    const claimSectionMap = new Map<string, Set<string>>();
    const sectionsFound = new Set<string>();

    for (const pair of pairs) {
      if (!pair.section || pair.claims.length === 0) {
        continue;
      }

      sectionsFound.add(pair.section);

      // Map each claim to this section
      for (const claimId of pair.claims) {
        if (!claimSectionMap.has(claimId)) {
          claimSectionMap.set(claimId, new Set());
        }
        claimSectionMap.get(claimId)!.add(pair.section);
      }
    }

    return {
      claimsTagged: claimSectionMap.size,
      sectionsFound: sectionsFound.size,
      claimSectionMap
    };
  }

  /**
   * Apply section tags to claims based on manuscript usage
   * Updates claims with section information
   */
  async tagClaimsFromManuscript(manuscriptText: string): Promise<SectionTaggingResult> {
    const result = await this.analyzeManuscript(manuscriptText);

    // Apply tags to claims
    for (const [claimId, sections] of result.claimSectionMap.entries()) {
      const claim = this.claimsManager.getClaim(claimId);
      if (!claim) {
        console.warn(`[SectionTagger] Claim ${claimId} not found`);
        continue;
      }

      // Update claim sections (merge with existing)
      const existingSections = new Set(claim.sections || []);
      for (const section of sections) {
        existingSections.add(section);
      }

      // Update claim
      await this.claimsManager.updateClaim(claimId, {
        sections: Array.from(existingSections)
      });
    }

    console.log(`[SectionTagger] Tagged ${result.claimsTagged} claims with ${result.sectionsFound} sections`);

    return result;
  }

  /**
   * Get section usage report
   * Shows which sections use which claims
   */
  getSectionUsageReport(manuscriptText: string): Map<string, string[]> {
    const pairs = this.parser.parseManuscript(manuscriptText);
    const sectionClaims = new Map<string, Set<string>>();

    for (const pair of pairs) {
      if (!pair.section || pair.claims.length === 0) {
        continue;
      }

      if (!sectionClaims.has(pair.section)) {
        sectionClaims.set(pair.section, new Set());
      }

      for (const claimId of pair.claims) {
        sectionClaims.get(pair.section)!.add(claimId);
      }
    }

    // Convert to sorted arrays
    const report = new Map<string, string[]>();
    for (const [section, claims] of sectionClaims.entries()) {
      report.set(section, Array.from(claims).sort());
    }

    return report;
  }
}
