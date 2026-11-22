// Deterministic, simulated Indian equity OHLC feed for portfolio demos.
// No broker keys, no live quotes, and no network calls.

const UNIVERSE = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', base: 2980, drift: 0.00030, vol: 0.014 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', base: 1680, drift: 0.00026, vol: 0.012 },
  { symbol: 'INFY', name: 'Infosys', base: 1840, drift: 0.00034, vol: 0.015 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', base: 4120, drift: 0.00024, vol: 0.013 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', base: 1280, drift: 0.00032, vol: 0.016 },
  { symbol: 'SBIN', name: 'State Bank of India', base: 820, drift: 0.00028, vol: 0.018 }
];

export function getUniverse() {
  return UNIVERSE.map(({ symbol, name }) => ({ symbol, name }));
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function istDateKey(value) {
  return new Date(value.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

function weekdayKeys(asOf, count) {
  const keys = [];
  const cursor = new Date(istDateKey(asOf) + 'T00:00:00Z');

  while (keys.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return keys.reverse();
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function getCandles(symbol, asOf = new Date(), count = 90) {
  const meta = UNIVERSE.find((item) => item.symbol === symbol);
  if (!meta) return [];

  const dates = weekdayKeys(asOf, Math.max(30, count));
  const random = mulberry32(hashString(meta.symbol + '|' + dates[0]));
  let price = meta.base * (0.94 + random() * 0.12);

  return dates.map((date, index) => {
    const shock = (random() + random() + random() - 1.5) * meta.vol;
    const cycle = Math.sin(index / 9) * meta.vol * 0.28;
    const open = price;
    const close = Math.max(20, open * (1 + meta.drift + cycle + shock));
    const wick = meta.vol * (0.35 + random() * 0.75);
    const high = Math.max(open, close) * (1 + wick * random());
    const low = Math.max(10, Math.min(open, close) * (1 - wick * random()));
    const volume = Math.round((900000 + random() * 2100000) * (1 + Math.abs(shock) * 18));

    price = close;
    return {
      date,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume
    };
  });
}
