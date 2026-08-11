// RegRails — deterministic EU trade & AI compliance primitives.
//
// CBAM scope and liability arithmetic, EUDR due-diligence structure and plot
// geometry, AI Act Article 50 transparency structure. Every answer is structural
// or arithmetic, Ed25519-signed, and ships its own limitations in-band.
//
// Two billing rails on purpose. x402 keeps the agentic-commerce optionality; the
// API key is how a customs broker or an ERP vendor actually pays this year.

import express from 'express';
import { paymentMiddleware, x402ResourceServer } from '@x402/express';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { createFacilitatorConfig } from '@coinbase/x402';
import { declareDiscoveryExtension } from '@x402/extensions/bazaar';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { cbamScope, cbamThreshold, cbamEstimate, cbamDeclarationCheck, CBAM_AS_OF, DE_MINIMIS_TONNES } from './src/cbam.js';
import { eudrScope, eudrDdsValidate, eudrGeoCheck, EUDR_AS_OF, EUDR_DEADLINES } from './src/eudr.js';
import { art50Applicability, art50Check, c2paCheck, AI_ACT_DATES } from './src/transparency.js';
import { Signer } from './src/sign.js';
import { createApiKeyGate, keyCount } from './src/auth.js';
import { buildEvidence, methodologyDocument, METHODOLOGY_VERSION } from './src/evidence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(config = {}) {
  const {
    payTo = process.env.PAY_TO_ADDRESS || null,
    network = process.env.X402_NETWORK || 'eip155:8453',
    facilitatorUrl = process.env.FACILITATOR_URL || 'https://x402.org/facilitator',
    signingKey = process.env.SIGNING_KEY_PKCS8_B64 || null,
    apiKeysRaw = process.env.API_KEYS || '',
    prices = {
      scope:      process.env.PRICE_SCOPE      || '$0.02',
      threshold:  process.env.PRICE_THRESHOLD  || '$0.05',
      geo:        process.env.PRICE_GEO        || '$0.10',
      dds:        process.env.PRICE_DDS        || '$0.15',
      estimate:   process.env.PRICE_ESTIMATE   || '$0.25',
      declaration:process.env.PRICE_DECLARATION|| '$1.00',
      art50:      process.env.PRICE_ART50      || '$0.04',
      c2pa:       process.env.PRICE_C2PA       || '$0.04',
    },
    log = (...a) => console.log('[regrails]', ...a),
    syncFacilitatorOnStart = true,
  } = config;

  const signer = new Signer(signingKey);
  if (signer.ephemeral) log('WARNING: signing key is ephemeral (set SIGNING_KEY_PKCS8_B64 to pin it)');

  const app = express();
  // Render terminates TLS at its proxy. Without this req.protocol is 'http', the
  // Bazaar discovery resource goes out as http:// and CDP rejects every submission.
  app.set('trust proxy', true);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const paidMode = Boolean(payTo);

  const signed = (kind, data) => {
    const _evidence = buildEvidence(kind);
    const body = _evidence ? { ...data, _evidence } : { ...data };
    const payload = { kind, ...body, iss: 'regrails', iat: Math.floor(Date.now() / 1000) };
    return { ...body, _attestation: { jws: signer.sign(payload), keyId: signer.keyId, verify: '/.well-known/signing-key.json' } };
  };

  // ---- Bazaar discovery -----------------------------------------------------
  const BZ = {
    'GET /v1/cbam/scope':        { in: { cn: '7208.51.20' }, k: 'cn', d: 'CN/HS code to test against CBAM sector scope', out: { inScope: true, sector: 'iron_steel' } },
    'POST /v1/cbam/threshold':   { body: { lines: [{ cn: '7208.51.20', netMassTonnes: 30 }] }, out: { countedTonnes: 30, thresholdExceeded: false } },
    'POST /v1/cbam/estimate':    { body: { lines: [{ cn: '7601.10.00', netMassTonnes: 100, embeddedEmissionsTco2ePerTonne: 8.6 }], certificatePriceEur: 75 }, out: { certificatesImpliedTco2e: 860, indicativeCostEur: 64500 } },
    'POST /v1/cbam/declaration-check': { body: { declarantId: 'LU123456', reportingYear: 2026, goods: [{ cn: '7208.51.20', netMassTonnes: 120, countryOfOrigin: 'TR', embeddedEmissionsTco2e: 240 }] }, out: { structurallyComplete: true } },
    'GET /v1/eudr/scope':        { in: { hs: '1801.00.00' }, k: 'hs', d: 'HS code to test against EUDR commodity scope', out: { inScope: true, commodity: 'cocoa' } },
    'POST /v1/eudr/dds-validate':{ body: { operatorName: 'Acme', operatorAddress: 'Luxembourg', eoriNumber: 'LU123456789', hsCode: '1801.00.00', productDescription: 'cocoa beans', quantity: { value: 24000, unit: 'kg' }, countryOfProduction: 'GH', productionAfterCutoffConfirmed: true, plots: [{ geometry: { type: 'Point', coordinates: [-1.2, 6.7] }, areaHectares: 2 }] }, out: { structurallyValid: true } },
    'POST /v1/eudr/geo-check':   { body: { geometry: { type: 'Polygon', coordinates: [[[-1.2, 6.7], [-1.19, 6.7], [-1.19, 6.71], [-1.2, 6.71], [-1.2, 6.7]]] }, declaredAreaHectares: 12 }, out: { valid: true, computedAreaHectares: 12.3 } },
    'GET /v1/aiact/art50':       { in: { kind: 'deepfake' }, k: 'kind', d: 'Article 50 obligation category: chatbot, synthetic_content, deepfake, public_interest_text', out: { requiredControls: [] } },
    'POST /v1/aiact/art50-check':{ body: { kind: 'chatbot', controls: { disclosureBeforeInteraction: true, disclosureMachineReadable: false } }, out: { structurallyConformant: false } },
    'POST /v1/aiact/c2pa-check': { body: { claim: { claim_generator: 'demo/1.0', assertions: [{ label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.created', digitalSourceType: 'trainedAlgorithmicMedia' }] } }] }, signature: 'present' }, out: { structurallyValid: true } },
  };
  function bzExt(route) {
    const m = BZ[route];
    if (!m) return undefined;
    try {
      if (m.body) return declareDiscoveryExtension({ bodyType: 'json', input: m.body, output: { example: m.out, schema: { type: 'object', additionalProperties: true } } });
      const key = m.k || Object.keys(m.in)[0];
      return declareDiscoveryExtension({
        input: m.in,
        inputSchema: { type: 'object', properties: { [key]: { type: 'string', description: m.d } }, required: [key] },
        output: { example: m.out, schema: { type: 'object', additionalProperties: true } },
      });
    } catch (e) { log(`bazaar declaration failed for ${route}: ${e.message}`); return undefined; }
  }

  const DESCRIPTIONS = {
    'GET /v1/cbam/scope': 'Is this CN code inside the CBAM Carbon Border Adjustment Mechanism? Returns the sector, whether the 50-tonne de minimis applies, and the declaration deadlines. Longest-prefix match against the bundled Annex I code list — a match is strong, a non-match is weak and never proof of exclusion.',
    'POST /v1/cbam/threshold': 'Track a year of import lines against the CBAM 50-tonne de minimis and catch the retroactivity trap: crossing the threshold at any point pulls every in-scope import that year into scope, not just the excess. Electricity and hydrogen never benefit from the de minimis and are excluded from the count.',
    'POST /v1/cbam/estimate': 'Embedded emissions and indicative certificate cost, computed line by line with every arithmetic step echoed back. RegRails supplies no default emission factors on purpose — a stale factor produces a wrong liability — so intensities and certificate price are yours. Indicative only, never a basis for a declaration.',
    'POST /v1/cbam/declaration-check': 'Structural pre-submission check of a draft CBAM annual declaration: required fields, per-good completeness, CN scope consistency, ISO country format, EU-origin contradictions, reporting-year plausibility, de minimis cross-check. Not a submission and not a validation against the official Registry schema.',
    'GET /v1/eudr/scope': 'Is this HS code inside the EU Deforestation Regulation? Returns the commodity (cattle, cocoa, coffee, oil palm, rubber, soya, wood) and the applicable enforcement deadline tier. A simplification package was in trilogue as of the asOf date; deadlines may move.',
    'POST /v1/eudr/dds-validate': 'Structural validation of a draft Due Diligence Statement: required fields, HS-to-commodity consistency, EORI and ISO country formats, quantity units, per-plot geometry, and the deforestation-free cut-off assertion. Explicitly does NOT check deforestation against any satellite dataset and does not file anything.',
    'POST /v1/eudr/geo-check': 'Validate EUDR plot geolocation: coordinate bounds, ring closure, self-intersection, approximate area, and the rule that plots above 4 hectares require a polygon rather than a point. Catches the [lat, lon] versus [lon, lat] error that silently relocates a plot to the wrong continent.',
    'GET /v1/aiact/art50': 'Which AI Act Article 50 transparency controls apply to a given obligation category, with the exemption note and the applicable date. Article 50 has applied since 2 August 2026 and was NOT deferred by the AI Omnibus, which moved only the high-risk obligations.',
    'POST /v1/aiact/art50-check': 'Check declared transparency controls against the Article 50 category they claim to satisfy, and get back precisely which ones are missing. Checks your assertions, not your system; not a conformity assessment.',
    'POST /v1/aiact/c2pa-check': 'Structural check of a content-credential manifest: claim generator, assertions, the c2pa.actions history, whether a digitalSourceType actually declares trained-algorithmic media, and whether it is signed at all. Does not verify the signature or the certificate chain.',
  };

  if (paidMode) {
    let facilitatorClient = config.facilitatorClient ?? null;
    let facilitatorLabel = facilitatorUrl;
    if (!facilitatorClient) {
      const id = process.env.CDP_API_KEY_ID, sec = process.env.CDP_API_KEY_SECRET;
      if (id && sec) {
        const cdp = createFacilitatorConfig(id, sec);
        facilitatorClient = new HTTPFacilitatorClient(cdp);
        facilitatorLabel = cdp.url;
      } else {
        facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });
      }
    }
    log(`facilitator: ${facilitatorLabel}`);

    const resourceServer = new x402ResourceServer(facilitatorClient).register(network, new ExactEvmScheme());
    const P = (price) => ({ accepts: { scheme: 'exact', price, network, payTo }, mimeType: 'application/json' });
    const routes = {
      'GET /v1/cbam/scope': P(prices.scope),
      'POST /v1/cbam/threshold': P(prices.threshold),
      'POST /v1/cbam/estimate': P(prices.estimate),
      'POST /v1/cbam/declaration-check': P(prices.declaration),
      'GET /v1/eudr/scope': P(prices.scope),
      'POST /v1/eudr/dds-validate': P(prices.dds),
      'POST /v1/eudr/geo-check': P(prices.geo),
      'GET /v1/aiact/art50': P(prices.art50),
      'POST /v1/aiact/art50-check': P(prices.art50),
      'POST /v1/aiact/c2pa-check': P(prices.c2pa),
    };
    for (const [rk, cfg] of Object.entries(routes)) {
      const ext = bzExt(rk);
      if (ext) cfg.extensions = ext;
      cfg.description = DESCRIPTIONS[rk] || rk;
    }
    const declared = Object.values(routes).filter((r) => r.extensions?.bazaar).length;
    log(`bazaar discovery declared on ${declared}/${Object.keys(routes).length} routes`);

    // API-key rail runs first and sets req.skipPayment; the payment gate is only
    // reached by callers with no valid key.
    app.use(createApiKeyGate({ apiKeysRaw, log }));
    const pay = paymentMiddleware(routes, resourceServer, undefined, undefined, syncFacilitatorOnStart);
    app.use((req, res, next) => (req.skipPayment ? next() : pay(req, res, next)));
    log(`paid mode: settling to ${payTo} on ${network}`);
    log(`api-key rail: ${keyCount(apiKeysRaw)} key(s)`);
  } else {
    log('FREE MODE: PAY_TO_ADDRESS not set — paid routes are open (dev/test only)');
  }

  // ---- CBAM ----
  app.get('/v1/cbam/scope', (req, res) => res.json(signed('cbam.scope', cbamScope(req.query.cn ?? req.query.code))));
  app.post('/v1/cbam/threshold', (req, res) => res.json(signed('cbam.threshold', cbamThreshold(req.body || {}))));
  app.post('/v1/cbam/estimate', (req, res) => res.json(signed('cbam.estimate', cbamEstimate(req.body || {}))));
  app.post('/v1/cbam/declaration-check', (req, res) => res.json(signed('cbam.declaration', cbamDeclarationCheck(req.body || {}))));

  // ---- EUDR ----
  app.get('/v1/eudr/scope', (req, res) => res.json(signed('eudr.scope', eudrScope(req.query.hs ?? req.query.code))));
  app.post('/v1/eudr/dds-validate', (req, res) => res.json(signed('eudr.dds', eudrDdsValidate(req.body || {}))));
  app.post('/v1/eudr/geo-check', (req, res) => res.json(signed('eudr.geo', eudrGeoCheck(req.body || {}))));

  // ---- AI Act ----
  app.get('/v1/aiact/art50', (req, res) => res.json(signed('art50.check', art50Applicability({ kind: req.query.kind }))));
  app.post('/v1/aiact/art50-check', (req, res) => res.json(signed('art50.check', art50Check(req.body || {}))));
  app.post('/v1/aiact/c2pa-check', (req, res) => res.json(signed('c2pa.check', c2paCheck(req.body || {}))));

  // ---- free ----
  app.get('/v1/methodology', (req, res) => res.json(methodologyDocument()));
  app.get('/v1/calendar', (req, res) => res.json({
    service: 'RegRails', asOf: CBAM_AS_OF,
    cbam: { definitivePeriodFrom: '2026-01-01', deMinimisTonnes: DE_MINIMIS_TONNES, certificateSalesOpen: '2027-02-01', firstAnnualDeclaration: '2027-09-30' },
    eudr: EUDR_DEADLINES,
    aiAct: AI_ACT_DATES,
    note: 'Free. Verify against the consolidated legal texts before relying on any date.',
  }));
  app.get('/health', (req, res) => res.json({ ok: true, service: 'regrails', mode: paidMode ? 'paid' : 'free', keyId: signer.keyId, methodologyVersion: METHODOLOGY_VERSION, cbamAsOf: CBAM_AS_OF, eudrAsOf: EUDR_AS_OF }));
  app.get('/healthz', (req, res) => res.json({ ok: true, service: 'regrails' }));
  app.get('/.well-known/signing-key.json', (req, res) => res.json(signer.wellKnown()));
  app.get('/.well-known/regrails.json', (req, res) => res.json({
    service: 'RegRails',
    description: 'Deterministic EU trade and AI compliance primitives: CBAM scope and liability arithmetic, EUDR due-diligence structure and plot geometry, AI Act Article 50 transparency structure.',
    signingKeys: [signer.wellKnown().keys[0]],
    ephemeralKey: signer.ephemeral,
    billing: { x402: paidMode, apiKey: keyCount(apiKeysRaw) > 0 },
  }));
  app.get('/.well-known/x402.json', (req, res) => res.json({
    x402Version: 2, name: 'RegRails',
    description: 'Deterministic EU trade & AI compliance primitives (CBAM, EUDR, AI Act Art. 50).',
    endpoints: Object.keys(BZ).map((k) => {
      const [method, p] = k.split(' ');
      return { path: p, method, price: null };
    }),
    network, payTo: payTo || null,
  }));
  app.get('/llms.txt', (req, res) => {
    res.type('text/plain').send(`# RegRails
Deterministic EU trade & AI compliance primitives for agents and software. USDC on Base via x402, or an API key. No signup for x402.

Structural and arithmetic checks against published EU legal text. Not legal advice, not a customs ruling, not a filing.

## CBAM (Regulation (EU) 2023/956 — definitive period from 2026-01-01)
- GET  /v1/cbam/scope?cn=            (${prices.scope})      is this CN code in scope, which sector, does the 50t de minimis apply
- POST /v1/cbam/threshold            (${prices.threshold})  run a year of import lines against the 50t de minimis; flags retroactivity on crossing
- POST /v1/cbam/estimate             (${prices.estimate})   embedded emissions + indicative cost, arithmetic on YOUR factors (no defaults bundled)
- POST /v1/cbam/declaration-check    (${prices.declaration}) structural pre-submission check of a draft annual declaration

## EUDR (Regulation (EU) 2023/1115 — 2026-12-30 large/medium, 2027-06-30 small/micro)
- GET  /v1/eudr/scope?hs=            (${prices.scope})  in scope, which commodity, which deadline tier
- POST /v1/eudr/dds-validate         (${prices.dds})    structural validation of a draft Due Diligence Statement
- POST /v1/eudr/geo-check            (${prices.geo})    plot geometry: bounds, closure, self-intersection, area, 4ha polygon rule

## EU AI Act Article 50 (transparency — applies from 2026-08-02, NOT deferred by the Omnibus)
- GET  /v1/aiact/art50?kind=         (${prices.art50})  which controls apply to chatbot / synthetic_content / deepfake / public_interest_text
- POST /v1/aiact/art50-check         (${prices.art50})  coverage check on declared controls
- POST /v1/aiact/c2pa-check          (${prices.c2pa})   content-credential manifest structure

## Free
- GET /v1/methodology  — what every check does and does not establish
- GET /v1/calendar     — the compliance dates, including the ones that moved

## Honest scope
Does NOT: supply default emission factors, consult satellite or deforestation data, classify your goods, file anything, or perform a conformity assessment. Every paid response is Ed25519-signed and carries its own limitations.

## Discovery
OpenAPI /openapi.json · x402 /.well-known/x402.json · Signing key /.well-known/signing-key.json
`);
  });
  app.get('/openapi.json', (req, res) => res.json({
    openapi: '3.0.3',
    info: { title: 'RegRails', version: '1.0.0', contact: { email: 'contact@chainverdict.xyz' },
      description: 'Deterministic EU trade & AI compliance primitives. Structural and arithmetic checks against published EU legal text. Not legal advice.' },
    paths: Object.fromEntries(Object.keys(BZ).map((k) => {
      const [method, p] = k.split(' ');
      const op = { summary: DESCRIPTIONS[k]?.slice(0, 120) || p, responses: { 200: { description: 'OK' }, 402: { description: 'Payment required (x402)' } } };
      return [p, { [method.toLowerCase()]: op }];
    })),
  }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (e) => { if (e) res.json({ service: 'regrails', see: '/llms.txt' }); });
  });

  return { app, signer };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { app } = createApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`[regrails] listening on :${port}`));
}
