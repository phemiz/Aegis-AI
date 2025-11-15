export type DSLCommandType = 'goto' | 'click' | 'fill' | 'waitForSelector' | 'waitForNavigation' | 'extract';

export interface GotoArgs {
  url: string;
}

export interface ClickArgs {
  selector: string;
}

export interface FillArgs {
  selector: string;
  value: string;
}

export interface WaitForSelectorArgs {
  selector: string;
  timeoutMs?: number;
}

export interface WaitForNavigationArgs {
  timeoutMs?: number;
}

export interface ExtractArgs {
  selector: string;
  as: string;
  multiple?: boolean;
}

export type DSLArgs = GotoArgs | ClickArgs | FillArgs | WaitForSelectorArgs | WaitForNavigationArgs | ExtractArgs;

export interface DSLCommand {
  type: DSLCommandType;
  args: DSLArgs;
}

export interface PlaywrightOperation {
  action: string;
  args: Record<string, unknown>;
}

export function validateDslJson(dsl: unknown): DSLCommand[] {
  if (!Array.isArray(dsl)) {
    throw new Error('DSL must be an array of commands');
  }

  const commands: DSLCommand[] = dsl.map((raw, index) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`DSL command at index ${index} must be an object`);
    }

    const { type, args } = raw as { type?: string; args?: unknown };

    if (!type || typeof type !== 'string') {
      throw new Error(`DSL command at index ${index} is missing a valid type`);
    }

    if (!args || typeof args !== 'object') {
      throw new Error(`DSL command at index ${index} is missing args`);
    }

    const cmd: DSLCommand = { type: type as DSLCommandType, args: args as DSLArgs };

    switch (cmd.type) {
      case 'goto': {
        const { url } = cmd.args as GotoArgs;
        if (!url || typeof url !== 'string') {
          throw new Error(`goto command at index ${index} requires a url`);
        }
        break;
      }
      case 'click': {
        const { selector } = cmd.args as ClickArgs;
        if (!selector) {
          throw new Error(`click command at index ${index} requires a selector`);
        }
        break;
      }
      case 'fill': {
        const { selector, value } = cmd.args as FillArgs;
        if (!selector || typeof value !== 'string') {
          throw new Error(`fill command at index ${index} requires selector and value`);
        }
        break;
      }
      case 'waitForSelector': {
        const { selector } = cmd.args as WaitForSelectorArgs;
        if (!selector) {
          throw new Error(`waitForSelector command at index ${index} requires selector`);
        }
        break;
      }
      case 'waitForNavigation': {
        break;
      }
      case 'extract': {
        const { selector, as } = cmd.args as ExtractArgs;
        if (!selector || !as) {
          throw new Error(`extract command at index ${index} requires selector and as`);
        }
        break;
      }
      default:
        throw new Error(`Unknown DSL command type at index ${index}: ${type}`);
    }

    return cmd;
  });

  return commands;
}

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export function parseDslText(text: string): DSLCommand[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const commands: DSLCommand[] = [];

  lines.forEach((line, index) => {
    const tokens = tokenize(line);
    if (tokens.length === 0) return;

    const [rawType, ...rest] = tokens;
    const type = rawType.toLowerCase();

    switch (type) {
      case 'goto': {
        const url = rest[0];
        if (!url) throw new Error(`Line ${index + 1}: goto requires a URL`);
        commands.push({ type: 'goto', args: { url } });
        break;
      }
      case 'click': {
        const selector = rest[0];
        if (!selector) throw new Error(`Line ${index + 1}: click requires a selector`);
        commands.push({ type: 'click', args: { selector } });
        break;
      }
      case 'fill': {
        const selector = rest[0];
        const value = rest.slice(1).join(' ');
        if (!selector || !value) throw new Error(`Line ${index + 1}: fill requires selector and value`);
        commands.push({ type: 'fill', args: { selector, value } });
        break;
      }
      case 'wait_for_selector':
      case 'waitforselector': {
        const selector = rest[0];
        const timeoutMs = rest[1] ? Number(rest[1]) : undefined;
        if (!selector) throw new Error(`Line ${index + 1}: waitForSelector requires a selector`);
        commands.push({ type: 'waitForSelector', args: { selector, timeoutMs } });
        break;
      }
      case 'wait_for_navigation':
      case 'waitfornavigation': {
        const timeoutMs = rest[0] ? Number(rest[0]) : undefined;
        commands.push({ type: 'waitForNavigation', args: { timeoutMs } });
        break;
      }
      case 'extract': {
        const selector = rest[0];
        const as = rest[1];
        const multiple = rest[2] === 'multiple';
        if (!selector || !as) throw new Error(`Line ${index + 1}: extract requires selector and as`);
        commands.push({ type: 'extract', args: { selector, as, multiple } });
        break;
      }
      default:
        throw new Error(`Line ${index + 1}: unknown command type ${rawType}`);
    }
  });

  return commands;
}

export function dslToPlaywrightOperations(dsl: DSLCommand[]): PlaywrightOperation[] {
  return dsl.map((cmd) => {
    switch (cmd.type) {
      case 'goto':
        return { action: 'goto', args: cmd.args as Record<string, unknown> };
      case 'click':
        return { action: 'click', args: cmd.args as Record<string, unknown> };
      case 'fill':
        return { action: 'fill', args: cmd.args as Record<string, unknown> };
      case 'waitForSelector':
        return { action: 'waitForSelector', args: cmd.args as Record<string, unknown> };
      case 'waitForNavigation':
        return { action: 'waitForNavigation', args: cmd.args as Record<string, unknown> };
      case 'extract':
        return { action: 'extract', args: cmd.args as Record<string, unknown> };
      default:
        throw new Error(`Unsupported DSL command type: ${cmd.type}`);
    }
  });
}
