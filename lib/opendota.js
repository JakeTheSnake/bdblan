// Throttled OpenDota API client.
// - Reads OPENDOTA_API_KEY from env (appended as ?api_key=...).
// - Simple token-bucket limiting to OPENDOTA_RPS requests/second.
// - Retries on 429 and 5xx with exponential backoff.

const BASE = 'https://api.opendota.com/api';

const RPS = Number(process.env.OPENDOTA_RPS || 30);
let _available = RPS;
let _lastRefill = Date.now();
const _queue = [];

function refill() {
  const now = Date.now();
  const elapsed = (now - _lastRefill) / 1000;
  _available = Math.min(RPS, _available + elapsed * RPS);
  _lastRefill = now;
}

function takeToken() {
  return new Promise((resolve) => {
    const tryTake = () => {
      refill();
      if (_available >= 1) {
        _available -= 1;
        resolve();
      } else {
        const waitMs = Math.max(20, ((1 - _available) / RPS) * 1000);
        setTimeout(tryTake, waitMs);
      }
    };
    tryTake();
  });
}

let _loggedKeyOnce = false;

async function request(pathAndQuery) {
  const url = new URL(BASE + pathAndQuery);
  const key = process.env.OPENDOTA_API_KEY;
  if (!_loggedKeyOnce) {
    _loggedKeyOnce = true;
    if (!key) {
      console.log('[opendota] OPENDOTA_API_KEY is NOT set — requests will be anonymous');
    } else {
      const masked = key.length <= 4 ? '*'.repeat(key.length) : `${key.slice(0, 2)}…${key.slice(-2)}`;
      console.log(`[opendota] OPENDOTA_API_KEY loaded (length=${key.length}, sample=${masked})`);
    }
  }
  if (key) url.searchParams.set('api_key', key);

  // Debug-friendly URL without the api_key query param.
  const displayUrl = `${url.origin}${url.pathname}${
    (() => {
      const sp = new URLSearchParams(url.search);
      sp.delete('api_key');
      const s = sp.toString();
      return s ? `?${s}` : '';
    })()
  }`;

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await takeToken();
    const started = Date.now();
    console.log(`[opendota] → GET ${displayUrl}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
    let res;
    try {
      res = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
    } catch (e) {
      console.log(`[opendota] ✗ ${displayUrl} — network error: ${e?.message || e}`);
      throw e;
    }
    const ms = Date.now() - started;
    console.log(`[opendota] ← ${res.status} ${res.statusText} ${displayUrl} (${ms}ms)`);

    if (res.ok) {
      const text = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        console.log(
          `[opendota]   body parse error (${text.length}b): ${text.slice(0, 200)}`,
        );
        throw e;
      }
      const shape = Array.isArray(parsed)
        ? `array(${parsed.length})`
        : `${typeof parsed}${parsed && typeof parsed === 'object' ? ` keys=${Object.keys(parsed).slice(0, 8).join(',')}` : ''}`;
      console.log(`[opendota]   body ${text.length}b ${shape}`);
      return parsed;
    }

    // Retry on rate limit or server errors
    if (res.status === 429 || res.status >= 500) {
      const backoff = Math.min(30_000, 500 * 2 ** (attempt - 1));
      console.log(`[opendota] retrying in ${backoff}ms (status ${res.status})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    const body = await res.text().catch(() => '');
    throw new Error(`OpenDota ${res.status} ${res.statusText}: ${pathAndQuery} — ${body.slice(0, 200)}`);
  }
  throw new Error(`OpenDota request failed after ${maxAttempts} attempts: ${pathAndQuery}`);
}

export async function getPlayerMatches(accountId, { limit } = {}) {
  const lim = limit ?? Number(process.env.OPENDOTA_MATCH_HISTORY_LIMIT || 100);
  return request(`/players/${accountId}/matches?limit=${lim}`);
}

export async function getPlayer(accountId) {
  return request(`/players/${accountId}`);
}

export async function getMatch(matchId) {
  return request(`/matches/${matchId}`);
}

export async function getHeroes() {
  return request(`/heroes`);
}

export async function getHeroStats() {
  // /heroStats includes img and icon urls whereas /heroes may not on all deployments.
  return request(`/heroStats`);
}
