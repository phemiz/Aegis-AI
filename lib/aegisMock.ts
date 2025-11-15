import { randomUUID } from 'crypto';

export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';

export interface Task {
  id: string;
  taskType: string;
  status: TaskStatus;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
  summary?: string;
}

const tasks = new Map<string, Task>();

function nowIso(): string {
  return new Date().toISOString();
}

export function createMockTask(input: { taskType: string; instructions?: string }): Task {
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
  };

  tasks.set(id, task);

  setTimeout(() => {
    const t = tasks.get(id);
    if (!t || t.status !== 'queued') return;
    t.status = 'running';
    t.updatedAt = nowIso();
    t.summary = 'Task is running in mock worker.';
    tasks.set(id, t);
  }, 500);

  setTimeout(() => {
    const t = tasks.get(id);
    if (!t || (t.status !== 'running' && t.status !== 'queued')) return;
    t.status = 'completed';
    t.updatedAt = nowIso();
    t.summary = 'Task completed successfully (mock).';
    tasks.set(id, t);
  }, 3000);

  return task;
}

export function getTask(id: string): Task | undefined {
  return tasks.get(id);
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
  tasks.set(id, t);
  return t;
}
