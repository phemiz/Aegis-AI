export default function DocsPage() {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://aegis-ai.vercel.app";

  const endpoints = [
    {
      title: "Create Task",
      method: "POST",
      path: "/api/tasks",
      description: "Create a new automation task (mock mode)",
      example: `curl -X POST ${baseUrl}/api/tasks \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskType": "navigate_extract",
    "instructions": "Go to example.com and extract the main heading",
    "executionMode": "auto"
  }'`,
    },
    {
      title: "List All Tasks",
      method: "GET",
      path: "/api/tasks/list",
      description: "Retrieve all tasks sorted by creation date",
      example: `curl ${baseUrl}/api/tasks/list`,
    },
    {
      title: "Get Task Status",
      method: "GET",
      path: "/api/tasks/{id}",
      description: "Get current status and metadata for a specific task",
      example: `curl ${baseUrl}/api/tasks/{task-id}`,
    },
    {
      title: "Get Task Result",
      method: "GET",
      path: "/api/tasks/{id}/result",
      description: "Retrieve final result including data, logs, and artifacts",
      example: `curl ${baseUrl}/api/tasks/{task-id}/result`,
    },
    {
      title: "Cancel Task",
      method: "POST",
      path: "/api/tasks/{id}/cancel",
      description: "Request cancellation of a running or queued task",
      example: `curl -X POST ${baseUrl}/api/tasks/{task-id}/cancel`,
    },
    {
      title: "Create Monitor",
      method: "POST",
      path: "/api/monitors",
      description: "Create a scheduled monitor for recurring automation",
      example: `curl -X POST ${baseUrl}/api/monitors \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Daily Price Check",
    "taskType": "navigate_extract",
    "instructions": "Check competitor prices",
    "intervalMs": 86400000
  }'`,
    },
    {
      title: "List Monitors",
      method: "GET",
      path: "/api/monitors",
      description: "Get all configured monitors",
      example: `curl ${baseUrl}/api/monitors`,
    },
    {
      title: "Get Monitor",
      method: "GET",
      path: "/api/monitors/{id}",
      description: "Get a specific monitor's configuration and status",
      example: `curl ${baseUrl}/api/monitors/{monitor-id}`,
    },
    {
      title: "Delete Monitor",
      method: "DELETE",
      path: "/api/monitors/{id}",
      description: "Stop and delete a monitor",
      example: `curl -X DELETE ${baseUrl}/api/monitors/{monitor-id}`,
    },
  ];

  return (
    <div>
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">API Documentation</h1>
        <p className="text-gray-600 mt-1">Aegis AI REST API (Phase 1: Mock Mode)</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Phase 1 Note</h3>
        <p className="text-sm text-blue-800">
          This is the mock version of Aegis MCP. All tasks simulate browser automation without
          actually launching browsers. Responses include mock logs, artifacts, and realistic
          success/failure scenarios.
        </p>
      </div>

      <div className="space-y-6">
        {endpoints.map((endpoint, i) => (
          <div key={i} className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <span
                className={`px-3 py-1 rounded text-xs font-bold ${
                  endpoint.method === "GET"
                    ? "bg-green-100 text-green-800"
                    : endpoint.method === "POST"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {endpoint.method}
              </span>
              <code className="text-sm font-mono text-gray-700">{endpoint.path}</code>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{endpoint.title}</h3>
            <p className="text-gray-600 mb-4">{endpoint.description}</p>
            <div className="bg-gray-900 rounded-md p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100 font-mono whitespace-pre-wrap">
                {endpoint.example}
              </pre>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Response Schemas</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Task</h3>
            <div className="bg-gray-50 rounded p-4">
              <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                {`{
  "id": "string (UUID)",
  "taskType": "string",
  "status": "queued | running | completed | failed | cancelled | timeout",
  "instructions": "string",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)",
  "summary": "string",
  "progress": "number (0-100)",
  "logs": [{ "timestamp": "string", "level": "string", "message": "string" }],
  "artifacts": [{ "id": "string", "type": "string", "url": "string" }]
}`}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Monitor</h3>
            <div className="bg-gray-50 rounded p-4">
              <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                {`{
  "id": "string (UUID)",
  "name": "string",
  "taskType": "string",
  "instructions": "string",
  "intervalMs": "number",
  "status": "active | paused | stopped",
  "createdAt": "string (ISO 8601)",
  "updatedAt": "string (ISO 8601)",
  "nextRunAt": "string (ISO 8601)",
  "lastTaskId": "string (UUID)"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Next Steps</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Phase 2: Integrate real Playwright-based browser automation</li>
          <li>Add worker queue and persistent task storage</li>
          <li>Implement SSE streaming for real-time logs</li>
          <li>Add authentication and rate limiting</li>
          <li>Support webhooks and notifications</li>
        </ul>
      </div>
    </div>
  );
}
