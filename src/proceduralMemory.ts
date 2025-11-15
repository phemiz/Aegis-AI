import { MemoryCore } from "./memoryCore.js";

/**
 * Procedural Memory data model
 * -----------------------------
 *
 * A ProcedureRecord stores the evolving "best known" procedure for a given taskKey
 * (e.g. "market_research.remote_pm_saas" or a workflow id) for a specific user.
 *
 * Each record is versioned; new versions are appended when the user teaches or
 * corrects the workflow. The orchestrator can then:
 *   - loadProcedure(...) on run
 *   - decide whether to use the learned version or a default
 *   - update via addVersionFromExecution(...) after user corrections
 */

export type TaskScope = "user" | "project" | "global";

export interface ProcedureStepTemplate {
  /** Logical step identifier (e.g. workflow step id) */
  stepId: string;
  /** Underlying tool name, when applicable (e.g. "web.navigate") */
  tool: string;
  /** Optional human description for UI */
  description?: string;
  /**
   * Template for inputs.
   *
   * This can be literal values or parameterized shapes
   * (e.g. { url: "{{inputs.targetUrl}}" }).
   */
  inputsTemplate: Record<string, unknown>;
}

export interface ProcedureVersion {
  version: number;
  createdAt: string;
  createdBy: string; // userId
  source: "taught" | "corrected" | "imported";
  steps: ProcedureStepTemplate[];
}

export interface ProcedureRecord {
  taskKey: string;
  userId: string;
  scope: TaskScope;
  activeVersion: number;
  versions: ProcedureVersion[];
}

// -----------------------
// Execution trace model
// -----------------------

export interface ExecutionStepTrace {
  stepId: string;
  tool?: string;
  /** Raw inputs passed at runtime */
  inputs: any;
  /** Raw outputs returned at runtime */
  outputs: any;
  startedAt?: string;
  finishedAt?: string;
}

export interface ExecutionTrace {
  taskKey: string;
  userId: string;
  workflowId?: string;
  startedAt: string;
  finishedAt?: string;
  steps: ExecutionStepTrace[];
}

// -----------------------
// Correction patch model
// -----------------------

export type StepChangeType = "modified" | "added" | "removed";

export interface StepChange {
  stepId: string;
  changeType: StepChangeType;
  before?: ExecutionStepTrace;
  after?: ExecutionStepTrace;
}

export interface CorrectionPatch {
  taskKey: string;
  userId: string;
  changes: StepChange[];
}

export const PROCEDURE_MEMORY_TYPE = "procedural_workflow";

function buildMemoryKey(taskKey: string, scope: TaskScope, userId: string): string {
  // For now we scope everything under the user; project/global scopes can be
  // layered on later by using different userId / tenant keys.
  switch (scope) {
    case "user":
      return `procedural.${userId}.${taskKey}`;
    case "project":
      return `procedural.project.${taskKey}`;
    case "global":
      return `procedural.global.${taskKey}`;
  }
}

// -----------------------
// Procedure persistence
// -----------------------

export async function loadProcedure(
  memory: MemoryCore,
  userId: string,
  taskKey: string,
  scope: TaskScope = "user"
): Promise<ProcedureRecord | null> {
  const key = buildMemoryKey(taskKey, scope, userId);
  const item = await memory.getItem(userId, key);
  if (!item) return null;

  // Best-effort runtime validation; rely on TypeScript on write paths.
  const data = item.data as any;
  if (!data || typeof data !== "object" || !Array.isArray(data.versions)) {
    return null;
  }
  return data as ProcedureRecord;
}

export async function saveProcedure(
  memory: MemoryCore,
  record: ProcedureRecord
): Promise<void> {
  const key = buildMemoryKey(record.taskKey, record.scope, record.userId);
  const now = new Date().toISOString();

  await memory.writeItem(record.userId, {
    key,
    type: PROCEDURE_MEMORY_TYPE,
    data: record,
    createdAt: now,
    tags: ["procedural", "workflow"],
  });
}

// -----------------------
// Building procedures from traces
// -----------------------

/**
 * Convert an execution trace into an initial ProcedureRecord.
 *
 * This is useful when the user teaches Aegis a new task for the first time.
 */
export function buildProcedureFromExecution(
  trace: ExecutionTrace,
  createdBy: string,
  scope: TaskScope = "user"
): ProcedureRecord {
  const steps: ProcedureStepTemplate[] = trace.steps.map((s) => ({
    stepId: s.stepId,
    tool: s.tool ?? "",
    inputsTemplate: s.inputs ?? {},
  }));

  const version: ProcedureVersion = {
    version: 1,
    createdAt: new Date().toISOString(),
    createdBy,
    source: "taught",
    steps,
  };

  return {
    taskKey: trace.taskKey,
    userId: trace.userId,
    scope,
    activeVersion: 1,
    versions: [version],
  };
}

/**
 * Append a new version to an existing ProcedureRecord based on a corrected
 * execution trace (e.g. after the user manually adjusted steps).
 */
export function addVersionFromExecution(
  existing: ProcedureRecord,
  trace: ExecutionTrace,
  createdBy: string,
  source: "corrected" | "taught" | "imported" = "corrected"
): ProcedureRecord {
  const nextVersion = existing.activeVersion + 1;
  const steps: ProcedureStepTemplate[] = trace.steps.map((s) => ({
    stepId: s.stepId,
    tool: s.tool ?? "",
    inputsTemplate: s.inputs ?? {},
  }));

  const newVersion: ProcedureVersion = {
    version: nextVersion,
    createdAt: new Date().toISOString(),
    createdBy,
    source,
    steps,
  };

  return {
    ...existing,
    activeVersion: nextVersion,
    versions: [...existing.versions, newVersion],
  };
}

// -----------------------
// Patch computation & UX helpers
// -----------------------

/**
 * Naive diff between agent_trace and user_corrected_trace.
 *
 * - If a stepId exists in agent but not in user: "removed".
 * - If a stepId exists in user but not in agent: "added".
 * - If present in both but inputs differ (JSON-wise): "modified".
 */
export function computeCorrectionPatch(
  agentTrace: ExecutionTrace,
  userTrace: ExecutionTrace
): CorrectionPatch {
  const agentById = new Map<string, ExecutionStepTrace>();
  for (const s of agentTrace.steps) {
    agentById.set(s.stepId, s);
  }

  const userById = new Map<string, ExecutionStepTrace>();
  for (const s of userTrace.steps) {
    userById.set(s.stepId, s);
  }

  const changes: StepChange[] = [];

  // Removed or modified steps
  for (const [stepId, before] of agentById.entries()) {
    const after = userById.get(stepId);
    if (!after) {
      changes.push({ stepId, changeType: "removed", before });
      continue;
    }

    const beforeInputs = JSON.stringify(before.inputs ?? {});
    const afterInputs = JSON.stringify(after.inputs ?? {});
    if (beforeInputs !== afterInputs) {
      changes.push({ stepId, changeType: "modified", before, after });
    }
  }

  // Added steps
  for (const [stepId, after] of userById.entries()) {
    if (!agentById.has(stepId)) {
      changes.push({ stepId, changeType: "added", after });
    }
  }

  return {
    taskKey: agentTrace.taskKey,
    userId: userTrace.userId,
    changes,
  };
}

export function patchIsMeaningful(patch: CorrectionPatch): boolean {
  return patch.changes.length > 0;
}

/**
 * Build a short natural-language summary of changes for prompting the user.
 * The actual confirmation UI/prompt is handled by your orchestrator/LLM.
 */
export function buildUpdateSummary(
  patch: CorrectionPatch,
  taskLabel?: string
): string {
  const parts: string[] = [];
  const label = taskLabel ?? patch.taskKey;

  const added = patch.changes.filter((c) => c.changeType === "added").length;
  const removed = patch.changes.filter((c) => c.changeType === "removed").length;
  const modified = patch.changes.filter((c) => c.changeType === "modified").length;

  if (added) parts.push(`${added} step(s) added`);
  if (removed) parts.push(`${removed} step(s) removed`);
  if (modified) parts.push(`${modified} step(s) modified`);

  const summary = parts.length > 0 ? parts.join(", ") : "no changes";

  return `Detected ${summary} in the procedure for task '${label}'.`;
}

/**
 * Helper used by the orchestrator after the user confirms they want to learn
 * from corrections:
 *
 *   1. Tries to load an existing procedure for (taskKey, userId).
 *   2. Creates or appends a version from the corrected execution trace.
 *   3. Persists the updated record in the memory core.
 */
export async function upsertProcedureFromCorrection(
  memory: MemoryCore,
  correctedTrace: ExecutionTrace,
  scope: TaskScope = "user"
): Promise<ProcedureRecord> {
  const existing = await loadProcedure(
    memory,
    correctedTrace.userId,
    correctedTrace.taskKey,
    scope
  );

  if (!existing) {
    const created = buildProcedureFromExecution(
      correctedTrace,
      correctedTrace.userId,
      scope
    );
    await saveProcedure(memory, created);
    return created;
  }

  const updated = addVersionFromExecution(
    existing,
    correctedTrace,
    correctedTrace.userId,
    "corrected"
  );
  await saveProcedure(memory, updated);
  return updated;
}
