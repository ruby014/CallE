import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createMemorySessionStore } from '../server/sessions.js';
import { createRunService, createMemoryRunStore } from '../server/runs.js';

const config = { pins: new Map([['PINA', 'A'], ['PINB', 'B']]) };

function build() {
  const runs = createRunService({
    store: createMemoryRunStore(),
    retrieveMemories: async () => [],
    getActiveMemoryIds: async () => new Set(),
    saveMemory: async () => ({}),
  });
  return createApp({ config, sessionStore: createMemorySessionStore(), runs });
}

const body = {
  provider: 'DemoNet', goal: 'Lower bill', limits: {}, useMemory: false,
  permissions: { phone: true, dob: false }, recipientEmail: 'me@example.com',
};

test('run endpoints: tenant comes from the session, other tenants get 404, bad input 400', async () => {
  const app = build();
  const a = request.agent(app);
  const b = request.agent(app);
  await a.post('/api/session').send({ pin: 'PINA' });
  await b.post('/api/session').send({ pin: 'PINB', tenantId: 'tenant-a' });

  const created = await a.post('/api/runs').send({ ...body, tenantId: 'tenant-b' });
  assert.equal(created.status, 201);
  const id = created.body.runId;

  assert.equal((await a.get(`/api/runs/${id}`)).status, 200);
  assert.equal((await b.get(`/api/runs/${id}`)).status, 404);
  assert.equal((await b.post(`/api/runs/${id}/field`).send({ field: 'phone' })).status, 404);
  assert.equal((await a.post('/api/runs').send({ ...body, provider: '' })).status, 400);
  assert.equal((await a.post(`/api/runs/${id}/field`).send({ field: 'card' })).body.allowed, false);
  assert.equal((await request(app).post('/api/runs').send(body)).status, 401);
});
