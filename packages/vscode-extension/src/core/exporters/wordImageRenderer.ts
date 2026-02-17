/**
 * Word Image Renderer
 * 
 * Handles rendering of images in Word documents.
 */

import { ImageRun } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

import type { DocumentImage } from '../documentModel';

/**
 * Renders images in Word documents
 */
export class WordImageRenderer {
  /**
   * Create an image run from DocumentImage
   * 
   * @param image The image data
   * @returns ImageRun or null if image file not found
   */
  public createImageRun(image: DocumentImage): ImageRun | null {
    try {
      console.log(`[WordImageRenderer] Attempting to load image: ${image.path}`);
      
      // Check if file exists
      if (!fs.existsSync(image.path)) {
        console.warn(`[WordImageRenderer] Image file not found: ${image.path}`);
        return null;
      }

      console.log(`[WordImageRenderer] Image file exists, reading data...`);
      
      // Read image data
      const imageData = fs.readFileSync(image.path);
      console.log(`[WordImageRenderer] Image data loaded, size: ${imageData.length} bytes`);

      // Determine image dimensions (use provided or default)
      const width = image.width || 600;
      const height = image.height || 400;

      // Determine image type from extension
      const ext = path.extname(image.path).toLowerCase();
      const imageType = ext === '.png' ? 'png' : 'jpg';
      
      console.log(`[WordImageRenderer] Creating ImageRun with type: ${imageType}, dimensions: ${width}x${height}`);

      return new ImageRun({
        data: imageData,
        transformation: {
          width,
          height
        },
        type: imageType
      });
    } catch (error) {
      console.error(`[WordImageRenderer] Error loading image ${image.path}:`, error);
      return null;
    }
  }
}
