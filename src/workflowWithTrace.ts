import { runWorkflowById, ToolInvoker, WorkflowStep } from "./workflowEngine.js";
import {
  ExecutionTrace,
  ExecutionStepTrace,
} from "./proceduralMemory.js";

/**
 * Run a YAML workflow and capture an ExecutionTrace that can be used by the
 * Procedural Memory system.
 */
export async function runWorkflowWithTrace(
  workflowId: string,
  inputs: Record<string, unknown>,
  userId: string,
  taskKey: string,
  toolInvoker: ToolInvoker
): Promise<{ context: Record<string, unknown>; trace: ExecutionTrace }> {
  const startedAt = new Date().toISOString();

  const trace: ExecutionTrace = {
    taskKey,
    userId,
    workflowId,
    startedAt,
    steps: [],
  };

  const onStepExecuted = (
    step: WorkflowStep,
    preparedInput: any,
    result: any
  ) => {
    const stepTrace: ExecutionStepTrace = {
      stepId: step.id,
      tool: step.tool,
      inputs: preparedInput,
      outputs: result,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
    trace.steps.push(stepTrace);
  };

  const context = await runWorkflowById(
    workflowId,
    inputs,
    { tool: toolInvoker },
    onStepExecuted
  );

  trace.finishedAt = new Date().toISOString();
  return { context, trace };
}
