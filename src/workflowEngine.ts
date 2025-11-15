import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export type ToolInvoker = (toolName: string, input: any) => Promise<any>;

export interface WorkflowStep {
  id: string;
  type: string;
  tool?: string;
  inputs?: Record<string, any>;
}

export interface WorkflowDefinition {
  id: string;
  steps: WorkflowStep[];
}

/**
 * Very small workflow runner that:
 * - Loads a YAML workflow by ID (expects `<id>.workflow.yaml` in the project root).
 * - Executes `type: tool` steps in order using an injected ToolInvoker.
 * - Performs minimal `{{...}}` interpolation against a context of inputs + prior step outputs.
 *
 * NOTE: This intentionally ignores `type: llm` and `type: composite` steps for now.
 * You can extend it as needed.
 */
export async function runWorkflowById(
  workflowId: string,
  inputs: Record<string, unknown>,
  invokers: { tool: ToolInvoker },
  onStepExecuted?: (step: WorkflowStep, preparedInput: any, result: any) => void
): Promise<Record<string, unknown>> {
  const filePath = path.resolve(
    process.cwd(),
    `${workflowId}.workflow.yaml`
  );

  const fileContents = fs.readFileSync(filePath, "utf8");
  const wf = yaml.load(fileContents) as WorkflowDefinition;

  const context: any = {
    inputs,
    steps: {},
  };

  for (const step of wf.steps || []) {
    if (step.type !== "tool") {
      // TODO: handle `llm` and `composite` step types.
      continue;
    }

    if (!step.tool) {
      throw new Error(`Tool step ${step.id} is missing 'tool' field`);
    }

    const preparedInput = interpolateObject(step.inputs ?? {}, context);
    const result = await invokers.tool(step.tool, preparedInput);

    context.steps[step.id] = {
      outputs: result,
    };

    if (onStepExecuted) {
      onStepExecuted(step, preparedInput, result);
    }
  }

  return context;
}

/**
 * Minimal interpolation: if a string is of the form `"{{path.to.value}}"`,
 * resolve that path against the context (inputs + steps outputs).
 */
function interpolateValue(value: any, context: any): any {
  if (typeof value !== "string") return value;

  const match = value.match(/^\{\{(.+)\}\}$/);
  if (!match) return value;

  const pathExpr = match[1].trim();
  const segments = pathExpr.split(".");
  let current: any = context;

  for (const seg of segments) {
    if (seg === "") continue;
    if (current == null) return undefined;
    current = current[seg];
  }

  return current;
}

function interpolateObject(obj: any, context: any): any {
  if (Array.isArray(obj)) {
    return obj.map((v) => interpolateObject(v, context));
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = interpolateObject(v, context);
    }
    return out;
  }
  return interpolateValue(obj, context);
}
