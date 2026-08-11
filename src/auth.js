// Dual billing rail. x402 is handled by the payment middleware; this module is the
// API-key rail for buyers who will never hold USDC — which, for EU trade compliance,
// is nearly all of them.
//
// Keys come from API_KEYS as "key:label:monthlyQuota" entries, comma separated.
// Usage counters are in-memory: they reset on deploy. That is acceptable for a
// soft quota and is stated plainly rather than pretended otherwise.

const usage = new Map();

function parseKeys(raw) {
  const out = new Map();
  for (const entry of String(raw || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [key, label, quota] = entry.split(':');
    if (!key) continue;
    out.set(key, { label: label || 'unnamed', quota: Number(quota) > 0 ? Number(quota) : Infinity });
  }
  return out;
}

export function createApiKeyGate({ apiKeysRaw = process.env.API_KEYS || '', log = () => {} } = {}) {
  const keys = parseKeys(apiKeysRaw);
  log(`api-key rail: ${keys.size} key(s) configured`);

  return function apiKeyGate(req, res, next) {
    const presented = req.get('x-api-key') || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!presented) return next();

    const rec = keys.get(presented);
    if (!rec) return res.status(401).json({ error: 'invalid api key' });

    const month = new Date().toISOString().slice(0, 7);
    const k = `${presented}:${month}`;
    const used = (usage.get(k) || 0) + 1;
    usage.set(k, used);

    if (used > rec.quota) {
      return res.status(429).json({
        error: 'monthly quota exceeded',
        label: rec.label, quota: rec.quota, used,
        hint: 'contact contact@chainverdict.xyz to raise the quota, or pay per call over x402 with no key',
      });
    }

    res.set('x-quota-used', String(used));
    if (rec.quota !== Infinity) res.set('x-quota-remaining', String(rec.quota - used));
    req.billing = { rail: 'api-key', label: rec.label };
    req.skipPayment = true;
    return next();
  };
}

export function keyCount(raw = process.env.API_KEYS || '') { return parseKeys(raw).size; }
