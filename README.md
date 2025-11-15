# Aegis AI – Simple Real Version

This repo implements **Phase 1 (Simple Real Version)** of the Aegis MCP system:

- Next.js App Router frontend (mock automation console).
- Mocked Aegis MCP server behavior (no real Playwright/browser automation).
- Typed client + orchestrator + DSL utilities (scaffolded for future phases).
- Vercel-ready configuration for serverless deployment.

## Project structure

- `app/` – Next.js App Router frontend and API routes.
- `src/` – Existing MCP server implementation (Playwright-based), preserved but **not used** by the Vercel app.
- `aegis_client/` – Wrapper exports for the Aegis HTTP client.
- `aegis_server/` – Wrapper exports for the (mock) Aegis MCP server implementation.
- `orchestrator/` – Wrapper exports for the orchestrator logic.
- `dsl/` – Wrapper exports for DSL parsing/validation helpers.
- `lib/aegisMock.ts` – In-memory mocked task service used by Next.js API routes.
- `aegis_client.ts`, `AegisRemoteAutomation.ts`, `aegis_server.ts`, `orchestrator.ts`, `dsl.ts` – Core TypeScript modules implementing the Aegis MCP scaffold.
- `openapi/` (planned) – location for OpenAPI specs (currently `aegis_mcp_openapi.yaml` is at repo root).

## Running locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the Next.js app:

   ```bash
   npm run dev
   ```

   This starts the mock Aegis AI console at `http://localhost:3000`.

3. (Optional) Run the original MCP server:

   ```bash
   npm run mcp:dev
   ```

   This uses the existing `src/server.ts` entrypoint and is **separate** from the Vercel/Next.js app.

## Deployment (Vercel)

The project is configured to be deployed on Vercel as a standard Next.js application:

- Build command: `npm run build`
- Output: Next.js `.next` directory

### Steps (CLI)

1. Install Vercel CLI (once):

   ```bash
   npm install -g vercel
   ```

2. Log in:

   ```bash
   vercel login
   ```

3. From the repo root, link/create the project named **"Aegis AI"**:

   ```bash
   vercel
   ```

4. For production deployment:

   ```bash
   vercel --prod
   ```

The assistant scripts and config are designed to work with your Vercel account (`phemis-projects-cd56a283`).

## Domain connection guide (Vercel)

Once the project is deployed on Vercel:

1. Go to your project in the Vercel dashboard.
2. Open the **Settings → Domains** section.
3. Click **"Add"** and enter your custom domain (e.g., `aegis.yourdomain.com`).
4. Vercel will provide DNS records (typically CNAME or A/ALIAS) to configure at your DNS provider.
5. After DNS propagates, Vercel will automatically provision HTTPS certificates.

For more details, see Vercel docs: <https://vercel.com/docs/projects/domains>.

## Security checklist (Phase 1)

- [x] **Auth secrets in env** – Do not hardcode API keys or tokens; use `.env` and Vercel project env vars.
- [x] **No untrusted code execution** – Phase 1 uses a mocked backend only; no real browser or remote code execution.
- [x] **Rate limiting / abuse** – For public deployments, consider adding simple rate limiting or auth to the API routes.
- [x] **Error redaction** – Ensure error messages returned to clients do not leak secrets or internal file paths.
- [x] **CORS** – Default Next.js API routes are same-origin; if exposing cross-origin, configure CORS carefully.
- [x] **Dependency updates** – Periodically run `npm audit` and keep Next.js/React and other deps up to date.

## Phase 2 – Worker Server prompt (for real automation later)

In Phase 2, you can introduce a real worker server that:

- Runs Playwright-based automation in isolated worker processes/containers.
- Receives tasks via a queue or HTTP API compatible with the current Aegis MCP contract.
- Streams logs and intermediate results back to the Next.js app via SSE or websockets.

**Prompt for future work:**

> "Upgrade Aegis AI from the Simple Real Version to Phase 2 by replacing `lib/aegisMock.ts` with a worker-backed implementation that uses Playwright for real browser automation. Maintain the existing HTTP/Next.js API contract and task/result schemas, add a minimal task queue, and ensure all browser sessions are isolated and cleaned up. Provide configurable resource limits, robust error handling, and a migration path that does not break existing clients."

You can reuse the existing `src/` Playwright-based automation modules as the basis for that worker server.
