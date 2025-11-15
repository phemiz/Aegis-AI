import { loadConfigFromEnv } from "../config.js";
import { logger } from "../logger.js";

interface RpcRequest {
  method: string;
  params?: Record<string, unknown>;
}

interface RpcResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error?: { code: string | number; message: string; data?: unknown };
}

export interface RemoteTabHandle {
  tabId: string;
  url: string;
}

export interface RemoteExtractResult {
  content: string;
  format: "text" | "html";
}

export interface RemotePdfWorkflowResult {
  workflowId: string;
  status: string;
  outputUrl?: string;
  meta?: Record<string, unknown>;
}

export interface RemoteSheetEnrichmentResult {
  jobId: string;
  status: string;
  enrichedRows?: Record<string, unknown>[];
}

export interface RemoteMonitoringTaskResult {
  taskId: string;
  status: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export interface RemoteSandboxExecutionResult {
  executionId: string;
  status: string;
  stdout?: string;
  stderr?: string;
  result?: unknown;
}

export interface RemoteParallelTabsResult {
  tabs: RemoteTabHandle[];
}

/**
 * AegisRemoteAutomation
 * ---------------------
 *
 * Thin HTTP RPC client for talking to the Aegis AI remote automation backend.
 * This does not depend on MCP client plumbing directly; instead it posts
 * JSON-RPC-like payloads to AEGIS_MCP_URL with an Authorization bearer token.
 *
 * The concrete method names ("aegis.navigate", "aegis.extract", etc.) are
 * placeholders and should be aligned with the actual Aegis service contract
 * when available.
 */
export class AegisRemoteAutomation {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    const config = loadConfigFromEnv();
    if (!config.AEGIS_MCP_URL || !config.AEGIS_API_KEY) {
      throw new Error(
        "AegisRemoteAutomation is not configured: set AEGIS_MCP_URL and AEGIS_API_KEY in the environment."
      );
    }
    this.baseUrl = config.AEGIS_MCP_URL;
    this.apiKey = config.AEGIS_API_KEY;
  }

  private async rpc<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const payload: RpcRequest = { method, params };

    let res: Response;
    try {
      res = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger.error("Aegis RPC network error", { method, error: String(err) });
      throw new Error(`Aegis RPC network error for method ${method}`);
    }

    let data: RpcResponse<T>;
    try {
      data = (await res.json()) as RpcResponse<T>;
    } catch (err) {
      logger.error("Aegis RPC invalid JSON response", { method, status: res.status });
      throw new Error(`Aegis RPC invalid JSON response for method ${method}`);
    }

    if (!data.ok) {
      logger.warn("Aegis RPC returned error", { method, error: data.error });
      const msg = data.error?.message || "Unknown Aegis error";
      throw new Error(`Aegis RPC error for method ${method}: ${msg}`);
    }

    return data.result as T;
  }

  // --------------------
  // Navigation & extract
  // --------------------

  async navigate(url: string): Promise<RemoteTabHandle> {
    return this.rpc<RemoteTabHandle>("aegis.navigate", { url });
  }

  async extract(
    tabId: string,
    selector: string,
    format: "text" | "html" = "text"
  ): Promise<RemoteExtractResult> {
    return this.rpc<RemoteExtractResult>("aegis.extract", {
      tabId,
      selector,
      format,
    });
  }

  // --------------
  // PDF workflows
  // --------------

  async runPdfWorkflow(params: {
    workflowName: string;
    url?: string;
    pdfId?: string;
    formData?: Record<string, unknown>;
  }): Promise<RemotePdfWorkflowResult> {
    return this.rpc<RemotePdfWorkflowResult>("aegis.pdf.workflow", params);
  }

  // ----------------------
  // Spreadsheet enrichment
  // ----------------------

  async enrichSpreadsheet(params: {
    sheetId: string;
    range?: string;
    enrichmentType: string;
    options?: Record<string, unknown>;
  }): Promise<RemoteSheetEnrichmentResult> {
    return this.rpc<RemoteSheetEnrichmentResult>("aegis.sheet.enrich", params);
  }

  // -----------------
  // Monitoring tasks
  // -----------------

  async startMonitoringTask(params: {
    taskName: string;
    targetUrl: string;
    frequency: string; // e.g. "daily", cron, etc.
    config?: Record<string, unknown>;
  }): Promise<RemoteMonitoringTaskResult> {
    return this.rpc<RemoteMonitoringTaskResult>("aegis.monitor.start", params);
  }

  async getMonitoringStatus(taskId: string): Promise<RemoteMonitoringTaskResult> {
    return this.rpc<RemoteMonitoringTaskResult>("aegis.monitor.status", { taskId });
  }

  // ---------------------
  // Sandbox code execution
  // ---------------------

  async runSandboxExecution(params: {
    language: string;
    code: string;
    stdin?: string;
    timeoutSeconds?: number;
  }): Promise<RemoteSandboxExecutionResult> {
    return this.rpc<RemoteSandboxExecutionResult>("aegis.sandbox.execute", params);
  }

  // -------------------
  // Parallel tab tasks
  // -------------------

  async openParallelTabs(urls: string[]): Promise<RemoteParallelTabsResult> {
    return this.rpc<RemoteParallelTabsResult>("aegis.tabs.open_parallel", { urls });
  }

  async runParallelTasks(params: {
    tabs: RemoteTabHandle[];
    taskName: string;
    taskConfig?: Record<string, unknown>;
  }): Promise<RemoteParallelTabsResult> {
    return this.rpc<RemoteParallelTabsResult>("aegis.tabs.run_parallel", params);
  }
}
