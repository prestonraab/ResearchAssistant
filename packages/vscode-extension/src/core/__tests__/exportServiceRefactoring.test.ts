import { ExportService } from '../exportService';
import { MarkdownExporter } from '../exporters/MarkdownExporter';
import { WordExporter } from '../exporters/WordExporter';
import { LaTeXExporter } from '../exporters/LaTeXExporter';
import { CSVExporter } from '../exporters/CSVExporter';
import { DocumentBuilder } from '../exporters/DocumentBuilder';

describe('ExportService Refactoring', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
  });

  it('should initialize with all exporter instances', () => {
    expect(exportService).toBeDefined();
  });

  it('should have exportManuscriptMarkdown method', () => {
    expect(typeof exportService.exportManuscriptMarkdown).toBe('function');
  });

  it('should have exportManuscriptWord method', () => {
    expect(typeof exportService.exportManuscriptWord).toBe('function');
  });

  it('should have exportManuscriptLatex method', () => {
    expect(typeof exportService.exportManuscriptLatex).toBe('function');
  });

  it('should have buildDocumentModel method', () => {
    expect(typeof exportService.buildDocumentModel).toBe('function');
  });

  it('should have exportCoverageAnalysis method', () => {
    expect(typeof exportService.exportCoverageAnalysis).toBe('function');
  });

  it('should have exportClaims method', () => {
    expect(typeof exportService.exportClaims).toBe('function');
  });

  it('should have exportReadingProgress method', () => {
    expect(typeof exportService.exportReadingProgress).toBe('function');
  });

  it('should have promptForExportLocation method', () => {
    expect(typeof exportService.promptForExportLocation).toBe('function');
  });
});

describe('Exporter Classes', () => {
  it('MarkdownExporter should be instantiable', () => {
    const exporter = new MarkdownExporter();
    expect(exporter).toBeDefined();
  });

  it('WordExporter should be instantiable', () => {
    const exporter = new WordExporter();
    expect(exporter).toBeDefined();
  });

  it('LaTeXExporter should be instantiable', () => {
    const exporter = new LaTeXExporter();
    expect(exporter).toBeDefined();
  });

  it('CSVExporter should be instantiable', () => {
    const exporter = new CSVExporter();
    expect(exporter).toBeDefined();
  });

  it('DocumentBuilder should be instantiable', () => {
    const builder = new DocumentBuilder();
    expect(builder).toBeDefined();
  });
});
