import express, { Request, Response } from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';

import { Artifact, CreateMonitorRequest, CreateTaskRequest, ErrorResponse, Monitor, MonitorStatus, Task, TaskResult, TaskStatus } from './aegis_client';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory stores (mock queue and persistence)
const tasks = new Map<string, Task>();
const results = new Map<string, TaskResult>();
const monitors = new Map<string, Monitor>();
const artifacts = new Map<string, Artifact>();

function nowIso(): string {
  return new Date().toISOString();
}

function makeError(code: string, message: string, retriable?: boolean, details?: Record<string, unknown>): ErrorResponse {
  return { code, message, retriable, details };
}

function authMiddleware(req: Request, res: Response, next: () => void): void {
  const authHeader = req.header('authorization');
  const apiKey = req.header('x-api-key');

  if (!authHeader && !apiKey) {
    const err = makeError('AUTH_FAILED', 'Missing Authorization or x-api-key header');
    res.status(401).json(err);
    return;
  }

  // In this mock implementation, any non-empty credential is accepted.
  next();
}

app.use(authMiddleware);

function simulateTask(task: Task): void {
  const taskId = task.id;

  setTimeout(() => {
    const existing = tasks.get(taskId);
    if (!existing || existing.status !== 'queued') return;
    existing.status = 'running';
    existing.updatedAt = nowIso();
    existing.summary = 'Task is running in mock worker.';
    tasks.set(taskId, existing);
  }, 500);

  setTimeout(() => {
    const existing = tasks.get(taskId);
    if (!existing || (existing.status !== 'running' && existing.status !== 'queued')) return;

    existing.status = 'completed';
    existing.updatedAt = nowIso();
    existing.progress = 100;
    existing.summary = 'Task completed successfully (mock).';
    tasks.set(taskId, existing);

    const result: TaskResult = {
      taskId,
      status: 'completed',
      data: {
        message: 'Mock task result payload',
        taskType: existing.taskType,
        targets: existing.targets ?? [],
      },
      logs: [
        {
          timestamp: nowIso(),
          level: 'info',
          message: 'Task started',
        },
        {
          timestamp: nowIso(),
          level: 'info',
          message: 'Task completed (mock)',
        },
      ],
      artifacts: [],
    };

    results.set(taskId, result);
  }, 3000);
}

app.post('/tasks', (req: Request, res: Response) => {
  const body = req.body as CreateTaskRequest;

  if (!body || !body.taskType) {
    const err = makeError('INVALID_REQUEST', 'taskType is required');
    res.status(400).json(err);
    return;
  }

  const id = randomUUID();
  const createdAt = nowIso();
  const task: Task = {
    id,
    taskType: body.taskType,
    status: 'queued',
    executionMode: body.executionMode ?? 'auto',
    instructions: body.instructions,
    targets: body.targets,
    createdAt,
    updatedAt: createdAt,
    progress: 0,
    summary: 'Task queued in mock Aegis server.',
    dslJson: body.dslJson,
    dslText: body.dslText,
    inputData: body.inputData,
    extractionSchema: body.extractionSchema,
    metadata: body.metadata,
    idempotencyKey: body.idempotencyKey,
    options: body.options,
    resultPreview: undefined,
  };

  tasks.set(id, task);
  simulateTask(task);

  res.status(202).json(task);
});

app.get('/tasks/:id', (req: Request, res: Response) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    const err = makeError('TASK_NOT_FOUND', 'Task not found');
    res.status(404).json(err);
    return;
  }

  res.json(task);
});

app.get('/tasks/:id/result', (req: Request, res: Response) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    const err = makeError('TASK_NOT_FOUND', 'Task not found');
    res.status(404).json(err);
    return;
  }

  const result = results.get(req.params.id);
  if (!result) {
    // If not yet available, return a partial shell
    const partial: TaskResult = {
      taskId: task.id,
      status: task.status,
      data: undefined,
      logs: [],
      artifacts: [],
    };
    res.json(partial);
    return;
  }

  res.json(result);
});

app.post('/tasks/:id/cancel', (req: Request, res: Response) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    const err = makeError('TASK_NOT_FOUND', 'Task not found');
    res.status(404).json(err);
    return;
  }

  if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled' || task.status === 'timeout') {
    const err = makeError('TASK_TERMINAL', 'Task is already in a terminal state', false, { status: task.status });
    res.status(409).json(err);
    return;
  }

  task.status = 'cancelled';
  task.updatedAt = nowIso();
  task.summary = 'Task cancelled by client.';
  tasks.set(task.id, task);

  const result: TaskResult = {
    taskId: task.id,
    status: 'cancelled',
    data: undefined,
    logs: [
      {
        timestamp: nowIso(),
        level: 'info',
        message: 'Task cancelled (mock).',
      },
    ],
    artifacts: [],
  };
  results.set(task.id, result);

  res.json(task);
});

app.get('/tasks/:id/events', (req: Request, res: Response) => {
  const taskId = req.params.id;
  const task = tasks.get(taskId);
  if (!task) {
    const err = makeError('TASK_NOT_FOUND', 'Task not found');
    res.status(404).json(err);
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  function sendEvent(event: string, data: unknown): void {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  sendEvent('status', task);

  const interval = setInterval(() => {
    const current = tasks.get(taskId);
    if (!current) {
      sendEvent('error', makeError('TASK_NOT_FOUND', 'Task not found during stream'));
      clearInterval(interval);
      res.end();
      return;
    }

    sendEvent('status', current);

    if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled' || current.status === 'timeout') {
      const result = results.get(taskId);
      if (result) {
        sendEvent('result', result);
      }

      sendEvent('end', { status: current.status });
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

app.post('/monitors', (req: Request, res: Response) => {
  const body = req.body as CreateMonitorRequest;

  if (!body || !body.instructions || !body.intervalMs) {
    const err = makeError('INVALID_REQUEST', 'instructions and intervalMs are required');
    res.status(400).json(err);
    return;
  }

  const id = randomUUID();
  const createdAt = nowIso();
  const monitor: Monitor = {
    id,
    name: body.name,
    taskType: body.taskType ?? 'monitor_run',
    instructions: body.instructions,
    targets: body.targets,
    intervalMs: body.intervalMs,
    executionMode: body.executionMode ?? 'auto',
    options: body.options,
    metadata: body.metadata,
    status: 'active',
    createdAt,
    updatedAt: createdAt,
    lastRunAt: undefined,
    nextRunAt: createdAt,
    lastTaskId: undefined,
  };

  monitors.set(id, monitor);

  res.status(201).json(monitor);
});

app.get('/monitors/:id', (req: Request, res: Response) => {
  const monitor = monitors.get(req.params.id);
  if (!monitor) {
    const err = makeError('MONITOR_NOT_FOUND', 'Monitor not found');
    res.status(404).json(err);
    return;
  }

  res.json(monitor);
});

app.delete('/monitors/:id', (req: Request, res: Response) => {
  const monitor = monitors.get(req.params.id);
  if (!monitor) {
    const err = makeError('MONITOR_NOT_FOUND', 'Monitor not found');
    res.status(404).json(err);
    return;
  }

  monitors.delete(req.params.id);
  res.status(204).send();
});

app.get('/artifacts/:id', (req: Request, res: Response) => {
  const artifact = artifacts.get(req.params.id);
  if (!artifact) {
    const err = makeError('ARTIFACT_NOT_FOUND', 'Artifact not found');
    res.status(404).json(err);
    return;
  }

  res.json(artifact);
});

export function createServer() {
  return app;
}

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Aegis MCP mock server listening on port ${port}`);
  });
}
