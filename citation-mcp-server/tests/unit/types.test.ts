/**
 * Basic tests to verify type definitions and infrastructure setup
 */

import { describe, it, expect } from '@jest/globals';
import type {
  Claim,
  ClaimMatch,
  SectionCoverage,
  PaperMetadata,
  ClaimStrengthResult,
  SynthesisOptions,
} from '../../src/types/index.js';

describe('Type Definitions', () => {
  it('should allow creating a valid Claim object', () => {
    const claim: Claim = {
      id: 'C_01',
      text: 'Test claim',
      category: 'Method',
      source: 'Smith2020',
      verified: true,
      primaryQuote: 'Test quote',
      supportingQuotes: [],
      sections: ['2.1'],
    };

    expect(claim.id).toBe('C_01');
    expect(claim.verified).toBe(true);
  });

  it('should allow creating a valid ClaimMatch object', () => {
    const match: ClaimMatch = {
      claimId: 'C_01',
      claimText: 'Test claim',
      source: 'Smith2020',
      similarity: 0.85,
      primaryQuote: 'Test quote',
    };

    expect(match.similarity).toBe(0.85);
  });

  it('should allow creating a valid SectionCoverage object', () => {
    const coverage: SectionCoverage = {
      sectionId: '2.1',
      sectionTitle: 'Background',
      totalSentences: 10,
      factualSentences: 8,
      supportedSentences: 6,
      coveragePercentage: 75,
      sentenceDetails: [],
    };

    expect(coverage.coveragePercentage).toBe(75);
  });

  it('should allow creating a valid PaperMetadata object', () => {
    const paper: PaperMetadata = {
      itemKey: 'ABC123',
      title: 'Test Paper',
      authors: ['Smith, J.', 'Doe, J.'],
      year: 2020,
      abstract: 'Test abstract',
      citationCount: 50,
    };

    expect(paper.authors.length).toBe(2);
  });

  it('should allow creating a valid ClaimStrengthResult object', () => {
    const result: ClaimStrengthResult = {
      claimId: 'C_01',
      strengthScore: 2.5,
      supportingClaims: [],
      contradictoryClaims: [],
    };

    expect(result.strengthScore).toBe(2.5);
  });

  it('should allow creating a valid SynthesisOptions object', () => {
    const options: SynthesisOptions = {
      claims: [],
      style: 'narrative',
      includeCitations: true,
      maxLength: 500,
    };

    expect(options.style).toBe('narrative');
  });
});
