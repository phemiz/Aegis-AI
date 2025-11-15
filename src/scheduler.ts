/**
 * Minimal scheduler scaffolding.
 *
 * This does not execute YAML workflows directly (that requires your workflow engine),
 * but it shows how you might trigger high-level workflows like `proactive_alerts`
 * and `tool_discovery` on an interval for a given user.
 */

export type WorkflowInvoker = (workflowId: string, inputs: Record<string, unknown>) => Promise<void>;

export interface SchedulerConfig {
  userId: string;
  invoker: WorkflowInvoker;
}

export function startDailyAlertsScheduler(config: SchedulerConfig): void {
  const { userId, invoker } = config;

  // Run once immediately, then every 24 hours.
  void invoker("proactive_alerts", { userId }).catch((err) => {
    console.error("Error running proactive_alerts:", err);
  });

  const dayMs = 24 * 60 * 60 * 1000;
  setInterval(() => {
    void invoker("proactive_alerts", { userId }).catch((err) => {
      console.error("Error running proactive_alerts:", err);
    });
  }, dayMs);
}

export function startWeeklyToolDiscoveryScheduler(config: SchedulerConfig): void {
  const { userId, invoker } = config;

  // Run once immediately, then every 7 days.
  void invoker("tool_discovery", { userId }).catch((err) => {
    console.error("Error running tool_discovery:", err);
  });

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  setInterval(() => {
    void invoker("tool_discovery", { userId }).catch((err) => {
      console.error("Error running tool_discovery:", err);
    });
  }, weekMs);
}
