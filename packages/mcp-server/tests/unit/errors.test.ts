/**
 * Unit tests for error response formatter
 * Tests error creation functions for various error scenarios
 */

import {
  createFileNotFoundError,
  createProcessingError,
  createEmptyResultError,
  createGenericError,
  createServiceNotInitializedError,
  createConfigurationError,
  createEmptyDatasetError,
  isErrorResponse,
  formatErrorResponse,
  safeErrorHandler,
} from '../../src/utils/errors';

describe('Error Utilities', () => {
  describe('createFileNotFoundError', () => {
    it('should create error for claims file', () => {
      const error = createFileNotFoundError(
        '/workspace/01_Knowledge_Base/claims_and_evidence.md',
        'claims file'
      );

      expect(error.error).toBe('FILE_NOT_FOUND');
      expect(error.message).toContain('claims_and_evidence.md');
      expect(error.context?.path).toBeDefined();
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions?.length).toBeGreaterThan(0);
      expect(error.suggestions?.some(s => s.includes('claims'))).toBe(true);
    });

    it('should create error for outline file', () => {
      const error = createFileNotFoundError(
        '/workspace/03_Drafting/outline.md',
        'outline file'
      );

      expect(error.error).toBe('FILE_NOT_FOUND');
      expect(error.message).toContain('outline.md');
      expect(error.suggestions?.some(s => s.includes('outline'))).toBe(true);
    });

    it('should create error for manuscript file', () => {
      const error = createFileNotFoundError(
        '/workspace/03_Drafting/manuscript.md',
        'manuscript file'
      );

      expect(error.error).toBe('FILE_NOT_FOUND');
      expect(error.message).toContain('manuscript.md');
      expect(error.suggestions?.some(s => s.includes('manuscript'))).toBe(true);
    });

    it('should create error for extracted text', () => {
      const error = createFileNotFoundError(
        '/workspace/literature/ExtractedText/Paper.txt',
        'extracted text'
      );

      expect(error.error).toBe('FILE_NOT_FOUND');
      expect(error.suggestions?.some(s => s.includes('Extract'))).toBe(true);
    });

    it('should create generic error for unknown file types', () => {
      const error = createFileNotFoundError(
        '/workspace/unknown/file.txt',
        'file'
      );

      expect(error.error).toBe('FILE_NOT_FOUND');
      expect(error.message).toContain('file.txt');
      expect(error.suggestions).toBeDefined();
    });
  });

  describe('createProcessingError', () => {
    it('should create error from Error object', () => {
      const originalError = new Error('Something went wrong');
      const error = createProcessingError('process data', originalError);

      expect(error.error).toBe('PROCESSING_ERROR');
      expect(error.message).toContain('process data');
      expect(error.message).toContain('Something went wrong');
      expect(error.context?.operation).toBe('process data');
      expect(error.suggestions).toBeDefined();
    });

    it('should create error from string', () => {
      const error = createProcessingError('parse file', 'Invalid format');

      expect(error.error).toBe('PROCESSING_ERROR');
      expect(error.message).toContain('parse file');
      expect(error.message).toContain('Invalid format');
    });

    it('should include additional context', () => {
      const error = createProcessingError(
        'generate embedding',
        new Error('API error'),
        { apiKey: 'hidden', model: 'text-embedding-3-small' }
      );

      expect(error.context?.apiKey).toBe('hidden');
      expect(error.context?.model).toBe('text-embedding-3-small');
    });

    it('should provide embedding-specific suggestions', () => {
      const error = createProcessingError('generate embedding', new Error('API error'));

      expect(error.suggestions?.some(s => s.includes('OPENAI_API_KEY'))).toBe(true);
    });

    it('should provide parsing-specific suggestions', () => {
      const error = createProcessingError('parse markdown', new Error('Invalid syntax'));

      expect(error.suggestions?.some(s => s.includes('markdown') || s.includes('format'))).toBe(true);
    });

    it('should provide search-specific suggestions', () => {
      const error = createProcessingError('search claims', new Error('No results'));

      expect(error.suggestions?.some(s => s.includes('threshold') || s.includes('claims'))).toBe(true);
    });
  });

  describe('createEmptyResultError', () => {
    it('should create error for empty search results', () => {
      const error = createEmptyResultError(
        'search claims',
        'No claims match the query'
      );

      expect(error.error).toBe('EMPTY_RESULT');
      expect(error.message).toContain('search claims');
      expect(error.message).toContain('No claims match');
      expect(error.context?.operation).toBe('search claims');
      expect(error.context?.reason).toBe('No claims match the query');
      expect(error.suggestions).toBeDefined();
    });

    it('should provide search-specific suggestions', () => {
      const error = createEmptyResultError('find claims', 'No matches');

      expect(error.suggestions?.some(s => s.includes('threshold') || s.includes('search'))).toBe(true);
    });

    it('should provide coverage-specific suggestions', () => {
      const error = createEmptyResultError('analyze coverage', 'No supporting claims');

      expect(error.suggestions?.some(s => s.includes('claims') || s.includes('support'))).toBe(true);
    });

    it('should provide ranking-specific suggestions', () => {
      const error = createEmptyResultError('rank papers', 'No papers available');

      expect(error.suggestions?.some(s => s.includes('papers') || s.includes('abstracts'))).toBe(true);
    });

    it('should include additional context', () => {
      const error = createEmptyResultError(
        'search',
        'No results',
        { query: 'test', threshold: 0.5 }
      );

      expect(error.context?.query).toBe('test');
      expect(error.context?.threshold).toBe(0.5);
    });
  });

  describe('createGenericError', () => {
    it('should create error from Error object', () => {
      const originalError = new Error('Generic error');
      const error = createGenericError(originalError);

      expect(error.error).toBe('PROCESSING_ERROR');
      expect(error.message).toBe('Generic error');
      expect(error.context?.errorType).toBe('Error');
      expect(error.context?.stack).toBeDefined();
    });

    it('should create error from string', () => {
      const error = createGenericError('Something failed');

      expect(error.error).toBe('PROCESSING_ERROR');
      expect(error.message).toBe('Something failed');
      expect(error.context?.errorType).toBe('string');
    });

    it('should include additional context', () => {
      const error = createGenericError(
        new Error('Test'),
        { operation: 'test', data: 'value' }
      );

      expect(error.context?.operation).toBe('test');
      expect(error.context?.data).toBe('value');
    });
  });

  describe('createServiceNotInitializedError', () => {
    it('should create error for uninitialized service', () => {
      const error = createServiceNotInitializedError('EmbeddingService');

      expect(error.error).toBe('PROCESSING_ERROR');
      expect(error.message).toContain('EmbeddingService');
      expect(error.message).toContain('not initialized');
      expect(error.context?.serviceName).toBe('EmbeddingService');
      expect(error.suggestions?.some(s => s.includes('OPENAI_API_KEY'))).toBe(true);
    });
  });

  describe('createConfigurationError', () => {
    it('should create error for invalid configuration', () => {
      const error = createConfigurationError(
        'SIMILARITY_THRESHOLD',
        'must be between 0 and 1'
      );

      expect(error.error).toBe('VALIDATION_ERROR');
      expect(error.message).toContain('SIMILARITY_THRESHOLD');
      expect(error.message).toContain('must be between 0 and 1');
      expect(error.context?.configKey).toBe('SIMILARITY_THRESHOLD');
      expect(error.context?.issue).toBe('must be between 0 and 1');
    });
  });

  describe('createEmptyDatasetError', () => {
    it('should create error for empty dataset', () => {
      const error = createEmptyDatasetError(
        'Claims database',
        '01_Knowledge_Base/claims/'
      );

      expect(error.error).toBe('EMPTY_RESULT');
      expect(error.message).toContain('Claims database');
      expect(error.message).toContain('empty');
      expect(error.context?.datasetName).toBe('Claims database');
      expect(error.context?.expectedLocation).toBe('01_Knowledge_Base/claims/');
    });
  });

  describe('isErrorResponse', () => {
    it('should return true for valid ErrorResponse', () => {
      const error = {
        error: 'VALIDATION_ERROR',
        message: 'Test error',
      };

      expect(isErrorResponse(error)).toBe(true);
    });

    it('should return false for non-ErrorResponse objects', () => {
      expect(isErrorResponse({})).toBe(false);
      expect(isErrorResponse({ error: 'test' })).toBe(false);
      expect(isErrorResponse({ message: 'test' })).toBe(false);
      expect(isErrorResponse('error')).toBe(false);
      expect(isErrorResponse(123)).toBe(false);
      expect(isErrorResponse(null)).toBe(false);
      expect(isErrorResponse(undefined)).toBe(false);
    });
  });

  describe('formatErrorResponse', () => {
    it('should format error as JSON string', () => {
      const error = createFileNotFoundError('/path/to/file.txt', 'file');
      const formatted = formatErrorResponse(error);

      expect(typeof formatted).toBe('string');
      expect(() => JSON.parse(formatted)).not.toThrow();
      
      const parsed = JSON.parse(formatted);
      expect(parsed.error).toBe('FILE_NOT_FOUND');
      expect(parsed.message).toBeDefined();
    });

    it('should format with proper indentation', () => {
      const error = createProcessingError('test', new Error('test'));
      const formatted = formatErrorResponse(error);

      // Check for indentation (2 spaces)
      expect(formatted).toContain('  ');
    });
  });

  describe('safeErrorHandler', () => {
    it('should return ErrorResponse as-is', () => {
      const originalError = createFileNotFoundError('/path/file.txt', 'file');
      const result = safeErrorHandler(originalError, 'test operation');

      expect(result).toBe(originalError);
    });

    it('should convert Error to ErrorResponse', () => {
      const originalError = new Error('Test error');
      const result = safeErrorHandler(originalError, 'test operation');

      expect(isErrorResponse(result)).toBe(true);
      expect(result.error).toBe('PROCESSING_ERROR');
      expect(result.message).toContain('Test error');
    });

    it('should convert string to ErrorResponse', () => {
      const result = safeErrorHandler('Error message', 'test operation');

      expect(isErrorResponse(result)).toBe(true);
      expect(result.error).toBe('PROCESSING_ERROR');
      expect(result.message).toContain('Error message');
    });

    it('should include operation in context', () => {
      const result = safeErrorHandler(new Error('Test'), 'my operation');

      expect(result.context?.operation).toBe('my operation');
    });

    it('should include additional context', () => {
      const result = safeErrorHandler(
        new Error('Test'),
        'operation',
        { key: 'value' }
      );

      expect(result.context?.key).toBe('value');
    });

    it('should never throw even with invalid input', () => {
      expect(() => safeErrorHandler(undefined, 'test')).not.toThrow();
      expect(() => safeErrorHandler(null, 'test')).not.toThrow();
      expect(() => safeErrorHandler({}, 'test')).not.toThrow();
      expect(() => safeErrorHandler([], 'test')).not.toThrow();
      expect(() => safeErrorHandler(123, 'test')).not.toThrow();
    });
  });
});
