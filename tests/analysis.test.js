import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSymbol,
  buildPrompt,
  fallbackExplanation,
  getAllSignals
} from '../lib/analysis.js';

const AS_OF = new Date('2026-11-22T12:00:00Z');

test('every symbol produces a complete signal', () => {
  const signals = getAllSignals(AS_OF);
  assert.equal(signals.length, 6);

  for (const signal of signals) {
    assert.ok(signal.symbol);
    assert.ok(signal.name);
    assert.ok(signal.price > 0);
    assert.ok(['Buy', 'Hold', 'Reduce'].includes(signal.action));
    assert.ok(signal.confidence >= 38 && signal.confidence <= 92);
    assert.ok(signal.reasons.length >= 3);
    assert.equal(signal.candles.length, 60);
    assert.ok(signal.levels.stop < signal.price);
    assert.ok(signal.levels.target > signal.price);
    assert.match(signal.dataNote, /simulated/i);
  }
});

test('indicators are finite numbers', () => {
  const signal = analyzeSymbol('HDFCBANK', AS_OF);
  const values = Object.values(signal.indicators);

  assert.ok(values.every((value) => Number.isFinite(value)));
  assert.ok(signal.indicators.rsi >= 0 && signal.indicators.rsi <= 100);
  assert.ok(signal.indicators.volumeRatio > 0);
});

test('prompt and fallback explanation are explicit about demo data', () => {
  const signal = analyzeSymbol('TCS', AS_OF);
  const prompt = buildPrompt(signal);
  const fallback = fallbackExplanation(signal);

  assert.match(prompt, /simulated indicators/i);
  assert.match(prompt, /Do not give personalised financial advice/i);
  assert.match(fallback, /simulated data/i);
  assert.match(fallback, /not a live quote/i);
});

test('unknown symbol cannot be analyzed', () => {
  assert.equal(analyzeSymbol('FAKE', AS_OF), null);
});
