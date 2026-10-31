import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, app as defaultApp } from './index.js';

after(() => defaultApp.locals.close());

const adminToken = 'test-only-administrator-token-at-least-24-characters';
const athlete = {
  fullName: 'Alex Runner', email: 'alex@example.org', location: 'Princeton, NJ',
  sport: 'Running', challenge: 'My first 5K', motivation: 'I would like to bring my community together.',
  goal: 100, adultConsent: true, privacyConsent: true, updatesConsent: false,
};

async function fixture(options = {}) {
  const app = createApp({ databasePath: ':memory:', env: { ADMIN_TOKEN: adminToken }, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, body, headers = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json();
    return { response, payload };
  };
  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
    app.locals.close();
  };
  return { app, baseUrl, request, close };
}

test('saves athlete applications with consent and does not publicly expose them', async () => {
  const f = await fixture();
  try {
    const { response, payload } = await f.request('/api/applications', athlete);
    assert.equal(response.status, 201);
    assert.equal(payload.success, true);
    assert.match(payload.reference, /^VR-[A-F0-9]{24}$/);
    assert.equal('email' in payload, false);
    const saved = f.app.locals.db.prepare('SELECT * FROM submissions').get();
    const data = JSON.parse(saved.payload);
    assert.equal(saved.status, 'pending');
    assert.equal(data.email, athlete.email);
    assert.equal(data.challenge, athlete.challenge);
    assert.equal(data.updatesConsent, false);
    assert.deepEqual((await f.request('/api/athletes')).payload, { athletes: [] });
  } finally { await f.close(); }
});

test('rejects invalid input and missing adult/privacy consent without writing records', async () => {
  const f = await fixture();
  try {
    for (const bad of [
      { ...athlete, adultConsent: false },
      { ...athlete, adultConsent: 'true' },
      { ...athlete, privacyConsent: false },
      { ...athlete, email: 'not-an-email' },
      { ...athlete, motivation: 'Hi' },
      { ...athlete, goal: -1 },
      { ...athlete, goal: true },
      { ...athlete, fullName: { injected: true } },
    ]) {
      const { response, payload } = await f.request('/api/applications', bad);
      assert.equal(response.status, 422);
      assert.ok(payload.error);
      assert.ok(Object.keys(payload.fields).length > 0);
    }
    assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 0);
  } finally { await f.close(); }
});

test('event interest validates a real event and remains a waitlist entry', async () => {
  const f = await fixture();
  try {
    const { payload } = await f.request('/api/events');
    assert.equal(payload.events.length, 3);
    assert.ok(payload.events.every((event) => event.status === 'planned'));
    const event = { fullName: 'Casey Walker', email: 'casey@example.org', eventId: payload.events[0].id, participation: 'walk', adultConsent: true, privacyConsent: true };
    assert.equal((await f.request('/api/event-registrations', { ...event, eventId: 'not-real' })).response.status, 422);
    assert.equal((await f.request('/api/event-registrations', { ...event, participation: 'helicopter' })).response.status, 422);
    const saved = await f.request('/api/event-registrations', event);
    assert.equal(saved.response.status, 201);
    assert.match(saved.payload.message, /not a confirmed race entry/);
    assert.equal(f.app.locals.db.prepare('SELECT status FROM submissions').get().status, 'waitlisted');
  } finally { await f.close(); }
});

test('giving interest takes no payment and requires update consent', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('/api/config')).payload.donations.enabled, false);
    const giving = { email: 'donor@example.org', amount: 50, frequency: 'monthly', privacyConsent: true, updatesConsent: true };
    assert.equal((await f.request('/api/donation-interest', { ...giving, updatesConsent: false })).response.status, 422);
    assert.equal((await f.request('/api/donation-interest', { ...giving, amount: 'NaN' })).response.status, 422);
    const saved = await f.request('/api/donation-interest', giving);
    assert.equal(saved.response.status, 201);
    assert.match(saved.payload.message, /No payment has been taken/);
    assert.equal(JSON.parse(f.app.locals.db.prepare('SELECT payload FROM submissions').get().payload).amount, 50);
  } finally { await f.close(); }
});

test('configured giving requires an HTTPS URL and a named receiving partner', async () => {
  for (const [env, enabled] of [
    [{ DONATION_URL: 'http://example.org/give', DONATION_PARTNER_NAME: 'Example Charity' }, false],
    [{ DONATION_URL: 'https://example.org/give' }, false],
    [{ DONATION_URL: 'https://user:password@example.org/give', DONATION_PARTNER_NAME: 'Example Charity' }, false],
    [{ DONATION_URL: 'https://example.org/give', DONATION_PARTNER_NAME: 'Example Charity' }, true],
  ]) {
    const f = await fixture({ env });
    try { assert.equal((await f.request('/api/config')).payload.donations.enabled, enabled); }
    finally { await f.close(); }
  }
});

test('newsletter consent is explicit and public endpoints never reveal subscribers', async () => {
  const f = await fixture();
  try {
    const subscriber = { email: 'reader@example.org', privacyConsent: true, updatesConsent: true, interest: 'events' };
    assert.equal((await f.request('/api/newsletter', { ...subscriber, updatesConsent: false })).response.status, 422);
    assert.equal((await f.request('/api/newsletter', subscriber)).response.status, 201);
    assert.equal((await f.request('/api/newsletter')).response.status, 404);
  } finally { await f.close(); }
});

test('organizer data fails closed without strong admin credentials', async () => {
  for (const token of [undefined, 'short']) {
    const f = await fixture({ env: { ADMIN_TOKEN: token } });
    try {
      assert.equal((await f.request('/api/admin/overview', undefined, { Authorization: `Bearer ${token}` })).response.status, 401);
    } finally { await f.close(); }
  }
  const f = await fixture();
  try {
    await f.request('/api/applications', athlete);
    assert.equal((await f.request('/api/admin/overview')).response.status, 401);
    assert.equal((await f.request('/api/admin/export?type=applications')).response.status, 401);
    assert.equal((await f.request('/api/admin/overview', undefined, { Authorization: `Bearer ${adminToken}x` })).response.status, 401);
    const { payload } = await f.request('/api/admin/overview', undefined, { Authorization: `Bearer ${adminToken}` });
    assert.equal(payload.counts.applications, 1);
    assert.equal(payload.recent.length, 1);
    assert.equal('payload' in payload.recent[0], false);
    const records = await f.request('/api/admin/export?type=applications', undefined, { Authorization: `Bearer ${adminToken}` });
    assert.equal(records.payload.records[0].email, athlete.email);
  } finally { await f.close(); }
});

test('parameterized inserts preserve hostile text and CSV exports escape formula injection', async () => {
  const f = await fixture();
  try {
    const maliciousName = '=HYPERLINK("https://bad.example","name")';
    const saved = await f.request('/api/applications', { ...athlete, fullName: maliciousName, motivation: "I am interested.'); DROP TABLE submissions; --" });
    assert.equal(saved.response.status, 201);
    assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 1);
    const response = await fetch(`${f.baseUrl}/api/admin/export?type=applications&format=csv`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /"'=HYPERLINK\(""https:\/\/bad.example/);
  } finally { await f.close(); }
});

test('privacy withdrawal requires both reference and matching email and reveals no match status', async () => {
  const f = await fixture();
  try {
    const { payload } = await f.request('/api/applications', athlete);
    const wrongEmail = await f.request('/api/privacy/withdraw', { email: 'someone-else@example.org', reference: payload.reference });
    assert.equal(wrongEmail.response.status, 200);
    assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 1);
    const removed = await f.request('/api/privacy/withdraw', { email: athlete.email, reference: payload.reference });
    assert.deepEqual(removed.payload, wrongEmail.payload);
    assert.equal(f.app.locals.db.prepare('SELECT COUNT(*) AS count FROM submissions').get().count, 0);
    assert.equal((await f.request('/api/privacy/withdraw', { email: athlete.email, reference: 'guess' })).response.status, 422);
  } finally { await f.close(); }
});

test('only approved athletes with separate public consent are visible', async () => {
  const f = await fixture();
  try {
    const insert = f.app.locals.db.prepare('INSERT INTO athlete_profiles (id,display_name,sport,approved,public_consent) VALUES (?,?,?,?,?)');
    insert.run('hidden-1', 'Private Person', 'Running', 0, 1);
    insert.run('hidden-2', 'Another Private Person', 'Running', 1, 0);
    insert.run('public-1', 'Alex R.', 'Walking', 1, 1);
    const athletes = (await f.request('/api/athletes')).payload.athletes;
    assert.equal(athletes.length, 1);
    assert.equal(athletes[0].displayName, 'Alex R.');
    assert.equal('email' in athletes[0], false);
  } finally { await f.close(); }
});

test('submissions persist across server restarts', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'veteran-api-'));
  const databasePath = join(folder, 'test.sqlite');
  let f;
  try {
    f = await fixture({ databasePath });
    await f.request('/api/applications', athlete);
    await f.close();
    f = await fixture({ databasePath });
    const records = await f.request('/api/admin/export?type=applications', undefined, { Authorization: `Bearer ${adminToken}` });
    assert.equal(records.payload.records.length, 1);
    assert.equal(records.payload.records[0].email, athlete.email);
  } finally {
    if (f) await f.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  }
});

test('rate limiting and request size caps reject excessive requests', async () => {
  const f = await fixture({ rateLimitMax: 1 });
  try {
    await f.request('/api/applications', athlete);
    const limited = await f.request('/api/applications', athlete);
    assert.equal(limited.response.status, 429);
    assert.ok(limited.response.headers.get('retry-after'));
  } finally { await f.close(); }
  const second = await fixture();
  try {
    const response = await fetch(`${second.baseUrl}/api/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...athlete, motivation: 'x'.repeat(17000) }) });
    assert.equal(response.status, 413);
    assert.ok((await response.json()).error);
    const malformed = await fetch(`${second.baseUrl}/api/applications`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  } finally { await second.close(); }
});

test('forwarded client addresses affect rate limiting only with an explicit trusted proxy setting', async () => {
  const untrusted = await fixture({ rateLimitMax: 1 });
  try {
    await untrusted.request('/api/applications', athlete, { 'X-Forwarded-For': '192.0.2.1' });
    const next = await untrusted.request('/api/applications', athlete, { 'X-Forwarded-For': '192.0.2.2' });
    assert.equal(next.response.status, 429);
  } finally { await untrusted.close(); }
  const trusted = await fixture({ rateLimitMax: 1, env: { TRUST_PROXY_HOPS: '1' } });
  try {
    await trusted.request('/api/applications', athlete, { 'X-Forwarded-For': '192.0.2.1' });
    const anotherClient = await trusted.request('/api/applications', athlete, { 'X-Forwarded-For': '192.0.2.2' });
    assert.equal(anotherClient.response.status, 201);
    const sameClient = await trusted.request('/api/applications', athlete, { 'X-Forwarded-For': '192.0.2.1' });
    assert.equal(sameClient.response.status, 429);
  } finally { await trusted.close(); }
});
