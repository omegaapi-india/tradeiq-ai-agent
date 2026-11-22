import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STARTING_CASH,
  buy,
  emptyPortfolio,
  loadPortfolio,
  savePortfolio,
  sell,
  valuation
} from '../lib/portfolio.js';

const signals = [
  { symbol: 'INFY', price: 1900 },
  { symbol: 'TCS', price: 4200 }
];

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value)
  };
}

test('a fresh portfolio starts with virtual cash only', () => {
  const portfolio = emptyPortfolio();
  assert.equal(portfolio.cash, STARTING_CASH);
  assert.deepEqual(portfolio.positions, []);
  assert.deepEqual(portfolio.history, []);
});

test('paper buys and sells update cash and realised P&L', () => {
  let portfolio = emptyPortfolio();

  const bought = buy(portfolio, 'INFY', 10, 1800);
  assert.equal(bought.error, null);
  portfolio = bought.portfolio;
  assert.equal(portfolio.cash, STARTING_CASH - 18000);
  assert.equal(portfolio.positions[0].qty, 10);

  const sold = sell(portfolio, 'INFY', 4, 1900);
  assert.equal(sold.error, null);
  portfolio = sold.portfolio;
  assert.equal(portfolio.positions[0].qty, 6);
  assert.equal(portfolio.history[0].realized, 400);
});

test('invalid and unaffordable trades are rejected', () => {
  const portfolio = emptyPortfolio();

  assert.match(buy(portfolio, 'TCS', 0, 100).error, /valid/i);
  assert.match(buy(portfolio, 'TCS', -5, 100).error, /valid/i);
  assert.match(buy(portfolio, 'TCS', 100, 5000).error, /Not enough virtual cash/i);
  assert.match(sell(portfolio, 'INFY', 1, 100).error, /No matching position/i);
});

test('valuation marks positions to the current simulated price', () => {
  let portfolio = emptyPortfolio();
  portfolio = buy(portfolio, 'INFY', 10, 1800).portfolio;

  const view = valuation(portfolio, signals);
  assert.equal(view.equity, STARTING_CASH + 1000);
  assert.equal(view.unrealized, 1000);
  assert.equal(view.positions[0].marketPrice, 1900);
  assert.equal(view.deployedPct, 18);
});

test('portfolio survives a storage round trip', () => {
  const storage = fakeStorage();
  const portfolio = buy(emptyPortfolio(), 'TCS', 2, 4100).portfolio;

  savePortfolio(storage, portfolio);
  assert.deepEqual(loadPortfolio(storage), portfolio);
});

test('corrupted storage falls back to a clean portfolio', () => {
  const storage = fakeStorage();
  storage.setItem('tradeiq.portfolio.v1', '{broken');

  assert.deepEqual(loadPortfolio(storage), emptyPortfolio());
});
