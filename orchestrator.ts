import { AegisRemoteAutomation, NormalizedAutomationResult } from './AegisRemoteAutomation';
import { CreateTaskRequest } from './aegis_client';
import { DSLCommand, dslToPlaywrightOperations, validateDslJson, parseDslText } from './dsl';

export interface PlaywrightBackendOptions {
  headless?: boolean;
  timeoutMs?: number;
}

export interface PlaywrightBackend {
  runDsl(commands: DSLCommand[], request: CreateTaskRequest, options?: PlaywrightBackendOptions): Promise<NormalizedAutomationResult>;
}

export interface OrchestratorOptions {
  useAegisEnvVarName?: string;
}

export class Orchestrator {
  private readonly aegis: AegisRemoteAutomation;
  private readonly playwright: PlaywrightBackend;
  private readonly useAegisEnvVarName: string;

  constructor(aegis: AegisRemoteAutomation, playwright: PlaywrightBackend, options?: OrchestratorOptions) {
    this.aegis = aegis;
    this.playwright = playwright;
    this.useAegisEnvVarName = options?.useAegisEnvVarName ?? 'USE_AEGIS';
  }

  private shouldPreferAegis(request: CreateTaskRequest): boolean {
    const env = (process.env[this.useAegisEnvVarName] || '').toLowerCase();
    const explicitMode = request.executionMode;

    if (env === 'false' || env === '0') {
      if (explicitMode === 'complex') return true;
      return false;
    }

    if (env === 'true' || env === '1') {
      if (explicitMode === 'simple') return false;
      return true;
    }

    if (explicitMode === 'simple') return false;
    if (explicitMode === 'complex') return true;

    const stepCount = Array.isArray(request.dslJson) ? request.dslJson.length : 0;
    const targetCount = request.targets?.length ?? 0;
    const instructionLength = request.instructions?.length ?? 0;

    if (stepCount > 5 || targetCount > 3 || instructionLength > 500) {
      return true;
    }

    return false;
  }

  private ensureDslCommands(request: CreateTaskRequest): DSLCommand[] | undefined {
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

  async run(request: CreateTaskRequest): Promise<NormalizedAutomationResult> {
    const preferAegis = this.shouldPreferAegis(request);
    const commands = this.ensureDslCommands(request);

    if (!commands) {
      if (preferAegis) {
        const remote = await this.aegis.runTask(request);
        if (remote.status === 'failed' || remote.status === 'timeout') {
          return remote;
        }
        return remote;
      }
      return this.aegis.runTask(request);
    }

    if (preferAegis) {
      const remote = await this.aegis.runTask(request);
      if (remote.status === 'failed' || remote.status === 'timeout') {
        const local = await this.playwright.runDsl(commands, request, {});
        return local;
      }
      return remote;
    }

    try {
      const local = await this.playwright.runDsl(commands, request, {});
      if (local.status === 'failed' || local.status === 'timeout') {
        const remote = await this.aegis.runTask(request);
        return remote;
      }
      return local;
    } catch (err) {
      const remote = await this.aegis.runTask(request);
      return remote;
    }
  }
}
