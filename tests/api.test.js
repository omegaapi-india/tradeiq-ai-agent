import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet as getSignals } from '../functions/api/signals.js';
import { onRequestPost as postExplain } from '../functions/api/explain.js';
import { onRequestGet as getHealth } from '../functions/api/health.js';

function context(path, options) {
  return { request: new Request('https://example.com' + path, options) };
}

test('health endpoint reports the demo architecture', async () => {
  const response = await getHealth(context('/api/health'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.llm, 'optional-local-open-llama-bridge');
});

test('signals endpoint returns the full watchlist', async () => {
  const response = await getSignals(context('/api/signals'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.count, 6);
  assert.equal(body.source, 'simulated-demo-feed');
  assert.equal(body.signals.length, 6);
  assert.ok(body.generatedFor);
});

test('signals endpoint filters symbols case-insensitively', async () => {
  const response = await getSignals(context('/api/signals?symbol=infy'));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.count, 1);
  assert.equal(body.signals[0].symbol, 'INFY');
});

test('signals endpoint rejects unknown symbols', async () => {
  const response = await getSignals(context('/api/signals?symbol=FAKE'));
  assert.equal(response.status, 404);
});

test('explain endpoint returns a safe prompt and fallback', async () => {
  const response = await postExplain(context('/api/explain', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ symbol: 'reliance' })
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.symbol, 'RELIANCE');
  assert.match(body.prompt, /simulated indicators/i);
  assert.match(body.fallback, /not a live quote or personalised advice/i);
});

test('explain endpoint validates input', async () => {
  const missing = await postExplain(context('/api/explain', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }));
  assert.equal(missing.status, 400);

  const broken = await postExplain(context('/api/explain', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json'
  }));
  assert.equal(broken.status, 400);
});
