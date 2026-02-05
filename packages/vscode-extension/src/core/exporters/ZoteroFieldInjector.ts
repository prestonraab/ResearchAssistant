/**
 * Post-processes DOCX files to inject Zotero-compatible complex field structures
 * 
 * The docx library only supports SimpleField (<w:fldSimple>), but Zotero requires
 * complex fields with <w:fldChar> and <w:instrText> elements. This class:
 * 1. Unzips the DOCX file
 * 2. Parses word/document.xml
 * 3. Replaces SimpleField elements with complex field structures
 * 4. Rezips and returns the modified DOCX
 */

import JSZip from 'jszip';

export class ZoteroFieldInjector {
  /**
   * Process a DOCX buffer to convert SimpleField citations to complex fields
   * 
   * @param docxBuffer The DOCX file buffer from the docx library
   * @returns Modified DOCX buffer with Zotero-compatible fields
   */
  public async processDocx(docxBuffer: Buffer): Promise<Buffer> {
    // Load the DOCX as a ZIP file
    const zip = await JSZip.loadAsync(docxBuffer);
    
    // Get the document.xml file
    const documentXml = await zip.file('word/document.xml')?.async('string');
    if (!documentXml) {
      throw new Error('word/document.xml not found in DOCX file');
    }

    // Replace SimpleField elements with complex fields
    const modifiedXml = this.convertSimpleFieldsToComplex(documentXml);

    // Update the document.xml in the ZIP
    zip.file('word/document.xml', modifiedXml);

    // Generate the modified DOCX buffer
    return await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });
  }

  /**
   * Convert SimpleField elements to complex field structures
   * 
   * Transforms:
   *   <w:fldSimple w:instr="ADDIN ZOTERO_ITEM ...">
   *     <w:r><w:t>citation text</w:t></w:r>
   *   </w:fldSimple>
   * 
   * Into:
   *   <w:r><w:fldChar w:fldCharType="begin"/></w:r>
   *   <w:r><w:instrText xml:space="preserve"> ADDIN ZOTERO_ITEM ... </w:instrText></w:r>
   *   <w:r><w:fldChar w:fldCharType="separate"/></w:r>
   *   <w:r><w:t>citation text</w:t></w:r>
   *   <w:r><w:fldChar w:fldCharType="end"/></w:r>
   */
  private convertSimpleFieldsToComplex(xml: string): string {
    // Match SimpleField elements that contain ADDIN ZOTERO_ITEM
    const simpleFieldRegex = /<w:fldSimple\s+w:instr="([^"]*ADDIN\s+ZOTERO_ITEM[^"]*)">([^]*?)<\/w:fldSimple>/g;

    return xml.replace(simpleFieldRegex, (match, instruction, content) => {
      // The instruction is already XML-escaped by the docx library (&quot; etc.)
      // We need to unescape it for the instrText element
      const unescapedInstruction = this.unescapeXml(instruction);
      
      // Extract the text content from inside the SimpleField
      // The content typically contains <w:r><w:t>text</w:t></w:r>
      const textMatch = content.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
      const displayText = textMatch ? textMatch[1] : '';

      // Build the complex field structure
      const complexField = [
        // Begin field character
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
        // Field instruction - note: instrText content should NOT be XML-escaped
        `<w:r><w:instrText xml:space="preserve"> ${unescapedInstruction} </w:instrText></w:r>`,
        // Separator
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
        // Display text (field result) - this should remain escaped
        `<w:r><w:t>${displayText}</w:t></w:r>`,
        // End field character
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
      ].join('');

      return complexField;
    });
  }

  /**
   * Unescape XML entities
   */
  private unescapeXml(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'); // Must be last
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
