# CallE

**Stop haggling. CallE calls, remembers, and gets you the better price.**

CallE is an AI agent that negotiates your service bills over a voice call. It remembers past deals in MongoDB Atlas and uses them as leverage on the next call. Every memory is private to its owner, expires, and can be corrected or forgotten.

Built for the MongoDB "Agents in Context" hackathon, Toronto. Problem statement 2: **Memory You Can Govern**.

Live demo: https://call-e-one.vercel.app/

## How it answers the three questions

### 1. How do we keep one client's or team's memory from leaking into another's?
- The tenant and user come from a server-side session (HttpOnly cookie). The server never trusts a tenant or user ID sent by the browser.
- Every memory carries `tenantId`, `ownerId` and `allowedReaderIds`.
- Atlas `$vectorSearch` pre-filters on `tenantId`, `allowedReaderIds`, `status: active` and `expiresAt` before ranking, so other tenants' memories are never candidates.
- Runs, memory reads, corrections and deletes are all scoped by the same principal.
- Personal fields (phone, date of birth) are released to the agent only when the user ticked permission for that run. SIN and card numbers are always denied.

### 2. How does the agent fix or drop a memory that turns out wrong or expired?
- **Expire:** each memory has `expiresAt`. Expired memories are excluded from retrieval. Outcomes the agent saves expire after 30 days.
- **Correct:** a correction runs in a transaction. The old memory becomes `superseded`, and a new version is created with `supersedesId` and an incremented `version`. Nothing is silently overwritten.
- **Forget:** forgetting removes the memory from retrieval and from the current run's context immediately.
- **Learn:** when a call ends, the outcome (won or failed) is saved to memory automatically, tagged with its source run. The user can correct or forget it afterwards.

### 3. How do we prove a memory changed the agent's behavior?
- Each run stores `memoryRefs` (memory ID and version only, never the text) for the memories it retrieved.
- The agent must call `record_negotiation_action` before it speaks a counteroffer. The server checks that the cited memory IDs were retrieved for this run and are still active.
- The trace timeline in the UI shows each action with the memory it cited. Field requests are logged by field name and allowed/denied only, never values.
- Control: run the same goal with "Use prior eligible memories" off. The retrieved list is empty and the agent has no prior deal to cite.
- Citations are labelled `agent_reported`: the server proves the cited memory was retrieved and active, not that it influenced the model's reasoning. We state this limit openly.

## What the agent does on a call
- Speaks in the browser (ElevenLabs Conversational AI) as an AI agent negotiating on behalf of the signed-in customer, by name.
- Counters using a retrieved memory, up to three counteroffers.
- If the rep asks for a field the user did not authorize, it declines politely. If the rep insists, it reports `verification_blocked` and hangs up.
- When an offer meets the goal, it repeats the terms, accepts, reports the outcome, and hangs up. If no deal is possible, it ends the call.
- The result email is generated and shown as a **preview**. We never claim it was sent.

## Architecture
- **Frontend:** React + Vite (landing page at `#/`, product at `#/demo`).
- **Backend:** Express (`server/`), deployed on Vercel through `api/index.js`.
- **Database:** MongoDB Atlas. Collections: `memories`, `runs`, `sessions`.
- **Vector search:** Atlas Vector Search index `memory_vector_index` (`atlas/memory-index.json`, 1024 dimensions, cosine, filters on `tenantId`, `allowedReaderIds`, `status`, `expiresAt`).
- **Embeddings:** Voyage AI `voyage-4-lite`.
- **Voice:** ElevenLabs Conversational AI with three client tools: `get_authorized_field`, `record_negotiation_action`, `report_outcome`, plus the built-in `end_call`.

## Run it locally
```
npm install
cp .env.example .env     # fill in the values below
npm run check:atlas      # verifies the Atlas connection
npm run seed             # seeds demo memories for two fictional tenants
npm run provision:elevenlabs   # creates or updates the ElevenLabs agent
npm run dev
```

Environment variables (see `.env.example`):
- `MONGODB_URI`, `MONGODB_DB` (`calle`), `VECTOR_INDEX_NAME` (`memory_vector_index`)
- `VOYAGE_API_KEY`
- `DEMO_PIN_A`, `DEMO_PIN_B`: invented PINs that sign in as Tenant A (Alex Morgan) or Tenant B (Jordan Lee)
- `VITE_ELEVENLABS_AGENT_ID`, `ELEVENLABS_VOICE_ID`

Create the Atlas vector index from `atlas/memory-index.json` before seeding. Re-run `npm run provision:elevenlabs` whenever the agent prompt or tools change.

## Tests
```
npm test        # backend (node:test)
npm run test:ui # frontend (Vitest)
npm run build
```

## Demo flow
1. Sign in as Tenant A. The retrieved panel shows the prior $75 DemoNet deal.
2. Start the call. The rep offers $85, and CallE counters at $75 citing the memory.
3. The rep asks for an unauthorized phone number. CallE declines.
4. The rep agrees to $75. CallE accepts and hangs up. The outcome is saved to memory automatically.
5. Forget the memory, and it disappears from the next run.
6. Sign in as Tenant B and see none of Tenant A's memories.

## Known limits
- The call is a browser role-play against a stand-in rep. There is no real telephony or provider dialing.
- All people and data are synthetic. Do not enter real personal data.
- Retrieval is semantic with no per-provider filter yet, so within one tenant a different provider's memory could surface.
- Email is preview only.

## Team
Built at the MongoDB Toronto hackathon by Ruchelle and Keejung Park.
