/**
 * Unit tests for input validation utilities
 * Tests validation functions for various input types and edge cases
 */

import {
  validateRequired,
  validateString,
  validateNumber,
  validateRange,
  validateBoolean,
  validateArray,
  validateNonEmptyArray,
  validateEnum,
  validateObject,
  validateThreshold,
  validateSectionId,
  validateClaimId,
  validatePaperMetadata,
  collectValidationErrors,
  createValidationErrorResponse,
} from '../../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateRequired', () => {
    it('should return null for valid values', () => {
      expect(validateRequired('test', 'field')).toBeNull();
      expect(validateRequired(123, 'field')).toBeNull();
      expect(validateRequired(true, 'field')).toBeNull();
      expect(validateRequired([], 'field')).toBeNull();
      expect(validateRequired({}, 'field')).toBeNull();
    });

    it('should return error for undefined', () => {
      const error = validateRequired(undefined, 'field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('field');
      expect(error?.message).toContain('required');
    });

    it('should return error for null', () => {
      const error = validateRequired(null, 'field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('field');
      expect(error?.message).toContain('required');
    });

    it('should return error for empty string', () => {
      const error = validateRequired('', 'field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('field');
      expect(error?.message).toContain('empty');
    });

    it('should return error for whitespace-only string', () => {
      const error = validateRequired('   ', 'field');
      expect(error).not.toBeNull();
      expect(error?.field).toBe('field');
      expect(error?.message).toContain('empty');
    });
  });

  describe('validateString', () => {
    it('should return null for valid strings', () => {
      expect(validateString('test', 'field')).toBeNull();
      expect(validateString('hello world', 'field')).toBeNull();
    });

    it('should return error for non-strings', () => {
      expect(validateString(123, 'field')).not.toBeNull();
      expect(validateString(true, 'field')).not.toBeNull();
      expect(validateString([], 'field')).not.toBeNull();
      expect(validateString({}, 'field')).not.toBeNull();
    });

    it('should handle optional strings', () => {
      expect(validateString(undefined, 'field', false)).toBeNull();
      expect(validateString(null, 'field', false)).toBeNull();
    });

    it('should require non-empty strings when required', () => {
      const error = validateString('', 'field', true);
      expect(error).not.toBeNull();
      expect(error?.message).toContain('empty');
    });
  });

  describe('validateNumber', () => {
    it('should return null for valid numbers', () => {
      expect(validateNumber(0, 'field')).toBeNull();
      expect(validateNumber(123, 'field')).toBeNull();
      expect(validateNumber(-456, 'field')).toBeNull();
      expect(validateNumber(3.14, 'field')).toBeNull();
    });

    it('should return error for non-numbers', () => {
      expect(validateNumber('123', 'field')).not.toBeNull();
      expect(validateNumber(true, 'field')).not.toBeNull();
      expect(validateNumber([], 'field')).not.toBeNull();
      expect(validateNumber({}, 'field')).not.toBeNull();
    });

    it('should return error for NaN', () => {
      const error = validateNumber(NaN, 'field');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('number');
    });

    it('should handle optional numbers', () => {
      expect(validateNumber(undefined, 'field', false)).toBeNull();
      expect(validateNumber(null, 'field', false)).toBeNull();
    });
  });

  describe('validateRange', () => {
    it('should return null for values within range', () => {
      expect(validateRange(5, 'field', 0, 10)).toBeNull();
      expect(validateRange(0, 'field', 0, 10)).toBeNull();
      expect(validateRange(10, 'field', 0, 10)).toBeNull();
    });

    it('should return error for values below minimum', () => {
      const error = validateRange(-1, 'field', 0, 10);
      expect(error).not.toBeNull();
      expect(error?.message).toContain('between');
    });

    it('should return error for values above maximum', () => {
      const error = validateRange(11, 'field', 0, 10);
      expect(error).not.toBeNull();
      expect(error?.message).toContain('between');
    });
  });

  describe('validateBoolean', () => {
    it('should return null for valid booleans', () => {
      expect(validateBoolean(true, 'field')).toBeNull();
      expect(validateBoolean(false, 'field')).toBeNull();
    });

    it('should return error for non-booleans', () => {
      expect(validateBoolean('true', 'field')).not.toBeNull();
      expect(validateBoolean(1, 'field')).not.toBeNull();
      expect(validateBoolean(0, 'field')).not.toBeNull();
      expect(validateBoolean([], 'field')).not.toBeNull();
    });

    it('should handle optional booleans', () => {
      expect(validateBoolean(undefined, 'field', false)).toBeNull();
      expect(validateBoolean(null, 'field', false)).toBeNull();
    });
  });

  describe('validateArray', () => {
    it('should return null for valid arrays', () => {
      expect(validateArray([], 'field')).toBeNull();
      expect(validateArray([1, 2, 3], 'field')).toBeNull();
      expect(validateArray(['a', 'b'], 'field')).toBeNull();
    });

    it('should return error for non-arrays', () => {
      expect(validateArray('[]', 'field')).not.toBeNull();
      expect(validateArray(123, 'field')).not.toBeNull();
      expect(validateArray({}, 'field')).not.toBeNull();
    });

    it('should handle optional arrays', () => {
      expect(validateArray(undefined, 'field', false)).toBeNull();
      expect(validateArray(null, 'field', false)).toBeNull();
    });
  });

  describe('validateNonEmptyArray', () => {
    it('should return null for non-empty arrays', () => {
      expect(validateNonEmptyArray([1], 'field')).toBeNull();
      expect(validateNonEmptyArray([1, 2, 3], 'field')).toBeNull();
    });

    it('should return error for empty arrays', () => {
      const error = validateNonEmptyArray([], 'field');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('empty');
    });
  });

  describe('validateEnum', () => {
    const allowedValues = ['option1', 'option2', 'option3'];

    it('should return null for valid enum values', () => {
      expect(validateEnum('option1', 'field', allowedValues)).toBeNull();
      expect(validateEnum('option2', 'field', allowedValues)).toBeNull();
      expect(validateEnum('option3', 'field', allowedValues)).toBeNull();
    });

    it('should return error for invalid enum values', () => {
      const error = validateEnum('invalid', 'field', allowedValues);
      expect(error).not.toBeNull();
      expect(error?.message).toContain('one of');
      expect(error?.message).toContain('option1');
    });

    it('should handle optional enum values', () => {
      expect(validateEnum(undefined, 'field', allowedValues, false)).toBeNull();
      expect(validateEnum(null, 'field', allowedValues, false)).toBeNull();
    });
  });

  describe('validateObject', () => {
    it('should return null for valid objects', () => {
      expect(validateObject({}, 'field')).toBeNull();
      expect(validateObject({ key: 'value' }, 'field')).toBeNull();
    });

    it('should return error for non-objects', () => {
      expect(validateObject('{}', 'field')).not.toBeNull();
      expect(validateObject(123, 'field')).not.toBeNull();
      expect(validateObject([], 'field')).not.toBeNull();
      expect(validateObject(null, 'field')).not.toBeNull();
    });

    it('should handle optional objects', () => {
      expect(validateObject(undefined, 'field', false)).toBeNull();
      expect(validateObject(null, 'field', false)).toBeNull();
    });
  });

  describe('validateThreshold', () => {
    it('should return null for valid thresholds', () => {
      expect(validateThreshold(0)).toBeNull();
      expect(validateThreshold(0.5)).toBeNull();
      expect(validateThreshold(1)).toBeNull();
    });

    it('should return error for out-of-range thresholds', () => {
      expect(validateThreshold(-0.1)).not.toBeNull();
      expect(validateThreshold(1.1)).not.toBeNull();
    });

    it('should handle optional thresholds', () => {
      expect(validateThreshold(undefined, 'threshold', false)).toBeNull();
      expect(validateThreshold(null, 'threshold', false)).toBeNull();
    });

    it('should return error for non-number thresholds', () => {
      expect(validateThreshold('0.5')).not.toBeNull();
    });
  });

  describe('validateSectionId', () => {
    it('should return null for valid section IDs', () => {
      expect(validateSectionId('2.1')).toBeNull();
      expect(validateSectionId('introduction')).toBeNull();
      expect(validateSectionId('background')).toBeNull();
      expect(validateSectionId('3.2.1')).toBeNull();
    });

    it('should return error for empty section IDs', () => {
      expect(validateSectionId('')).not.toBeNull();
      expect(validateSectionId('   ')).not.toBeNull();
    });

    it('should return error for non-string section IDs', () => {
      expect(validateSectionId(123)).not.toBeNull();
      expect(validateSectionId(null)).not.toBeNull();
    });
  });

  describe('validateClaimId', () => {
    it('should return null for valid claim IDs', () => {
      expect(validateClaimId('C_01')).toBeNull();
      expect(validateClaimId('C_02')).toBeNull();
      expect(validateClaimId('C_10')).toBeNull();
      expect(validateClaimId('C_01a')).toBeNull();
      expect(validateClaimId('C_02b')).toBeNull();
    });

    it('should return error for invalid claim ID formats', () => {
      expect(validateClaimId('C01')).not.toBeNull(); // Missing underscore
      expect(validateClaimId('C_1')).not.toBeNull(); // Only one digit
      expect(validateClaimId('C_01A')).not.toBeNull(); // Uppercase letter
      expect(validateClaimId('C_01ab')).not.toBeNull(); // Multiple letters
      expect(validateClaimId('claim_01')).not.toBeNull(); // Wrong prefix
    });

    it('should return error for non-string claim IDs', () => {
      expect(validateClaimId(123)).not.toBeNull();
      expect(validateClaimId(null)).not.toBeNull();
    });
  });

  describe('validatePaperMetadata', () => {
    const validPaper = {
      itemKey: 'ABC123',
      title: 'Test Paper',
      authors: ['Author 1', 'Author 2'],
      year: 2020,
      abstract: 'Test abstract',
    };

    it('should return null for valid paper metadata', () => {
      expect(validatePaperMetadata(validPaper)).toBeNull();
    });

    it('should return error for missing required fields', () => {
      const { itemKey, ...missingItemKey } = validPaper;
      expect(validatePaperMetadata(missingItemKey)).not.toBeNull();

      const { title, ...missingTitle } = validPaper;
      expect(validatePaperMetadata(missingTitle)).not.toBeNull();

      const { authors, ...missingAuthors } = validPaper;
      expect(validatePaperMetadata(missingAuthors)).not.toBeNull();

      const { year, ...missingYear } = validPaper;
      expect(validatePaperMetadata(missingYear)).not.toBeNull();
    });

    it('should return error for invalid field types', () => {
      expect(validatePaperMetadata({ ...validPaper, itemKey: 123 })).not.toBeNull();
      expect(validatePaperMetadata({ ...validPaper, title: 123 })).not.toBeNull();
      expect(validatePaperMetadata({ ...validPaper, authors: 'Author' })).not.toBeNull();
      expect(validatePaperMetadata({ ...validPaper, year: '2020' })).not.toBeNull();
    });

    it('should return error for non-object input', () => {
      expect(validatePaperMetadata('paper')).not.toBeNull();
      expect(validatePaperMetadata(123)).not.toBeNull();
      expect(validatePaperMetadata([])).not.toBeNull();
    });
  });

  describe('collectValidationErrors', () => {
    it('should collect all errors from validators', () => {
      const validators = [
        () => validateRequired(undefined, 'field1'),
        () => validateString(123, 'field2'),
        () => validateNumber('abc', 'field3'),
      ];

      const errors = collectValidationErrors(validators);
      expect(errors).toHaveLength(3);
      expect(errors[0].field).toBe('field1');
      expect(errors[1].field).toBe('field2');
      expect(errors[2].field).toBe('field3');
    });

    it('should skip null results', () => {
      const validators = [
        () => validateRequired('valid', 'field1'),
        () => validateString(123, 'field2'),
        () => validateNumber(456, 'field3'),
      ];

      const errors = collectValidationErrors(validators);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('field2');
    });

    it('should return empty array when all validators pass', () => {
      const validators = [
        () => validateRequired('valid', 'field1'),
        () => validateString('valid', 'field2'),
        () => validateNumber(123, 'field3'),
      ];

      const errors = collectValidationErrors(validators);
      expect(errors).toHaveLength(0);
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should create error response for single error', () => {
      const errors = [
        { field: 'field1', message: 'field1 is required' },
      ];

      const response = createValidationErrorResponse(errors);
      expect(response.error).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('field1 is required');
      expect(response.context?.errors).toHaveLength(1);
      expect(response.suggestions).toBeDefined();
    });

    it('should create error response for multiple errors', () => {
      const errors = [
        { field: 'field1', message: 'field1 is required' },
        { field: 'field2', message: 'field2 must be a string' },
      ];

      const response = createValidationErrorResponse(errors);
      expect(response.error).toBe('VALIDATION_ERROR');
      expect(response.message).toContain('2 validation errors');
      expect(response.context?.errors).toHaveLength(2);
    });

    it('should include error context', () => {
      const errors = [
        { field: 'field1', message: 'field1 is required', value: undefined },
      ];

      const response = createValidationErrorResponse(errors);
      const contextErrors = response.context?.errors as Array<{ field: string; message: string; value: unknown }>;
      expect(contextErrors[0].field).toBe('field1');
      expect(contextErrors[0].message).toBe('field1 is required');
      expect(contextErrors[0].value).toBeUndefined();
    });
  });
});
