# Three-agent negotiation flow

CallE can run three negotiations concurrently for different providers on behalf of one authenticated user. Each agent has an isolated `runId`, while governed memory remains scoped by the same server-derived `tenantId` and `userId`.

## Flow

1. The user starts three runs, one per provider.
2. Each run retrieves only that user's authorized, active, confirmed, unexpired memories relevant to internet service.
3. Each run logs the memory IDs and versions placed in its context. Raw memory text is not stored in the run trace.
4. A provider offer captured during a call is `unconfirmed`. It is visible to the user but cannot be used as evidence by another agent.
5. After the user confirms it, the offer becomes `active` and `confirmed` memory, with a source run reference and expiry.
6. Other active runs explicitly refresh memory context. The refresh event logs the new memory IDs, versions, timestamp, and reason.
7. A counteroffer can cite only a memory delivered to that run and still active and confirmed at action time.

## Guardrails

- Agents never receive another agent's raw transcript.
- A shared offer is not usable until the user confirms it.
- Corrections create a new version and supersede the old version.
- Expired, forgotten, inactive, or unconfirmed memories are excluded from retrieval.
- Structured `terms` support exact comparisons; Vector Search finds semantically relevant negotiation history.

## Users without an existing plan

Do not create a placeholder plan or invent missing terms. A run starts with no current-plan memory and labels the strategy as an acquisition negotiation rather than a renewal comparison. The agent may ask the user for a baseline later, but it must not claim savings against a plan that is not on file.
