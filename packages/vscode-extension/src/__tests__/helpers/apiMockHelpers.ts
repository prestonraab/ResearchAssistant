import { jest } from '@jest/globals';

/**
 * API Response Mock Helpers
 * 
 * These helpers consolidate common patterns for mocking API responses,
 * reducing duplication and improving consistency across tests.
 */

/**
 * Creates a mock successful fetch response
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockFetchResponse({ data: 'test' }));
 */
export const createMockFetchResponse = (
  data: any,
  options?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  }
): Response => {
  const { status = 200, statusText = 'OK', headers = {} } = options || {};
  
  return {
    status,
    statusText,
    ok: status >= 200 && status < 300,
    headers: new Headers(headers),
    json: jest.fn<() => Promise<any>>().mockResolvedValue(data),
    text: jest.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify(data)),
    blob: jest.fn<() => Promise<Blob>>().mockResolvedValue(new Blob([JSON.stringify(data)])),
    arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(0)),
    clone: jest.fn().mockReturnValue({
      json: jest.fn<() => Promise<any>>().mockResolvedValue(data),
      text: jest.fn<() => Promise<string>>().mockResolvedValue(JSON.stringify(data))
    }),
    redirected: false,
    type: 'basic',
    url: 'http://test.com',
    bodyUsed: false,
    body: null
  } as any as Response;
};

/**
 * Creates a mock error fetch response
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockErrorResponse(404, 'Not Found'));
 */
export const createMockErrorResponse = (
  status: number = 500,
  statusText: string = 'Internal Server Error',
  errorData?: any
): Response => {
  return createMockFetchResponse(
    errorData || { error: statusText },
    { status, statusText }
  );
};

/**
 * Creates a mock Zotero API response
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockZoteroResponse([item1, item2]));
 */
export const createMockZoteroResponse = (items: any[]): Response => {
  return createMockFetchResponse(items, {
    headers: {
      'content-type': 'application/json',
      'zotero-api-version': '3'
    }
  });
};

/**
 * Creates a mock verification service response
 * 
 * @example
 * mockMCPClient.verifyQuote.mockResolvedValueOnce(
 *   createMockVerificationResponse(true, 0.95)
 * );
 */
export const createMockVerificationResponse = (
  verified: boolean = true,
  similarity: number = 0.85,
  closestMatch?: string,
  context?: string
) => {
  return {
    verified,
    similarity,
    closestMatch: closestMatch || 'Test match',
    context: context || 'Test context'
  };
};

/**
 * Creates a mock embedding response
 * 
 * @example
 * mockEmbeddingService.generateEmbedding.mockResolvedValueOnce(
 *   createMockEmbedding()
 * );
 */
export const createMockEmbedding = (dimension: number = 1536): number[] => {
  return new Array(dimension).fill(0).map(() => Math.random());
};

/**
 * Creates multiple mock embeddings
 * 
 * @example
 * mockEmbeddingService.generateBatch.mockResolvedValueOnce(
 *   createMockEmbeddings(3)
 * );
 */
export const createMockEmbeddings = (count: number, dimension: number = 1536): number[][] => {
  return Array.from({ length: count }, () => createMockEmbedding(dimension));
};

/**
 * Creates a mock search results response
 * 
 * @example
 * mockMCPClient.zoteroSemanticSearch.mockResolvedValueOnce(
 *   createMockSearchResults([item1, item2])
 * );
 */
export const createMockSearchResults = (items: any[]) => {
  return {
    results: items,
    total: items.length,
    query: 'test query',
    timestamp: new Date().toISOString()
  };
};

/**
 * Creates a mock cache stats response
 * 
 * @example
 * mockMCPClient.getCacheStats.mockReturnValueOnce(
 *   createMockCacheStats(100, 50)
 * );
 */
export const createMockCacheStats = (size: number = 100, keys: number = 50) => {
  return {
    size,
    keys: Array.from({ length: keys }, (_, i) => `key_${i}`),
    hitRate: 0.85,
    missRate: 0.15
  };
};

/**
 * Creates a mock error object
 * 
 * @example
 * mockService.method.mockRejectedValueOnce(
 *   createMockError('Service unavailable')
 * );
 */
export const createMockError = (
  message: string = 'Test error',
  code?: string,
  details?: any
): Error => {
  const error = new Error(message);
  if (code) (error as any).code = code;
  if (details) (error as any).details = details;
  return error;
};

/**
 * Creates a mock timeout error
 * 
 * @example
 * mockService.method.mockRejectedValueOnce(createMockTimeoutError());
 */
export const createMockTimeoutError = (): Error => {
  return createMockError('Request timeout', 'TIMEOUT', { timeout: 5000 });
};

/**
 * Creates a mock network error
 * 
 * @example
 * mockService.method.mockRejectedValueOnce(createMockNetworkError());
 */
export const createMockNetworkError = (): Error => {
  return createMockError('Network error', 'NETWORK_ERROR', { offline: true });
};

/**
 * Creates a mock validation error
 * 
 * @example
 * mockService.method.mockRejectedValueOnce(
 *   createMockValidationError('Invalid input', { field: 'email' })
 * );
 */
export const createMockValidationError = (message: string, details?: any): Error => {
  return createMockError(message, 'VALIDATION_ERROR', details);
};

/**
 * Creates a mock paginated response
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockPaginatedResponse(items, 1, 10, 100)
 * );
 */
export const createMockPaginatedResponse = (
  items: any[],
  page: number = 1,
  pageSize: number = 10,
  total: number = 100
): Response => {
  return createMockFetchResponse({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total,
      hasPreviousPage: page > 1
    }
  });
};

/**
 * Creates a mock streaming response
 * 
 * @example
 * const chunks = ['chunk1', 'chunk2', 'chunk3'];
 * mockFetch.mockResolvedValueOnce(createMockStreamingResponse(chunks));
 */
export const createMockStreamingResponse = (chunks: string[]): Response => {
  let index = 0;
  
  return {
    status: 200,
    ok: true,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: {
      getReader: () => ({
        read: jest.fn().mockImplementation(async () => {
          if (index >= chunks.length) {
            return { done: true, value: undefined };
          }
          const chunk = chunks[index++];
          return {
            done: false,
            value: new TextEncoder().encode(chunk)
          };
        }),
        cancel: jest.fn(),
        releaseLock: jest.fn()
      })
    },
    json: jest.fn(),
    text: jest.fn(),
    blob: jest.fn(),
    arrayBuffer: jest.fn(),
    clone: jest.fn(),
    redirected: false,
    type: 'basic',
    url: 'http://test.com',
    bodyUsed: false
  } as any as Response;
};

/**
 * Setup helper to mock fetch globally
 * 
 * @example
 * beforeEach(() => {
 *   setupFetchMock();
 * });
 * 
 * // Then use:
 * (global.fetch as jest.Mock).mockResolvedValueOnce(
 *   createMockFetchResponse({ data: 'test' })
 * );
 */
export const setupFetchMock = () => {
  (global as any).fetch = jest.fn();
};

/**
 * Setup helper to mock XMLHttpRequest
 * 
 * @example
 * beforeEach(() => {
 *   setupXHRMock();
 * });
 */
export const setupXHRMock = () => {
  const mockXHR = {
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    abort: jest.fn(),
    getAllResponseHeaders: jest.fn().mockReturnValue(''),
    getResponseHeader: jest.fn(),
    overrideMimeType: jest.fn(),
    responseText: '',
    responseXML: null,
    status: 200,
    statusText: 'OK',
    readyState: 4,
    response: '',
    responseType: '',
    timeout: 0,
    withCredentials: false,
    upload: {}
  };

  (global as any).XMLHttpRequest = jest.fn(() => mockXHR);
};

/**
 * Creates a mock response for file operations
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockFileResponse('file content', 'text/plain')
 * );
 */
export const createMockFileResponse = (
  content: string,
  mimeType: string = 'text/plain'
): Response => {
  return createMockFetchResponse(content, {
    headers: { 'content-type': mimeType }
  });
};

/**
 * Creates a mock response for JSON file operations
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockJsonFileResponse({ data: 'test' })
 * );
 */
export const createMockJsonFileResponse = (data: any): Response => {
  return createMockFileResponse(JSON.stringify(data), 'application/json');
};

/**
 * Creates a mock response for CSV file operations
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockCsvFileResponse('col1,col2\nval1,val2')
 * );
 */
export const createMockCsvFileResponse = (content: string): Response => {
  return createMockFileResponse(content, 'text/csv');
};

/**
 * Creates a mock response for PDF operations
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockPdfResponse());
 */
export const createMockPdfResponse = (): Response => {
  const pdfBuffer = new ArrayBuffer(100);
  return {
    status: 200,
    ok: true,
    headers: new Headers({ 'content-type': 'application/pdf' }),
    arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(pdfBuffer),
    blob: jest.fn<() => Promise<Blob>>().mockResolvedValue(new Blob([pdfBuffer], { type: 'application/pdf' })),
    json: jest.fn(),
    text: jest.fn(),
    clone: jest.fn(),
    redirected: false,
    type: 'basic',
    url: 'http://test.com/file.pdf',
    bodyUsed: false,
    body: null
  } as any as Response;
};

/**
 * Creates a mock response for redirect operations
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockRedirectResponse('http://new-location.com')
 * );
 */
export const createMockRedirectResponse = (
  location: string,
  status: number = 302
): Response => {
  return createMockFetchResponse(null, {
    status,
    statusText: status === 301 ? 'Moved Permanently' : 'Found',
    headers: { 'location': location }
  });
};

/**
 * Creates a mock response for authentication errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockUnauthorizedResponse());
 */
export const createMockUnauthorizedResponse = (): Response => {
  return createMockErrorResponse(401, 'Unauthorized', {
    error: 'Invalid credentials'
  });
};

/**
 * Creates a mock response for forbidden errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockForbiddenResponse());
 */
export const createMockForbiddenResponse = (): Response => {
  return createMockErrorResponse(403, 'Forbidden', {
    error: 'Access denied'
  });
};

/**
 * Creates a mock response for not found errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockNotFoundResponse());
 */
export const createMockNotFoundResponse = (): Response => {
  return createMockErrorResponse(404, 'Not Found', {
    error: 'Resource not found'
  });
};

/**
 * Creates a mock response for conflict errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockConflictResponse());
 */
export const createMockConflictResponse = (): Response => {
  return createMockErrorResponse(409, 'Conflict', {
    error: 'Resource conflict'
  });
};

/**
 * Creates a mock response for rate limit errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockRateLimitResponse());
 */
export const createMockRateLimitResponse = (retryAfter: number = 60): Response => {
  return createMockErrorResponse(429, 'Too Many Requests', {
    error: 'Rate limit exceeded'
  });
};

/**
 * Creates a mock response for server errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockServerErrorResponse());
 */
export const createMockServerErrorResponse = (): Response => {
  return createMockErrorResponse(500, 'Internal Server Error', {
    error: 'Server error'
  });
};

/**
 * Creates a mock response for service unavailable errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockServiceUnavailableResponse());
 */
export const createMockServiceUnavailableResponse = (): Response => {
  return createMockErrorResponse(503, 'Service Unavailable', {
    error: 'Service temporarily unavailable'
  });
};

/**
 * Creates a mock response for gateway timeout errors
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(createMockGatewayTimeoutResponse());
 */
export const createMockGatewayTimeoutResponse = (): Response => {
  return createMockErrorResponse(504, 'Gateway Timeout', {
    error: 'Gateway timeout'
  });
};

/**
 * Creates a mock response with custom headers
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockResponseWithHeaders({ data: 'test' }, {
 *     'x-custom-header': 'value',
 *     'cache-control': 'no-cache'
 *   })
 * );
 */
export const createMockResponseWithHeaders = (
  data: any,
  headers: Record<string, string>
): Response => {
  return createMockFetchResponse(data, { headers });
};

/**
 * Creates a mock response with custom status
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockResponseWithStatus({ data: 'test' }, 201)
 * );
 */
export const createMockResponseWithStatus = (
  data: any,
  status: number
): Response => {
  return createMockFetchResponse(data, { status });
};

/**
 * Creates a mock response that simulates a slow network
 * 
 * @example
 * mockFetch.mockImplementationOnce(
 *   createMockSlowResponse({ data: 'test' }, 1000)
 * );
 */
export const createMockSlowResponse = (
  data: any,
  delayMs: number = 1000
): (...args: any[]) => Promise<Response> => {
  return async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return createMockFetchResponse(data);
  };
};

/**
 * Creates a mock response that fails intermittently
 * 
 * @example
 * mockFetch.mockImplementationOnce(
 *   createMockFlakeyResponse({ data: 'test' }, 0.5)
 * );
 */
export const createMockFlakeyResponse = (
  data: any,
  failureRate: number = 0.5
): (...args: any[]) => Promise<Response> => {
  return async () => {
    if (Math.random() < failureRate) {
      throw createMockNetworkError();
    }
    return createMockFetchResponse(data);
  };
};

/**
 * Creates a mock response that retries on failure
 * 
 * @example
 * mockFetch.mockImplementationOnce(
 *   createMockRetryableResponse({ data: 'test' }, 3)
 * );
 */
export const createMockRetryableResponse = (
  data: any,
  maxRetries: number = 3
): (...args: any[]) => Promise<Response> => {
  let attempts = 0;
  return async () => {
    attempts++;
    if (attempts < maxRetries) {
      throw createMockNetworkError();
    }
    return createMockFetchResponse(data);
  };
};

/**
 * Creates a mock response for batch operations
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockBatchResponse([
 *     { id: 1, status: 'success', data: 'result1' },
 *     { id: 2, status: 'error', error: 'Failed' }
 *   ])
 * );
 */
export const createMockBatchResponse = (results: any[]): Response => {
  return createMockFetchResponse({
    results,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length
  });
};

/**
 * Creates a mock response for webhook events
 * 
 * @example
 * mockFetch.mockResolvedValueOnce(
 *   createMockWebhookResponse('claim.created', { claimId: 'C_01' })
 * );
 */
export const createMockWebhookResponse = (
  eventType: string,
  data: any
): Response => {
  return createMockFetchResponse({
    event: eventType,
    timestamp: new Date().toISOString(),
    data
  });
};
