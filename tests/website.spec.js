import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const adminHeaders = { Authorization: 'Bearer e2e-organizer-token-32-characters' };
const cleanup = [];
const uniqueEmail = () => `veteran.e2e.${randomBytes(6).toString('hex')}@example.com`;

async function recordsFor(request, kind) {
  const response = await request.get(`/api/admin/export?type=${kind}`, { headers: adminHeaders });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).records;
}

async function saveReference(dialog, email) {
  const reference = await dialog.locator('.action-reference strong').innerText();
  expect(reference).toMatch(/^VR-[A-F0-9]{24}$/);
  cleanup.push({ email, reference });
  return reference;
}

async function identity(dialog, name, email) {
  await dialog.getByLabel(/^Full name/).fill(name);
  await dialog.getByLabel('Email address', { exact: true }).fill(email);
}

async function adultConsent(dialog) {
  await dialog.getByRole('checkbox', { name: /I’m 18 or older/ }).check();
  await dialog.getByRole('checkbox', { name: /I agree that veteRAN may store/ }).check();
}

test.afterEach(async ({ request }) => {
  // Tests run against their own temporary database, never the development records.
  for (const submission of cleanup.splice(0)) {
    const response = await request.post('/api/privacy/withdraw', { data: submission });
    expect(response.ok()).toBeTruthy();
  }
});

test('athlete applications are saved privately and organizers can review and export them', async ({ page, request }) => {
  const email = uniqueEmail();
  const motivation = 'I want to build community through a welcoming first 5K.';
  const unauthorized = await request.get('/api/admin/overview');
  expect(unauthorized.status()).toBe(401);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Every mile, a new beginning/ })).toBeVisible();
  await page.getByRole('button', { name: 'Find your purpose' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Your miles. A bigger mission.' })).toBeVisible();
  await identity(dialog, 'Alex Test Runner', email);
  await dialog.getByLabel('Your sport or activity').selectOption('running');
  await dialog.getByLabel(/^City \/ state/).fill('Princeton, NJ');
  await dialog.getByLabel(/^A challenge you have in mind/).fill('My first community 5K');
  await dialog.getByLabel('What brings you to veteRAN?').fill(motivation);
  await dialog.getByLabel(/^Potential fundraising goal/).fill('500');
  await adultConsent(dialog);
  await dialog.getByRole('checkbox', { name: /I’d also like occasional project updates/ }).check();
  await dialog.getByRole('button', { name: 'Send my application' }).click();
  await expect(dialog.getByRole('heading', { name: 'Application received.' })).toBeVisible();
  const reference = await saveReference(dialog, email);
  const publicProfiles = await request.get('/api/athletes');
  expect(JSON.stringify(await publicProfiles.json())).not.toContain(email);

  await page.goto('/organizer');
  await page.getByLabel('Organizer token').fill('e2e-organizer-token-32-characters');
  await page.getByRole('button', { name: 'Open organizer dashboard' }).click();
  await expect(page.getByRole('heading', { name: /Good things start together/ })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search submissions by name, email, or reference' }).fill(email);
  const row = page.getByRole('row').filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'View', exact: true }).click();
  const details = page.getByRole('dialog');
  await expect(details.getByRole('heading', { name: 'Alex Test Runner' })).toBeVisible();
  await expect(details.getByText(motivation, { exact: true })).toBeVisible();
  await expect(details.getByText(reference, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(details).not.toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('veteran-applications.csv');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain(email);
  expect(csv).toContain(reference);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByLabel('Organizer token')).toHaveValue('');
});

test('planned event signup records interest without confirming a race entry', async ({ page, request }) => {
  const email = uniqueEmail();
  await page.goto('/#events');
  const eventCard = page.locator('.event-card').filter({ has: page.getByRole('heading', { name: 'First miles, together', exact: true }) });
  await eventCard.getByRole('button', { name: 'Join the interest list' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('First miles, together', { exact: true })).toBeVisible();
  await identity(dialog, 'Jamie Test Walker', email);
  await dialog.getByLabel('How would you like to join?').selectOption('walk');
  await adultConsent(dialog);
  await dialog.getByRole('button', { name: 'Join the interest list' }).click();
  await expect(dialog.getByRole('heading', { name: 'You’re on the interest list.' })).toBeVisible();
  await expect(dialog.getByText(/not a race entry/)).toBeVisible();
  const reference = await saveReference(dialog, email);
  const record = (await recordsFor(request, 'event-registrations')).find(item => item.reference === reference);
  expect(record).toMatchObject({ email, eventId: 'together-pilot', participation: 'walk', status: 'waitlisted', updatesConsent: false });
});

test('giving selections save interest only and never collect payment details', async ({ page, request }) => {
  const email = uniqueEmail();
  await page.goto('/');
  await page.getByRole('button', { name: 'Support the mission' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Help open the next door.' })).toBeVisible();
  await expect(dialog.getByText(/This records your interest only/)).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Continue to donate' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Monthly' }).click();
  await expect(dialog.getByRole('button', { name: 'Monthly' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('spinbutton', { name: 'Other potential donation amount in US dollars' }).fill('75');
  await identity(dialog, 'Taylor Test Supporter', email);
  await dialog.getByRole('checkbox', { name: /I agree that veteRAN may store/ }).check();
  await dialog.getByRole('checkbox', { name: /Email me when giving opens/ }).check();
  await dialog.getByRole('button', { name: 'Notify me when giving opens' }).click();
  await expect(dialog.getByRole('heading', { name: 'You’re on the giving list.' })).toBeVisible();
  await expect(dialog.getByText(/No payment has been taken and no donation has been pledged/)).toBeVisible();
  const reference = await saveReference(dialog, email);
  const record = (await recordsFor(request, 'donation-interest')).find(item => item.reference === reference);
  expect(record).toMatchObject({ email, amount: 75, frequency: 'monthly', status: 'subscribed', updatesConsent: true });
});

test('a member can remove a submission with their email and private confirmation reference', async ({ page, request }) => {
  const email = uniqueEmail();
  const response = await request.post('/api/newsletter', { data: { email, privacyConsent: true, updatesConsent: true } });
  expect(response.status()).toBe(201);
  const { reference } = await response.json();
  cleanup.push({ email, reference });
  expect((await recordsFor(request, 'newsletter')).some(item => item.reference === reference)).toBeTruthy();
  await page.goto('/');
  await page.getByRole('button', { name: 'Privacy & your data' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email used for your submission').fill(email);
  await dialog.getByLabel(/^Confirmation reference/).fill(reference);
  await dialog.getByRole('button', { name: 'Remove my submission' }).click();
  await expect(dialog.getByRole('heading', { name: 'Request processed.' })).toBeVisible();
  expect((await recordsFor(request, 'newsletter')).some(item => item.reference === reference)).toBeFalsy();
});

test('event filters, questions, and keyboard modal dismissal work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Events' }).click();
  await expect(page).toHaveURL(/#events$/);
  await expect(page.locator('.event-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Community runs', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(1);
  await expect(page.locator('.event-card').getByRole('heading')).toHaveText('First miles, together');
  await page.getByRole('button', { name: 'Athlete challenges', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(1);
  await expect(page.locator('.event-card').getByRole('heading')).toHaveText('Your miles. Your mission.');
  await page.getByRole('button', { name: 'All events', exact: true }).click();
  await expect(page.locator('.event-card')).toHaveCount(3);
  await page.locator('summary').filter({ hasText: 'Can I register for a race now?' }).click();
  await expect(page.getByText(/Joining a list doesn’t reserve a race entry/)).toBeVisible();
  const athleteButton = page.getByRole('button', { name: 'Become an athlete', exact: true }).first();
  await athleteButton.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(athleteButton).toBeFocused();
});

test('footer newsletter saves an explicitly consented subscription', async ({ page, request }) => {
  const email = uniqueEmail();
  await page.goto('/');
  const footer = page.locator('.site-footer');
  await footer.getByRole('textbox', { name: 'Email address', exact: true }).fill(email);
  await footer.getByRole('checkbox', { name: /I agree to receive updates/ }).check();
  await footer.getByRole('button', { name: 'Subscribe to updates' }).click();
  await expect(footer.getByRole('status')).toContainText('You’re on the list.');
  const confirmation = await footer.getByRole('status').innerText();
  const reference = confirmation.match(/VR-[A-F0-9]{24}/)?.[0];
  expect(reference).toBeTruthy();
  cleanup.push({ email, reference });
  const record = (await recordsFor(request, 'newsletter')).find(item => item.reference === reference);
  expect(record).toMatchObject({ email, privacyConsent: true, updatesConsent: true });
});

test('the mobile navigation and application are usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Every mile, a new beginning/ })).toBeVisible();
  const image = page.locator('.hero-photo img');
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Events' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#events$/);
  await page.getByRole('button', { name: 'Join the interest list' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBeTruthy();
  const bounds = await dialog.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toHaveCount(0);
});
