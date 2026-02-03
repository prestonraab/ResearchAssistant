import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Persistence operation result
 */
export interface PersistenceResult {
  success: boolean;
  error?: Error;
  retryCount: number;
  filePath: string;
  operationId?: string; // For idempotency
  verificationPassed?: boolean;
}

/**
 * Persistence operation log entry
 */
export interface PersistenceLogEntry {
  timestamp: Date;
  operationId: string;
  operationType: 'write' | 'read' | 'verify' | 'recover';
  filePath: string;
  contentHash: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * External change detection result
 */
export interface ExternalChangeDetection {
  hasChanged: boolean;
  diskContent: string;
  diskHash: string;
  memoryHash: string;
}

/**
 * PersistenceUtils - Provides robust file persistence with atomic writes, retry logic, and validation
 * 
 * Features:
 * - Atomic writes using temporary files and rename
 * - Automatic retry with exponential backoff
 * - Data validation before persistence
 * - Error notifications to user
 * - External change detection and conflict resolution
 * - Automatic recovery from backups
 * - Idempotency guarantees (prevent duplicate operations)
 * - Consistency verification (verify written data matches in-memory state)
 * - In-memory operation logging
 * - Comprehensive logging
 */
export class PersistenceUtils {
  private static readonly TEMP_SUFFIX = '.tmp';
  private static readonly BACKUP_SUFFIX = '.backup';
  private static readonly HASH_SUFFIX = '.hash';
  
  // In-memory operation log (keep last 1000 operations, ~500KB max)
  private static readonly operationLog: PersistenceLogEntry[] = [];
  private static readonly MAX_LOG_ENTRIES = 1000;
  
  // Track completed operations for idempotency
  private static readonly completedOperations: Map<string, PersistenceResult> = new Map();
  private static readonly MAX_COMPLETED_OPS = 100;

  /**
   * Write data to file atomically with retry logic, idempotency, and consistency verification
   */
  static async writeFileAtomic(
    filePath: string,
    content: string,
    options: Partial<RetryOptions> = {},
    operationId?: string
  ): Promise<PersistenceResult> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    const opId = operationId || this.generateOperationId();
    const startTime = performance.now();
    
    // Check for idempotency - if this operation already completed successfully, return cached result
    if (operationId && this.completedOperations.has(operationId)) {
      const cachedResult = this.completedOperations.get(operationId)!;
      if (cachedResult.success) {
        console.log(`[PersistenceUtils] Idempotent operation ${operationId} - returning cached result`);
        return cachedResult;
      }
    }

    let lastError: Error | null = null;
    let retryCount = 0;
    let delay = opts.initialDelayMs;
    let contentHash = this.computeHash(content);

    // Validate input
    if (!filePath || typeof content !== 'string') {
      const error = new Error('Invalid input: filePath and content are required');
      this.logOperation('write', filePath, contentHash, false, error.message, 0);
      return {
        success: false,
        error,
        retryCount: 0,
        filePath,
        operationId: opId
      };
    }

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });

        // Write to temporary file first
        const tempPath = filePath + this.TEMP_SUFFIX;
        await fs.writeFile(tempPath, content, 'utf-8');

        // Verify temp file was written correctly
        const writtenContent = await fs.readFile(tempPath, 'utf-8');
        if (writtenContent !== content) {
          throw new Error('Data corruption detected while writing file. The file may not have been saved correctly. Please check your disk space and try again.');
        }

        // Create backup of existing file if it exists
        try {
          const backupPath = filePath + this.BACKUP_SUFFIX;
          await fs.copyFile(filePath, backupPath);
        } catch {
          // File doesn't exist yet, that's fine
        }

        // Atomically rename temp file to target
        await fs.rename(tempPath, filePath);

        // Verify written file matches expected content (consistency verification)
        const verifyContent = await fs.readFile(filePath, 'utf-8');
        const verifyHash = this.computeHash(verifyContent);
        
        if (verifyHash !== contentHash) {
          throw new Error('Consistency verification failed: written content does not match expected content. Please check your disk space and try again.');
        }

        const duration = performance.now() - startTime;
        this.logOperation('write', filePath, contentHash, true, undefined, duration);
        
        const result: PersistenceResult = {
          success: true,
          retryCount,
          filePath,
          operationId: opId,
          verificationPassed: true
        };
        
        // Cache successful operation for idempotency
        if (operationId) {
          this.completedOperations.set(operationId, result);
          // Maintain size limit
          if (this.completedOperations.size > this.MAX_COMPLETED_OPS) {
            const firstKey = this.completedOperations.keys().next().value;
            if (firstKey) {
              this.completedOperations.delete(firstKey);
            }
          }
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount++;

        if (attempt < opts.maxRetries) {
          console.warn(
            `[PersistenceUtils] Write attempt ${attempt + 1}/${opts.maxRetries + 1} failed for ${filePath}: ${lastError.message}. Retrying in ${delay}ms...`
          );
          await this.sleep(delay);
          delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
        }
      }
    }

    const duration = performance.now() - startTime;
    this.logOperation('write', filePath, contentHash, false, lastError?.message, duration);

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      retryCount,
      filePath,
      operationId: opId,
      verificationPassed: false
    };
  }

  /**
   * Validate claim data before persistence
   */
  static validateClaim(claim: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!claim) {
      errors.push('Claim is null or undefined');
      return { valid: false, errors };
    }

    const claimObj = claim as Record<string, unknown>;

    if (!claimObj.id || typeof claimObj.id !== 'string') {
      errors.push('Claim must have a valid id (string)');
    }

    if (!claimObj.text || typeof claimObj.text !== 'string') {
      errors.push('Claim must have a valid text (string)');
    }

    if (claimObj.text && (claimObj.text as string).trim().length === 0) {
      errors.push('Claim text cannot be empty');
    }

    if (!Array.isArray(claimObj.sections)) {
      errors.push('Claim sections must be an array');
    }

    if (!Array.isArray(claimObj.supportingQuotes)) {
      errors.push('Claim supportingQuotes must be an array');
    }

    if (claimObj.createdAt && !(claimObj.createdAt instanceof Date)) {
      errors.push('Claim createdAt must be a Date');
    }

    if (claimObj.modifiedAt && !(claimObj.modifiedAt instanceof Date)) {
      errors.push('Claim modifiedAt must be a Date');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate reading progress data before persistence
   */
  static validateReadingProgress(progress: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!progress) {
      errors.push('Reading progress is null or undefined');
      return { valid: false, errors };
    }

    const progressObj = progress as Record<string, unknown>;
    const validStatuses = ['to-read', 'reading', 'read'];
    if (!validStatuses.includes(progressObj.status as string)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    if (progressObj.startedAt && !(progressObj.startedAt instanceof Date)) {
      errors.push('startedAt must be a Date');
    }

    if (progressObj.completedAt && !(progressObj.completedAt instanceof Date)) {
      errors.push('completedAt must be a Date');
    }

    if (progressObj.readingDuration !== undefined && typeof progressObj.readingDuration !== 'number') {
      errors.push('readingDuration must be a number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Show error notification to user with retry option
   */
  static async showPersistenceError(
    error: Error,
    operation: string,
    filePath: string,
    onRetry?: () => Promise<void>
  ): Promise<void> {
    const message = `Failed to ${operation}: ${error.message}`;
    const actions = onRetry ? ['Retry', 'Dismiss'] : ['Dismiss'];

    const result = await vscode.window.showErrorMessage(message, ...actions);

    if (result === 'Retry' && onRetry) {
      try {
        await onRetry();
        vscode.window.showInformationMessage(`Successfully ${operation}`);
      } catch (retryError) {
        await this.showPersistenceError(
          retryError instanceof Error ? retryError : new Error(String(retryError)),
          operation,
          filePath
        );
      }
    }
  }

  /**
   * Show warning notification for validation errors
   */
  static async showValidationWarning(errors: string[], context: string): Promise<void> {
    const message = `Validation errors in ${context}:\n${errors.join('\n')}`;
    await vscode.window.showWarningMessage(message);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Recover from backup if available
   */
  static async recoverFromBackup(filePath: string): Promise<boolean> {
    try {
      const backupPath = filePath + this.BACKUP_SUFFIX;
      const stat = await fs.stat(backupPath);
      if (stat.isFile()) {
        await fs.copyFile(backupPath, filePath);
        console.log(`[PersistenceUtils] Recovered ${filePath} from backup`);
        return true;
      }
    } catch (error) {
      console.warn(`[PersistenceUtils] Could not recover from backup: ${error}`);
    }
    return false;
  }

  /**
   * Clean up temporary and backup files
   */
  static async cleanup(filePath: string): Promise<void> {
    try {
      const tempPath = filePath + this.TEMP_SUFFIX;
      const backupPath = filePath + this.BACKUP_SUFFIX;

      await Promise.all([
        fs.unlink(tempPath).catch(() => {}),
        fs.unlink(backupPath).catch(() => {})
      ]);
    } catch (error) {
      console.warn(`[PersistenceUtils] Cleanup failed: ${error}`);
    }
  }

  /**
   * Compute simple hash of content for change detection
   */
  static computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Detect if file has been modified externally
   * Compares disk content with in-memory state
   */
  static async detectExternalChanges(
    filePath: string,
    memoryContent: string
  ): Promise<ExternalChangeDetection> {
    try {
      const diskContent = await fs.readFile(filePath, 'utf-8');
      const diskHash = this.computeHash(diskContent);
      const memoryHash = this.computeHash(memoryContent);

      return {
        hasChanged: diskHash !== memoryHash,
        diskContent,
        diskHash,
        memoryHash
      };
    } catch (error) {
      // File doesn't exist or can't be read
      return {
        hasChanged: false,
        diskContent: '',
        diskHash: '',
        memoryHash: this.computeHash(memoryContent)
      };
    }
  }

  /**
   * Show conflict resolution dialog to user
   * Returns true if user wants to use disk version, false for memory version
   */
  static async showConflictDialog(filePath: string): Promise<boolean> {
    const fileName = path.basename(filePath);
    const result = await vscode.window.showWarningMessage(
      `"${fileName}" has been modified externally. Which version would you like to use?`,
      'Use Disk Version',
      'Keep Memory Version'
    );

    return result === 'Use Disk Version';
  }

  /**
   * Attempt automatic recovery from backup
   * Returns true if recovery was successful
   */
  static async attemptRecovery(filePath: string): Promise<boolean> {
    try {
      const backupPath = filePath + this.BACKUP_SUFFIX;
      const stat = await fs.stat(backupPath);
      if (stat.isFile()) {
        const backupContent = await fs.readFile(backupPath, 'utf-8');
        await fs.writeFile(filePath, backupContent, 'utf-8');
        console.log(`[PersistenceUtils] Recovered ${filePath} from backup`);
        
        await vscode.window.showInformationMessage(
          `Recovered "${path.basename(filePath)}" from backup`
        );
        return true;
      }
    } catch (error) {
      console.warn(`[PersistenceUtils] Could not recover from backup: ${error}`);
    }
    return false;
  }

  /**
   * Generate unique operation ID for idempotency
   */
  private static generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log persistence operation to in-memory log
   */
  private static logOperation(
    operationType: 'write' | 'read' | 'verify' | 'recover',
    filePath: string,
    contentHash: string,
    success: boolean,
    error: string | undefined,
    durationMs: number
  ): void {
    const entry: PersistenceLogEntry = {
      timestamp: new Date(),
      operationId: this.generateOperationId(),
      operationType,
      filePath,
      contentHash,
      success,
      error,
      durationMs
    };

    this.operationLog.push(entry);

    // Maintain size limit
    if (this.operationLog.length > this.MAX_LOG_ENTRIES) {
      this.operationLog.shift();
    }

    // Log to console for debugging
    const status = success ? '✓' : '✗';
    console.log(
      `[PersistenceUtils] ${status} ${operationType} ${path.basename(filePath)} (${durationMs.toFixed(0)}ms)${error ? ` - ${error}` : ''}`
    );
  }

  /**
   * Get operation log for debugging
   */
  static getOperationLog(): PersistenceLogEntry[] {
    return [...this.operationLog];
  }

  /**
   * Clear operation log
   */
  static clearOperationLog(): void {
    this.operationLog.length = 0;
  }

  /**
   * Get statistics about persistence operations
   */
  static getOperationStats(): {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageDurationMs: number;
    cachedOperations: number;
  } {
    const total = this.operationLog.length;
    const successful = this.operationLog.filter(op => op.success).length;
    const failed = total - successful;
    const avgDuration = total > 0 
      ? this.operationLog.reduce((sum, op) => sum + op.durationMs, 0) / total 
      : 0;

    return {
      totalOperations: total,
      successfulOperations: successful,
      failedOperations: failed,
      averageDurationMs: avgDuration,
      cachedOperations: this.completedOperations.size
    };
  }
}
