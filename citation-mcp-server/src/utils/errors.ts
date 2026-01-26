/**
 * Error response formatter for MCP tools
 * Formats all errors as JSON with error type, message, context, and suggestions
 * Provides actionable error messages and remediation steps
 */

import { ErrorResponse, ErrorType } from '../types/index.js';
import * as path from 'path';

/**
 * Create a file not found error response
 */
export function createFileNotFoundError(
  filePath: string,
  fileType: string = 'file'
): ErrorResponse {
  const suggestions: string[] = [];
  
  // Provide specific suggestions based on file type
  if (filePath.includes('claims')) {
    suggestions.push(
      'Ensure claims are stored in 01_Knowledge_Base/claims/ directory',
      'Or create a claims_and_evidence.md file in 01_Knowledge_Base/',
      'Run the claim extraction tool to populate claims from papers'
    );
  } else if (filePath.includes('outline')) {
    suggestions.push(
      'Create an outline.md file in 03_Drafting/ directory',
      'Use markdown headers (##, ###) to structure sections',
      'Include section IDs and questions for research guidance'
    );
  } else if (filePath.includes('manuscript')) {
    suggestions.push(
      'Create a manuscript.md file in 03_Drafting/ directory',
      'Start writing your draft content',
      'Use the outline as a guide for structure'
    );
  } else if (filePath.includes('sources')) {
    suggestions.push(
      'Create a sources.md file in 01_Knowledge_Base/ directory',
      'Add source metadata in table format',
      'Include Source ID, Author-Year, Authors, Year, and Title columns'
    );
  } else if (filePath.includes('ExtractedText')) {
    suggestions.push(
      'Extract text from PDFs using the Docling MCP server',
      'Save extracted text files in literature/ExtractedText/ directory',
      'Use Author - Year.txt naming format (e.g., "Johnson - 2007.txt")'
    );
  } else {
    suggestions.push(
      `Create the ${fileType} at: ${filePath}`,
      'Check the workspace root path is configured correctly',
      'Verify file permissions allow reading'
    );
  }

  return {
    error: 'FILE_NOT_FOUND' as ErrorType,
    message: `${fileType} not found: ${path.basename(filePath)}`,
    context: {
      path: filePath,
      fileType,
    },
    suggestions,
  };
}

/**
 * Create a processing error response
 */
export function createProcessingError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const suggestions: string[] = [];
  
  // Provide specific suggestions based on operation
  if (operation.includes('embedding')) {
    suggestions.push(
      'Check that OPENAI_API_KEY environment variable is set',
      'Verify OpenAI API key is valid and has credits',
      'Check network connectivity to OpenAI API',
      'Try reducing the text length if it exceeds limits'
    );
  } else if (operation.includes('parse') || operation.includes('parsing')) {
    suggestions.push(
      'Verify the file format is valid markdown',
      'Check for malformed headers or special characters',
      'Ensure file encoding is UTF-8',
      'Try opening the file in a text editor to check for issues'
    );
  } else if (operation.includes('search') || operation.includes('similarity')) {
    suggestions.push(
      'Ensure claims database is loaded and not empty',
      'Check that embeddings are being generated successfully',
      'Try adjusting the similarity threshold',
      'Verify the search text is not empty'
    );
  } else {
    suggestions.push(
      'Check the error message for specific details',
      'Verify all required files and data are available',
      'Try the operation again with different parameters',
      'Contact support if the issue persists'
    );
  }

  return {
    error: 'PROCESSING_ERROR' as ErrorType,
    message: `Failed to ${operation}: ${errorMessage}`,
    context: {
      operation,
      errorDetails: errorMessage,
      ...context,
    },
    suggestions,
  };
}

/**
 * Create an empty result error response
 */
export function createEmptyResultError(
  operation: string,
  reason: string,
  context?: Record<string, unknown>
): ErrorResponse {
  const suggestions: string[] = [];
  
  // Provide specific suggestions based on operation
  if (operation.includes('search') || operation.includes('find')) {
    suggestions.push(
      'Try lowering the similarity threshold',
      'Use broader or different search terms',
      'Check that claims database contains relevant claims',
      'Consider adding more papers to your literature collection'
    );
  } else if (operation.includes('coverage')) {
    suggestions.push(
      'Add claims to support the section content',
      'Extract claims from relevant papers',
      'Review the section to ensure it contains factual statements',
      'Consider whether the section needs supporting evidence'
    );
  } else if (operation.includes('rank') || operation.includes('papers')) {
    suggestions.push(
      'Ensure papers array is not empty',
      'Check that papers have abstracts for semantic matching',
      'Verify section content is available for comparison',
      'Try with a different section or query'
    );
  } else {
    suggestions.push(
      'Check that input data is available and not empty',
      'Verify the operation parameters are correct',
      'Try with different input values',
      'Ensure required files and data exist'
    );
  }

  return {
    error: 'EMPTY_RESULT' as ErrorType,
    message: `No results found for ${operation}: ${reason}`,
    context: {
      operation,
      reason,
      ...context,
    },
    suggestions,
  };
}

/**
 * Create a generic error response from an unknown error
 */
export function createGenericError(
  error: unknown,
  context?: Record<string, unknown>
): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  return {
    error: 'PROCESSING_ERROR' as ErrorType,
    message: errorMessage,
    context: {
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: errorStack,
      ...context,
    },
    suggestions: [
      'Check the error message for specific details',
      'Verify all required configuration is set',
      'Ensure workspace files are accessible',
      'Try the operation again',
    ],
  };
}

/**
 * Wrap a function with error handling that returns ErrorResponse on failure
 */
export async function withErrorHandling<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T | ErrorResponse> {
  try {
    return await fn();
  } catch (error) {
    // Check if it's a known error type
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('ENOENT')) {
        // Extract file path from error message if possible
        const pathMatch = error.message.match(/['"]([^'"]+)['"]/);
        const filePath = pathMatch ? pathMatch[1] : 'unknown';
        return createFileNotFoundError(filePath);
      }
    }
    
    return createProcessingError(operation, error, context);
  }
}

/**
 * Check if a value is an ErrorResponse
 */
export function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    'message' in value
  );
}

/**
 * Format error response as JSON string
 */
export function formatErrorResponse(error: ErrorResponse): string {
  return JSON.stringify(error, null, 2);
}

/**
 * Create a validation error for missing required service
 */
export function createServiceNotInitializedError(
  serviceName: string
): ErrorResponse {
  return {
    error: 'PROCESSING_ERROR' as ErrorType,
    message: `${serviceName} is not initialized`,
    context: {
      serviceName,
      reason: 'OpenAI API key not configured',
    },
    suggestions: [
      'Set the OPENAI_API_KEY environment variable',
      'Ensure the API key is valid and has credits',
      'Restart the MCP server after setting the environment variable',
      'Check the server logs for configuration errors',
    ],
  };
}

/**
 * Create an error for invalid configuration
 */
export function createConfigurationError(
  configKey: string,
  issue: string
): ErrorResponse {
  return {
    error: 'VALIDATION_ERROR' as ErrorType,
    message: `Configuration error: ${configKey} - ${issue}`,
    context: {
      configKey,
      issue,
    },
    suggestions: [
      `Check the ${configKey} configuration value`,
      'Refer to the documentation for valid configuration options',
      'Ensure environment variables are set correctly',
      'Restart the server after changing configuration',
    ],
  };
}

/**
 * Create an error for empty dataset
 */
export function createEmptyDatasetError(
  datasetName: string,
  expectedLocation: string
): ErrorResponse {
  return {
    error: 'EMPTY_RESULT' as ErrorType,
    message: `${datasetName} is empty`,
    context: {
      datasetName,
      expectedLocation,
    },
    suggestions: [
      `Add data to ${expectedLocation}`,
      'Check that files are in the correct format',
      'Verify the workspace root path is correct',
      'Run data extraction or import tools to populate data',
    ],
  };
}

/**
 * Safe error handler that never throws
 * Returns ErrorResponse for any error
 */
export function safeErrorHandler(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): ErrorResponse {
  try {
    if (isErrorResponse(error)) {
      return error;
    }
    return createProcessingError(operation, error, context);
  } catch (handlerError) {
    // Fallback if error handling itself fails
    return {
      error: 'PROCESSING_ERROR' as ErrorType,
      message: 'An unexpected error occurred',
      context: {
        operation,
        originalError: String(error),
        handlerError: String(handlerError),
        ...context,
      },
      suggestions: [
        'Contact support with the error details',
        'Check server logs for more information',
      ],
    };
  }
}
