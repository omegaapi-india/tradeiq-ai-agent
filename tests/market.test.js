import test from 'node:test';
import assert from 'node:assert/strict';

import { getCandles, getUniverse } from '../lib/market.js';

const AS_OF = new Date('2026-11-22T12:00:00Z');

test('universe contains six Indian equities', () => {
  const universe = getUniverse();
  assert.equal(universe.length, 6);
  assert.deepEqual(
    universe.map((item) => item.symbol),
    ['RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'ICICIBANK', 'SBIN']
  );
  assert.ok(universe.every((item) => item.name));
});

test('candles are deterministic for the same as-of date', () => {
  const first = getCandles('RELIANCE', AS_OF, 90);
  const second = getCandles('RELIANCE', AS_OF, 90);
  assert.deepEqual(first, second);
});

test('candles contain only weekdays and valid OHLC relationships', () => {
  const candles = getCandles('INFY', AS_OF, 90);

  assert.equal(candles.length, 90);
  assert.ok(candles.every((candle) => {
    const day = new Date(candle.date + 'T00:00:00Z').getUTCDay();
    return day !== 0 && day !== 6;
  }));
  assert.ok(candles.every((candle) =>
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close) &&
    candle.volume > 0
  ));
});

test('unknown symbols return no candles', () => {
  assert.deepEqual(getCandles('UNKNOWN', AS_OF), []);
});
