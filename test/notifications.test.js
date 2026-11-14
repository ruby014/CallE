import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmail, previewDelivery } from '../server/notifications.js';

test('offer email says offer obtained, never contract changed', () => {
  const { subject, body } = buildEmail({ provider: 'DemoNet', status: 'offer_obtained', monthlyPrice: 75, durationMonths: 12 });
  assert.match(subject, /offer/i);
  assert.match(body, /\$75/);
  assert.match(body, /12 months/);
  assert.match(body, /not (been )?accepted|no changes/i);
  assert.doesNotMatch(body, /contract (has been )?(changed|updated|signed)/i);
});

test('no_offer and verification_blocked emails are distinct and contain no price', () => {
  const none = buildEmail({ provider: 'DemoNet', status: 'no_offer', monthlyPrice: null, durationMonths: null });
  const blocked = buildEmail({ provider: 'DemoNet', status: 'verification_blocked', monthlyPrice: null, durationMonths: null });
  assert.notEqual(none.body, blocked.body);
  assert.doesNotMatch(none.body, /\$\d/);
  assert.match(blocked.body, /verification/i);
});

test('buildEmail is deterministic', () => {
  const o = { provider: 'DemoNet', status: 'offer_obtained', monthlyPrice: 75, durationMonths: 12 };
  assert.deepEqual(buildEmail(o), buildEmail(o));
});

test('preview delivery reports preview, never sent', async () => {
  assert.deepEqual(await previewDelivery({ subject: 's', body: 'b' }, 'a@b.c'), { status: 'preview' });
});
