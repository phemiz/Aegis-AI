"use client";

import { useState, useEffect } from "react";

interface Monitor {
  id: string;
  name: string;
  taskType: string;
  instructions: string;
  intervalMs: number;
  status: string;
  createdAt: string;
  nextRunAt?: string;
}

export default function MonitorsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    taskType: "navigate_extract",
    instructions: "",
    intervalMs: 3600000,
  });

  async function fetchMonitors() {
    try {
      const res = await fetch("/api/monitors");
      if (!res.ok) return;
      const data = await res.json();
      setMonitors(data.monitors || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function createMonitor(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setShowCreate(false);
        setFormData({
          name: "",
          taskType: "navigate_extract",
          instructions: "",
          intervalMs: 3600000,
        });
        fetchMonitors();
      }
    } catch {
      // ignore
    }
  }

  async function deleteMonitor(monitorId: string) {
    if (!confirm("Are you sure you want to delete this monitor?")) return;
    try {
      const res = await fetch(`/api/monitors/${encodeURIComponent(monitorId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMonitors();
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchMonitors();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Loading monitors...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Monitors</h1>
            <p className="text-gray-600 mt-1">Scheduled automation tasks (mock mode)</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
          >
            {showCreate ? "Cancel" : "Create Monitor"}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Monitor</h2>
          <form onSubmit={createMonitor} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Daily Price Check"
              />
            </div>
            <div>
              <label htmlFor="taskType" className="block text-sm font-medium text-gray-700 mb-1">
                Task Type
              </label>
              <select
                id="taskType"
                value={formData.taskType}
                onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="navigate_extract">Navigate & Extract</option>
                <option value="form_fill_submit">Form Fill & Submit</option>
                <option value="workflow">Complex Workflow</option>
                <option value="monitor_run">Monitor Run</option>
              </select>
            </div>
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">
                Instructions
              </label>
              <textarea
                id="instructions"
                required
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-2 focus:ring-indigo-500"
                rows={3}
                placeholder="Describe what this monitor should do..."
              />
            </div>
            <div>
              <label htmlFor="interval" className="block text-sm font-medium text-gray-700 mb-1">
                Interval (ms)
              </label>
              <select
                id="interval"
                value={formData.intervalMs}
                onChange={(e) => setFormData({ ...formData, intervalMs: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-md p-2 text-gray-900 focus:ring-2 focus:ring-indigo-500"
              >
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
                <option value={900000}>15 minutes</option>
                <option value={1800000}>30 minutes</option>
                <option value={3600000}>1 hour</option>
                <option value={21600000}>6 hours</option>
                <option value={86400000}>24 hours</option>
              </select>
            </div>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 font-medium"
            >
              Create Monitor
            </button>
          </form>
        </div>
      )}

      {monitors.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 text-lg">No monitors configured.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-block text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Create your first monitor →
          </button>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Interval
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Run
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monitors.map((monitor) => (
                <tr key={monitor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {monitor.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {monitor.taskType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {monitor.intervalMs / 60000} min
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {monitor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {monitor.nextRunAt ? new Date(monitor.nextRunAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => deleteMonitor(monitor.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
