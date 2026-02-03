import * as path from 'path';
import * as fs from 'fs';
import { ExtensionState } from '../core/state';
import { PapersTreeProvider } from '../ui/papersTreeProvider';

interface Logger {
  info(message: string): void;
  error(message: string, error?: unknown): void;
}

interface PdfAttachment {
  contentType?: string;
  title?: string;
  path?: string;
  [key: string]: unknown;
}

export async function autoScanFulltexts(state: ExtensionState, papersProvider: PapersTreeProvider, logger: Logger): Promise<void> {
  try {
    logger.info('Auto-scanning for missing fulltexts...');

    await state.fulltextStatusManager.scanLibrary();
    const stats = state.fulltextStatusManager.getStatistics();

    logger.info(`Fulltext scan complete: ${stats.withFulltext}/${stats.total} papers have extracted text (${stats.coveragePercentage.toFixed(1)}%)`);

    if (stats.missingFulltext > 0) {
      logger.info(`${stats.missingFulltext} papers need fulltext extraction`);
    }

    papersProvider.refresh();
  } catch (error) {
    logger.error('Auto-scan fulltexts failed:', error);
  }
}

export async function autoSyncPDFs(state: ExtensionState, papersProvider: PapersTreeProvider, logger: Logger): Promise<void> {
  try {
    logger.info('Auto-syncing PDFs from Zotero...');

    const extractedTextPath = state.getAbsolutePath(state.getConfig().extractedTextPath);
    const pdfDir = path.join(state.getWorkspaceRoot(), 'literature', 'PDFs');

    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const files = fs.readdirSync(extractedTextPath)
      .filter(f => f.endsWith('.txt') || f.endsWith('.md'));

    const missingPdfs = files.filter(file => {
      const basename = path.basename(file, path.extname(file));
      const pdfPath = path.join(pdfDir, `${basename}.pdf`);
      return !fs.existsSync(pdfPath);
    });

    if (missingPdfs.length === 0) {
      logger.info('All papers have PDFs');
      return;
    }

    logger.info(`Found ${missingPdfs.length} papers without PDFs, syncing...`);

    let downloaded = 0;
    let failed = 0;

    for (const file of missingPdfs.slice(0, 10)) {
      const basename = path.basename(file, path.extname(file));
      const pdfPath = path.join(pdfDir, `${basename}.pdf`);

      try {
        const results = await state.zoteroClient.getItems(1);

        if (results.length === 0) {
          failed++;
          continue;
        }

        const item = results[0];
        const children = await state.zoteroClient.getPdfAttachments(item.key);

        const pdfAttachment = children.find((child) =>
          child.contentType === 'application/pdf' ||
          child.title?.endsWith('.pdf')
        );

        if (pdfAttachment && pdfAttachment.path) {
          const zoteroPath = pdfAttachment.path;
          if (fs.existsSync(zoteroPath)) {
            fs.copyFileSync(zoteroPath, pdfPath);
            downloaded++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (downloaded > 0) {
      logger.info(`Auto-sync complete: ${downloaded} PDFs downloaded`);
      papersProvider.refresh();
    }
  } catch (error) {
    logger.error('Auto-sync PDFs failed:', error);
  }
}
