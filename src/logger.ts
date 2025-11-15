import { SECRET_ENV_KEYS, loadConfigFromEnv } from "./config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const config = loadConfigFromEnv();
const currentLevel = config.LOG_LEVEL;

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] >= levelOrder[currentLevel];
}

// Basic redaction: masks known secret env keys in logged objects/strings.
function redact(value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === "string") {
    let redacted = value;
    for (const key of SECRET_ENV_KEYS) {
      const raw = process.env[key];
      if (!raw) continue;
      // Replace any direct occurrence of the secret with a placeholder.
      redacted = redacted.split(raw).join(`***redacted:${key}***`);
    }
    return redacted;
  }

  if (Array.isArray(value)) {
    return value.map((v) => redact(v));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_ENV_KEYS.includes(k as (typeof SECRET_ENV_KEYS)[number])) {
        out[k] = "***redacted***";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }

  return value;
}

function log(level: LogLevel, message: string, meta?: unknown) {
  if (!shouldLog(level)) return;
  const ts = new Date().toISOString();
  const base = { level, ts, message };
  const payload = meta ? { ...base, meta: redact(meta) } : base;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};