import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * A lead paper waiting to be added to Zotero
 */
export interface ZoteroLead {
  id: string;                    // Unique ID for this lead
  title: string;                 // Paper title
  authors: string[];             // Authors
  year: number;                  // Publication year
  abstract: string;              // Abstract
  url: string;                   // Paper URL
  doi?: string;                  // DOI if available
  claimId: string;               // Associated claim ID
  quoteText: string;             // The quote text (abstract or extracted)
  quoteType: 'abstract' | 'verified';  // Whether this is just abstract or verified text
  confidence?: number;           // Confidence score if verified
  addedAt: number;               // Timestamp when added to queue
  attempts: number;              // Number of attempts to add to Zotero
  lastAttempt?: number;          // Timestamp of last attempt
}

/**
 * Manages a queue of paper leads to be added to Zotero
 * Handles retries when Zotero API is unavailable
 */
export class ZoteroLeadQueue {
  private queuePath: string;
  private leads: Map<string, ZoteroLead> = new Map();
  private processing: boolean = false;
  private readonly MAX_ATTEMPTS = 5;
  private readonly RETRY_DELAY = 60000; // 1 minute

  constructor(workspaceRoot: string) {
    this.queuePath = path.join(workspaceRoot, '.cache', 'zotero_lead_queue.json');
    this.loadQueue();
  }

  /**
   * Load queue from disk
   */
  private async loadQueue(): Promise<void> {
    try {
      const data = await fs.readFile(this.queuePath, 'utf-8');
      const leads = JSON.parse(data) as ZoteroLead[];
      this.leads = new Map(leads.map(lead => [lead.id, lead]));
      console.log(`[ZoteroLeadQueue] Loaded ${this.leads.size} leads from queue`);
    } catch (error) {
      // Queue file doesn't exist yet, that's fine
      console.log('[ZoteroLeadQueue] No existing queue file');
    }
  }

  /**
   * Save queue to disk
   */
  private async saveQueue(): Promise<void> {
    try {
      const dir = path.dirname(this.queuePath);
      await fs.mkdir(dir, { recursive: true });
      const leads = Array.from(this.leads.values());
      await fs.writeFile(this.queuePath, JSON.stringify(leads, null, 2));
    } catch (error) {
      console.error('[ZoteroLeadQueue] Failed to save queue:', error);
    }
  }

  /**
   * Add a lead to the queue
   */
  public async addLead(lead: Omit<ZoteroLead, 'id' | 'addedAt' | 'attempts'>): Promise<string> {
    const id = `lead_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fullLead: ZoteroLead = {
      ...lead,
      id,
      addedAt: Date.now(),
      attempts: 0
    };
    
    this.leads.set(id, fullLead);
    await this.saveQueue();
    
    console.log(`[ZoteroLeadQueue] Added lead: ${lead.title}`);
    
    // Try to process immediately
    this.processQueue();
    
    return id;
  }

  /**
   * Remove a lead from the queue
   */
  public async removeLead(id: string): Promise<void> {
    this.leads.delete(id);
    await this.saveQueue();
  }

  /**
   * Get all leads in the queue
   */
  public getLeads(): ZoteroLead[] {
    return Array.from(this.leads.values());
  }

  /**
   * Get a specific lead
   */
  public getLead(id: string): ZoteroLead | undefined {
    return this.leads.get(id);
  }

  /**
   * Process the queue - attempt to add leads to Zotero
   */
  public async processQueue(): Promise<void> {
    if (this.processing) {
      return; // Already processing
    }

    this.processing = true;

    try {
      const now = Date.now();
      const leadsToProcess = Array.from(this.leads.values()).filter(lead => {
        // Skip if max attempts reached
        if (lead.attempts >= this.MAX_ATTEMPTS) {
          return false;
        }
        
        // Skip if recently attempted
        if (lead.lastAttempt && (now - lead.lastAttempt) < this.RETRY_DELAY) {
          return false;
        }
        
        return true;
      });

      if (leadsToProcess.length === 0) {
        return;
      }

      console.log(`[ZoteroLeadQueue] Processing ${leadsToProcess.length} leads`);

      for (const lead of leadsToProcess) {
        try {
          // Try to add to Zotero via command
          await vscode.commands.executeCommand(
            'researchAssistant.addPaperToZotero',
            {
              title: lead.title,
              authors: lead.authors,
              year: lead.year,
              abstract: lead.abstract,
              url: lead.url,
              doi: lead.doi
            }
          );

          // Success - remove from queue
          console.log(`[ZoteroLeadQueue] Successfully added to Zotero: ${lead.title}`);
          await this.removeLead(lead.id);

        } catch (error) {
          // Failed - increment attempts
          lead.attempts++;
          lead.lastAttempt = now;
          
          console.warn(`[ZoteroLeadQueue] Failed to add ${lead.title} (attempt ${lead.attempts}/${this.MAX_ATTEMPTS}):`, error);
          
          if (lead.attempts >= this.MAX_ATTEMPTS) {
            vscode.window.showWarningMessage(
              `Failed to add "${lead.title}" to Zotero after ${this.MAX_ATTEMPTS} attempts. Please add manually.`,
              'Open URL'
            ).then(action => {
              if (action === 'Open URL') {
                vscode.env.openExternal(vscode.Uri.parse(lead.url));
              }
            });
          }
        }
      }

      await this.saveQueue();

    } finally {
      this.processing = false;
    }
  }

  /**
   * Start periodic queue processing
   */
  public startPeriodicProcessing(intervalMs: number = 300000): vscode.Disposable {
    const interval = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    return new vscode.Disposable(() => {
      clearInterval(interval);
    });
  }
}
