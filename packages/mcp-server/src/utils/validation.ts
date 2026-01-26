/**
 * Input validation utilities for MCP tool parameters
 * Validates required parameters, types, and ranges
 * Returns structured validation errors
 */

import type { ErrorResponse, ErrorType } from '@research-assistant/core';

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validate that a required parameter is present and not empty
 */
export function validateRequired(
  value: unknown,
  fieldName: string
): ValidationError | null {
  if (value === undefined || value === null) {
    return {
      field: fieldName,
      message: `${fieldName} is required`,
    };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return {
      field: fieldName,
      message: `${fieldName} cannot be empty`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a value is a string
 */
export function validateString(
  value: unknown,
  fieldName: string,
  required: boolean = true
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  if (required) {
    const requiredError = validateRequired(value, fieldName);
    if (requiredError) return requiredError;
  }

  if (typeof value !== 'string') {
    return {
      field: fieldName,
      message: `${fieldName} must be a string`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a value is a number
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  required: boolean = true
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  if (required) {
    const requiredError = validateRequired(value, fieldName);
    if (requiredError) return requiredError;
  }

  if (typeof value !== 'number' || isNaN(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a number`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a number is within a range
 */
export function validateRange(
  value: number,
  fieldName: string,
  min: number,
  max: number
): ValidationError | null {
  if (value < min || value > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be between ${min} and ${max}`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a value is a boolean
 */
export function validateBoolean(
  value: unknown,
  fieldName: string,
  required: boolean = true
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  if (required) {
    const requiredError = validateRequired(value, fieldName);
    if (requiredError) return requiredError;
  }

  if (typeof value !== 'boolean') {
    return {
      field: fieldName,
      message: `${fieldName} must be a boolean`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a value is an array
 */
export function validateArray(
  value: unknown,
  fieldName: string,
  required: boolean = true
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  if (required) {
    const requiredError = validateRequired(value, fieldName);
    if (requiredError) return requiredError;
  }

  if (!Array.isArray(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be an array`,
      value,
    };
  }

  return null;
}

/**
 * Validate that an array is not empty
 */
export function validateNonEmptyArray(
  value: unknown[],
  fieldName: string
): ValidationError | null {
  if (value.length === 0) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be empty`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a value is one of the allowed enum values
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: T[],
  required: boolean = true
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  if (required) {
    const requiredError = validateRequired(value, fieldName);
    if (requiredError) return requiredError;
  }

  if (!allowedValues.includes(value as T)) {
    return {
      field: fieldName,
      message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      value,
    };
  }

  return null;
}

/**
 * Validate that a value is an object
 */
export function validateObject(
  value: unknown,
  fieldName: string,
  required: boolean = true
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  if (required) {
    const requiredError = validateRequired(value, fieldName);
    if (requiredError) return requiredError;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be an object`,
      value,
    };
  }

  return null;
}

/**
 * Validate threshold parameter (0-1 range)
 */
export function validateThreshold(
  value: unknown,
  fieldName: string = 'threshold',
  required: boolean = false
): ValidationError | null {
  if (!required && (value === undefined || value === null)) {
    return null;
  }

  const numberError = validateNumber(value, fieldName, required);
  if (numberError) return numberError;

  return validateRange(value as number, fieldName, 0, 1);
}

/**
 * Validate section ID format
 */
export function validateSectionId(
  value: unknown,
  fieldName: string = 'sectionId'
): ValidationError | null {
  const stringError = validateString(value, fieldName);
  if (stringError) return stringError;

  const sectionId = value as string;
  
  // Section IDs should be non-empty strings
  // Common formats: "2.1", "introduction", "background", etc.
  if (sectionId.trim().length === 0) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be empty`,
      value,
    };
  }

  return null;
}

/**
 * Validate claim ID format
 */
export function validateClaimId(
  value: unknown,
  fieldName: string = 'claimId'
): ValidationError | null {
  const stringError = validateString(value, fieldName);
  if (stringError) return stringError;

  const claimId = value as string;
  
  // Claim IDs should match pattern like "C_01", "C_1", "C_02a", etc.
  // Must start with C_, followed by at least one digit, optionally followed by a single lowercase letter
  if (!/^C_\d{2,}[a-z]?$/.test(claimId)) {
    return {
      field: fieldName,
      message: `${fieldName} must match pattern C_XX or C_XXa (e.g., "C_01", "C_02a")`,
      value,
    };
  }

  return null;
}

/**
 * Validate paper metadata object
 */
export function validatePaperMetadata(
  value: unknown,
  fieldName: string = 'paper'
): ValidationError | null {
  const objectError = validateObject(value, fieldName);
  if (objectError) return objectError;

  const paper = value as Record<string, unknown>;

  // Check required fields
  const requiredFields = ['itemKey', 'title', 'authors', 'year'];
  for (const field of requiredFields) {
    if (!(field in paper)) {
      return {
        field: `${fieldName}.${field}`,
        message: `${fieldName} must have ${field} field`,
        value,
      };
    }
  }

  // Validate field types
  if (typeof paper.itemKey !== 'string') {
    return {
      field: `${fieldName}.itemKey`,
      message: 'itemKey must be a string',
      value: paper.itemKey,
    };
  }

  if (typeof paper.title !== 'string') {
    return {
      field: `${fieldName}.title`,
      message: 'title must be a string',
      value: paper.title,
    };
  }

  if (!Array.isArray(paper.authors)) {
    return {
      field: `${fieldName}.authors`,
      message: 'authors must be an array',
      value: paper.authors,
    };
  }

  if (typeof paper.year !== 'number') {
    return {
      field: `${fieldName}.year`,
      message: 'year must be a number',
      value: paper.year,
    };
  }

  return null;
}

/**
 * Collect all validation errors from multiple validators
 */
export function collectValidationErrors(
  validators: Array<() => ValidationError | null>
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const validator of validators) {
    const error = validator();
    if (error) {
      errors.push(error);
    }
  }
  
  return errors;
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  errors: ValidationError[]
): ErrorResponse {
  const firstError = errors[0];
  
  return {
    error: 'VALIDATION_ERROR' as ErrorType,
    message: errors.length === 1
      ? firstError.message
      : `${errors.length} validation errors found`,
    context: {
      errors: errors.map(e => ({
        field: e.field,
        message: e.message,
        value: e.value,
      })),
    },
    suggestions: [
      'Check the input parameters match the expected types and formats',
      'Refer to the tool documentation for parameter requirements',
    ],
  };
}
