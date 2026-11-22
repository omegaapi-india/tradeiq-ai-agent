# TradeIQ — Explainable Trading Agent

**Live demo:** https://tradeiq-51x.pages.dev/

**Built by Krishna Prakash Ojha (Leon) — OmegaAPI:** https://omegaapi.com

TradeIQ is a portfolio-friendly demo of an explainable trading agent for Indian equities. It scores six simulated NSE-style tickers, highlights a transparent signal, optionally asks a **local open LLM** to explain the reasoning, and lets visitors practise with a virtual paper portfolio.

> **Important:** Prices are simulated, not live market data. Signals are not personalised financial advice. No broker keys, real orders, paid AI APIs, trackers, or third-party scripts are used.

## Why this project

Most “AI trading” demos hide their logic behind a paid API key. TradeIQ does the opposite: the scoring layer is readable, deterministic, and local-first. The LLM is optional and runs on your own machine through Ollama. If it is not running, the app automatically falls back to a plain-English rule-engine explanation.

## Features

### Signal engine

- Six Indian tickers: `RELIANCE`, `HDFCBANK`, `INFY`, `TCS`, `ICICIBANK`, `SBIN`.
- 90 deterministic weekday candles generated locally from a fixed seed.
- Five transparent checks: trend, 5-day momentum, RSI, volatility, and volume ratio.
- Each stock receives an action (`Buy`, `Hold`, or `Reduce`), confidence score, support, resistance, demo stop, and demo target.
- A responsive SVG-style canvas chart with no charting library.

### Open LLM reasoning

- Optional localhost bridge to Ollama.
- Recommended open models: `llama3.2`, `mistral`, or `qwen2.5`.
- The prompt is built server-side from the signal only — arbitrary browser text is never sent to the model.
- The bridge binds to `127.0.0.1` only.
- If Ollama is unavailable, the deterministic explanation appears automatically.

### Paper portfolio

- Starts with virtual ₹1,00,000.
- Paper buy and sell actions update cash, positions, realised P&L, and mark-to-market equity.
- Stored in the browser's `localStorage`; nothing is sent to a server or broker.
- Reset button restores the starting balance.

### Privacy and security

- No login, phone number, third-party chat buttons, analytics, cookies, or font CDN.
- Strict Content Security Policy with localhost-only LLM bridge allowance.
- Pages Functions return no personal data and accept no broker credentials.
- Contact is limited to `info@omegaapi.com` and Telegram.

## Architecture

```text
Browser UI
   |
   ├── GET  /api/signals  ──► Pages Function ──► lib/analysis.js + lib/market.js
   ├── POST /api/explain  ──► Pages Function ──► safe prompt + rule fallback
   ├── GET  /api/health   ──► Pages Function ──► status
   └── POST http://127.0.0.1:8788/api/explain ──► local bridge ──► local Ollama model

Paper portfolio ──► browser localStorage only
```

The static UI also imports the same analysis module directly, so signals still render if the Functions API is temporarily unavailable.

## Quick start

```bash
npm install
npm test
npm run dev
```

Open http://127.0.0.1:8787/.

### Run the optional local open LLM

Install Ollama, pull an open model, and start the bridge:

```bash
ollama pull llama3.2
npm run bridge
```

Then open the live demo and keep **Use local open LLM** enabled. The reasoning panel will show `Local llama3.2` when the bridge is reachable. Otherwise it shows `Rule engine (offline)`.

Optional bridge environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `BRIDGE_PORT` | `8788` | Localhost bridge port |
| `OLLAMA_MODEL` | `llama3.2` | Open model tag to use |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Local Ollama endpoint |

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/signals` | Full six-stock watchlist |
| `GET` | `/api/signals?symbol=INFY` | One filtered signal |
| `POST` | `/api/explain` | Safe prompt and deterministic fallback |
| `GET` | `/api/health` | Demo status |

Example:

```bash
curl "https://tradeiq-51x.pages.dev/api/signals?symbol=INFY"
```

```bash
curl -X POST https://tradeiq-51x.pages.dev/api/explain \
  -H 'content-type: application/json' \
  -d '{"symbol":"INFY"}'
```

The local bridge endpoint is:

```bash
curl -X POST http://127.0.0.1:8788/api/explain \
  -H 'content-type: application/json' \
  -d '{"prompt":"Explain this signal briefly."}'
```

## Scoring logic

The base score changes as follows:

- Price above both SMA20 and SMA50: `+24`; below both: `-24`.
- 5-day momentum above `2%`: `+15`; below `-2%`: `-15`.
- RSI below `35`: `+12`; above `70`: `-12`.
- Price within `2%` of SMA20: `+8`.
- Low volatility: `+5`; high volatility: `-5`.
- Volume above `1.15x` average: `+5`.

A score of `16` or more becomes `Buy`, `-16` or less becomes `Reduce`, and anything between becomes `Hold`. Confidence is derived from the score and clamped to `38–92%`.

## Tests

```bash
npm test
```

The suite covers deterministic candles, weekday-only OHLC, complete signals, finite indicators, safe prompts, API validation, paper trades, mark-to-market valuation, and corrupted-storage recovery.

## Screenshots

| File | What it shows |
|---|---|
| `screenshots/01-dashboard.png` | Signal universe and selected stock analysis |
| `screenshots/02-explanation.png` | Explainable reasoning panel with offline fallback |
| `screenshots/03-paper-portfolio.png` | Virtual positions, P&L, and recent paper activity |

## Deployment

The live demo was deployed manually:

```bash
npm test
npm run deploy
```

An optional GitHub Actions workflow is included as `docs/github-actions-deploy.yml.example`. Copy it to `.github/workflows/deploy.yml` to run tests and deploy on every push to `main`. Creating workflow files requires a GitHub token with the `workflow` scope.

The workflow expects these encrypted repository secrets if enabled:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Project structure

```text
assets/                 Browser UI, styles, config, and app logic
bridge/                 Localhost-only Ollama bridge
functions/api/          Cloudflare Pages Function routes
lib/                    Market feed, scoring engine, and portfolio maths
tests/                  Node test suite
screenshots/            Portfolio captures
_headers                CSP and security headers
wrangler.toml           Pages project configuration
```

## Contact for a custom build

Want this adapted for a real research desk, trading journal, or internal dashboard?

- Email: **info@omegaapi.com**
- Telegram: **https://t.me/Omegaapiofficial**
- Portfolio: **https://omegaapi.com**

## Demo access and data safety

Every public demo is a **3-day free trial**. Access is enforced by a signed, HttpOnly cookie issued by a Cloudflare Pages Function. There is no payment form, card field, subscription, or paid API key in any demo.

The cookie contains only a timestamp and a random nonce. No IP address, name, email, phone number, or order/booking/trade detail is stored in it. Customer-facing public pages and APIs continue to hide personal data, and existing data-retention rules still apply. Clearing browser cookies starts a fresh trial; a commercial deployment should add accounts and billing for hard entitlement control.

Local development and deployment need one extra secret:

```bash
# add to .dev.vars
DEMO_TRIAL_SECRET=replace-with-a-long-random-string

# upload for production
npx wrangler pages secret bulk .dev.vars --project-name tradeiq
```

## ❤️ Sponsor this project

If TradeIQ saves you time or helps your business, please consider sponsoring. It keeps the live demo online and lets me keep building free, open-source tools.

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-%E2%9D%A4-db61a2?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/omegaapi-india)

Even $1/month helps. Can't sponsor? A ⭐ on this repo or sharing it with someone who needs it helps too!

## License

MIT — see [LICENSE](LICENSE). Copyright © 2026 Krishna Prakash Ojha (Leon), OmegaAPI.
