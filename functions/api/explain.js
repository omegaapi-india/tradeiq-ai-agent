import { analyzeSymbol, buildPrompt, fallbackExplanation } from '../../lib/analysis.js';

function badRequest(message) {
  return Response.json(
    { error: message },
    { status: 400, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return badRequest('Send a JSON body with a symbol.');
  }

  const symbol = typeof body?.symbol === 'string' ? body.symbol.toUpperCase().slice(0, 20) : '';
  const signal = analyzeSymbol(symbol);
  if (!signal) return badRequest('Unknown symbol.');

  return Response.json(
    {
      symbol,
      source: 'deterministic-rule-engine',
      prompt: buildPrompt(signal),
      fallback: fallbackExplanation(signal)
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
