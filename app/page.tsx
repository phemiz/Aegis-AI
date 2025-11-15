"use client";

import { useState } from "react";

interface Task {
  id: string;
  status: string;
  summary?: string;
}

export default function HomePage() {
  const [instructions, setInstructions] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTask() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "navigate_extract",
          instructions: instructions || "Go to example.com and summarize the page.",
          executionMode: "auto",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `Failed to create task (${res.status})`);
      }
      const data = (await res.json()) as Task;
      setTask(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTask() {
    if (!task) return;
    try {
      const res = await fetch(`/api/tasks/${encodeURIComponent(task.id)}`);
      if (!res.ok) return;
      const data = (await res.json()) as Task;
      setTask(data);
    } catch {
      // ignore
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Aegis AI – Mock Automation Console</h1>
      <p>Phase 1: Simple Real Version (mocked Aegis MCP server).</p>

      <section style={{ marginTop: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          style={{ width: "100%", minHeight: 120 }}
          placeholder="Describe what you want the agent to do..."
        />
        <button
          onClick={createTask}
          disabled={loading}
          style={{ marginTop: "0.75rem", padding: "0.5rem 1rem" }}
        >
          {loading ? "Creating..." : "Create mock task"}
        </button>
        {error && (
          <p style={{ color: "red", marginTop: "0.5rem" }}>{error}</p>
        )}
      </section>

      {task && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Current Task</h2>
          <p>
            <strong>ID:</strong> {task.id}
          </p>
          <p>
            <strong>Status:</strong> {task.status}
          </p>
          {task.summary && <p>{task.summary}</p>}
          <button
            onClick={refreshTask}
            style={{ marginTop: "0.75rem", padding: "0.5rem 1rem" }}
          >
            Refresh status
          </button>
        </section>
      )}
    </main>
  );
}
