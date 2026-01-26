import { ClaimsManager } from '../../src/core/ClaimsManager';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Integration tests for ClaimsManager using actual workspace data.
 * These tests verify that the ClaimsManager can correctly parse
 * real claim files from the workspace.
 */
describe('ClaimsManager Integration Tests', () => {
  let claimsManager: ClaimsManager;
  // Workspace root is citation-mcp-server/../../ (go up from citation-mcp-server to Chapter directory)
  const workspaceRoot = path.resolve(__dirname, '../../..');

  beforeEach(() => {
    claimsManager = new ClaimsManager(workspaceRoot);
  });

  it('should load claims from actual workspace', async () => {
    const claims = await claimsManager.loadClaims();

    // Verify we loaded some claims
    expect(claims.length).toBeGreaterThan(0);
    console.log(`Loaded ${claims.length} claims from workspace`);

    // Verify claim structure
    const firstClaim = claims[0];
    expect(firstClaim).toHaveProperty('id');
    expect(firstClaim).toHaveProperty('text');
    expect(firstClaim).toHaveProperty('category');
    expect(firstClaim).toHaveProperty('source');
    expect(firstClaim).toHaveProperty('primaryQuote');
    expect(firstClaim).toHaveProperty('supportingQuotes');
    expect(firstClaim).toHaveProperty('sections');

    // Verify ID format
    expect(firstClaim.id).toMatch(/^C_\d+$/);
  });

  it('should correctly parse claim metadata', async () => {
    await claimsManager.loadClaims();

    // Get a specific claim (C_23 from the sample we saw)
    const claim = claimsManager.getClaim('C_23');

    if (claim) {
      expect(claim.text).toContain('stacking model');
      expect(claim.category).toBe('Method');
      expect(claim.source).toBe('Babichev2025');
      expect(claim.primaryQuote).toBeTruthy();
      expect(claim.primaryQuote.length).toBeGreaterThan(0);
    }
  });

  it('should support getClaim lookup', async () => {
    await claimsManager.loadClaims();

    const claim = claimsManager.getClaim('C_23');
    expect(claim).not.toBeNull();
    
    const nonExistent = claimsManager.getClaim('C_99999');
    expect(nonExistent).toBeNull();
  });

  it('should support findClaimsBySource', async () => {
    await claimsManager.loadClaims();

    // Find claims from a known source
    const claims = claimsManager.findClaimsBySource('Babichev2025');
    
    if (claims.length > 0) {
      expect(claims.length).toBeGreaterThan(0);
      claims.forEach(claim => {
        expect(claim.source).toBe('Babichev2025');
      });
    }
  });

  it('should handle multiple claim files', async () => {
    const claims = await claimsManager.loadClaims();

    // Group claims by category
    const categories = new Set(claims.map(c => c.category));
    
    // We should have multiple categories
    expect(categories.size).toBeGreaterThan(1);
    console.log(`Found ${categories.size} unique categories:`, Array.from(categories));
  });

  it('should parse supporting quotes correctly', async () => {
    await claimsManager.loadClaims();

    // Find claims with supporting quotes
    const claimsWithSupporting = claimsManager
      .getAllClaims()
      .filter(c => c.supportingQuotes.length > 0);

    expect(claimsWithSupporting.length).toBeGreaterThan(0);
    
    // Verify supporting quotes are non-empty strings
    claimsWithSupporting.forEach(claim => {
      claim.supportingQuotes.forEach(quote => {
        expect(typeof quote).toBe('string');
        expect(quote.length).toBeGreaterThan(0);
      });
    });
  });

  it('should provide accurate claim count', async () => {
    await claimsManager.loadClaims();

    const count = claimsManager.getClaimCount();
    const allClaims = claimsManager.getAllClaims();

    expect(count).toBe(allClaims.length);
    expect(count).toBeGreaterThan(0);
  });
});
