# Aegis AI Security Model

This document describes the core security architecture and policies for Aegis AI, including:

- End-to-end encryption for the memory core
- Tool and data access permissions
- Data anonymization for training and analytics
- Logging, auditing, and incident response
- Browser extension–specific controls

---

## 1. Security Principles

Aegis AI is designed around these principles:

- **Privacy-first**: User memory is private by default and is never used for training or shared across users without explicit, informed opt-in.
- **Defense in depth**: Use multiple layers of protection (client, transport, server, storage, tool permissions) rather than relying on a single control.
- **Least privilege**: Tools and workflows get only the minimum access they need, for as short a time as necessary.
- **User control & transparency**: Users can inspect and control what Aegis can access and do, and sensitive operations are visible and explainable.

---

## 2. End-to-End Encryption (E2EE) for the Memory Core

The memory core stores user-specific data (profiles, workflows, reports, logs, preferences). Aegis applies **application-level end-to-end encryption** on top of storage and transport encryption.

### 2.1 High-level architecture

- **Client-side encryption**: First-party clients (e.g., the Aegis Chrome extension) encrypt memory payloads *before* sending them to the backend.
- **Server stores ciphertext only**: The memory service persists only encrypted `data` fields plus non-sensitive metadata (key, type, tags, timestamps, ACL).
- **Double-encryption**: Even though data is encrypted at the app layer, the underlying storage (database and volumes) is also encrypted using infrastructure-provided mechanisms.

### 2.2 Keys

- `K_user`: per-user content encryption key used to encrypt/decrypt memory item `data`.
- `K_device`: device-level key used to wrap `K_user` on each client device.
- `K_server`: server-side key used only for non-sensitive metadata and operational purposes; never for decrypting `data`.

### 2.3 Lifecycle

**Account creation**

1. Client generates a random `K_user`.
2. `K_user` is wrapped on-device using a credential-derived key (e.g., from password via PBKDF2/scrypt/Argon2) or a hardware-backed keystore.
3. Server never sees `K_user` in plaintext.

**Login / unlock**

1. Client authenticates to Aegis.
2. User unlocks memory (e.g., entering a passphrase or using OS secure storage).
3. Client retrieves and unwraps `K_user` locally.

**Writing memory**

1. Client constructs a memory item `{ key, type, data, tags, userId }`.
2. Client computes `ciphertext = AEAD_Encrypt(K_user, data, associated_data={ key, type, tags, userId })`.
3. Client sends to server:
   - `key`, `type`, `tags`, `createdAt`, `ciphertext`, `nonce`, `authTag`.
4. Server persists ciphertext and metadata.

**Reading memory**

1. Client requests a list of items (metadata only) via `memory.list` / `memory.query`.
2. For a chosen item, client requests ciphertext.
3. Client decrypts using `K_user` locally.

**Key rotation**

- Aegis supports rotating `K_user` (e.g., if a device is compromised):
  - Client generates `K_user'`.
  - Items are re-encrypted lazily when accessed or via a user-initiated background job.

### 2.4 Transport and storage security

- All client-server communication uses **TLS (HTTPS)** with modern cipher suites (TLS 1.2+), with HSTS enabled.
- Where possible, first-party clients (like the Chrome extension) may implement **certificate pinning** to reduce MITM risks.
- Storage (databases, object stores, logs) is encrypted using infrastructure-provided encryption (e.g., KMS-managed keys).

---

## 3. Permissions for Tools and Data Access

Aegis supports an explicit permissions model over:

- **Tools** (MCP tools, internal tools)
- **Memory items** (per-user, per-project, global)
- **Sessions** (per-conversation and per-workflow context)

### 3.1 Tools and capabilities

Each tool exposes a structured description including:

- **Capabilities** (what it can do):
  - Examples: `read_web`, `write_web`, `read_memory`, `write_memory`, `send_email`, `post_social`, `manage_docs`, `access_crm`, `access_analytics`, `access_financial`.
- **Data categories** (what type of data it might touch):
  - Examples: `personal_profile`, `contacts`, `documents`, `analytics`, `crm`, `social`, `financial`, `secrets`.

For each user (and optionally project/workspace), Aegis maintains a **Tool Access Policy**:

```json
{
  "toolId": "email.send",
  "allowed": true,
  "mode": "ask",               // "allow" | "ask" | "deny"
  "allowedDataCategories": ["personal_profile"],
  "restrictedDataCategories": ["financial"],
  "lastUpdatedBy": "user-123",
  "lastUpdatedAt": "2025-11-14T16:45:00Z"
}
```

- `allow` – tool can be invoked automatically in workflows when required.
- `ask` – before calling the tool with data, the user must confirm.
- `deny` – tool is unavailable; calls fail with a clear error.

This policy is visible and editable in the **Tools** panel (Aegis Command Center UI).

### 3.2 Memory access control

Each memory item includes access metadata:

```json
{
  "ownerUserId": "user-123",
  "scope": "user",            // "user" | "project" | "global"
  "projectId": "proj-abc",   // if scope = "project"
  "permissions": {
    "read": ["user-123", "proj-abc:member"],
    "write": ["user-123"],
    "execute": ["user-123", "proj-abc:owner"]
  }
}
```

- **User scope**: Only the owning user can read/write/execute.
- **Project scope**: Members of a project may read or execute items based on role.
- **Global scope**: Templates and generic workflows that contain no personal or sensitive content, read-only for all users, writable by admins.

### 3.3 Session context permissions

Each Aegis session (conversation or workflow run) has a **context grant** describing which tools and memory categories are allowed:

```json
{
  "sessionId": "sess-xyz",
  "userId": "user-123",
  "allowedMemoryTags": ["profile", "project", "workflow_hint"],
  "allowedTools": ["web.search", "web.navigate", "memory.read"],
  "restrictedTools": ["email.send", "social.post"],
  "requireConfirmationFor": ["email.send", "gdocs.create_document"]
}
```

The Command Center shows this as a small **Context & Permissions** summary so users understand what the agent can do in that session.

### 3.4 User-controlled settings

Users can manage permissions through Aegis UI:

- Per-tool toggles and modes (`allow` / `ask` / `deny`).
- Per-tool data category permissions (e.g., allow `email.send` to use profile email but not CRM contacts).
- Session-level overrides (e.g., “This run can access my CRM but not social accounts”).

---

## 4. Data Anonymization for Training and Analytics

By default, **memory content is not used for training or analytics**. Aegis only processes operational metadata necessary to provide the service.

Users can opt in to share **anonymized** data to improve Aegis; this is governed by a strict pipeline.

### 4.1 Data categories

- **Private memory** (no training by default):
  - User profile, saved workflows, reports, notes, alerts, etc.
- **Operational logs** (limited, possibly used in aggregate):
  - Tool names, latencies, error codes, environment metrics.
- **User-shared examples** (explicit opt-in):
  - Selected conversations or workflows the user marks as “share to improve Aegis”.

### 4.2 Anonymization pipeline

For opt-in data:

1. **Filtering & selection**
   - Only include items of allowed types/tags (e.g., `task_activity`, anonymized workflow definitions).
   - Exclude items tagged `sensitive`, `secrets`, `pii_strict`.

2. **PII detection & redaction**
   - Run PII detection on text to find:
     - Names, emails, phone numbers, addresses, payment identifiers, URLs.
   - Replace with placeholders:
     - `"John Doe"` → `"{{PERSON_1}}"`
     - `"john@example.com"` → `"{{EMAIL_1}}"`
   - For structured fields (e.g., `email`, `accountId`), either omit or hash.

3. **Pseudonymization**
   - When relationships matter, pseudonymize IDs:
     - `userId` → `hash(userId, training_salt)`
     - `workspaceId` → `hash(workspaceId, training_salt)`
   - Ensure training datasets cannot be trivially mapped back to real IDs.

4. **Aggregation & minimization**
   - Prefer aggregated metrics (e.g., tool usage counts, error rates) over raw text where possible.
   - Apply retention limits for training data (e.g., 90–180 days).

5. **Isolated training environment**
   - Training and analytics pipelines run in restricted environments with:
     - Limited access to production systems.
     - No direct linkage back to user accounts beyond pseudonyms.

### 4.3 User controls

- Settings include:
  - `Share anonymized data to improve Aegis` (off by default).
  - “Preview what will be shared” – show examples of anonymized content.
  - “Delete my shared data” – best-effort removal of training entries associated with the user’s pseudonym.

---

## 5. Logging, Auditing, and Incident Response

### 5.1 Audit logs

Aegis maintains internal audit logs for sensitive operations, including:

- Tool calls that can cause external effects:
  - `email.send`, `whatsapp.send`, `social.post`, `gdocs.create_document`, CRM/financial tools.
- Administrative actions:
  - Changes to tool policies, global workflows, or security settings.

Audit log entries record:

- Timestamp, userId (or pseudonym), sessionId.
- Tool name and high-level operation description.
- Success/failure and error codes.

**No sensitive payloads or secrets** are stored in audit logs; only metadata.

### 5.2 User-facing history

Through the Command Center, users can see:

- Workflows run, including parameters at a high level.
- Memory items created/updated.
- External actions taken (emails sent, docs created, posts made), with links where appropriate.

### 5.3 Incident response

If a security incident is detected (e.g., key compromise, suspicious tool usage):

- **Immediate steps**:
  - Revoke affected sessions and API tokens.
  - Rotate server-side keys and, if needed, guide users through rotation of `K_user`.
  - Disable or restrict affected tools.
- **Forensics**:
  - Analyze audit logs to scope affected users and operations.
- **User notification**:
  - Notify impacted users, describing what happened and what data might be affected.
  - Provide remediation guidance (e.g., re-authenticate integrations, update passwords elsewhere if necessary).

---

## 6. Browser Extension (Chrome) Security

The Aegis Command Center runs as a Chrome extension. Additional controls apply here:

- **Storage**
  - Use Chrome storage APIs with OS-backed encryption where possible to store:
    - Wrapped `K_user`, session tokens, minimal configuration.
  - Never store raw secrets or plaintext memory data on disk.

- **Content scripts**
  - Only inject content scripts on domains necessary for Aegis features or when the user explicitly enables the extension for the site.
  - Minimize captured data from pages; avoid sending entire DOMs when not needed.
  - For sensitive sites (e.g., online banking), require explicit user action before any content is read.

- **Network**
  - All requests to Aegis or MCP servers use HTTPS.
  - Do not embed long-term secrets directly in extension code; use short-lived tokens and proper auth flows.

---

## 7. Future Enhancements

Planned or recommended security enhancements include:

- Hardware-backed keys (WebAuthn/FIDO2) for unlocking `K_user`.
- Fine-grained DLP policies to block exfiltration of sensitive content through tools.
- Per-tool risk scoring and automatic prompts when workflows combine higher-risk tools.
- Formal verification / security reviews for critical workflows (e.g., financial operations).

---

For questions, vulnerability reports, or security disclosures, Aegis should provide a dedicated security contact and, ideally, a responsible disclosure or bug bounty program (not yet specified in this document).