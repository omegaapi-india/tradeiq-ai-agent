// Tiny localhost-only bridge from the public demo to a local open LLM.
// It never stores prompts, never uses API keys, and never sees broker data.

import http from 'node:http';

const PORT = Number(process.env.BRIDGE_PORT || 8788);
const HOST = '127.0.0.1';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store'
};

function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...corsHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body)
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 32000) {
        reject(new Error('Request too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    request.on('error', reject);
  });
}

async function ollamaStatus() {
  try {
    const response = await fetch(OLLAMA_URL + '/api/tags', {
      signal: AbortSignal.timeout(2500)
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function askOllama(prompt) {
  const response = await fetch(OLLAMA_URL + '/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.2, num_predict: 220 }
    })
  });

  if (!response.ok) throw new Error('Ollama returned ' + response.status);
  const data = await response.json();
  const text = String(data.response || '').trim();
  if (!text) throw new Error('Ollama returned an empty answer.');
  return text;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    send(response, 200, {
      ok: true,
      bind: HOST + ':' + PORT,
      model: MODEL,
      ollamaReachable: await ollamaStatus()
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/explain') {
    let body;
    try {
      body = await readBody(request);
    } catch (error) {
      send(response, 400, { error: error.message });
      return;
    }

    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 6000) : '';
    if (!prompt) {
      send(response, 400, { error: 'A prompt string is required.' });
      return;
    }

    if (!(await ollamaStatus())) {
      send(response, 503, {
        error: 'Ollama is not reachable on ' + OLLAMA_URL,
        hint: 'Start Ollama, then run: ollama pull ' + MODEL
      });
      return;
    }

    try {
      const text = await askOllama(prompt);
      send(response, 200, { text, model: MODEL, source: 'local-open-llm' });
    } catch (error) {
      send(response, 502, { error: error.message, model: MODEL });
    }
    return;
  }

  send(response, 404, { error: 'Not found. Use GET /health or POST /api/explain.' });
});

server.listen(PORT, HOST, () => {
  console.log('TradeIQ LLM bridge listening on http://' + HOST + ':' + PORT);
  console.log('Model: ' + MODEL + ' | Ollama: ' + OLLAMA_URL);
});
