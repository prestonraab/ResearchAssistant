/**
 * Central export for all test helpers
 * 
 * This module provides comprehensive testing utilities organized by category:
 * 
 * - mockFactories: Pre-built mocks for services, VSCode APIs, and external dependencies
 * - testSetup: Test initialization, assertion helpers, and mock utilities
 * - fixtures: Shared test data (claims, papers, configurations, etc.)
 * - builders: Fluent builders for creating complex test objects
 * - vscodeHelpers: VSCode-specific setup and assertion utilities
 * - apiMockHelpers: HTTP response mocks and API simulation helpers
 * 
 * QUICK START:
 * 
 * 1. Always call setupTest() at the top of your describe block
 * 2. Use factories for services: createMockEmbeddingService()
 * 3. Use builders for objects: aClaim().withId('C_01').build()
 * 4. Use fixtures for shared data: TEST_CLAIMS.method
 * 5. Use assertion helpers: expectCalledTimes(mock, 2)
 * 
 * EXAMPLE:
 * 
 * import { setupTest, createMockEmbeddingService, aClaim, TEST_CLAIMS, expectCalledTimes } from './helpers';
 * 
 * describe('MyService', () => {
 *   setupTest();
 *   
 *   let mockEmbedding = createMockEmbeddingService();
 *   
 *   test('should process claim', async () => {
 *     const claim = aClaim().withId('C_01').build();
 *     await service.process(claim);
 *     expectCalledTimes(mockEmbedding.generateEmbedding, 1);
 *   });
 * });
 */

export * from './mockFactories';
export * from './testSetup';
export * from './fixtures';
export * from './builders';
export * from './vscodeHelpers';
export * from './apiMockHelpers';
