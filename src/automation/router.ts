import { logger } from "../logger.js";
import { PlaywrightAutomation } from "./playwrightAutomation.js";
import {
  AegisRemoteAutomation,
  type RemoteTabHandle,
  type RemotePdfWorkflowResult,
  type RemoteSheetEnrichmentResult,
  type RemoteMonitoringTaskResult,
  type RemoteSandboxExecutionResult,
  type RemoteParallelTabsResult,
  type RemoteExtractResult,
} from "./aegisRemoteAutomation.js";
import type { PlaywrightPageHandle } from "./playwrightAutomation.js";

/**
 * AutomationRouter
 * ----------------
 *
 * Chooses between local PlaywrightAutomation and remote AegisRemoteAutomation
 * based on the type of task.
 *
 * - Local (Playwright): simple, single-site navigation / clicks / extraction.
 * - Remote (Aegis): multi-site research, heavy scraping, complex forms,
 *   parallel tabs, PDF workflows, monitoring, spreadsheet enrichment,
 *   sandbox execution, and API-driven workflows.
 */
export class AutomationRouter {
  private readonly local: PlaywrightAutomation;
  private readonly remote: AegisRemoteAutomation | null;

  constructor() {
    this.local = new PlaywrightAutomation();

    let remote: AegisRemoteAutomation | null = null;
    try {
      remote = new AegisRemoteAutomation();
      logger.info("AegisRemoteAutomation enabled");
    } catch (err) {
      logger.info("AegisRemoteAutomation disabled (missing or invalid config)", {
        reason: String(err),
      });
    }
    this.remote = remote;
  }

  /** Whether the remote Aegis backend is available. */
  isRemoteAvailable(): boolean {
    return this.remote != null;
  }

  // -------------------------------
  // Local-first simple page tasks
  // -------------------------------

  /** Open a single page locally using Playwright. */
  async openPage(url: string): Promise<PlaywrightPageHandle> {
    return this.local.openPage(url);
  }

  /** Navigate an existing local page to a new URL. */
  async navigateLocal(pageId: string, url: string): Promise<PlaywrightPageHandle> {
    return this.local.navigate(pageId, url);
  }

  /** Local click, with optional navigation wait. */
  async clickLocal(
    pageId: string,
    selector: string,
    waitForNavigation = false
  ): Promise<{ success: boolean; pageId: string }> {
    return this.local.click(pageId, selector, waitForNavigation);
  }

  /** Local typing into inputs/textareas. */
  async typeLocal(
    pageId: string,
    selector: string,
    value: string
  ): Promise<{ success: boolean }> {
    return this.local.type(pageId, selector, value);
  }

  /** Local extraction of text/HTML. */
  async extractLocal(
    pageId: string,
    selector: string,
    format: "text" | "html" = "text"
  ): Promise<{ content: string }> {
    return this.local.extract(pageId, selector, format);
  }

  /** Local screenshot capture. */
  async screenshotLocal(
    pageId: string,
    options?: { fullPage?: boolean }
  ): Promise<Buffer> {
    return this.local.screenshot(pageId, { fullPage: options?.fullPage ?? true });
  }

  /** Local evaluation in the page context. */
  async evaluateLocal<T = unknown>(
    pageId: string,
    fn: (...args: any[]) => T | Promise<T>,
    ...args: any[]
  ): Promise<T> {
    return this.local.evaluate(pageId, fn, ...args);
  }

  // ------------------------------------
  // Remote multi-site / heavy-weight ops
  // ------------------------------------

  private ensureRemote(): AegisRemoteAutomation {
    if (!this.remote) {
      throw new Error(
        "Aegis remote automation is not configured; set AEGIS_MCP_URL and AEGIS_API_KEY to enable remote tasks."
      );
    }
    return this.remote;
  }

  /**
   * Multi-site research / navigation.
   * Uses Aegis to open multiple tabs in parallel when remote is available,
   * otherwise falls back to sequential local openPage calls.
   */
  async openParallelTabs(urls: string[]): Promise<{ remote?: RemoteParallelTabsResult; local?: PlaywrightPageHandle[] }> {
    if (this.remote) {
      const remote = await this.remote.openParallelTabs(urls);
      return { remote };
    }

    // Fallback: open pages locally, sequentially
    const local: PlaywrightPageHandle[] = [];
    for (const url of urls) {
      local.push(await this.local.openPage(url));
    }
    return { local };
  }

  /** Remote extract on a tab controlled by Aegis. */
  async extractRemote(
    tabId: string,
    selector: string,
    format: "text" | "html" = "text"
  ): Promise<RemoteExtractResult> {
    const remote = this.ensureRemote();
    return remote.extract(tabId, selector, format);
  }

  /** PDF workflows (form filling, generation, etc.) via Aegis. */
  async runPdfWorkflowRemote(params: {
    workflowName: string;
    url?: string;
    pdfId?: string;
    formData?: Record<string, unknown>;
  }): Promise<RemotePdfWorkflowResult> {
    const remote = this.ensureRemote();
    return remote.runPdfWorkflow(params);
  }

  /** Spreadsheet enrichment via Aegis (Spreadsheet Agent). */
  async enrichSpreadsheetRemote(params: {
    sheetId: string;
    range?: string;
    enrichmentType: string;
    options?: Record<string, unknown>;
  }): Promise<RemoteSheetEnrichmentResult> {
    const remote = this.ensureRemote();
    return remote.enrichSpreadsheet(params);
  }

  /** Monitoring tasks via Aegis (Monitoring Agent). */
  async startMonitoringTaskRemote(params: {
    taskName: string;
    targetUrl: string;
    frequency: string;
    config?: Record<string, unknown>;
  }): Promise<RemoteMonitoringTaskResult> {
    const remote = this.ensureRemote();
    return remote.startMonitoringTask(params);
  }

  async getMonitoringStatusRemote(taskId: string): Promise<RemoteMonitoringTaskResult> {
    const remote = this.ensureRemote();
    return remote.getMonitoringStatus(taskId);
  }

  /** Sandbox code execution via Aegis (Browser Sandbox Code). */
  async runSandboxExecutionRemote(params: {
    language: string;
    code: string;
    stdin?: string;
    timeoutSeconds?: number;
  }): Promise<RemoteSandboxExecutionResult> {
    const remote = this.ensureRemote();
    return remote.runSandboxExecution(params);
  }

  /** Generic parallel tab tasks via Aegis. */
  async runParallelTasksRemote(params: {
    tabs: RemoteTabHandle[];
    taskName: string;
    taskConfig?: Record<string, unknown>;
  }): Promise<RemoteParallelTabsResult> {
    const remote = this.ensureRemote();
    return remote.runParallelTasks(params);
  }
}
