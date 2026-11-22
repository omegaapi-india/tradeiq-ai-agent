import { getAllSignals } from '../../lib/analysis.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = url.searchParams.get('symbol');
  const signals = getAllSignals();
  const filtered = raw
    ? signals.filter((signal) => signal.symbol === raw.toUpperCase())
    : signals;

  if (raw && !filtered.length) {
    return Response.json(
      { error: 'Unknown symbol. Try RELIANCE, HDFCBANK, INFY, TCS, ICICIBANK, or SBIN.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return Response.json(
    {
      count: filtered.length,
      generatedFor: filtered[0]?.asOf || null,
      source: 'simulated-demo-feed',
      signals: filtered
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
