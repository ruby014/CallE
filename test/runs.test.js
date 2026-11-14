import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunService, createMemoryRunStore } from '../server/runs.js';

const A = { tenantId: 'tenant-a', userId: 'user-a', profile: { phone: '555-0100', dob: '1990-01-01' } };
const B = { tenantId: 'tenant-b', userId: 'user-b', profile: { phone: '555-0199', dob: '1985-05-05' } };
const NOW = new Date('2026-11-14T12:00:00Z');

const memo = { id: 'm1', content: 'DemoNet offered $75 per month for 12 months.', source: 'run:old', expiresAt: new Date('2026-12-31'), version: 1 };

function build(overrides = {}) {
  const calls = { retrieve: 0, deliver: 0, saved: [] };
  const service = createRunService({
    store: createMemoryRunStore(),
    now: () => NOW,
    newId: (() => { let n = 0; return () => `run-${++n}`; })(),
    retrieveMemories: async () => { calls.retrieve++; return [memo]; },
    getActiveMemoryIds: async (_p, ids) => new Set(ids.filter((id) => id === 'm1')),
    saveMemory: async (_p, input) => { calls.saved.push(input); return { id: 'new', ...input }; },
    deliverEmail: async () => { calls.deliver++; return { status: 'preview' }; },
    ...overrides,
  });
  return { service, calls };
}

const request = (extra = {}) => ({
  provider: 'DemoNet', goal: 'Lower my internet bill', limits: { maxMonthlyPrice: 80 },
  useMemory: true, permissions: { phone: true, dob: false }, recipientEmail: 'me@example.com', ...extra,
});

test('memory-off run bypasses retrieval and has no memories', async () => {
  const { service, calls } = build();
  const ctx = await service.startRun(A, request({ useMemory: false }));
  assert.deepEqual(ctx.memories, []);
  assert.equal(calls.retrieve, 0);
});

test('memory-on run returns memories and traces only ids/versions, not text', async () => {
  const { service } = build();
  const ctx = await service.startRun(A, request());
  assert.equal(ctx.memories[0].id, 'm1');
  const run = await service.getRun(A, ctx.runId);
  assert.deepEqual(run.memoryRefs, [{ id: 'm1', version: 1 }]);
  assert.equal(JSON.stringify(run).includes('$75'), false);
});

test('field gate: consent per run, phone/dob only, card/SIN never', async () => {
  const { service } = build();
  const { runId } = await service.startRun(A, request());
  assert.equal((await service.authorizeField(A, runId, 'dob')).allowed, false);
  const phone = await service.authorizeField(A, runId, 'phone');
  assert.equal(phone.allowed, true);
  assert.equal(phone.value, '555-0100');
  for (const f of ['card', 'sin', 'cardNumber', '__proto__']) {
    const r = await service.authorizeField(A, runId, f);
    assert.equal(r.allowed, false);
    assert.equal(r.value, undefined);
  }
  const consentAll = await service.startRun(A, request({ permissions: { phone: true, dob: true } }));
  assert.equal((await service.authorizeField(A, consentAll.runId, 'card')).allowed, false);
});

test('stored trace never contains verification values', async () => {
  const { service } = build();
  const { runId } = await service.startRun(A, request({ permissions: { phone: true, dob: true } }));
  await service.authorizeField(A, runId, 'phone');
  await service.authorizeField(A, runId, 'dob');
  const trace = JSON.stringify(await service.getRun(A, runId));
  assert.equal(trace.includes('555-0100'), false);
  assert.equal(trace.includes('1990-01-01'), false);
  assert.match(trace, /phone/);
});

test('cross-tenant run access fails as not found, including writes', async () => {
  const { service } = build();
  const { runId } = await service.startRun(A, request());
  await assert.rejects(() => service.getRun(B, runId), /not found/i);
  await assert.rejects(() => service.authorizeField(B, runId, 'phone'), /not found/i);
  await assert.rejects(() => service.recordAction(B, runId, { type: 'counter_offer', monthlyPrice: 75, memoryIdsUsed: [] }), /not found/i);
  await assert.rejects(() => service.completeRun(B, runId, { status: 'no_offer' }), /not found/i);
});

test('actions: foreign/invented memory ids, bad prices and bad types are rejected', async () => {
  const { service } = build();
  const { runId } = await service.startRun(A, request());
  const ok = { type: 'counter_offer', monthlyPrice: 75, memoryIdsUsed: ['m1'] };
  await service.recordAction(A, runId, ok);
  const run = await service.getRun(A, runId);
  assert.equal(run.actions[0].monthlyPrice, 75);
  assert.equal(run.actions[0].memoryCitation, 'agent_reported');
  await assert.rejects(() => service.recordAction(A, runId, { ...ok, memoryIdsUsed: ['foreign'] }), /invalid/i);
  await assert.rejects(() => service.recordAction(A, runId, { ...ok, monthlyPrice: -5 }), /invalid/i);
  await assert.rejects(() => service.recordAction(A, runId, { ...ok, type: 'accept_contract' }), /invalid/i);
});

test('memory-linked action is rejected if the memory expired or was forgotten since retrieval', async () => {
  const { service } = build({ getActiveMemoryIds: async () => new Set() });
  const { runId } = await service.startRun(A, request());
  await assert.rejects(
    () => service.recordAction(A, runId, { type: 'counter_offer', monthlyPrice: 75, memoryIdsUsed: ['m1'] }),
    /invalid/i,
  );
});

test('memory-off runs cannot cite memories', async () => {
  const { service } = build();
  const { runId } = await service.startRun(A, request({ useMemory: false }));
  await assert.rejects(
    () => service.recordAction(A, runId, { type: 'counter_offer', monthlyPrice: 75, memoryIdsUsed: ['m1'] }),
    /invalid/i,
  );
});

test('completion is idempotent: one notification, same result', async () => {
  const { service, calls } = build();
  const { runId } = await service.startRun(A, request());
  const outcome = { status: 'offer_obtained', monthlyPrice: 75, durationMonths: 12 };
  const first = await service.completeRun(A, runId, outcome);
  const second = await service.completeRun(A, runId, { status: 'no_offer' });
  assert.equal(calls.deliver, 1);
  assert.deepEqual(second.run.outcome, first.run.outcome);
  assert.equal(first.email.status, 'preview');
});

test('failed delivery is reported as failed, not sent', async () => {
  const { service } = build({ deliverEmail: async () => { throw new Error('smtp down'); } });
  const { runId } = await service.startRun(A, request());
  const done = await service.completeRun(A, runId, { status: 'no_offer', monthlyPrice: null, durationMonths: null });
  assert.equal(done.email.status, 'failed');
});

test('invalid outcomes are rejected', async () => {
  const { service } = build();
  const { runId } = await service.startRun(A, request());
  await assert.rejects(() => service.completeRun(A, runId, { status: 'contract_signed' }), /invalid/i);
  await assert.rejects(() => service.completeRun(A, runId, { status: 'offer_obtained', monthlyPrice: 'free', durationMonths: 12 }), /invalid/i);
});

test('run input validation rejects missing provider/goal and bad permissions', async () => {
  const { service } = build();
  await assert.rejects(() => service.startRun(A, request({ provider: '' })), /invalid/i);
  await assert.rejects(() => service.startRun(A, request({ permissions: { phone: 'yes' } })), /invalid/i);
});

test('completing a run saves memory automatically for any outcome, once', async () => {
  const { service, calls } = build();
  const won = await service.startRun(A, request());
  const done = await service.completeRun(A, won.runId, { status: 'offer_obtained', monthlyPrice: 75, durationMonths: 12 });
  await service.completeRun(A, won.runId, { status: 'offer_obtained', monthlyPrice: 75, durationMonths: 12 });
  assert.equal(calls.saved.length, 1);
  assert.match(calls.saved[0].content, /\$75/);
  assert.equal(calls.saved[0].source, `run:${won.runId}`);
  assert.ok(done.memory);
  const lost = await service.startRun(A, request());
  await service.completeRun(A, lost.runId, { status: 'no_offer' });
  assert.equal(calls.saved.length, 2);
  assert.match(calls.saved[1].content, /no offer was obtained/);
});

test('a failed memory write does not fail run completion', async () => {
  const { service } = build({ saveMemory: async () => { throw new Error('db down'); } });
  const { runId } = await service.startRun(A, request());
  const done = await service.completeRun(A, runId, { status: 'no_offer' });
  assert.equal(done.run.outcome.status, 'no_offer');
  assert.equal(done.memory, null);
});
