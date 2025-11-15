import { randomUUID } from 'crypto';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
export type MonitorStatus = 'active' | 'paused' | 'stopped';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
}

export interface Artifact {
  id: string;
  type: string;
  url: string;
  contentType?: string;
}

export interface Task {
  id: string;
  taskType: string;
  status: TaskStatus;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
  progress?: number;
  logs?: LogEntry[];
  artifacts?: Artifact[];
  error?: { code: string; message: string };
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  data?: Record<string, unknown>;
  logs: LogEntry[];
  artifacts: Artifact[];
  error?: { code: string; message: string };
}

export interface Monitor {
  id: string;
  name: string;
  taskType: string;
  instructions: string;
  intervalMs: number;
  status: MonitorStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastTaskId?: string;
}

const tasks = new Map<string, Task>();
const taskResults = new Map<string, TaskResult>();
const monitors = new Map<string, Monitor>();

function nowIso(): string {
  return new Date().toISOString();
}

function mockLogs(taskId: string, status: TaskStatus): LogEntry[] {
  const logs: LogEntry[] = [
    { timestamp: nowIso(), level: 'info', message: `Task ${taskId} created` },
    { timestamp: nowIso(), level: 'info', message: 'Initializing mock worker' },
  ];
  if (status === 'running' || status === 'completed' || status === 'failed') {
    logs.push({ timestamp: nowIso(), level: 'info', message: 'Task started execution' });
  }
  if (status === 'completed') {
    logs.push({ timestamp: nowIso(), level: 'info', message: 'Task completed successfully' });
  }
  if (status === 'failed') {
    logs.push({ timestamp: nowIso(), level: 'error', message: 'Task failed due to mock error' });
  }
  return logs;
}

function mockArtifacts(taskId: string): Artifact[] {
  return [
    {
      id: randomUUID(),
      type: 'screenshot',
      url: `https://mock-cdn.example.com/screenshots/${taskId}.png`,
      contentType: 'image/png',
    },
    {
      id: randomUUID(),
      type: 'json',
      url: `https://mock-cdn.example.com/results/${taskId}.json`,
      contentType: 'application/json',
    },
  ];
}

export function createMockTask(input: { taskType: string; instructions?: string; simulateFailure?: boolean }): Task {
  const id = randomUUID();
  const createdAt = nowIso();
  const task: Task = {
    id,
    taskType: input.taskType,
    status: 'queued',
    instructions: input.instructions,
    createdAt,
    updatedAt: createdAt,
    summary: 'Task queued (mock).',
    progress: 0,
    logs: mockLogs(id, 'queued'),
  };

  tasks.set(id, task);

  const shouldFail = input.simulateFailure ?? Math.random() < 0.1;

  setTimeout(() => {
    const t = tasks.get(id);
    if (!t || t.status !== 'queued') return;
    t.status = 'running';
    t.updatedAt = nowIso();
    t.progress = 30;
    t.summary = 'Task is running in mock worker.';
    t.logs = mockLogs(id, 'running');
    tasks.set(id, t);
  }, 500);

  setTimeout(() => {
    const t = tasks.get(id);
    if (!t || (t.status !== 'running' && t.status !== 'queued')) return;

    if (shouldFail) {
      t.status = 'failed';
      t.progress = 60;
      t.summary = 'Task failed (mock error scenario).';
      t.error = { code: 'MOCK_ERROR', message: 'Simulated failure for testing' };
      t.logs = mockLogs(id, 'failed');
      tasks.set(id, t);

      taskResults.set(id, {
        taskId: id,
        status: 'failed',
        logs: t.logs,
        artifacts: [],
        error: t.error,
      });
    } else {
      t.status = 'completed';
      t.progress = 100;
      t.updatedAt = nowIso();
      t.summary = 'Task completed successfully (mock).';
      t.logs = mockLogs(id, 'completed');
      t.artifacts = mockArtifacts(id);
      tasks.set(id, t);

      taskResults.set(id, {
        taskId: id,
        status: 'completed',
        data: {
          result: 'Mock task execution result',
          extractedData: { example: 'value' },
        },
        logs: t.logs,
        artifacts: t.artifacts,
      });
    }
  }, 3000);

  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

export function listTasks(): Task[] {
  return Array.from(tasks.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getTaskResult(id: string): TaskResult | undefined {
  return taskResults.get(id);
}

export function cancelTask(id: string): Task | undefined {
  const t = tasks.get(id);
  if (!t) return undefined;
  if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled' || t.status === 'timeout') {
    return t;
  }
  t.status = 'cancelled';
  t.updatedAt = nowIso();
  t.summary = 'Task cancelled by client (mock).';
  t.logs = [...(t.logs || []), { timestamp: nowIso(), level: 'warn', message: 'Task cancelled by user' }];
  tasks.set(id, t);

  taskResults.set(id, {
    taskId: id,
    status: 'cancelled',
    logs: t.logs || [],
    artifacts: [],
  });

  return t;
}

export function createMonitor(input: {
  name: string;
  taskType: string;
  instructions: string;
  intervalMs: number;
}): Monitor {
  const id = randomUUID();
  const createdAt = nowIso();
  const monitor: Monitor = {
    id,
    name: input.name,
    taskType: input.taskType,
    instructions: input.instructions,
    intervalMs: input.intervalMs,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    nextRunAt: new Date(Date.now() + input.intervalMs).toISOString(),
  };
  monitors.set(id, monitor);
  return monitor;
}

export function getMonitor(id: string): Monitor | undefined {
  return monitors.get(id);
}

export function listMonitors(): Monitor[] {
  return Array.from(monitors.values());
}

export function deleteMonitor(id: string): boolean {
  return monitors.delete(id);
}
