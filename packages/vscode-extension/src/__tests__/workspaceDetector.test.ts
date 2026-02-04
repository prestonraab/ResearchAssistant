import { jest } from '@jest/globals';
import * as vscode from 'vscode';
import { WorkspaceDetector, checkResearchIndicators, FileSystemDeps } from '../core/workspaceDetector';
import { setupTest, createMockWorkspaceFolder, createMockExtensionContext } from './helpers';

/**
 * Creates a mock file system for testing
 */
function createMockFileSystem(): FileSystemDeps & { 
  existsSync: jest.Mock<(path: string) => boolean>; 
} {
  return {
    existsSync: jest.fn<(path: string) => boolean>().mockReturnValue(false)
  };
}

describe('WorkspaceDetector', () => {
  setupTest();

  let mockContext: ReturnType<typeof createMockExtensionContext>;
  let mockFs: ReturnType<typeof createMockFileSystem>;

  beforeEach(() => {
    mockContext = createMockExtensionContext();
    mockFs = createMockFileSystem();
    WorkspaceDetector.setFileSystem(mockFs);
    
    (vscode.workspace as any).workspaceFolders = [
      createMockWorkspaceFolder({ uri: vscode.Uri.file('/test/workspace') })
    ];
  });

  afterEach(() => {
    WorkspaceDetector.resetFileSystem();
  });

  describe('checkResearchIndicators (pure logic)', () => {
    test('should return true when indicator exists', () => {
      const fs: FileSystemDeps = { existsSync: (p: string) => p.includes('01_Knowledge_Base') };
      const result = checkResearchIndicators('/workspace', ['01_Knowledge_Base'], fs);
      expect(result).toBe(true);
    });

    test('should return false when no indicators exist', () => {
      const fs: FileSystemDeps = { existsSync: (p: string) => false };
      const result = checkResearchIndicators('/workspace', ['01_Knowledge_Base', '03_Drafting'], fs);
      expect(result).toBe(false);
    });

    test('should check all indicators', () => {
      const checked: string[] = [];
      const fs: FileSystemDeps = { existsSync: (p: string) => { checked.push(p); return false; } };
      checkResearchIndicators('/workspace', ['a', 'b', 'c'], fs);
      expect(checked).toHaveLength(3);
    });
  });

  describe('isResearchWorkspace', () => {
    test('should return true when 01_Knowledge_Base directory exists', () => {
      mockFs.existsSync.mockImplementation((path: string) => path.includes('01_Knowledge_Base'));
      expect(WorkspaceDetector.isResearchWorkspace()).toBe(true);
    });

    test('should return true when 03_Drafting directory exists', () => {
      mockFs.existsSync.mockImplementation((path: string) => path.includes('03_Drafting'));
      expect(WorkspaceDetector.isResearchWorkspace()).toBe(true);
    });

    test('should return false when no research indicators exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(WorkspaceDetector.isResearchWorkspace()).toBe(false);
    });

    test('should return false when workspace folders is undefined', () => {
      (vscode.workspace as any).workspaceFolders = undefined;
      expect(WorkspaceDetector.isResearchWorkspace()).toBe(false);
    });

    test('should return false when workspace folders is empty', () => {
      (vscode.workspace as any).workspaceFolders = [];
      expect(WorkspaceDetector.isResearchWorkspace()).toBe(false);
    });
  });

  describe('autoActivateIfNeeded', () => {
    beforeEach(() => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string, defaultValue?: unknown) => 
          key === 'autoActivate' ? true : defaultValue
        ),
        update: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
      });
    });

    test('should not activate when auto-activation is disabled', async () => {
      (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
        get: jest.fn((key: string) => key === 'autoActivate' ? false : undefined),
      });
      mockFs.existsSync.mockReturnValue(true);

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    test('should not activate when not a research workspace', async () => {
      mockFs.existsSync.mockReturnValue(false);
      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    });

    test('should activate when research workspace detected', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (vscode.window.showInformationMessage as jest.Mock<any>).mockResolvedValue('OK');

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      
      expect(vscode.window.showInformationMessage).toHaveBeenCalled();
      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('researchAssistant.activate');
    });

    test('should handle activation failure gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      (vscode.window.showInformationMessage as jest.Mock<any>).mockResolvedValue('OK');
      (vscode.commands.executeCommand as jest.Mock<any>).mockRejectedValue(new Error('Failed'));

      await WorkspaceDetector.autoActivateIfNeeded(mockContext);
      expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    });
  });

  describe('getResearchIndicators', () => {
    test('should return array of research indicators', () => {
      const indicators = WorkspaceDetector.getResearchIndicators();
      expect(Array.isArray(indicators)).toBe(true);
      expect(indicators).toContain('01_Knowledge_Base');
      expect(indicators).toContain('03_Drafting');
    });

    test('should return a copy of the indicators array', () => {
      const indicators1 = WorkspaceDetector.getResearchIndicators();
      const indicators2 = WorkspaceDetector.getResearchIndicators();
      expect(indicators1).not.toBe(indicators2);
      expect(indicators1).toEqual(indicators2);
    });
  });
});
