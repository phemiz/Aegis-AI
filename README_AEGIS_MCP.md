# Aegis MCP Overview

This directory contains a mock implementation of the **Aegis MCP** system, a remote browser automation and research backend inspired by tools like rtrvr.ai.

## Components

- `aegis_mcp_openapi.yaml` – OpenAPI 3.1 spec describing the Aegis MCP HTTP API (tasks, monitors, artifacts, auth, errors, SSE).
- `aegis_client.ts` – Typed Axios client with retry and timeout logic for interacting with Aegis MCP.
- `AegisRemoteAutomation.ts` – High-level automation wrapper around `AegisClient` that validates DSL, runs tasks, polls for completion, and normalizes results.
- `aegis_server.ts` – Express-based mock server implementing the OpenAPI endpoints with in-memory storage, async task simulation, and SSE event streaming.
- `orchestrator.ts` – Orchestrator that routes automation between local Playwright-style backend and Aegis MCP based on heuristics and configuration.
- `dsl.ts` – Minimal DSL definition, JSON validator, text parser, and translator to Playwright-style operations.

## Notes

- Auth: both `Authorization: Bearer <token>` and `x-api-key: <apiKey>` are supported.
- Async: tasks are created asynchronously and completed via polling or SSE event streams.
- This implementation is intended as a scaffold; you can extend it with real browser automation, persistent storage, and richer task types.
