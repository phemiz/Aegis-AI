"use client";

import { useState } from "react";
import Link from "next/link";

interface Task {
  id: string;
  status: string;
  summary?: string;
  progress?: number;
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
    <div>
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Aegis AI Dashboard</h1>
        <p className="text-gray-600">Phase 1: Mock Automation Console (Vercel deployment ready)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-500">Quick Actions</h3>
          <div className="mt-4 space-y-2">
            <Link href="/tasks" className="block text-indigo-600 hover:text-indigo-800 font-medium">
              → View all tasks
            </Link>
            <Link href="/monitors" className="block text-indigo-600 hover:text-indigo-800 font-medium">
              → Manage monitors
            </Link>
            <Link href="/docs" className="block text-indigo-600 hover:text-indigo-800 font-medium">
              → API Documentation
            </Link>
          </div>
        </div>

        <div className="bg-indigo-50 shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-indigo-900">Status</h3>
          <p className="mt-2 text-2xl font-bold text-indigo-600">Mock Mode</p>
          <p className="text-sm text-indigo-700 mt-1">No real browser automation</p>
        </div>

        <div className="bg-green-50 shadow rounded-lg p-6">
          <h3 className="text-sm font-medium text-green-900">Deployment</h3>
          <p className="mt-2 text-2xl font-bold text-green-600">Live</p>
          <p className="text-sm text-green-700 mt-1">Vercel serverless</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Task</h2>
        <div>
          <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-2">
            Instructions
          </label>
          <textarea
            id="instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full border border-gray-300 rounded-md p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            rows={4}
            placeholder="Describe what you want the agent to do..."
          />
          <button
            onClick={createTask}
            disabled={loading}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Creating..." : "Create Mock Task"}
          </button>
          {error && (
            <p className="mt-3 text-red-600 text-sm">{error}</p>
          )}
        </div>

        {task && (
          <div className="mt-6 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Latest Task</h3>
            <dl className="grid grid-cols-1 gap-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Task ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">{task.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'failed' ? 'bg-red-100 text-red-800' :
                    task.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status}
                  </span>
                </dd>
              </div>
              {task.progress !== undefined && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Progress</dt>
                  <dd className="mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 mt-1">{task.progress}%</span>
                  </dd>
                </div>
              )}
              {task.summary && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Summary</dt>
                  <dd className="mt-1 text-sm text-gray-900">{task.summary}</dd>
                </div>
              )}
            </dl>
            <div className="mt-4 flex gap-3">
              <button
                onClick={refreshTask}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-sm font-medium"
              >
                Refresh Status
              </button>
              <Link
                href="/tasks"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium inline-block"
              >
                View All Tasks
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
