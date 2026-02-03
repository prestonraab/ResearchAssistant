import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { DeepLinkHandler } from '../services/deepLinkHandler';
import { setupTest } from './helpers';

describe('DeepLinkHandler', () => {
  setupTest();

  let handler: DeepLinkHandler;

  beforeEach(() => {
    handler = new DeepLinkHandler();
  });

  describe('buildAnnotationUrl', () => {
    test('should construct valid annotation URL with annotation key', () => {
      const annotationKey = 'ABC123DEF456';
      const url = handler.buildAnnotationUrl(annotationKey);
      
      expect(url).toContain('zotero://open-pdf/library/items/{itemKey}');
      expect(url).toContain('annotation=ABC123DEF456');
    });

    test('should URL-encode special characters in annotation key', () => {
      const annotationKey = 'ABC-123/DEF&456';
      const url = handler.buildAnnotationUrl(annotationKey);
      
      expect(url).toContain('annotation=ABC-123%2FDEF%26456');
    });

    test('should handle annotation keys with spaces', () => {
      const annotationKey = 'ABC 123 DEF';
      const url = handler.buildAnnotationUrl(annotationKey);
      
      expect(url).toContain('annotation=ABC%20123%20DEF');
    });

    test('should handle empty annotation key', () => {
      const annotationKey = '';
      const url = handler.buildAnnotationUrl(annotationKey);
      
      expect(url).toBeDefined();
    });
  });

  describe('buildPageUrl', () => {
    test('should construct valid page URL with item key and page number', () => {
      const itemKey = 'ITEM123';
      const pageNumber = 5;
      const url = handler.buildPageUrl(itemKey, pageNumber);
      
      expect(url).toBe('zotero://open-pdf/library/items/ITEM123?page=5');
    });

    test('should URL-encode special characters in item key', () => {
      const itemKey = 'ITEM-123/ABC&DEF';
      const pageNumber = 1;
      const url = handler.buildPageUrl(itemKey, pageNumber);
      
      expect(url).toContain('zotero://open-pdf/library/items/ITEM-123%2FABC%26DEF');
      expect(url).toContain('page=1');
    });

    test('should handle page number 1', () => {
      const url = handler.buildPageUrl('ITEM123', 1);
      expect(url).toContain('page=1');
    });

    test('should handle large page numbers', () => {
      const url = handler.buildPageUrl('ITEM123', 9999);
      expect(url).toContain('page=9999');
    });

    test('should throw error when itemKey is empty', () => {
      expect(() => handler.buildPageUrl('', 5)).toThrow('itemKey is required and cannot be empty');
    });

    test('should throw error when itemKey is whitespace only', () => {
      expect(() => handler.buildPageUrl('   ', 5)).toThrow('itemKey is required and cannot be empty');
    });

    test('should throw error when pageNumber is less than 1', () => {
      expect(() => handler.buildPageUrl('ITEM123', 0)).toThrow('pageNumber must be greater than 0');
    });

    test('should throw error when pageNumber is negative', () => {
      expect(() => handler.buildPageUrl('ITEM123', -5)).toThrow('pageNumber must be greater than 0');
    });
  });

  describe('openAnnotation', () => {
    test('should open annotation URL successfully', async () => {
      const result = await handler.openAnnotation('ANNO123', 'ITEM456');
      
      expect(result).toBe(true);
      expect(vscode.env.openExternal).toHaveBeenCalledWith(
        expect.objectContaining({
          scheme: 'zotero',
        })
      );
    });

    test('should construct correct URL for openAnnotation', async () => {
      await handler.openAnnotation('ANNO123', 'ITEM456');
      
      const callArgs = (vscode.env.openExternal as any).mock.calls[0][0] as any;
      expect(callArgs.toString()).toContain('zotero://open-pdf/library/items/ITEM456');
      expect(callArgs.toString()).toContain('annotation=ANNO123');
    });

    test('should return false and show error when annotationKey is empty', async () => {
      const result = await handler.openAnnotation('', 'ITEM456');
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Invalid annotation or item key');
    });

    test('should return false and show error when itemKey is empty', async () => {
      const result = await handler.openAnnotation('ANNO123', '');
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Invalid annotation or item key');
    });

    test('should show Zotero not running error when openExternal fails', async () => {
      (vscode.env.openExternal as any).mockRejectedValueOnce(
        new Error('Protocol handler not available')
      );

      const result = await handler.openAnnotation('ANNO123', 'ITEM456');
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to open PDF in Zotero. Make sure Zotero is running.',
        'Open Zotero'
      );
    });

    test('should handle Zotero launch when user clicks "Open Zotero" button', async () => {
      (vscode.env.openExternal as any).mockRejectedValueOnce(
        new Error('Protocol handler not available')
      );
      (vscode.window.showErrorMessage as any).mockResolvedValueOnce('Open Zotero');

      await handler.openAnnotation('ANNO123', 'ITEM456');
      
      // Check that openExternal was called twice: once for the annotation, once for Zotero
      expect(vscode.env.openExternal).toHaveBeenCalledTimes(2);
    });

    test('should URL-encode special characters in annotation and item keys', async () => {
      await handler.openAnnotation('ANNO-123/ABC&DEF', 'ITEM-456/XYZ&123');
      
      const callArgs = (vscode.env.openExternal as any).mock.calls[0][0] as any;
      const urlString = callArgs.toString();
      expect(urlString).toContain('ITEM-456%2FXYZ%26123');
      expect(urlString).toContain('ANNO-123%2FABC%26DEF');
    });
  });

  describe('openPage', () => {
    test('should open page URL successfully', async () => {
      const result = await handler.openPage('ITEM123', 5);
      
      expect(result).toBe(true);
      expect(vscode.env.openExternal).toHaveBeenCalledWith(
        expect.objectContaining({
          scheme: 'zotero',
        })
      );
    });

    test('should construct correct URL for openPage', async () => {
      await handler.openPage('ITEM123', 5);
      
      const callArgs = (vscode.env.openExternal as any).mock.calls[0][0] as any;
      expect(callArgs.toString()).toBe('zotero://open-pdf/library/items/ITEM123?page=5');
    });

    test('should return false and show error when itemKey is empty', async () => {
      const result = await handler.openPage('', 5);
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Invalid item key or page number');
    });

    test('should return false and show error when pageNumber is invalid', async () => {
      const result = await handler.openPage('ITEM123', 0);
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Invalid item key or page number');
    });

    test('should show Zotero not running error when openExternal fails', async () => {
      (vscode.env.openExternal as any).mockRejectedValueOnce(
        new Error('Protocol handler not available')
      );

      const result = await handler.openPage('ITEM123', 5);
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Failed to open PDF in Zotero. Make sure Zotero is running.',
        'Open Zotero'
      );
    });

    test('should handle Zotero launch when user clicks "Open Zotero" button', async () => {
      (vscode.env.openExternal as any).mockRejectedValueOnce(
        new Error('Protocol handler not available')
      );
      (vscode.window.showErrorMessage as any).mockResolvedValueOnce('Open Zotero');

      await handler.openPage('ITEM123', 5);
      
      // Check that openExternal was called twice: once for the page, once for Zotero
      expect(vscode.env.openExternal).toHaveBeenCalledTimes(2);
    });

    test('should URL-encode special characters in item key', async () => {
      await handler.openPage('ITEM-123/ABC&DEF', 5);
      
      const callArgs = (vscode.env.openExternal as any).mock.calls[0][0] as any;
      const urlString = callArgs.toString();
      expect(urlString).toContain('ITEM-123%2FABC%26DEF');
      expect(urlString).toContain('page=5');
    });

    test('should handle page number 1', async () => {
      await handler.openPage('ITEM123', 1);
      
      const callArgs = (vscode.env.openExternal as any).mock.calls[0][0] as any;
      expect(callArgs.toString()).toContain('page=1');
    });

    test('should handle large page numbers', async () => {
      await handler.openPage('ITEM123', 9999);
      
      const callArgs = (vscode.env.openExternal as any).mock.calls[0][0] as any;
      expect(callArgs.toString()).toContain('page=9999');
    });
  });

  describe('Error Handling', () => {
    test('should log errors when openAnnotation fails', async () => {
      const error = new Error('Test error');
      (vscode.env.openExternal as any).mockRejectedValueOnce(error);

      await handler.openAnnotation('ANNO123', 'ITEM456');
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    test('should log errors when openPage fails', async () => {
      const error = new Error('Test error');
      (vscode.env.openExternal as any).mockRejectedValueOnce(error);

      await handler.openPage('ITEM123', 5);
      
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    test('should handle non-Error exceptions in openAnnotation', async () => {
      (vscode.env.openExternal as any).mockRejectedValueOnce('String error');

      const result = await handler.openAnnotation('ANNO123', 'ITEM456');
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    test('should handle non-Error exceptions in openPage', async () => {
      (vscode.env.openExternal as any).mockRejectedValueOnce('String error');

      const result = await handler.openPage('ITEM123', 5);
      
      expect(result).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });

    test('should handle multiple consecutive failures', async () => {
      (vscode.env.openExternal as any).mockRejectedValue(new Error('Persistent failure'));

      const result1 = await handler.openPage('ITEM123', 5);
      const result2 = await handler.openPage('ITEM456', 10);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(vscode.window.showErrorMessage).toHaveBeenCalledTimes(2);
    });
  });
