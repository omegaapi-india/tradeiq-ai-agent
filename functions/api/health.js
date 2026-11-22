export async function onRequestGet() {
  return Response.json(
    {
      ok: true,
      product: 'TradeIQ',
      data: 'simulated-indian-equity-demo',
      llm: 'optional-local-open-llama-bridge'
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
