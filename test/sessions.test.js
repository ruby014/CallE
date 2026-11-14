import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createMemorySessionStore } from '../server/sessions.js';

const config = { pins: new Map([['PINA', 'A'], ['PINB', 'B']]) };

function build() {
  return createApp({ config, sessionStore: createMemorySessionStore() });
}

test('unauthenticated memory access is rejected', async () => {
  const res = await request(build()).get('/api/memories');
  assert.equal(res.status, 401);
});

test('wrong pin is rejected and sets no cookie', async () => {
  const res = await request(build()).post('/api/session').send({ pin: 'wrong' });
  assert.equal(res.status, 401);
  assert.equal(res.headers['set-cookie'], undefined);
});

test('valid pin yields fixed identity with an HttpOnly cookie', async () => {
  const agent = request.agent(build());
  const login = await agent.post('/api/session').send({ pin: 'PINA' });
  assert.equal(login.status, 200);
  assert.match(login.body.user, /\S/);
  assert.match(login.headers['set-cookie'][0], /HttpOnly/);
  assert.equal((await agent.get('/api/session')).body.user, login.body.user);
});

test('body-supplied tenant cannot select identity; forged cookie is rejected', async () => {
  const app = build();
  const a = await request(app).post('/api/session').send({ pin: 'PINA', tenantId: 'tenant-b' });
  const b = await request(app).post('/api/session').send({ pin: 'PINB' });
  assert.equal(a.body.tenantId, undefined);
  assert.notEqual(a.body.user, b.body.user);
  const forged = await request(app).get('/api/memories').set('Cookie', 'calle_session=forged');
  assert.equal(forged.status, 401);
});

test('health is public and exposes no secrets', async () => {
  const res = await request(build()).get('/api/health');
  assert.deepEqual(res.body, { ok: true });
});
