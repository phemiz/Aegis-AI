import { MemoryCore } from "./memoryCore.js";

export interface TaskActivityInput {
  userId: string;
  intent: string;
  naturalLanguagePrompt: string;
  toolsUsed: string[];
  entities?: Record<string, unknown>;
  success: boolean;
}

/**
 * Log a task activity entry into the memory core so Tool Discovery can
 * analyze recurring patterns later.
 */
export async function logTaskActivity(
  memory: MemoryCore,
  activity: TaskActivityInput
): Promise<void> {
  const key = `task_activity.${new Date().toISOString()}`;

  await memory.writeItem(activity.userId, {
    key,
    type: "task_activity",
    data: {
      intent: activity.intent,
      naturalLanguagePrompt: activity.naturalLanguagePrompt,
      toolsUsed: activity.toolsUsed,
      entities: activity.entities ?? {},
      timestamp: new Date().toISOString(),
      success: activity.success,
    },
    createdAt: new Date().toISOString(),
    tags: ["usage_log"],
  });
}
