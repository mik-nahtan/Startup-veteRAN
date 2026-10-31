# veteRAN

A community website for **“They ran. So we run.”** Built around athlete recruitment, community-event interest, and future partner-led giving.

## What works

- Responsive mission, programs, events, transparency, and FAQ sections.
- Private adult athlete applications with optional challenge and fundraising goals.
- Event-specific interest lists for three explicitly proposed activities, with walk/run/volunteer preferences.
- Future-giving interest: one-time/monthly preferences, preset/custom amounts, and consent. **No payment is collected or pledged.**
- Consented update/volunteer signups.
- Persistent SQLite records, confirmation references, validation, and submission rate limits.
- A private organizer dashboard at `/organizer`: search submissions, view details, and export CSV.
- Self-service withdrawal with the submission’s email and private confirmation reference.

Submissions are saved for organizers to review. No email service is connected: the website does not yet send confirmation emails, bulk updates, or alerts. Applications do not create public athlete profiles. Event interest is not confirmed race registration. The hero is an AI-generated illustrative image, not a photograph of actual participants.

## Run locally

Requires **Node.js 24 or later** (uses built-in `node:sqlite`) and npm.

```bash
cd /workspace/Startup-veteRAN
npm ci
# On a new machine, copy .env.example to .env and set a private ADMIN_TOKEN.
# Generate a token with `openssl rand -hex 32`; do not commit or share it.
npm run dev
```

Vite serves the frontend on port **5173** and proxies `/api` to Express on **3001**. On this prepared machine, an ignored, permission-restricted `.env` already contains a generated local organizer token. Open that file privately when you need to sign in; never put the token in a URL or commit it.

For the production build:

```bash
npm run build
npm start
```

Express serves both the built frontend and API on port **3001** (or `PORT`). `/api/health` checks API/database readiness. `/organizer` works on the same origin. Use HTTPS at your hosting provider/reverse proxy for a public deployment.

## Configuration

See [.env.example](.env.example). Keep `.env`, `data/`, exports, and backup files private.

| Variable | Purpose |
| --- | --- |
| `PORT` | Express port; default `3001`. |
| `DATABASE_PATH` | SQLite file; default `data/veteran.sqlite`. |
| `ADMIN_TOKEN` | A random token of at least 24 characters. Admin APIs fail closed if absent/short. |
| `PUBLIC_CONTACT_EMAIL` | Optional real project contact displayed on the site. |
| `DONATION_URL` | Approved receiving organization’s HTTPS hosted donation page. |
| `DONATION_PARTNER_NAME` | Actual receiving organization’s name. Both donation fields are needed to enable the external giving link. |
| `TRUST_PROXY_HOPS` | Default `0`. Set only when the API is reachable exclusively through the intended trusted proxy; do not enable blindly. |

The local server does not need third-party API keys. Fonts and imagery are served locally. Payment processing is intentionally handled by an approved external provider, never by this application. Donation-interest preferences are not automatically transferred to a future provider’s checkout.

## Validation

```bash
npm test              # Backend API, persistence, consent, access, export, withdrawal
npm run build         # Production bundle
npm run test:e2e      # Browser tests against a separate temporary database
```

Browser tests use Chromium at `/usr/bin/chromium`. Set `CHROMIUM_PATH` if it is installed elsewhere. They start the production server on port **4173**; build first. The test organizer token is a non-production fixture and never grants access to the normal application database. Network-restricted sandboxes may require permission to bind local test sockets.

## Before a public launch

1. Choose hosting and use a persistent, backed-up volume for SQLite; `data/` must survive restarts and deployments. Use one application instance for this SQLite MVP.
2. Set a unique production organizer token, keep it private, and configure a real project contact. The shared-token dashboard is intended for a small initial team; use individual identity-based access before broader operations.
3. Review the public wording, proposed events, adult participation, and data-handling process. Event proposals are defined in `server/index.js`; no confirmed dates or partners have been invented.
4. Connect an email provider if you want automatic notifications and consented campaigns. Organizers can currently use private exports for manual follow-up.
5. Enable giving only after the receiving organization approves the page and campaign. Real race registration, waivers, fees, and any youth participation need their own confirmed event workflow.

This repository is already isolated for cloud tasks. Use the existing checkout; do not create another Git worktree unless explicitly requested.
