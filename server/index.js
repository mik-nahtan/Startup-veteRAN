import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const EVENTS = [
  {
    id: 'together-pilot',
    title: 'First miles, together',
    date: 'February 2027 · Proposed',
    location: 'Princeton area · Venue to be confirmed',
    distance: 'Walk / run',
    status: 'planned',
    type: 'community',
    description: 'An easy-paced community run and walk. Meet your neighbors, move at your own pace, and help shape our first gathering.',
  },
  {
    id: 'athlete-challenge',
    title: 'Your miles. Your mission.',
    date: 'Spring 2027 · Proposed',
    location: 'Your community · Your own route',
    distance: 'Your own challenge',
    status: 'planned',
    type: 'challenge',
    description: 'Choose a personal challenge, bring your community along, and support a future partner-led veteran opportunity program.',
  },
  {
    id: 'spring-5k',
    title: 'The veteRAN 5K',
    date: 'Spring 2027 · Proposed',
    location: 'Princeton area · Venue to be confirmed',
    distance: '5K / walk',
    status: 'planned',
    type: 'race',
    description: 'A starting line for veterans, students, and neighbors. Join the interest list for updates as plans take shape.',
  },
];

const MAX_TEXT = 2000;
const SUBMISSION_TYPES = new Set(['applications', 'event-registrations', 'donation-interest', 'newsletter']);

function text(value, max = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function safeDonationConfig(env) {
  const partnerName = text(env.DONATION_PARTNER_NAME, 160);
  try {
    const url = new URL(env.DONATION_URL);
    if (url.protocol !== 'https:' || url.username || url.password || !partnerName) return { enabled: false };
    return { enabled: true, url: url.href, partnerName };
  } catch {
    return { enabled: false };
  }
}

function validateSubmission(kind, body) {
  const fields = {};
  const fullName = text(body.fullName, 120);
  const email = text(body.email, 254).toLowerCase();
  const data = { fullName, email, privacyConsent: body.privacyConsent === true, updatesConsent: body.updatesConsent === true };

  if (!validEmail(email)) fields.email = 'Enter a valid email address.';
  if (typeof body.email === 'string' && body.email.length > 254) fields.email = 'Enter an email address with no more than 254 characters.';
  if (body.privacyConsent !== true) fields.privacyConsent = 'Please agree to how your information will be used.';

  if (kind === 'applications' || kind === 'event-registrations') {
    if (fullName.length < 2) fields.fullName = 'Enter your full name.';
    if (typeof body.fullName === 'string' && body.fullName.length > 120) fields.fullName = 'Use no more than 120 characters.';
    if (body.adultConsent !== true) fields.adultConsent = 'The first pilot is for adults 18 and older.';
    data.adultConsent = body.adultConsent === true;
  }

  if (kind === 'applications') {
    data.location = text(body.location, 160);
    data.sport = text(body.sport || body.challenge, 160);
    data.challenge = text(body.challenge, 160);
    data.motivation = text(body.motivation, MAX_TEXT);
    if (!data.sport) fields.sport = 'Tell us your sport or challenge.';
    if (data.motivation.length < 10) fields.motivation = 'Share a little about why you would like to join (at least 10 characters).';
    if (typeof body.motivation === 'string' && body.motivation.length > MAX_TEXT) fields.motivation = 'Use no more than 2,000 characters.';
    if (body.goal !== undefined && body.goal !== null && body.goal !== '') {
      const goal = Number(body.goal);
      if (!Number.isFinite(goal) || goal < 1 || goal > 100000 || typeof body.goal === 'boolean' || typeof body.goal === 'object') {
        fields.goal = 'Choose a goal between $1 and $100,000.';
      } else data.goal = Math.round(goal * 100) / 100;
    }
  }

  if (kind === 'event-registrations') {
    data.eventId = text(body.eventId, 100);
    data.participation = text(body.participation, 30);
    if (!EVENTS.some((event) => event.id === data.eventId)) fields.eventId = 'Choose an available event.';
    if (!['walk', 'run', 'volunteer'].includes(data.participation)) fields.participation = 'Choose walking, running, or volunteering.';
  }

  if (kind === 'donation-interest') {
    const amount = Number(body.amount);
    data.frequency = text(body.frequency, 20);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000 || typeof body.amount === 'boolean' || typeof body.amount === 'object') {
      fields.amount = 'Enter an amount between $1 and $100,000.';
    } else data.amount = Math.round(amount * 100) / 100;
    if (!['one-time', 'monthly'].includes(data.frequency)) fields.frequency = 'Choose a one-time or monthly gift.';
    if (body.updatesConsent !== true) fields.updatesConsent = 'Please agree to receive an update when giving opens.';
  }

  if (kind === 'newsletter') {
    data.interest = text(body.interest, 100) || 'general';
    if (body.updatesConsent !== true) fields.updatesConsent = 'Please agree to receive project updates.';
  }

  return { fields, data };
}

function safeCsvCell(value) {
  let cell = value === undefined || value === null ? '' : String(value);
  // Spreadsheet applications treat these prefixes as formulas, even inside CSV quotes.
  if (/^[\s]*[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}

export function createApp(options = {}) {
  const env = options.env || process.env;
  const databasePath = options.databasePath || env.DATABASE_PATH || join(projectRoot, 'data', 'veteran.sqlite');
  if (databasePath !== ':memory:') mkdirSync(dirname(resolve(databasePath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(databasePath);
  if (databasePath !== ':memory:') chmodSync(resolve(databasePath), 0o600);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS submissions_kind ON submissions(kind);
    CREATE TABLE IF NOT EXISTS athlete_profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      sport TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      goal REAL,
      approved INTEGER NOT NULL DEFAULT 0,
      public_consent INTEGER NOT NULL DEFAULT 0
    );
  `);

  const app = express();
  app.disable('x-powered-by');
  const proxyHops = Number(env.TRUST_PROXY_HOPS || 0);
  if (Number.isInteger(proxyHops) && proxyHops >= 1 && proxyHops <= 5) app.set('trust proxy', proxyHops);
  app.locals.db = db;
  app.locals.close = () => db.close();

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const attempts = new Map();
  const windowMs = options.rateLimitWindowMs || 15 * 60 * 1000;
  const maxAttempts = options.rateLimitMax ?? 40;
  app.use('/api', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const now = Date.now();
    // Forwarded addresses are used only when the deployment explicitly trusts its proxy.
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    let record = attempts.get(key);
    if (!record || now > record.until) {
      record = { count: 0, until: now + windowMs };
      attempts.set(key, record);
    }
    if (++record.count > maxAttempts) {
      res.setHeader('Retry-After', String(Math.ceil((record.until - now) / 1000)));
      return res.status(429).json({ error: 'Too many submissions. Please try again in a few minutes.' });
    }
    if (attempts.size > 10000) {
      for (const [address, entry] of attempts) if (now > entry.until) attempts.delete(address);
    }
    next();
  });
  app.use(express.json({ limit: '16kb', strict: true }));

  app.get('/api/health', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });

  app.get('/api/config', (_req, res) => {
    const privacyContact = validEmail(env.PUBLIC_CONTACT_EMAIL) ? env.PUBLIC_CONTACT_EMAIL : null;
    const demoMode = env.DEMO_MODE === 'true';
    res.json({ donations: demoMode ? { enabled: false } : safeDonationConfig(env), privacyContact, adultOnly: true, demoMode });
  });

  app.get('/api/events', (_req, res) => res.json({ events: EVENTS }));

  app.get('/api/athletes', (_req, res) => {
    const athletes = db.prepare(`SELECT id, display_name AS displayName, sport, bio, goal
      FROM athlete_profiles WHERE approved = 1 AND public_consent = 1 ORDER BY display_name`).all();
    res.json({ athletes });
  });

  const insert = db.prepare('INSERT INTO submissions (reference,kind,status,payload) VALUES (?,?,?,?)');
  const messages = {
    applications: 'Your athlete application has been saved for the organizing team. Keep your reference number for your records.',
    'event-registrations': 'You are on the interest list. This event is still being planned; this is not a confirmed race entry.',
    'donation-interest': 'Your interest has been saved. We will let you know when partner-led giving opens. No payment has been taken.',
    newsletter: 'You are on the list for veteRAN project updates.',
  };

  for (const kind of SUBMISSION_TYPES) {
    app.post(`/api/${kind}`, (req, res) => {
      if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') {
        return res.status(422).json({ error: 'Submit a valid form.' });
      }
      const { fields, data } = validateSubmission(kind, req.body);
      if (Object.keys(fields).length) return res.status(422).json({ error: 'Please check the highlighted fields.', fields });
      const reference = `VR-${randomBytes(12).toString('hex').toUpperCase()}`;
      const status = kind === 'event-registrations' ? 'waitlisted' : kind === 'applications' ? 'pending' : 'subscribed';
      insert.run(reference, kind, status, JSON.stringify(data));
      return res.status(201).json({ success: true, reference, message: messages[kind] });
    });
  }

  app.post('/api/privacy/withdraw', (req, res) => {
    const email = text(req.body?.email, 254).toLowerCase();
    const reference = text(req.body?.reference, 100).toUpperCase();
    if (!validEmail(email) || !/^VR-[A-F0-9]{24}$/.test(reference)) {
      return res.status(422).json({ error: 'Enter the email and confirmation reference from your submission.', fields: {
        ...(!validEmail(email) ? { email: 'Enter a valid email address.' } : {}),
        ...(!/^VR-[A-F0-9]{24}$/.test(reference) ? { reference: 'Enter your complete confirmation reference (VR- followed by 24 letters and numbers).' } : {}),
      } });
    }
    db.prepare("DELETE FROM submissions WHERE reference = ? AND json_extract(payload, '$.email') = ?").run(reference, email);
    res.json({ success: true, message: 'If those details matched a submission, it has been removed. Repeat for any other confirmation references you wish to withdraw.' });
  });

  function requireAdmin(req, res, next) {
    const expected = env.ADMIN_TOKEN;
    const header = req.get('Authorization') || '';
    if (!expected || expected.length < 24 || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Organizer access required.' });
    }
    const provided = Buffer.from(header.slice(7));
    const wanted = Buffer.from(expected);
    if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
      return res.status(401).json({ error: 'Organizer access required.' });
    }
    next();
  }

  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const counts = Object.fromEntries([...SUBMISSION_TYPES].map((kind) => [kind, 0]));
    for (const row of db.prepare('SELECT kind, COUNT(*) AS count FROM submissions GROUP BY kind').all()) counts[row.kind] = row.count;
    const recent = db.prepare('SELECT reference,kind,status,created_at AS createdAt FROM submissions ORDER BY id DESC LIMIT 20').all();
    res.json({ counts, recent });
  });

  app.get('/api/admin/export', requireAdmin, (req, res) => {
    const kind = req.query.type;
    if (!SUBMISSION_TYPES.has(kind)) return res.status(400).json({ error: 'Choose applications, event-registrations, donation-interest, or newsletter.' });
    const rows = db.prepare('SELECT reference,status,created_at AS createdAt,payload FROM submissions WHERE kind = ? ORDER BY id DESC').all(kind)
      .map(({ payload, ...row }) => ({ ...row, ...JSON.parse(payload) }));
    if (req.query.format === 'csv') {
      const columns = [...new Set(['reference', 'status', 'createdAt', ...rows.flatMap((row) => Object.keys(row))])];
      const csv = [columns.map(safeCsvCell).join(','), ...rows.map((row) => columns.map((column) => safeCsvCell(row[column])).join(','))].join('\r\n');
      res.setHeader('Content-Disposition', `attachment; filename="veteran-${kind}.csv"`);
      return res.type('text/csv').send(csv);
    }
    res.json({ records: rows });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'This endpoint does not exist.' }));

  const distPath = join(projectRoot, 'dist');
  if (existsSync(join(distPath, 'index.html'))) {
    app.use(express.static(distPath));
    app.get('/{*path}', (_req, res) => res.sendFile(join(distPath, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'This form is too large. Please shorten your answers.' });
    if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'The form could not be read. Please try again.' });
    // Never include request data, database contents, or credentials in public errors.
    console.error('Request failed:', err.code || err.name || 'UnknownError');
    res.status(500).json({ error: 'We could not save your submission. Please try again.' });
  });

  return app;
}

export const app = createApp();

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3001);
  const server = app.listen(port, '0.0.0.0', () => console.log(`veteRAN server listening on port ${port}`));
  const stop = () => server.close(() => { app.locals.close(); process.exit(0); });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
