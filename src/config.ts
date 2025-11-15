import { z } from "zod";

// Centralized environment schema for validation at startup.
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"]) // default if unset
    .optional(),

  // Browser automation backend selection
  WEB_AUTOMATION_BACKEND: z
    .enum(["stub", "playwright"])
    .optional(),

  // Placeholder Aegis config (can be expanded when wiring remote MCP)
  AEGIS_MCP_URL: z.string().url().optional(),
  AEGIS_API_KEY: z.string().min(1).optional(),
  USE_AEGIS: z.enum(["always", "never", "auto"]).optional(),

  // Persistent memory backend (for future SQLite/Redis implementations)
  MEMORY_BACKEND: z.enum(["memory", "sqlite"]).optional(),
  SQLITE_MEMORY_PATH: z.string().optional(),

  // Logging configuration
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),

  // HTTP transport
  HTTP_PORT: z.string().regex(/^\d+$/).optional(),
  HTTP_AUTH_TOKEN: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof EnvSchema> & {
  NODE_ENV: "development" | "test" | "production";
  WEB_AUTOMATION_BACKEND: "stub" | "playwright";
  MEMORY_BACKEND: "memory" | "sqlite";
  SQLITE_MEMORY_PATH: string;
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  HTTP_PORT: number; // 0 means disabled
  HTTP_AUTH_TOKEN?: string;
  USE_AEGIS: "always" | "never" | "auto";
};

let cachedConfig: AppConfig | null = null;

export function loadConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    // Do NOT log raw env; only structured validation issues.
    // This avoids leaking secrets while still surfacing misconfiguration.
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration", parsed.error.flatten());
    process.exit(1);
  }

  const base = parsed.data;

  const NODE_ENV = base.NODE_ENV ?? "development";
  const WEB_AUTOMATION_BACKEND = base.WEB_AUTOMATION_BACKEND ?? "stub";
  const MEMORY_BACKEND = base.MEMORY_BACKEND ?? "memory";
  const SQLITE_MEMORY_PATH =
    base.SQLITE_MEMORY_PATH ?? "data/memory.sqlite";
  const LOG_LEVEL = base.LOG_LEVEL ?? "info";

  const HTTP_PORT = base.HTTP_PORT ? parseInt(base.HTTP_PORT, 10) : 0;
  const HTTP_AUTH_TOKEN = base.HTTP_AUTH_TOKEN;
  const USE_AEGIS = base.USE_AEGIS ?? "auto";

  cachedConfig = {
    ...base,
    NODE_ENV,
    WEB_AUTOMATION_BACKEND,
    MEMORY_BACKEND,
    SQLITE_MEMORY_PATH,
    LOG_LEVEL,
    HTTP_PORT,
    HTTP_AUTH_TOKEN,
    USE_AEGIS,
  } as AppConfig;

  return cachedConfig;
}

// Keys that should never be logged in plaintext.
export const SECRET_ENV_KEYS = ["AEGIS_API_KEY"] as const;