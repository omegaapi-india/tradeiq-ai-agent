export const STARTING_CASH = 100000;

export function emptyPortfolio() {
  return { cash: STARTING_CASH, positions: [], history: [] };
}

function clone(portfolio) {
  return JSON.parse(JSON.stringify(portfolio));
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function validPortfolio(value) {
  return (
    value &&
    Number.isFinite(value.cash) &&
    Array.isArray(value.positions) &&
    Array.isArray(value.history)
  );
}

export function loadPortfolio(storage) {
  if (!storage) return emptyPortfolio();
  try {
    const raw = storage.getItem('tradeiq.portfolio.v1');
    if (!raw) return emptyPortfolio();
    const parsed = JSON.parse(raw);
    return validPortfolio(parsed) ? parsed : emptyPortfolio();
  } catch {
    return emptyPortfolio();
  }
}

export function savePortfolio(storage, portfolio) {
  if (!storage) return;
  try {
    storage.setItem('tradeiq.portfolio.v1', JSON.stringify(portfolio));
  } catch {
    // Storage can be unavailable in private modes; the in-memory state still works.
  }
}

export function buy(portfolio, symbol, quantity, price) {
  const qty = Math.floor(Number(quantity));
  const px = Number(price);

  if (!symbol || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
    return { portfolio, error: 'Enter a valid symbol, quantity, and price.' };
  }

  const cost = qty * px;
  if (cost > portfolio.cash) {
    return { portfolio, error: 'Not enough virtual cash for this paper trade.' };
  }

  const next = clone(portfolio);
  const existing = next.positions.find((position) => position.symbol === symbol);

  if (existing) {
    const totalQty = existing.qty + qty;
    existing.avgPrice = round((existing.avgPrice * existing.qty + cost) / totalQty);
    existing.qty = totalQty;
  } else {
    next.positions.push({ symbol, qty, avgPrice: round(px) });
  }

  next.cash = round(next.cash - cost);
  next.history.unshift({
    type: 'BUY',
    symbol,
    qty,
    price: round(px),
    time: new Date().toISOString()
  });

  return { portfolio: next, error: null };
}

export function sell(portfolio, symbol, quantity, price) {
  const qty = Math.floor(Number(quantity));
  const px = Number(price);
  const position = portfolio.positions.find((item) => item.symbol === symbol);

  if (!position || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(px) || px <= 0) {
    return { portfolio, error: 'No matching position or invalid trade details.' };
  }

  const sellQty = Math.min(qty, position.qty);
  const next = clone(portfolio);
  const target = next.positions.find((item) => item.symbol === symbol);
  const realized = round((px - target.avgPrice) * sellQty);

  target.qty -= sellQty;
  next.cash = round(next.cash + sellQty * px);
  next.history.unshift({
    type: 'SELL',
    symbol,
    qty: sellQty,
    price: round(px),
    realized,
    time: new Date().toISOString()
  });

  if (target.qty === 0) {
    next.positions = next.positions.filter((item) => item.symbol !== symbol);
  }

  return { portfolio: next, error: null };
}

export function valuation(portfolio, signals) {
  const priceMap = new Map(signals.map((signal) => [signal.symbol, signal.price]));
  const positions = portfolio.positions.map((position) => {
    const marketPrice = priceMap.get(position.symbol) || position.avgPrice;
    const value = round(marketPrice * position.qty);
    const invested = round(position.avgPrice * position.qty);
    return {
      ...position,
      marketPrice: round(marketPrice),
      value,
      invested,
      unrealized: round(value - invested),
      unrealizedPct: round(((marketPrice - position.avgPrice) / position.avgPrice) * 100)
    };
  });

  const holdingsValue = round(positions.reduce((sum, position) => sum + position.value, 0));
  const equity = round(portfolio.cash + holdingsValue);
  const invested = round(positions.reduce((sum, position) => sum + position.invested, 0));
  const unrealized = round(positions.reduce((sum, position) => sum + position.unrealized, 0));
  const realized = round(portfolio.history.reduce((sum, item) => sum + (item.realized || 0), 0));

  return {
    cash: round(portfolio.cash),
    holdingsValue,
    equity,
    unrealized,
    realized,
    totalPnl: round(equity - STARTING_CASH),
    totalPnlPct: round(((equity - STARTING_CASH) / STARTING_CASH) * 100),
    positions,
    history: portfolio.history.slice(0, 8),
    deployedPct: round((invested / STARTING_CASH) * 100)
  };
}
