import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type MonitorStatus = 'active' | 'paused' | 'stopped';
export type ExecutionMode = 'simple' | 'complex' | 'auto';

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retriable?: boolean;
}

export interface Artifact {
  id: string;
  type: string;
  url: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface TaskOptions {
  maxDurationMs?: number;
  maxActions?: number;
  parallelism?: number;
  maxConcurrentTabs?: number;
  priority?: string;
  callbackUrl?: string;
  llmProvider?: string;
  llmModel?: string;
  llmKeyRef?: string;
}

export interface CreateTaskRequest {
  taskType: string;
  instructions?: string;
  targets?: string[];
  executionMode?: ExecutionMode;
  dslJson?: Array<Record<string, unknown>>;
  dslText?: string;
  inputData?: Record<string, unknown>;
  extractionSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  options?: TaskOptions;
}

export interface Task extends CreateTaskRequest {
  id: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  progress?: number;
  summary?: string;
  error?: ErrorResponse;
  resultPreview?: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  data?: Record<string, unknown>;
  logs?: LogEntry[];
  artifacts?: Artifact[];
  error?: ErrorResponse;
}

export interface CreateMonitorRequest {
  name?: string;
  taskType?: string;
  instructions: string;
  targets?: string[];
  intervalMs: number;
  executionMode?: ExecutionMode;
  options?: TaskOptions;
  metadata?: Record<string, unknown>;
}

export interface Monitor extends CreateMonitorRequest {
  id: string;
  status: MonitorStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastTaskId?: string;
}

export interface AegisClientConfig {
  baseURL: string;
  apiKey?: string;
  bearerToken?: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

export class AegisClient {
  private axios: AxiosInstance;
  private readonly retryDefaults: RetryOptions;
  private readonly apiKey?: string;
  private readonly bearerToken?: string;

  constructor(config: AegisClientConfig) {
    this.apiKey = config.apiKey;
    this.bearerToken = config.bearerToken;
    this.retryDefaults = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: 500,
    };

    this.axios = axios.create({
      baseURL: config.baseURL,
      timeout: config.requestTimeoutMs ?? 30000,
    });

    this.axios.interceptors.request.use((cfg) => {
      cfg.headers = cfg.headers ?? {};
      if (this.bearerToken) {
        (cfg.headers as Record<string, unknown>)['Authorization'] = `Bearer ${this.bearerToken}`;
      } else if (this.apiKey) {
        (cfg.headers as Record<string, unknown>)['x-api-key'] = this.apiKey;
      }
      return cfg;
    });
  }

  getBaseURL(): string | undefined {
    return this.axios.defaults.baseURL;
  }

  private isRetriableError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;

    const err = error as AxiosError<ErrorResponse>;
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
      return true;
    }

    const status = err.response?.status;
    if (!status) {
      // Network-level error
      return true;
    }

    if (status >= 500 && status <= 599) {
      return true;
    }

    // Optionally treat 429 as retriable later
    if (status === 429) {
      return true;
    }

    return false;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(config: AxiosRequestConfig, retryOverrides?: Partial<RetryOptions>): Promise<T> {
    const retryConfig: RetryOptions = {
      ...this.retryDefaults,
      ...(retryOverrides ?? {}),
    };

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retryConfig.maxRetries) {
      try {
        const response = await this.axios.request<T>(config);
        return response.data;
      } catch (err) {
        lastError = err;
        attempt += 1;
        if (attempt > retryConfig.maxRetries || !this.isRetriableError(err)) {
          throw err;
        }

        const jitter = Math.random() * 100;
        const backoff = retryConfig.baseDelayMs * Math.pow(2, attempt - 1) + jitter;
        await this.delay(backoff);
      }
    }

    throw lastError;
  }

  async createTask(request: CreateTaskRequest): Promise<Task> {
    return this.request<Task>({
      method: 'POST',
      url: '/tasks',
      data: request,
    });
  }

  async getTask(taskId: string): Promise<Task> {
    return this.request<Task>({
      method: 'GET',
      url: `/tasks/${encodeURIComponent(taskId)}`,
    });
  }

  async getTaskResult(taskId: string): Promise<TaskResult> {
    return this.request<TaskResult>({
      method: 'GET',
      url: `/tasks/${encodeURIComponent(taskId)}/result`,
    });
  }

  async cancelTask(taskId: string): Promise<Task> {
    return this.request<Task>({
      method: 'POST',
      url: `/tasks/${encodeURIComponent(taskId)}/cancel`,
    });
  }

  async createMonitor(request: CreateMonitorRequest): Promise<Monitor> {
    return this.request<Monitor>({
      method: 'POST',
      url: '/monitors',
      data: request,
    });
  }

  async getMonitor(monitorId: string): Promise<Monitor> {
    return this.request<Monitor>({
      method: 'GET',
      url: `/monitors/${encodeURIComponent(monitorId)}`,
    });
  }

  async deleteMonitor(monitorId: string): Promise<void> {
    await this.request<void>({
      method: 'DELETE',
      url: `/monitors/${encodeURIComponent(monitorId)}`,
    });
  }

  async getArtifact(artifactId: string): Promise<Artifact> {
    return this.request<Artifact>({
      method: 'GET',
      url: `/artifacts/${encodeURIComponent(artifactId)}`,
    });
  }
}
