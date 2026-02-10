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

export interface FieldInjectionProgress {
  (message: string): void;
}

export interface FieldInjectionReport {
  totalFields: number;
  convertedFields: number;
  samples: Array<{
    before: string;
    after: string;
    displayText: string;
  }>;
  errors: string[];
}

export class ZoteroFieldInjector {
  private report: FieldInjectionReport = {
    totalFields: 0,
    convertedFields: 0,
    samples: [],
    errors: []
  };

  /**
   * Get the last injection report
   */
  public getReport(): FieldInjectionReport {
    return this.report;
  }

  /**
   * Process a DOCX buffer to convert SimpleField citations to complex fields
   * 
   * @param docxBuffer The DOCX file buffer from the docx library
   * @param onProgress Optional callback for progress updates
   * @returns Modified DOCX buffer with Zotero-compatible fields
   */
  public async processDocx(docxBuffer: Buffer, onProgress?: FieldInjectionProgress): Promise<Buffer> {
    // Reset report
    this.report = {
      totalFields: 0,
      convertedFields: 0,
      samples: [],
      errors: []
    };

    try {
      onProgress?.('📦 Loading DOCX file...');
      
      // Load the DOCX as a ZIP file
      const zip = await JSZip.loadAsync(docxBuffer);
      
      onProgress?.('📄 Extracting document.xml...');
      
      // Get the document.xml file
      const documentXml = await zip.file('word/document.xml')?.async('string');
      if (!documentXml) {
        const error = 'word/document.xml not found in DOCX file';
        this.report.errors.push(error);
        throw new Error(error);
      }

      onProgress?.('🔍 Scanning for citation fields...');
      
      // Count how many fields we'll convert - match self-closing fldSimple tags
      const fieldMatches = documentXml.match(/<w:fldSimple\s+w:instr="[^"]*ADDIN\s+ZOTERO_ITEM[^"]*"\s*\/>/g) || [];
      this.report.totalFields = fieldMatches.length;
      
      console.log('[ZoteroFieldInjector] Searching for pattern: <w:fldSimple w:instr="...ADDIN ZOTERO_ITEM..." />');
      console.log('[ZoteroFieldInjector] Found', fieldMatches.length, 'matching fields');
      
      // Also check if there are ANY fldSimple elements at all
      const allSimpleFields = documentXml.match(/<w:fldSimple[^>]*>/g) || [];
      console.log('[ZoteroFieldInjector] Total <w:fldSimple> elements found:', allSimpleFields.length);
      if (allSimpleFields.length > 0) {
        console.log('[ZoteroFieldInjector] First fldSimple element:', allSimpleFields[0]);
      }
      
      // Check if ADDIN ZOTERO_ITEM appears anywhere in the document
      const hasZoteroText = documentXml.includes('ADDIN ZOTERO_ITEM');
      console.log('[ZoteroFieldInjector] Document contains "ADDIN ZOTERO_ITEM":', hasZoteroText);
      
      if (this.report.totalFields === 0) {
        onProgress?.('⚠️ No Zotero citation fields found');
      } else {
        onProgress?.(`🔧 Converting ${this.report.totalFields} citation field${this.report.totalFields === 1 ? '' : 's'} to Zotero format...`);
      }

      // Replace SimpleField elements with complex fields and collect samples
      const modifiedXml = this.convertSimpleFieldsToComplex(documentXml);

      onProgress?.('💾 Updating document.xml...');
      
      // Update the document.xml in the ZIP
      zip.file('word/document.xml', modifiedXml);

      onProgress?.('📦 Generating final DOCX file...');
      
      // Generate the modified DOCX buffer
      const result = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
      });
      
      onProgress?.(`✅ Successfully processed ${this.report.convertedFields} citation${this.report.convertedFields === 1 ? '' : 's'}`);
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.report.errors.push(errorMsg);
      onProgress?.(`❌ Error: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Convert SimpleField elements to complex field structures
   * 
   * Transforms self-closing SimpleField tags:
   *   <w:fldSimple w:instr="ADDIN ZOTERO_ITEM ..." />
   * 
   * Into complex field structure:
   *   <w:r><w:fldChar w:fldCharType="begin"/></w:r>
   *   <w:r><w:instrText xml:space="preserve"> ADDIN ZOTERO_ITEM ... </w:instrText></w:r>
   *   <w:r><w:fldChar w:fldCharType="separate"/></w:r>
   *   <w:r><w:t>citation text</w:t></w:r>
   *   <w:r><w:fldChar w:fldCharType="end"/></w:r>
   */
  private convertSimpleFieldsToComplex(xml: string): string {
    // Match self-closing SimpleField elements that contain ADDIN ZOTERO_ITEM
    const simpleFieldRegex = /<w:fldSimple\s+w:instr="([^"]*ADDIN\s+ZOTERO_ITEM[^"]*)"\s*\/>/g;

    let sampleCount = 0;
    const maxSamples = 3;

    return xml.replace(simpleFieldRegex, (match, instruction) => {
      try {
        // The instruction is XML-escaped in the fldSimple w:instr attribute (&quot; etc.)
        // When moving to instrText element content:
        //   - &quot; must be unescaped (quotes are fine in element text)
        //   - &apos; must be unescaped (apostrophes are fine in element text)
        //   - &amp; &lt; &gt; must STAY escaped (they're invalid in XML text content)
        const instrTextContent = this.unescapeForInstrText(instruction);
        
        // Extract display text from the CSL citation if possible
        let displayText = '[Citation]';
        try {
          // Parse using fully unescaped version (for JSON parsing only)
          const fullyUnescaped = this.unescapeXml(instruction);
          const cslMatch = fullyUnescaped.match(/CSL_CITATION\s+(\{.*\})/);
          if (cslMatch) {
            const cslData = JSON.parse(cslMatch[1]);
            displayText = cslData.properties?.formattedCitation || displayText;
          }
        } catch (e) {
          // Fallback to default display text
        }

        // Build the complex field structure
        const complexField = [
          // Begin field character
          '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
          // Field instruction - instrText is XML element content, so <, >, & must stay escaped
          `<w:r><w:instrText xml:space="preserve">${instrTextContent}</w:instrText></w:r>`,
          // Separator
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
          // Display text (field result)
          `<w:r><w:t>${this.escapeXml(displayText)}</w:t></w:r>`,
          // End field character
          '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
        ].join('');

        // Collect samples for the report (first few conversions)
        if (sampleCount < maxSamples) {
          this.report.samples.push({
            before: match.substring(0, 200) + (match.length > 200 ? '...' : ''),
            after: complexField.substring(0, 200) + (complexField.length > 200 ? '...' : ''),
            displayText
          });
          sampleCount++;
        }

        this.report.convertedFields++;
        return complexField;
      } catch (error) {
        const errorMsg = `Failed to convert field: ${error instanceof Error ? error.message : String(error)}`;
        this.report.errors.push(errorMsg);
        // Return original on error
        return match;
      }
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
   * Unescape only attribute-specific entities for instrText element content.
   * Quotes and apostrophes can be unescaped (they're valid in element text),
   * but &amp; &lt; &gt; must remain escaped since instrText is XML element content.
   */
  private unescapeForInstrText(text: string): string {
    return text
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    // Deliberately NOT unescaping &amp; &lt; &gt; — they must stay escaped in XML text
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
