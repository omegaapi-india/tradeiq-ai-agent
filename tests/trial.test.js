import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COOKIE_NAME,
  TRIAL_SECONDS,
  createTrialToken,
  onRequest
} from '../functions/_middleware.js';

const SECRET = 'test-secret-'.repeat(6);

function context(path, cookie) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  return {
    request: new Request('https://example.com' + path, { headers }),
    env: { DEMO_TRIAL_SECRET: SECRET },
    next: async () => new Response('OK', { status: 200 })
  };
}

function cookiePair(response) {
  const value = response.headers.get('set-cookie');
  return value ? value.split(';')[0] : '';
}

test('first visit issues a signed three-day cookie', async () => {
  const response = await onRequest(context('/'));
  const header = response.headers.get('set-cookie');

  assert.equal(response.status, 200);
  assert.match(header, new RegExp('^' + COOKIE_NAME + '='));
  assert.match(header, /Max-Age=259200/);
  assert.match(header, /HttpOnly/);
  assert.equal(TRIAL_SECONDS, 259200);
});

test('a valid cookie is accepted without issuing a new one', async () => {
  const first = await onRequest(context('/'));
  const second = await onRequest(context('/about', cookiePair(first)));

  assert.equal(second.status, 200);
  assert.equal(second.headers.get('set-cookie'), null);
});

test('an expired token redirects to the trial page', async () => {
  const expired = await createTrialToken(SECRET, Date.now() - (TRIAL_SECONDS + 60) * 1000);
  const response = await onRequest(context('/', COOKIE_NAME + '=' + expired));

  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /trial-ended(?:\.html)?$/);
});

test('a tampered token is rejected', async () => {
  const token = await createTrialToken(SECRET);
  const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  const response = await onRequest(context('/', COOKIE_NAME + '=' + tampered));

  assert.equal(response.status, 302);
});

test('an expired API call returns JSON instead of HTML', async () => {
  const expired = await createTrialToken(SECRET, Date.now() - (TRIAL_SECONDS + 60) * 1000);
  const response = await onRequest(context('/api/signals', COOKIE_NAME + '=' + expired));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.error, 'Demo trial has ended.');
  assert.equal(body.contactEmail, 'info@omegaapi.com');
});

test('the trial page and stylesheet stay reachable', async () => {
  const page = await onRequest(context('/trial-ended'));
  const css = await onRequest(context('/trial.css'));

  assert.equal(page.status, 200);
  assert.equal(css.status, 200);
});
