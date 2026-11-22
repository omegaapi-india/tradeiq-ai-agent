import { getCandles, getUniverse } from './market.js';

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values, period) {
  if (values.length < period) return average(values);
  return average(values.slice(-period));
}

function rsi(closes, period = 14) {
  if (closes.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = closes.length - period; i < closes.length; i += 1) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses -= change;
  }

  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function standardDeviation(values) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function analyzeSymbol(symbol, asOf = new Date()) {
  const candles = getCandles(symbol, asOf);
  if (!candles.length) return null;

  const closes = candles.map((candle) => candle.close);
  const last = closes[closes.length - 1];
  const previous = closes[closes.length - 2];
  const baseline = closes[closes.length - 6];
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsi14 = rsi(closes);
  const momentumPct = ((last - baseline) / baseline) * 100;
  const changePct = ((last - previous) / previous) * 100;
  const recent = candles.slice(-20);
  const avgVolume20 = average(recent.map((candle) => candle.volume));
  const volumeRatio = candles[candles.length - 1].volume / avgVolume20;
  const volatilityPct = (standardDeviation(closes.slice(-20)) / sma20) * 100;
  const high20 = Math.max(...closes.slice(-20));
  const low20 = Math.min(...closes.slice(-20));

  let score = 0;
  const reasons = [];

  if (last > sma20 && sma20 > sma50) {
    score += 24;
    reasons.push('Price is above both short and medium averages, so the trend is constructive.');
  } else if (last < sma20 && sma20 < sma50) {
    score -= 24;
    reasons.push('Price is below both averages, so the trend is weak.');
  } else {
    score += 4;
    reasons.push('The averages are close together, so the trend is still mixed.');
  }

  if (momentumPct > 2) {
    score += 15;
    reasons.push('Five-day momentum is strong and positive.');
  } else if (momentumPct < -2) {
    score -= 15;
    reasons.push('Five-day momentum is negative.');
  } else {
    reasons.push('Five-day momentum is neutral.');
  }

  if (rsi14 < 35) {
    score += 12;
    reasons.push('RSI is low, which can indicate a stretched-down setup.');
  } else if (rsi14 > 70) {
    score -= 12;
    reasons.push('RSI is high, so the move may be crowded.');
  } else {
    score += 3;
    reasons.push('RSI is in a balanced range.');
  }

  if (Math.abs(last - sma20) / sma20 < 0.02) {
    score += 8;
    reasons.push('Price is close to the 20-day average, reducing chase risk.');
  }

  if (volatilityPct < 2.2) {
    score += 5;
    reasons.push('Recent volatility is comparatively contained.');
  } else if (volatilityPct > 4) {
    score -= 5;
    reasons.push('Recent volatility is elevated, so position size should stay small.');
  }

  if (volumeRatio > 1.15) {
    score += 5;
    reasons.push('Latest volume is above its 20-day average.');
  }

  const action = score >= 16 ? 'Buy' : score <= -16 ? 'Reduce' : 'Hold';
  const confidence = clamp(Math.round(52 + score * 1.1), 38, 92);

  return {
    symbol,
    name: getUniverse().find((item) => item.symbol === symbol)?.name || symbol,
    asOf: candles[candles.length - 1].date,
    price: round(last),
    changePct: round(changePct),
    action,
    confidence,
    score: round(score, 1),
    indicators: {
      sma20: round(sma20),
      sma50: round(sma50),
      rsi: round(rsi14, 1),
      momentumPct: round(momentumPct),
      volatilityPct: round(volatilityPct),
      volumeRatio: round(volumeRatio)
    },
    levels: {
      support: round(low20),
      resistance: round(high20),
      stop: round(last * 0.97),
      target: round(last * 1.06)
    },
    reasons,
    candles: candles.slice(-60).map(({ date, close }) => ({ date, close })),
    dataNote: 'Simulated daily OHLC for demonstration only; not live market data.'
  };
}

export function getAllSignals(asOf = new Date()) {
  return getUniverse()
    .map((item) => analyzeSymbol(item.symbol, asOf))
    .filter(Boolean);
}

export function buildPrompt(signal) {
  return [
    'You are a cautious Indian equity research assistant for a demo app.',
    'Use only the supplied simulated indicators. Do not claim live data.',
    'Give a short plain-English explanation of the signal, one risk, and one question the user should ask before acting.',
    'Do not give personalised financial advice or instruct the user to place real trades.',
    '',
    'Symbol: ' + signal.symbol + ' (' + signal.name + ')',
    'Signal: ' + signal.action + ', confidence ' + signal.confidence + '%',
    'Close: ' + signal.price + ', day change: ' + signal.changePct + '%',
    'SMA20: ' + signal.indicators.sma20 + ', SMA50: ' + signal.indicators.sma50,
    'RSI: ' + signal.indicators.rsi + ', momentum: ' + signal.indicators.momentumPct + '%',
    'Volatility: ' + signal.indicators.volatilityPct + '%, volume ratio: ' + signal.indicators.volumeRatio,
    'Support: ' + signal.levels.support + ', resistance: ' + signal.levels.resistance
  ].join('\n');
}

export function fallbackExplanation(signal) {
  const lead =
    signal.action === 'Buy'
      ? 'The demo engine leans constructive because'
      : signal.action === 'Reduce'
        ? 'The demo engine turns cautious because'
        : 'The demo engine stays neutral because';

  return [
    lead + ' the trend, momentum, RSI, and volatility checks sum to a ' + signal.score + ' score.',
    signal.reasons.slice(0, 2).join(' '),
    'Risk: this is simulated data, not a live quote or personalised advice. Review the stop and target levels with your own research before making any decision.'
  ].join(' ');
}
