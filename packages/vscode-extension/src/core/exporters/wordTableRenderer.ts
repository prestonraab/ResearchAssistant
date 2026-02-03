/**
 * Word Table Renderer
 * 
 * Handles rendering of tables in Word documents.
 */

import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  WidthType,
  BorderStyle
} from 'docx';

import { WORD_STYLES } from './wordFormattingUtils';

import type { DocumentTable } from '../documentModel';

/**
 * Renders tables in Word documents
 */
export class WordTableRenderer {
  /**
   * Create a Word table from DocumentTable
   * 
   * @param table The table data
   * @returns Table object
   */
  public createTable(table: DocumentTable): Table {
    const rows: TableRow[] = [];

    for (let i = 0; i < table.rows.length; i++) {
      const rowData = table.rows[i];
      const isHeader = table.hasHeader && i === 0;

      const cells = rowData.map(cellText =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: cellText,
                  font: WORD_STYLES.body.font,
                  size: WORD_STYLES.body.size,
                  bold: isHeader
                })
              ]
            })
          ],
          shading: isHeader
            ? {
              fill: 'D9D9D9' // Light gray for header
            }
            : undefined
        })
      );

      rows.push(
        new TableRow({
          children: cells
        })
      );
    }

    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 }
      }
    });
  }
}
