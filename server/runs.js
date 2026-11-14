import crypto from 'node:crypto';
import { buildEmail, previewDelivery } from './notifications.js';

const COLLECTION = 'runs';
const ALLOWED_FIELDS = new Set(['phone', 'dob']);
const OUTCOME_STATUSES = new Set(['offer_obtained', 'no_offer', 'verification_blocked']);

const invalid = (msg) => new Error(`Invalid ${msg}`);
const notFound = () => new Error('Run not found');
const scope = (id, principal) => ({ _id: id, tenantId: principal.tenantId, userId: principal.userId });

export function createMemoryRunStore() {
  const runs = new Map();
  const find = (id, p) => {
    const r = runs.get(id);
    return r && r.tenantId === p.tenantId && r.userId === p.userId ? r : null;
  };
  return {
    async insert(run) { runs.set(run._id, structuredClone(run)); },
    async get(id, p) { const r = find(id, p); return r ? structuredClone(r) : null; },
    async push(id, p, key, item) {
      const r = find(id, p);
      if (!r) return false;
      r[key].push(structuredClone(item));
      return true;
    },
    async claimCompletion(id, p, fields) {
      const r = find(id, p);
      if (!r || r.completedAt) return null;
      Object.assign(r, structuredClone(fields));
      return structuredClone(r);
    },
    async set(id, p, fields) {
      const r = find(id, p);
      if (r) Object.assign(r, structuredClone(fields));
    },
  };
}

export function createMongoRunStore(getDb) {
  const col = async () => (await getDb()).collection(COLLECTION);
  return {
    async insert(run) { await (await col()).insertOne(run); },
    async get(id, p) { return (await col()).findOne(scope(id, p)); },
    async push(id, p, key, item) {
      const res = await (await col()).updateOne(scope(id, p), { $push: { [key]: item } });
      return res.matchedCount === 1;
    },
    // Atomic claim: only the first completion wins, so duplicates never re-notify.
    async claimCompletion(id, p, fields) {
      return (await col()).findOneAndUpdate(
        { ...scope(id, p), completedAt: null },
        { $set: fields },
        { returnDocument: 'after' },
      );
    },
    async set(id, p, fields) { await (await col()).updateOne(scope(id, p), { $set: fields }); },
  };
}

function sanitize(run) {
  const { _id, tenantId: _t, userId: _u, recipientEmail: _r, ...rest } = run;
  return { id: _id, ...rest };
}

function validateRequest(input) {
  const p = input?.permissions;
  if (typeof input?.provider !== 'string' || !input.provider.trim()) throw invalid('provider');
  if (typeof input.goal !== 'string' || !input.goal.trim()) throw invalid('goal');
  if (typeof input.useMemory !== 'boolean') throw invalid('useMemory');
  if (!p || typeof p.phone !== 'boolean' || typeof p.dob !== 'boolean') throw invalid('permissions');
  if (typeof input.recipientEmail !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(input.recipientEmail)) throw invalid('recipientEmail');
}

function validateOutcome(o) {
  if (!o || !OUTCOME_STATUSES.has(o.status)) throw invalid('outcome status');
  if (o.status === 'offer_obtained') {
    if (!Number.isFinite(o.monthlyPrice) || o.monthlyPrice <= 0) throw invalid('monthlyPrice');
    if (!Number.isInteger(o.durationMonths) || o.durationMonths <= 0) throw invalid('durationMonths');
    return { status: o.status, monthlyPrice: o.monthlyPrice, durationMonths: o.durationMonths };
  }
  return { status: o.status, monthlyPrice: null, durationMonths: null };
}

const MEMORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function memoryText(run, outcome) {
  if (outcome.status === 'offer_obtained') return `${run.provider} offered $${outcome.monthlyPrice} per month for ${outcome.durationMonths} months.`;
  if (outcome.status === 'verification_blocked') return `${run.provider} negotiation was blocked at identity verification; no offer was obtained.`;
  return `${run.provider} would not agree to a deal for goal '${run.goal}'; no offer was obtained.`;
}

export function createRunService({
  store,
  retrieveMemories,
  getActiveMemoryIds,
  saveMemory,
  deliverEmail = previewDelivery,
  now = () => new Date(),
  newId = crypto.randomUUID,
}) {
  async function load(principal, runId) {
    const run = typeof runId === 'string' ? await store.get(runId, principal) : null;
    if (!run) throw notFound();
    return run;
  }

  return {
    async startRun(principal, input) {
      validateRequest(input);
      const memories = input.useMemory
        ? await retrieveMemories(principal, `${input.provider} ${input.goal}`, now())
        : [];
      const run = {
        _id: newId(),
        tenantId: principal.tenantId,
        userId: principal.userId,
        provider: input.provider,
        goal: input.goal,
        limits: input.limits ?? {},
        useMemory: input.useMemory,
        permissions: { phone: input.permissions.phone, dob: input.permissions.dob },
        recipientEmail: input.recipientEmail,
        memoryRefs: memories.map((m) => ({ id: m.id ?? m._id, version: m.version })),
        fieldRequests: [],
        actions: [],
        outcome: null,
        email: null,
        createdAt: now(),
        completedAt: null,
      };
      await store.insert(run);
      return {
        runId: run._id,
        provider: run.provider,
        goal: run.goal,
        limits: run.limits,
        memories: memories.map((m) => ({
          id: m.id ?? m._id, content: m.content, source: m.source, expiresAt: m.expiresAt,
        })),
      };
    },

    async getRun(principal, runId) {
      return sanitize(await load(principal, runId));
    },

    async authorizeField(principal, runId, field) {
      const run = await load(principal, runId);
      const known = typeof field === 'string' && ALLOWED_FIELDS.has(field);
      const allowed = known && !run.completedAt && run.permissions[field] === true;
      await store.push(runId, principal, 'fieldRequests', { field: known ? field : 'other', allowed, at: now() });
      return allowed ? { allowed: true, value: principal.profile[field] } : { allowed: false };
    },

    async recordAction(principal, runId, action) {
      const run = await load(principal, runId);
      if (run.completedAt) throw invalid('action: run already completed');
      if (action?.type !== 'counter_offer') throw invalid('action type');
      if (!Number.isFinite(action.monthlyPrice) || action.monthlyPrice <= 0) throw invalid('monthlyPrice');
      const cited = action.memoryIdsUsed;
      if (!Array.isArray(cited) || !cited.every((id) => typeof id === 'string')) throw invalid('memoryIdsUsed');
      const retrieved = new Set(run.memoryRefs.map((m) => m.id));
      if (!cited.every((id) => retrieved.has(id))) throw invalid('memoryIdsUsed: not retrieved for this run');
      if (cited.length) {
        const active = await getActiveMemoryIds(principal, cited, now());
        if (!cited.every((id) => active.has(id))) throw invalid('memoryIdsUsed: memory is no longer active');
      }
      await store.push(runId, principal, 'actions', {
        type: 'counter_offer',
        monthlyPrice: action.monthlyPrice,
        memoryIdsUsed: cited,
        memoryCitation: 'agent_reported',
        at: now(),
      });
    },

    async completeRun(principal, runId, outcomeInput) {
      const existing = await load(principal, runId);
      if (existing.completedAt) return { run: sanitize(existing), email: existing.email };
      const outcome = validateOutcome(outcomeInput);
      const claimed = await store.claimCompletion(runId, principal, { outcome, completedAt: now() });
      if (!claimed) {
        const latest = await load(principal, runId);
        return { run: sanitize(latest), email: latest.email };
      }
      const { subject, body } = buildEmail({ provider: claimed.provider, ...outcome });
      let status;
      try {
        status = (await deliverEmail({ subject, body }, claimed.recipientEmail)).status;
      } catch {
        status = 'failed';
      }
      const email = { status, subject, body };
      await store.set(runId, principal, { email });
      let memory = null;
      try {
        memory = await saveMemory(principal, {
          content: memoryText(claimed, outcome),
          source: `run:${runId}`,
          expiresAt: new Date(now().getTime() + MEMORY_TTL_MS),
        });
      } catch {
        // A failed memory write must not fail the completed run.
      }
      return { run: sanitize({ ...claimed, email }), email, memory };
    },
  };
}
