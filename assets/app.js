import { CONFIG } from './config.js';
import { getAllSignals } from '../lib/analysis.js';
import {
  buy,
  emptyPortfolio,
  loadPortfolio,
  savePortfolio,
  sell,
  valuation
} from '../lib/portfolio.js';

const state = {
  signals: [],
  selected: null,
  portfolio: loadPortfolio(window.localStorage),
  useLocalLlm: true,
  explainToken: 0
};

const el = {
  cards: document.getElementById('signalCards'),
  universeCount: document.getElementById('universeCount'),
  feedDate: document.getElementById('feedDate'),
  disclaimerText: document.getElementById('disclaimerText'),
  symbolName: document.getElementById('symbolName'),
  symbolCode: document.getElementById('symbolCode'),
  priceValue: document.getElementById('priceValue'),
  changeValue: document.getElementById('changeValue'),
  actionBadge: document.getElementById('actionBadge'),
  confidenceValue: document.getElementById('confidenceValue'),
  chart: document.getElementById('priceChart'),
  indicatorGrid: document.getElementById('indicatorGrid'),
  reasonList: document.getElementById('reasonList'),
  levelGrid: document.getElementById('levelGrid'),
  explainStatus: document.getElementById('explainStatus'),
  explainText: document.getElementById('explainText'),
  llmToggle: document.getElementById('llmToggle'),
  retryExplain: document.getElementById('retryExplain'),
  localBtn: document.getElementById('localBtn'),
  tradeSymbol: document.getElementById('tradeSymbol'),
  tradeQty: document.getElementById('tradeQty'),
  tradePrice: document.getElementById('tradePrice'),
  buyBtn: document.getElementById('buyBtn'),
  sellBtn: document.getElementById('sellBtn'),
  tradeMessage: document.getElementById('tradeMessage'),
  equityValue: document.getElementById('equityValue'),
  cashValue: document.getElementById('cashValue'),
  pnlValue: document.getElementById('pnlValue'),
  deployedValue: document.getElementById('deployedValue'),
  positionsBody: document.getElementById('positionsBody'),
  historyList: document.getElementById('historyList'),
  resetBtn: document.getElementById('resetBtn')
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function money(value, decimals = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value) || 0);
}

function signedMoney(value) {
  const amount = Number(value) || 0;
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return sign + money(Math.abs(amount), 2);
}

function pct(value) {
  const amount = Number(value) || 0;
  return (amount > 0 ? '+' : '') + amount.toFixed(2) + '%';
}

function actionClass(action) {
  if (action === 'Buy') return 'buy';
  if (action === 'Reduce') return 'reduce';
  return 'hold';
}

function confClass(confidence) {
  if (confidence >= 70) return 'high';
  if (confidence >= 50) return 'mid';
  return 'low';
}

function timeoutSignal(ms) {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined;
}

function setMessage(text, kind = '') {
  el.tradeMessage.textContent = text;
  el.tradeMessage.className = 'form-message' + (kind ? ' ' + kind : '');
}

function renderCards() {
  el.cards.innerHTML = state.signals.map((signal) => `
    <button class="signal-card ${signal.symbol === state.selected.symbol ? 'is-active' : ''}"
            data-symbol="${esc(signal.symbol)}" type="button">
      <span class="signal-top">
        <span class="signal-code">${esc(signal.symbol)}</span>
        <span class="badge ${actionClass(signal.action)}">${esc(signal.action)}</span>
      </span>
      <span class="signal-name">${esc(signal.name)}</span>
      <span class="signal-bottom">
        <span>${money(signal.price, 2)}</span>
        <span class="${signal.changePct >= 0 ? 'up' : 'down'}">${pct(signal.changePct)}</span>
      </span>
      <span class="confidence-track" aria-label="Confidence ${signal.confidence}%">
        <span class="confidence-fill ${confClass(signal.confidence)}" data-confidence="${signal.confidence}"></span>
      </span>
    </button>
  `).join('');

  requestAnimationFrame(() => {
    el.cards.querySelectorAll('[data-confidence]').forEach((node) => {
      node.style.width = node.dataset.confidence + '%';
    });
  });
}

function drawChart(signal) {
  if (!signal || !el.chart) return;

  const canvas = el.chart;
  const context = canvas.getContext('2d');
  if (!context) return;

  const cssWidth = Math.max(320, canvas.getBoundingClientRect().width || 720);
  const cssHeight = 260;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(cssWidth * ratio);
  canvas.height = Math.floor(cssHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const values = signal.candles.map((candle) => candle.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const left = 16;
  const right = 16;
  const top = 20;
  const bottom = 30;
  const plotHeight = cssHeight - top - bottom;
  const plotWidth = cssWidth - left - right;
  const xAt = (index) => left + (index * plotWidth) / (values.length - 1);
  const yAt = (value) => top + (1 - (value - min) / span) * plotHeight;

  context.strokeStyle = 'rgba(148, 163, 184, 0.15)';
  context.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (i * plotHeight) / 4;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(cssWidth - right, y);
    context.stroke();
  }

  const gradient = context.createLinearGradient(0, top, 0, top + plotHeight);
  gradient.addColorStop(0, 'rgba(45, 212, 191, 0.28)');
  gradient.addColorStop(1, 'rgba(45, 212, 191, 0)');

  context.beginPath();
  context.moveTo(xAt(0), yAt(values[0]));
  values.forEach((value, index) => context.lineTo(xAt(index), yAt(value)));
  context.lineTo(xAt(values.length - 1), top + plotHeight);
  context.lineTo(xAt(0), top + plotHeight);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  values.forEach((value, index) => {
    const x = xAt(index);
    const y = yAt(value);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = '#2dd4bf';
  context.lineWidth = 2.2;
  context.stroke();

  context.beginPath();
  context.arc(xAt(values.length - 1), yAt(values[values.length - 1]), 4, 0, Math.PI * 2);
  context.fillStyle = '#e8f1f5';
  context.fill();

  context.fillStyle = '#93a9b8';
  context.font = '12px system-ui, sans-serif';
  context.fillText(money(max), left, 14);
  context.fillText(money(min), left, cssHeight - 9);
  context.textAlign = 'right';
  context.fillText(signal.candles[signal.candles.length - 1].date, cssWidth - right, cssHeight - 9);
  context.textAlign = 'left';
}

function renderDetail(signal) {
  el.symbolName.textContent = signal.name;
  el.symbolCode.textContent = signal.symbol + ' · ' + signal.asOf;
  el.priceValue.textContent = money(signal.price, 2);
  el.changeValue.textContent = pct(signal.changePct);
  el.changeValue.className = signal.changePct >= 0 ? 'up' : 'down';
  el.actionBadge.textContent = signal.action;
  el.actionBadge.className = 'badge ' + actionClass(signal.action);
  el.confidenceValue.textContent = signal.confidence + '%';

  const indicators = [
    ['SMA 20', money(signal.indicators.sma20, 2)],
    ['SMA 50', money(signal.indicators.sma50, 2)],
    ['RSI 14', signal.indicators.rsi],
    ['Momentum', pct(signal.indicators.momentumPct)],
    ['Volatility', signal.indicators.volatilityPct + '%'],
    ['Volume ratio', signal.indicators.volumeRatio + 'x']
  ];

  const levels = [
    ['Support', money(signal.levels.support, 2)],
    ['Resistance', money(signal.levels.resistance, 2)],
    ['Demo stop / target', money(signal.levels.stop, 2) + ' / ' + money(signal.levels.target, 2)]
  ];

  el.indicatorGrid.innerHTML = indicators.map(([label, value]) => `
    <div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>
  `).join('');

  el.levelGrid.innerHTML = levels.map(([label, value]) => `
    <div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>
  `).join('');

  el.reasonList.innerHTML = signal.reasons.map((reason) => `<li>${esc(reason)}</li>`).join('');
  requestAnimationFrame(() => drawChart(signal));
}

function renderPortfolio() {
  const view = valuation(state.portfolio, state.signals);

  el.equityValue.textContent = money(view.equity);
  el.cashValue.textContent = money(view.cash);
  el.pnlValue.textContent = signedMoney(view.totalPnl);
  el.pnlValue.className = view.totalPnl >= 0 ? 'up' : 'down';
  el.deployedValue.textContent = view.deployedPct + '%';

  el.positionsBody.innerHTML = view.positions.length
    ? view.positions.map((position) => `
        <tr>
          <td>${esc(position.symbol)}</td>
          <td>${position.qty}</td>
          <td>${money(position.avgPrice, 2)}</td>
          <td>${money(position.marketPrice, 2)}</td>
          <td class="${position.unrealized >= 0 ? 'up' : 'down'}">${signedMoney(position.unrealized)}</td>
        </tr>
      `).join('')
    : '<tr><td class="empty" colspan="5">No open paper positions yet.</td></tr>';

  el.historyList.innerHTML = view.history.length
    ? view.history.map((item) => {
        const change = item.type === 'SELL' && Number.isFinite(item.realized)
          ? '<span class="' + (item.realized >= 0 ? 'up' : 'down') + '">' + signedMoney(item.realized) + '</span>'
          : '<span>' + money(item.qty * item.price, 0) + '</span>';
        return `
          <li>
            <span class="history-dot ${item.type === 'BUY' ? 'buy' : 'sell'}"></span>
            <span><strong>${esc(item.type)}</strong> ${item.qty} ${esc(item.symbol)} @ ${money(item.price, 2)}</span>
            ${change}
          </li>
        `;
      }).join('')
    : '<li class="empty">No trades yet. Try a paper buy above.</li>';
}

async function requestExplanation(signal) {
  const token = ++state.explainToken;
  el.explainStatus.textContent = 'Preparing…';
  el.explainStatus.className = 'status-chip';
  el.explainText.textContent = '';

  try {
    const baseResponse = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ symbol: signal.symbol }),
      signal: timeoutSignal(8000)
    });
    if (!baseResponse.ok) throw new Error('Explanation service unavailable.');
    const base = await baseResponse.json();
    if (token !== state.explainToken) return;

    if (state.useLocalLlm) {
      el.explainStatus.textContent = 'Local LLM thinking…';
      try {
        const llmResponse = await fetch(CONFIG.bridgeUrl + '/api/explain', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: base.prompt }),
          signal: timeoutSignal(9000)
        });
        if (!llmResponse.ok) throw new Error('Bridge unavailable.');
        const llm = await llmResponse.json();
        if (token !== state.explainToken) return;
        el.explainText.textContent = llm.text;
        el.explainStatus.textContent = 'Local ' + llm.model;
        el.explainStatus.className = 'status-chip local';
        return;
      } catch {
        if (token !== state.explainToken) return;
      }
    }

    el.explainText.textContent = base.fallback;
    el.explainStatus.textContent = 'Rule engine (offline)';
    el.explainStatus.className = 'status-chip fallback';
  } catch {
    if (token !== state.explainToken) return;
    el.explainText.textContent =
      signal.reasons.slice(0, 2).join(' ') +
      ' Explanation service is temporarily unavailable, but the scored reasons above remain valid.';
    el.explainStatus.textContent = 'Local reasons';
    el.explainStatus.className = 'status-chip fallback';
  }
}

function populateTradeSymbols() {
  el.tradeSymbol.innerHTML = state.signals.map((signal) => `
    <option value="${esc(signal.symbol)}">${esc(signal.symbol)} — ${esc(signal.name)}</option>
  `).join('');
}

function selectSignal(symbol) {
  const signal = state.signals.find((item) => item.symbol === symbol);
  if (!signal) return;

  state.selected = signal;
  el.tradeSymbol.value = signal.symbol;
  el.tradePrice.value = String(signal.price);
  renderCards();
  renderDetail(signal);
  requestExplanation(signal);
}

async function loadSignals() {
  try {
    const response = await fetch('/api/signals', {
      headers: { accept: 'application/json' },
      signal: timeoutSignal(8000)
    });
    if (!response.ok) throw new Error('Signals API unavailable.');
    const data = await response.json();
    if (!Array.isArray(data.signals) || !data.signals.length) throw new Error('Empty signal feed.');
    state.signals = data.signals;
  } catch {
    state.signals = getAllSignals();
  }

  el.universeCount.textContent = String(state.signals.length);
  el.feedDate.textContent = state.signals[0].asOf;
  el.disclaimerText.textContent = CONFIG.disclaimer;
  populateTradeSymbols();
  selectSignal(state.signals[0].symbol);
  renderPortfolio();
}

function commitTrade(type) {
  const symbol = el.tradeSymbol.value;
  const quantity = el.tradeQty.value;
  const price = el.tradePrice.value;
  const result = type === 'BUY'
    ? buy(state.portfolio, symbol, quantity, price)
    : sell(state.portfolio, symbol, quantity, price);

  if (result.error) {
    setMessage(result.error, 'error');
    return;
  }

  state.portfolio = result.portfolio;
  savePortfolio(window.localStorage, state.portfolio);
  setMessage(type === 'BUY'
    ? 'Paper buy recorded for ' + symbol + '.'
    : 'Paper sell recorded for ' + symbol + '.', 'success');
  renderPortfolio();
}

el.cards.addEventListener('click', (event) => {
  const button = event.target.closest('[data-symbol]');
  if (button) selectSignal(button.dataset.symbol);
});

el.tradeSymbol.addEventListener('change', () => {
  const signal = state.signals.find((item) => item.symbol === el.tradeSymbol.value);
  if (signal) el.tradePrice.value = String(signal.price);
});

el.buyBtn.addEventListener('click', () => commitTrade('BUY'));
el.sellBtn.addEventListener('click', () => commitTrade('SELL'));

el.resetBtn.addEventListener('click', () => {
  if (!window.confirm('Reset the virtual portfolio to ' + money(CONFIG.startingCash) + '?')) return;
  state.portfolio = emptyPortfolio();
  savePortfolio(window.localStorage, state.portfolio);
  setMessage('Virtual portfolio reset.', 'success');
  renderPortfolio();
});

el.llmToggle.addEventListener('change', () => {
  state.useLocalLlm = el.llmToggle.checked;
  if (state.selected) requestExplanation(state.selected);
});

el.retryExplain.addEventListener('click', () => {
  if (state.selected) requestExplanation(state.selected);
});

el.localBtn.addEventListener('click', () => {
  el.llmToggle.checked = true;
  state.useLocalLlm = true;
  document.getElementById('llm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (state.selected) requestExplanation(state.selected);
});

let resizeFrame = 0;
window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => drawChart(state.selected));
});

loadSignals();
