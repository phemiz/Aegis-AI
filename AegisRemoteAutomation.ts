import { AegisClient, Artifact, CreateTaskRequest, ErrorResponse, Task, TaskResult } from './aegis_client';
import { validateDslJson, parseDslText, DSLCommand } from './dsl';

export type NormalizedStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface NormalizedError {
  code: string;
  message: string;
  retriable?: boolean;
  details?: Record<string, unknown>;
}

export interface NormalizedAutomationResult<TData = unknown> {
  status: NormalizedStatus;
  output?: TData;
  artifacts?: Artifact[];
  debug?: {
    task?: Task;
    result?: TaskResult;
    logs?: TaskResult['logs'];
    attempts: number;
  };
  error?: NormalizedError;
}

export interface RunTaskOptions {
  useStreaming?: boolean;
  pollingIntervalMs?: number;
  workflowTimeoutMs?: number;
  maxLogicalRetries?: number;
  complexityHint?: 'simple' | 'complex';
  onEvent?: (event: { type: string; data: unknown }) => void;
}

export interface AegisRemoteAutomationOptions {
  defaultPollingIntervalMs?: number;
  defaultWorkflowTimeoutMsSimple?: number;
  defaultWorkflowTimeoutMsComplex?: number;
  maxLogicalRetries?: number;
}

export class AegisRemoteAutomation {
  private readonly client: AegisClient;
  private readonly defaultPollingIntervalMs: number;
  private readonly defaultWorkflowTimeoutMsSimple: number;
  private readonly defaultWorkflowTimeoutMsComplex: number;
  private readonly maxLogicalRetries: number;

  constructor(client: AegisClient, options?: AegisRemoteAutomationOptions) {
    this.client = client;
    this.defaultPollingIntervalMs = options?.defaultPollingIntervalMs ?? 1500;
    this.defaultWorkflowTimeoutMsSimple = options?.defaultWorkflowTimeoutMsSimple ?? 5 * 60_000;
    this.defaultWorkflowTimeoutMsComplex = options?.defaultWorkflowTimeoutMsComplex ?? 10 * 60_000;
    this.maxLogicalRetries = options?.maxLogicalRetries ?? 3;
  }

  private inferComplexity(request: CreateTaskRequest): 'simple' | 'complex' {
    if (request.executionMode === 'simple') return 'simple';
    if (request.executionMode === 'complex') return 'complex';

    const stepCount = Array.isArray(request.dslJson) ? request.dslJson.length : 0;
    const targetCount = request.targets?.length ?? 0;
    const instructionLength = request.instructions?.length ?? 0;

    if (stepCount > 5 || targetCount > 3 || instructionLength > 500) {
      return 'complex';
    }

    return 'simple';
  }

  private normalizeError(error: ErrorResponse | undefined, fallback: unknown): NormalizedError {
    if (error) {
      return {
        code: error.code,
        message: error.message,
        retriable: error.retriable,
        details: error.details,
      };
    }

    const message = fallback instanceof Error ? fallback.message : 'Unknown error';
    return { code: 'UNKNOWN', message };
  }

  private normalizeResult<TData = unknown>(task: Task, result?: TaskResult, attempts = 1): NormalizedAutomationResult<TData> {
    const status = result?.status ?? task.status;
    const error = result?.error ?? task.error;

    return {
      status,
      output: (result?.data as TData | undefined),
      artifacts: result?.artifacts,
      debug: {
        task,
        result,
        logs: result?.logs,
        attempts,
      },
      error: error ? this.normalizeError(error, undefined) : undefined,
    };
  }

  private ensureValidDsl(request: CreateTaskRequest): DSLCommand[] | undefined {
    if (request.dslJson) {
      return validateDslJson(request.dslJson);
    }

    if (request.dslText) {
      const commands = parseDslText(request.dslText);
      request.dslJson = commands as unknown as Array<Record<string, unknown>>;
      return commands;
    }

    return undefined;
  }

  private async pollUntilDone(taskId: string, timeoutMs: number, pollingIntervalMs: number, onEvent?: (event: { type: string; data: unknown }) => void): Promise<{ task: Task; result?: TaskResult }> {
    const start = Date.now();

    while (true) {
      if (Date.now() - start > timeoutMs) {
        throw new Error('TASK_TIMEOUT');
      }

      const task = await this.client.getTask(taskId);
      onEvent?.({ type: 'status', data: task });

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled' || task.status === 'timeout') {
        const result = await this.client.getTaskResult(taskId);
        onEvent?.({ type: 'result', data: result });
        return { task, result };
      }

      await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
    }
  }

  async runTask<TData = unknown>(request: CreateTaskRequest, options?: RunTaskOptions): Promise<NormalizedAutomationResult<TData>> {
    const attempts = this.maxLogicalRetries;
    let lastError: unknown;

    // Validate or compile DSL if present
    try {
      this.ensureValidDsl(request);
    } catch (err) {
      return {
        status: 'failed',
        error: {
          code: 'INVALID_DSL',
          message: err instanceof Error ? err.message : 'Invalid DSL',
          retriable: false,
        },
      };
    }

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const complexity = options?.complexityHint ?? this.inferComplexity(request);
        const timeoutMs = options?.workflowTimeoutMs ?? (complexity === 'complex' ? this.defaultWorkflowTimeoutMsComplex : this.defaultWorkflowTimeoutMsSimple);
        const pollingIntervalMs = options?.pollingIntervalMs ?? this.defaultPollingIntervalMs;

        // Ensure maxDurationMs is set for the server as a guardrail
        request.options = request.options ?? {};
        if (!request.options.maxDurationMs) {
          request.options.maxDurationMs = timeoutMs;
        }

        const task = await this.client.createTask(request);
        const { task: finalTask, result } = await this.pollUntilDone(task.id, timeoutMs, pollingIntervalMs, options?.onEvent);

        if (finalTask.status === 'failed' && result?.error?.retriable && attempt < attempts) {
          lastError = result.error;
          continue;
        }

        return this.normalizeResult<TData>(finalTask, result, attempt);
      } catch (err) {
        lastError = err;

        // If we hit a workflow-level timeout, classify and stop
        if (err instanceof Error && err.message === 'TASK_TIMEOUT') {
          return {
            status: 'timeout',
            error: {
              code: 'TIMEOUT',
              message: 'Workflow exceeded configured timeout',
              retriable: false,
            },
          };
        }

        // Unknown or non-retriable error at this layer; do not blindly retry beyond attempts
        if (attempt >= attempts) {
          const normalizedError: NormalizedError = {
            code: 'CLIENT_OR_TASK_ERROR',
            message: err instanceof Error ? err.message : 'Task failed with an unknown error',
            retriable: false,
          };
          return { status: 'failed', error: normalizedError, debug: { attempts } };
        }
      }
    }

    // Fallback if loop exits unexpectedly
    return {
      status: 'failed',
      error: {
        code: 'UNKNOWN',
        message: lastError instanceof Error ? lastError.message : 'Unknown failure after retries',
      },
    };
  }
}
