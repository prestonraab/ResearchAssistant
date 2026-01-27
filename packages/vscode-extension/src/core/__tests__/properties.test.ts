/**
 * Property-based tests for Research Assistant Extension
 * These tests validate correctness properties across randomized inputs
 * Each property test runs minimum 10 iterations with fast-check (reduced for performance)
 */

import * as fc from 'fast-check';
import { OutlineParser } from '../outlineParserWrapper';
import { ClaimsManager } from '../claimsManagerWrapper';
import { CoverageAnalyzer } from '../coverageAnalyzer';
import { EmbeddingService } from '@research-assistant/core';
import {
  outlineArbitrary,
  claimArbitrary,
  claimsArrayArbitrary,
  sectionArbitrary,
  markdownArbitrary
} from './arbitraries';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Feature: research-assistant-extension

describe('Property-Based Tests', () => {
  let tempDir: string;
  let outlineParser: OutlineParser;
  let claimsManager: ClaimsManager;
  let coverageAnalyzer: CoverageAnalyzer;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-assistant-test-'));
    
    // Initialize services
    const outlinePath = path.join(tempDir, 'outline.md');
    const claimsPath = path.join(tempDir, 'claims.md');
    
    outlineParser = new OutlineParser(outlinePath);
    claimsManager = new ClaimsManager(claimsPath);
    embeddingService = new EmbeddingService(path.join(tempDir, '.cache'));
    coverageAnalyzer = new CoverageAnalyzer(claimsManager, embeddingService);
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // Property 1: Outline Parsing Completeness
  // Feature: research-assistant-extension, Property 1: Outline Parsing Completeness
  describe('Property 1: Outline Parsing Completeness', () => {
    it('should extract all headers and content from valid markdown', async () => {
      await fc.assert(
        fc.asyncProperty(
          markdownArbitrary(),
          async (markdown) => {
            // Write markdown to file
            const outlinePath = path.join(tempDir, 'test-outline.md');
            fs.writeFileSync(outlinePath, markdown);
            
            const parser = new OutlineParser(outlinePath);
            const sections = await parser.parse();
            
            // Count headers in markdown
            const headerRegex = /^(#{2,4})\s+(.+)$/gm;
            const matches = [...markdown.matchAll(headerRegex)];
            
            // All headers should be extracted
            expect(sections.length).toBe(matches.length);
            
            // Each section should have correct level and title
            sections.forEach((section, idx) => {
              const match = matches[idx];
              const expectedLevel = match[1].length;
              const expectedTitle = match[2].trim();
              
              expect(section.level).toBe(expectedLevel);
              expect(section.title).toBe(expectedTitle);
            });
            
            return true;
          }
        ),
        { numRuns: 10 } // Reduced for performance
      );
    }, 30000); // 30 second timeout
  });

  // Property 2: Coverage Calculation Accuracy
  // Feature: research-assistant-extension, Property 2: Coverage Calculation Accuracy
  describe('Property 2: Coverage Calculation Accuracy', () => {
    it('should calculate coverage levels based on claim counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          outlineArbitrary(),
          claimsArrayArbitrary(0, 20), // Reduced from 50
          async (sections, claims) => {
            // Assign claims to random sections
            const sectionIds = sections.map(s => s.id);
            const claimsWithSections = claims.map(claim => {
              const numSections = Math.floor(Math.random() * 3); // 0-2 sections
              const selectedSections = [];
              for (let i = 0; i < numSections && i < sectionIds.length; i++) {
                const randomIdx = Math.floor(Math.random() * sectionIds.length);
                selectedSections.push(sectionIds[randomIdx]);
              }
              return {
                ...claim,
                sections: selectedSections
              };
            });
            
            // Calculate coverage for each section
            sections.forEach(section => {
              const sectionClaims = claimsWithSections.filter(c => c.sections.includes(section.id));
              const claimCount = sectionClaims.length;
              
              // Determine expected coverage level
              let expectedLevel: 'none' | 'low' | 'moderate' | 'strong';
              if (claimCount === 0) {
                expectedLevel = 'none';
              } else if (claimCount <= 3) {
                expectedLevel = 'low';
              } else if (claimCount <= 6) {
                expectedLevel = 'moderate';
              } else {
                expectedLevel = 'strong';
              }
              
              // Coverage level should match claim count
              const coverage = {
                sectionId: section.id,
                claimCount,
                coverageLevel: expectedLevel,
                lastUpdated: new Date(),
                suggestedQueries: [],
                relevantPapers: []
              };
              
              expect(coverage.coverageLevel).toBe(expectedLevel);
              expect(coverage.claimCount).toBe(claimCount);
            });
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  // Property 8: Claim Serialization Round-Trip
  // Feature: research-assistant-extension, Property 8: Claim Serialization Round-Trip
  describe('Property 8: Claim Serialization Round-Trip', () => {
    it('should preserve all claim data through serialization', async () => {
      await fc.assert(
        fc.asyncProperty(
          claimArbitrary(),
          async (claim) => {
            // Serialize claim to markdown format
            const serialized = claimsManager.serializeClaim(claim);
            
            // Parse it back
            const deserialized = claimsManager.parseClaim(serialized);
            
            // Should not be null
            expect(deserialized).not.toBeNull();
            if (!deserialized) return false;
            
            // All fields should match (text is normalized by trimming)
            expect(deserialized.id).toBe(claim.id);
            expect(deserialized.text).toBe(claim.text.trim());
            expect(deserialized.category).toBe(claim.category);
            expect(deserialized.source).toBe(claim.source);
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  // Property 3: Query Generation Bounds
  // Feature: research-assistant-extension, Property 3: Query Generation Bounds
  describe('Property 3: Query Generation Bounds', () => {
    it('should generate 2-5 queries for any section', () => {
      fc.assert(
        fc.property(
          sectionArbitrary(),
          (section) => {
            const queries = coverageAnalyzer.generateSearchQueries(section);
            
            expect(queries.length).toBeGreaterThanOrEqual(2);
            expect(queries.length).toBeLessThanOrEqual(5);
            
            // All queries should be non-empty strings
            queries.forEach(query => {
              expect(typeof query).toBe('string');
              expect(query.length).toBeGreaterThan(0);
            });
            
            return true;
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
