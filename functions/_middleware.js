const TRIAL_DAYS = 3;
const TRIAL_SECONDS = TRIAL_DAYS * 24 * 60 * 60;
const TRIAL_MS = TRIAL_SECONDS * 1000;
const COOKIE_NAME = 'tradeiq_trial';
const CONTACT_EMAIL = 'info@omegaapi.com';
const TELEGRAM = 'https://t.me/Omegaapiofficial';
const ALLOWED_PATHS = ['/trial-ended', '/trial-ended.html', '/trial.css'];

const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input) {
  const normalized = String(input).replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  const padding = remainder === 0 ? '' : '='.repeat(4 - remainder);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signValue(payload, secret) {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifyValue(payload, signature, secret) {
  try {
    const key = await hmacKey(secret);
    return await crypto.subtle.verify('HMAC', key, base64UrlDecode(signature), encoder.encode(payload));
  } catch {
    return false;
  }
}

function randomNonce() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createTrialToken(secret, issuedAt) {
  const payload = String(issuedAt || Date.now()) + '.' + randomNonce();
  const signature = await signValue(payload, secret);
  return payload + '.' + signature;
}

async function verifyToken(token, secret) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const issuedAt = Number(parts[0]);
  const nonce = parts[1];
  const signature = parts[2];

  if (!Number.isSafeInteger(issuedAt) || !nonce || !signature) return false;

  const age = Date.now() - issuedAt;
  if (age > TRIAL_MS || age < -60000) return false;

  return verifyValue(issuedAt + '.' + nonce, signature, secret);
}

function readCookie(header, name) {
  if (!header) return null;
  const prefix = name + '=';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function buildCookie(token, url) {
  const parts = [
    COOKIE_NAME + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=' + TRIAL_SECONDS
  ];
  if (url.protocol === 'https:') parts.push('Secure');
  return parts.join('; ');
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env || {};
  const next = context.next;
  const url = new URL(request.url);

  if (ALLOWED_PATHS.indexOf(url.pathname) !== -1) return next();

  const secret = env.DEMO_TRIAL_SECRET;
  if (!secret) {
    console.warn('TradeIQ: DEMO_TRIAL_SECRET is not set; trial check skipped.');
    return next();
  }

  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);

  if (token && !(await verifyToken(token, secret))) {
    if (url.pathname.indexOf('/api/') === 0) {
      return Response.json(
        {
          error: 'Demo trial has ended.',
          contactEmail: CONTACT_EMAIL,
          telegram: TELEGRAM
        },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return Response.redirect(new URL('/trial-ended', request.url).toString(), 302);
  }

  const response = await next();
  if (!token) {
    const fresh = await createTrialToken(secret);
    response.headers.append('Set-Cookie', buildCookie(fresh, url));
  }
  return response;
}

export { COOKIE_NAME, TRIAL_SECONDS };
