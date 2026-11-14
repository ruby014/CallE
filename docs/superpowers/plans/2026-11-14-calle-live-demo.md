# CallE Live Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a hosted voice negotiation role-play that demonstrates durable, governed Atlas memory changing CallE's next action.

**Architecture:** React/Vite calls an Express API deployed as a Vercel Node function. Express owns demo sessions, Atlas retrieval, memory updates, and run traces; the browser connects directly to ElevenLabs for audio. The ElevenLabs teammate configures the agent and React voice integration against the shared contract below.

**Tech Stack:** MERN, Vite, MongoDB Node driver, Atlas Vector Search, ElevenLabs React SDK, Vercel, Node test runner and Supertest. Embeddings: Voyage AI `voyage-4-lite`, 1024 dimensions (`VOYAGE_API_KEY`); verify the REST call and `input_type` (document/query) before coding.

**Spec:** `docs\superpowers\specs\2026-11-14-calle-design.md`

## Global Constraints

- Use the hackathon MongoDB Atlas Sandbox and Atlas Vector Search.
- Human teammate plays the rep; no real calls, impersonation, or automatic contract acceptance.
- Synthetic data only. Never collect or disclose SIN or any payment-card verification details.
- Phone/DOB permission is specific to a provider and run; never put values into memories, traces, emails, or persisted transcripts.
- Server derives tenant/reader identity from a session; never accept a body-supplied tenant as authority.
- Filter tenant, readers, status, and expiry on every retrieval and mutation.
- Corrections supersede; forgetting deletes the document and embedding.
- Hosted Vercel URL and public repository required; secrets stay in local/Vercel settings.
- Email preview is permitted; actual sending is stretch. Do not label a preview as sent.

## Review Focus

- Forged sessions and cross-tenant run/memory IDs must fail, including writes (Tasks 1-3).
- Expiry boundaries and vector-index lag must never reintroduce inactive/deleted memories (Task 2).
- Empty retrieval and provider failure are different: empty is valid; failure is an explicit error (Tasks 2-4).
- Voice tools must not invent memory IDs, authorized fields, or a completed contract (Tasks 3-4).
- Audio/transcript retention and duplicate completion must not leak verification data or duplicate notifications (Tasks 4-5).

---

## Timebox and ownership

Budget **150-180 minutes from implementation start**, not from the original discussion.

| Window | Backend/app owner | ElevenLabs teammate |
| --- | --- | --- |
| 0-20 min | Scaffold, sessions, credential prompts, start Atlas index | Agent setup, voice/privacy configuration |
| 20-65 min | Governed memory APIs and tests | Voice component and tools against shared contract |
| 65-100 min | Run lifecycle, trace, completion and preview | Integrate run context; rehearse rep script |
| 100-130 min | UI governance controls and deployment | Voice/error checks on hosted URL |
| 130-150 min | Hosted proof sequence and fixes | Play rep; verify actual spoken behavior |
| Remaining time | Buffer; actual email only if core demo passes | Demo rehearsal |

Tasks 2 and 4 can proceed in parallel after Task 1 defines the shell/contracts.
Task 3 depends on Task 2; integration and Task 5 depend on Tasks 3 and 4.
No implementation is started by this planning request.

## File map

- `package.json`, `vite.config.js`, `vercel.json`, `index.html`: scripts, frontend build and API routing.
- `.gitignore`, `.env.example`: exclude secrets/build output; document variable names only.
- `api/index.js`, `server/app.js`, `server/local.js`: exported Express function and local runner.
- `server/config.js`, `server/db.js`, `server/sessions.js`: environment checks, cached Atlas connection, demo identity.
- `server/memory.js`, `server/embeddings.js`, `scripts/seed.js`, `atlas/memory-index.json`: governed memories and index/seed setup.
- `server/runs.js`, `server/notifications.js`: run lifecycle, field gate, trace, outcome preview.
- `src/main.jsx`, `src/App.jsx`, `src/api.js`, `src/styles.css`: request form, governance/trace panels, API wrapper.
- `src/VoiceSession.jsx`, `src/VoiceSession.test.jsx`: teammate-owned ElevenLabs integration and error-state test.
- `test/sessions.test.js`, `test/memory.test.js`, `test/runs.test.js`, `test/notifications.test.js`: focused automated checks.

## Shared integration contract

All API calls use an HttpOnly demo-session cookie. Backend rejects missing/invalid cookies and scopes every ID lookup. Demo PINs are configured server-side for two fixed fictional identities; entering a PIN selects its identity, not an arbitrary tenant. This is a controlled demo, not production authentication.

**Memory:** `{ id, tenantId, ownerId, allowedReaderIds, content, source, status, version, supersedesId, createdAt, expiresAt, embedding }`.
`status` is `active` or `superseded`; API responses never expose embedding vectors.

**Run request:** `{ provider: "DemoNet", goal, limits, useMemory, permissions: { phone: boolean, dob: boolean }, recipientEmail }`.
Use a fixed synthetic profile; do not request real phone/DOB values.

**Run context:** `{ runId, provider, goal, limits, memories: [{ id, content, source, expiresAt }] }`.
Do not inject historical chats, verification values, or a baked-in answer. With memory off, `memories` is empty.

**Outcome:** `{ status: "offer_obtained" | "no_offer" | "verification_blocked", monthlyPrice: number | null, durationMonths: number | null }`.
An offer is not an accepted contract. Email copy must distinguish these.

| Endpoint | Input / output |
| --- | --- |
| `POST /api/session` | `{ pin }` -> sets cookie; returns fictional user label |
| `GET /api/health` | `{ ok: true }`; no secrets |
| `GET /api/memories` | Current user's authorized memory list |
| `POST /api/memories` | `{ content, source, expiresAt }` -> approved persisted memory |
| `PATCH /api/memories/:id` | `{ content, source, expiresAt }` -> superseding version |
| `DELETE /api/memories/:id` | Deletes document and embedding; returns 204 |
| `POST /api/runs` | Run request -> run context |
| `POST /api/runs/:id/field` | `{ field: "phone" | "dob" }` -> `{ allowed, value? }`; other fields denied |
| `POST /api/runs/:id/actions` | `{ type: "counter_offer", monthlyPrice, memoryIdsUsed }` -> validated action |
| `POST /api/runs/:id/complete` | Outcome -> `{ run, email: { status: "preview" | "sent" | "failed", subject, body } }` |
| `GET /api/runs/:id` | Sanitized trace and outcome, never transcript/verification values |

The browser registers `get_authorized_field`, `record_negotiation_action`, and `report_outcome` as ElevenLabs client tools. Each calls the corresponding API with the active run ID bound by React, not selected by the agent. Permission checks happen on the server, not in the tool description.

## Task 1: App shell, demo sessions and deployment baseline

**Files:** `package.json`, `vite.config.js`, `vercel.json`, `.gitignore`, `.env.example`, `api/index.js`, `server/{app,local,config,db,sessions}.js`, `src/{main,App}.jsx`, `index.html`, `test/sessions.test.js`.

**Interfaces:** `createApp(services) -> Express`; `resolveSession(cookie) -> Principal`; `getDb() -> Promise<Db>`.
Principal contains fixed `tenantId`, `userId`, and synthetic profile. Store/revalidate session identity server-side in Atlas so Vercel cold starts do not lose it.

- [ ] Create package scripts `dev`, `test`, `test:ui`, `build`, and `seed`; install only after creating the manifest. Use React/Vite, Express, MongoDB, and Supertest. Run backend tests with the Node runner and UI tests with Vitest, jsdom, and React Testing Library; keep their file selectors separate.
- [ ] Write failing session tests with assertions:
  ```js
  assert.equal((await request(app).get('/api/memories')).status, 401);
  assert.equal((await request(app).post('/api/session').send({ pin: 'wrong' })).status, 401);
  assert.equal((await authenticatedA.get('/api/health')).body.ok, true);
  ```
- [ ] Run `npm test`; confirm failures identify missing session/route behavior.
- [ ] Implement PIN-to-fixed-identity login, cookie handling, cached database connection, and API error responses. Do not log credential bodies.
- [ ] Configure Vite assets and the Vercel Express function/rewrite for `/api/*`; verify both frontend and health route in an early preview deployment rather than leaving routing to the end.
- [ ] Prompt user to configure `MONGODB_URI`, `MONGODB_DB`, `VOYAGE_API_KEY`, `DEMO_PIN_A`, and `DEMO_PIN_B` locally and in Vercel. Never request values in chat. Confirm hosted Atlas network access.
- [ ] Run `npm test` and `npm run build`; commit only task files with a Co-authored-by trailer.

## Task 2: Governed retrieval, correction, forgetting and durable writes

**Files:** `server/{memory,embeddings}.js`, `atlas/memory-index.json`, `scripts/seed.js`, `test/memory.test.js`.

**Interfaces:** `embedText(text) -> Promise<number[]>`; `retrieveMemories(db, principal, query, now) -> Promise<Memory[]>`; `saveMemory(db, principal, input) -> Promise<Memory>`; `correctMemory(db, principal, id, input) -> Promise<Memory>`; `forgetMemory(db, principal, id) -> Promise<void>`.

- [ ] Write failing tests for tenant/reader/status/expiry filters, forbidden writes, and vector failures:
  ```js
  assert.deepEqual(result.map(m => m.id), ['active-A']);
  assert.equal(expiryBoundaryResult.length, 0); // expiresAt === now is expired
  assert.equal(staleIndexDeletedResult.length, 0);
  await assert.rejects(() => correctAsB(memoryA.id), /not found/i);
  await assert.rejects(() => retrieveWithEmbeddingFailure(), /embedding/i);
  ```
- [ ] Run `node --test test/memory.test.js`; expect failing cases before implementation.
- [ ] Implement 1024-dimensional Voyage embeddings (`voyage-4-lite`; index `numDimensions: 1024`, cosine) and `$vectorSearch` pre-filters for `tenantId`, `allowedReaderIds`, `status`, and `expiresAt > now`. Index those filter fields. Re-read candidates from current documents with the same authorization filters to guard against stale search-index entries.
- [ ] Implement owner-only writes. Correction creates a sourced replacement and supersedes the old version atomically; forgetting physically deletes the record/embedding. Reads exclude expiry immediately; TTL is optional cleanup, not access control.
- [ ] Create the index in the provided Atlas Sandbox immediately; wait for readiness. Seed only fictional A/B records via `npm run seed`, including an expired record.
- [ ] Run `node --test test/memory.test.js`; additionally verify a real Atlas query returns A's authorized memory but not B's/expired records. Commit task files.

## Task 3: Runs, action evidence, permission gate and summary

**Files:** `server/{runs,notifications,app}.js`, `test/{runs,notifications}.test.js`.

**Interfaces:** `startRun(principal, input) -> Promise<RunContext>`; `authorizeField(principal, runId, field) -> Promise<{allowed,value?}>`; `recordAction(principal, runId, action) -> Promise<void>`; `completeRun(principal, runId, outcome) -> Promise<Completion>`; `buildEmail(outcome) -> {subject,body}`.

- [ ] Write failing tests:
  ```js
  assert.deepEqual(memoryOff.memories, []);
  assert.equal((await fieldWithoutConsent('dob')).allowed, false);
  assert.equal((await fieldWithConsent('phone')).allowed, true);
  assert.equal((await fieldWithConsent('card')).allowed, false);
  await assert.rejects(() => actionWithForeignMemoryId(), /invalid/i);
  await assert.rejects(() => accessRunAsOtherTenant(), /not found/i);
  assert.equal(storedTraceContainsVerificationValues, false);
  assert.equal(repeatedCompletion.notificationCount, 1);
  assert.equal(preview.email.status, 'preview');
  assert.equal(failedDelivery.email.status, 'failed');
  ```
- [ ] Run `node --test test/runs.test.js test/notifications.test.js`; confirm missing behavior fails.
- [ ] Implement scoped run endpoints from the contract. Snapshot retrieved IDs/version metadata, not reusable raw memory text in traces; memory-off bypasses retrieval and has no IDs. Check memory existence/status/expiry again before approving memory-linked actions.
- [ ] Store structured action amounts and validate cited memory IDs against retrieval; label citations as agent-reported, not definitive causal proof. Persist structured outcomes, not raw transcripts/free-text summaries.
- [ ] Implement provider/run-scoped phone/DOB checks from the synthetic profile. Reject all other fields, including any card/SIN verification. Do not persist tool-returned values.
- [ ] Implement idempotent completion and a deterministic email preview from outcome fields. Add real delivery only with sender credentials and verified success; failed delivery is visibly failed, not sent.
- [ ] Add explicit user approval to save an offer as memory with source/run reference and expiry. Reuse `saveMemory`; never silently certify model output as fact.
- [ ] Run targeted tests then `npm test`; commit task files.

## Task 4: ElevenLabs integration and demo UI (teammate TODO)

**Files:** `src/VoiceSession.jsx`, `src/VoiceSession.test.jsx`, `src/App.jsx`, `src/api.js`, `src/styles.css`.

**Interfaces:** `VoiceSession({ context, onAction, onOutcome, onFieldRequest, onError }) -> React component`; context is the Task 3 run context. UI owner implements same-origin `apiFetch(path, options)` using the demo cookie.

- [ ] Teammate creates an ElevenLabs agent with a disclosed AI opening and natural negotiation voice; configure supported prompt/context personalization before integrating.
- [ ] Configure agent instructions: use verified retrieved offers only; never fabricate leverage, share unauthorized fields, or accept/cancel a contract. Record a counteroffer via `record_negotiation_action`, and report structured results via `report_outcome`.
- [ ] Register the three client tools from the shared contract, with matching names/schema in ElevenLabs. Configure permission/action tools to wait for their result; errors must stop the dependent action, not imply success.
- [ ] Configure privacy: disable persisted audio/transcripts where supported and verify settings in the dashboard. If verification speech would be retained despite the settings, keep that part of the demo as a synthetic policy-tool test rather than claim it is never recorded. Do not export transcripts to Atlas.
- [ ] Prompt only when needed for the agent ID and any server-side API key needed for private session tokens. Never expose an ElevenLabs API key in a Vite variable. Private agent token requests must be scoped to the authenticated run.
- [ ] Build request form, demo login, permission toggles, start/end voice buttons, error/status display, memory on/off control, retrieved-memory panel, correction/forget controls, action trace, and summary/preview.
- [ ] Connect using the installed `@elevenlabs/react` API and a fresh context for every run. Keep the agent prompt identical across comparison runs except for authorized retrieved memory; do not preload the demo offer in the global prompt/knowledge base.
- [ ] Write failing `src/VoiceSession.test.jsx` cases: rejected microphone access renders an alert, rejected session start renders an alert, and both assert `onOutcome` was not called. Run `npm run test:ui -- --run`; confirm failure, implement visible error state, then rerun to pass.
- [ ] Run `npm run build`; manually test each client tool against Express and test a live browser conversation with the human rep. Commit only teammate-owned files.

## Task 5: Hosted proof and final freeze

**Files:** Vercel environment/project settings; `README.md` for brief setup and demo instructions.
**Interfaces:** Same endpoints and context as Tasks 1-4; no new features.

- [ ] Configure Vercel build/output/API settings and environment secrets; redeploy after setting them. Verify health, Atlas retrieval, and HTTPS microphone access on the actual URL.
- [ ] First conversation: rep offers **$75/month**; CallE records the offer, not a contract acceptance. User approves saving it with expiry/source.
- [ ] Fresh conversation: rep offers **$85/month**. With memory enabled, observe CallE counter using the saved **$75** offer. Rep confirms an improved offer; show the actual spoken action plus validated trace.
- [ ] Repeat the same rep script with memory disabled and unchanged agent instructions. Compare observed action amounts, not just displayed context. If behavior does not differ, record the result honestly and adjust the scenario; never fabricate proof.
- [ ] Correct the saved offer to **$80**, rerun, and observe updated behavior. Set expiry in the past and confirm immediate exclusion; forget and confirm document/embedding deletion. Reset seed data only through the controlled setup script.
- [ ] Log into B; demonstrate A memory/run IDs cannot be read or modified. These demo identities do not establish production-grade authentication.
- [ ] Check email says "offer obtained", not "contract changed"; verify preview/sent/failed status. Ensure traces and summaries contain no verification data.
- [ ] Run `npm test`, `npm run test:ui -- --run`, and `npm run build`, rehearse the hosted sequence, and verify the public repo identifies event-created work.
- [ ] Freeze scope: fix only demo blockers. Add actual email only if all core checks pass and sender configuration is ready.

## Execution recommendation

Use **native execution** for the backend/app work, with the teammate independently owning Task 4. Shared contracts reduce integration drift; extra task-by-task agent launches would consume the short timebox. Review this plan before implementation begins.
