import test from 'node:test';
import assert from 'node:assert/strict';
import { cbamScope, cbamThreshold, cbamEstimate, cbamDeclarationCheck } from '../src/cbam.js';
import { eudrScope, eudrDdsValidate, eudrGeoCheck } from '../src/eudr.js';
import { art50Applicability, art50Check, c2paCheck } from '../src/transparency.js';
import { buildEvidence, methodologyDocument } from '../src/evidence.js';
import { Signer } from '../src/sign.js';
import crypto from 'node:crypto';

// ---------- CBAM scope ----------
test('CBAM: steel CN is in scope, iron_steel sector, de minimis applies', () => {
  const r = cbamScope('7208.51.20');
  assert.equal(r.inScope, true);
  assert.equal(r.sector, 'iron_steel');
  assert.equal(r.deMinimisApplies, true);
});

test('CBAM: aluminium and cement in scope', () => {
  assert.equal(cbamScope('7601.10.00').sector, 'aluminium');
  assert.equal(cbamScope('2523 29 00').sector, 'cement');
});

test('CBAM: hydrogen matches the longest prefix, not chapter 28 fertiliser codes', () => {
  const r = cbamScope('2804.10.00');
  assert.equal(r.sector, 'hydrogen');
  assert.equal(r.deMinimisApplies, false, 'hydrogen is excluded from the de minimis');
  assert.equal(r.deMinimisTonnes, null);
});

test('CBAM: electricity excluded from de minimis', () => {
  const r = cbamScope('2716.00.00');
  assert.equal(r.sector, 'electricity');
  assert.equal(r.deMinimisApplies, false);
});

test('CBAM: out-of-scope code returns inScope false but never claims proof', () => {
  const r = cbamScope('0901.21.00');
  assert.equal(r.inScope, false);
  assert.match(r.note, /not proof/i);
});

test('CBAM: garbage input is rejected, not guessed', () => {
  assert.equal(cbamScope('abc').valid, false);
  assert.equal(cbamScope('72').valid, false, 'fewer than 4 digits is not a usable CN code');
});

// ---------- CBAM threshold ----------
test('CBAM threshold: under 50t is not exceeded', () => {
  const r = cbamThreshold({ lines: [{ cn: '7208.51.20', netMassTonnes: 20 }, { cn: '7601.10.00', netMassTonnes: 25 }] });
  assert.equal(r.thresholdExceeded, false);
  assert.equal(r.countedTonnes, 45);
  assert.equal(r.headroomTonnes, 5);
});

test('CBAM threshold: crossing flags retroactivity and the crossing line', () => {
  const r = cbamThreshold({ lines: [{ cn: '7208.51.20', netMassTonnes: 30 }, { cn: '7208.51.20', netMassTonnes: 25 }] });
  assert.equal(r.thresholdExceeded, true);
  assert.equal(r.crossedAtLineIndex, 1);
  assert.match(r.retroactivity, /ALL in-scope goods/);
});

test('CBAM threshold: electricity does not count toward the de minimis', () => {
  const r = cbamThreshold({ lines: [{ cn: '2716.00.00', netMassTonnes: 900 }] });
  assert.equal(r.countedTonnes, 0);
  assert.equal(r.thresholdExceeded, false);
});

test('CBAM threshold: out-of-scope lines are not counted', () => {
  const r = cbamThreshold({ lines: [{ cn: '0901.21.00', netMassTonnes: 500 }] });
  assert.equal(r.countedTonnes, 0);
});

// ---------- CBAM estimate ----------
test('CBAM estimate: arithmetic is exact and echoed', () => {
  const r = cbamEstimate({ lines: [{ cn: '7601.10.00', netMassTonnes: 100, embeddedEmissionsTco2ePerTonne: 8.6 }], certificatePriceEur: 75 });
  assert.equal(r.valid, true);
  assert.equal(r.totalEmbeddedTco2e, 860);
  assert.equal(r.certificatesImpliedTco2e, 860);
  assert.equal(r.indicativeCostEur, 64500);
  assert.match(r.lines[0].arithmetic, /100 t x 8.6/);
});

test('CBAM estimate: free allocation share reduces the certificate obligation', () => {
  const r = cbamEstimate({ lines: [{ cn: '7601.10.00', netMassTonnes: 100, embeddedEmissionsTco2ePerTonne: 10 }], freeAllocationShare: 0.4, certificatePriceEur: 100 });
  assert.equal(r.totalEmbeddedTco2e, 1000);
  assert.equal(r.certificatesImpliedTco2e, 600);
  assert.equal(r.indicativeCostEur, 60000);
});

test('CBAM estimate: refuses to invent a missing emission factor', () => {
  const r = cbamEstimate({ lines: [{ cn: '7601.10.00', netMassTonnes: 100 }] });
  assert.equal(r.valid, false);
  assert.ok(r.problems.some((p) => /does not supply default factors/.test(p)));
});

test('CBAM estimate: rejects an out-of-range free allocation share', () => {
  assert.equal(cbamEstimate({ lines: [{ cn: '7601', netMassTonnes: 1, embeddedEmissionsTco2ePerTonne: 1 }], freeAllocationShare: 1.5 }).valid, false);
});

// ---------- CBAM declaration ----------
test('CBAM declaration: a complete draft passes', () => {
  const r = cbamDeclarationCheck({ declarantId: 'LU123', reportingYear: 2026, goods: [{ cn: '7208.51.20', netMassTonnes: 120, countryOfOrigin: 'TR', embeddedEmissionsTco2e: 240 }] });
  assert.equal(r.structurallyComplete, true);
});

test('CBAM declaration: EU country of origin is a contradiction', () => {
  const r = cbamDeclarationCheck({ declarantId: 'LU123', reportingYear: 2026, goods: [{ cn: '7208.51.20', netMassTonnes: 120, countryOfOrigin: 'DE', embeddedEmissionsTco2e: 240 }] });
  assert.equal(r.structurallyComplete, false);
  assert.ok(r.errors.some((e) => /EU member state/.test(e)));
});

test('CBAM declaration: pre-2026 reporting year is refused', () => {
  const r = cbamDeclarationCheck({ declarantId: 'x', reportingYear: 2025, goods: [{ cn: '7208', netMassTonnes: 1, countryOfOrigin: 'TR', embeddedEmissionsTco2e: 1 }] });
  assert.ok(r.errors.some((e) => /precedes the definitive period/.test(e)));
});

test('CBAM declaration: small tonnage raises the de minimis warning', () => {
  const r = cbamDeclarationCheck({ declarantId: 'x', reportingYear: 2026, goods: [{ cn: '7208.51.20', netMassTonnes: 10, countryOfOrigin: 'TR', embeddedEmissionsTco2e: 5 }] });
  assert.ok(r.warnings.some((w) => /de minimis/.test(w)));
});

// ---------- EUDR ----------
test('EUDR: cocoa, coffee, soya and wood map correctly', () => {
  assert.equal(eudrScope('1801.00.00').commodity, 'cocoa');
  assert.equal(eudrScope('0901.21.00').commodity, 'coffee');
  assert.equal(eudrScope('1201.90.00').commodity, 'soya');
  assert.equal(eudrScope('4407.11.00').commodity, 'wood');
});

test('EUDR: steel is not an EUDR commodity', () => {
  assert.equal(eudrScope('7208.51.20').inScope, false);
});

test('EUDR geo: a valid closed polygon computes a plausible area', () => {
  const r = eudrGeoCheck({ geometry: { type: 'Polygon', coordinates: [[[-1.20, 6.70], [-1.19, 6.70], [-1.19, 6.71], [-1.20, 6.71], [-1.20, 6.70]]] } });
  assert.equal(r.valid, true);
  assert.ok(r.computedAreaHectares > 100 && r.computedAreaHectares < 130, `got ${r.computedAreaHectares} ha`);
});

test('EUDR geo: an unclosed ring is rejected', () => {
  const r = eudrGeoCheck({ geometry: { type: 'Polygon', coordinates: [[[-1.20, 6.70], [-1.19, 6.70], [-1.19, 6.71]]] } });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /not closed|at least 4/.test(e)));
});

test('EUDR geo: a self-intersecting polygon is caught', () => {
  const r = eudrGeoCheck({ geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] } });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /self-intersecting/.test(e)));
});

test('EUDR geo: a point is refused for a plot above 4 hectares', () => {
  const r = eudrGeoCheck({ geometry: { type: 'Point', coordinates: [-1.2, 6.7] }, declaredAreaHectares: 10 });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => /polygon is required/.test(e)));
});

test('EUDR geo: a point is fine at or below 4 hectares', () => {
  assert.equal(eudrGeoCheck({ geometry: { type: 'Point', coordinates: [-1.2, 6.7] }, declaredAreaHectares: 3 }).valid, true);
});

test('EUDR geo: out-of-bounds coordinates are rejected (the lat/lon swap)', () => {
  const r = eudrGeoCheck({ geometry: { type: 'Point', coordinates: [200, 6.7] } });
  assert.equal(r.valid, false);
});

test('EUDR geo: declared vs computed area mismatch warns', () => {
  const r = eudrGeoCheck({ geometry: { type: 'Polygon', coordinates: [[[-1.20, 6.70], [-1.19, 6.70], [-1.19, 6.71], [-1.20, 6.71], [-1.20, 6.70]]] }, declaredAreaHectares: 2 });
  assert.ok(r.warnings.some((w) => /factor of two/.test(w)));
});

test('EUDR DDS: a complete statement validates', () => {
  const r = eudrDdsValidate({
    operatorName: 'Acme', operatorAddress: 'Luxembourg', eoriNumber: 'LU123456789',
    hsCode: '1801.00.00', productDescription: 'cocoa beans', quantity: { value: 24000, unit: 'kg' },
    countryOfProduction: 'GH', productionAfterCutoffConfirmed: true,
    plots: [{ geometry: { type: 'Point', coordinates: [-1.2, 6.7] }, areaHectares: 2, productionDate: '2026-03-01' }],
  });
  assert.equal(r.structurallyValid, true, JSON.stringify(r.errors));
  assert.equal(r.commodity, 'cocoa');
});

test('EUDR DDS: commodity inconsistent with HS code is an error', () => {
  const r = eudrDdsValidate({
    operatorName: 'A', operatorAddress: 'B', eoriNumber: 'LU1', hsCode: '1801.00.00', commodity: 'coffee',
    productDescription: 'x', quantity: { value: 1, unit: 'kg' }, countryOfProduction: 'GH',
    productionAfterCutoffConfirmed: true, plots: [{ geometry: { type: 'Point', coordinates: [0, 0] }, areaHectares: 1 }],
  });
  assert.ok(r.errors.some((e) => /inconsistent/.test(e)));
});

test('EUDR DDS: missing cut-off assertion is refused, not assumed', () => {
  const r = eudrDdsValidate({
    operatorName: 'A', operatorAddress: 'B', eoriNumber: 'LU1', hsCode: '1801.00.00',
    productDescription: 'x', quantity: { value: 1, unit: 'kg' }, countryOfProduction: 'GH',
    productionAfterCutoffConfirmed: false, plots: [{ geometry: { type: 'Point', coordinates: [0, 0] }, areaHectares: 1 }],
  });
  assert.ok(r.errors.some((e) => /deforested after/.test(e)));
});

test('EUDR DDS: bad EORI format is caught', () => {
  const r = eudrDdsValidate({
    operatorName: 'A', operatorAddress: 'B', eoriNumber: '123456', hsCode: '1801.00.00',
    productDescription: 'x', quantity: { value: 1, unit: 'kg' }, countryOfProduction: 'GH',
    productionAfterCutoffConfirmed: true, plots: [{ geometry: { type: 'Point', coordinates: [0, 0] }, areaHectares: 1 }],
  });
  assert.ok(r.errors.some((e) => /eoriNumber/.test(e)));
});

// ---------- AI Act ----------
test('Art50: deepfake requires visible disclosure and machine-readable marking', () => {
  const r = art50Applicability({ kind: 'deepfake' });
  assert.equal(r.valid, true);
  assert.ok(r.requiredControls.includes('disclosureVisibleToViewer'));
  assert.equal(r.deferredByOmnibus, false);
  assert.equal(r.applicableFrom, '2026-08-02');
});

test('Art50: unknown kind is refused with the valid list', () => {
  const r = art50Applicability({ kind: 'nonsense' });
  assert.equal(r.valid, false);
  assert.ok(Array.isArray(r.kinds));
});

test('Art50 check: missing controls are named exactly', () => {
  const r = art50Check({ kind: 'chatbot', controls: { disclosureBeforeInteraction: true } });
  assert.equal(r.structurallyConformant, false);
  assert.deepEqual(r.controlsMissing, ['disclosureMachineReadable']);
});

test('C2PA: unsigned manifest without actions fails', () => {
  const r = c2paCheck({ claim: { claim_generator: 'x/1.0', assertions: [] } });
  assert.equal(r.structurallyValid, false);
  assert.equal(r.isSigned, false);
});

test('C2PA: signed manifest declaring AI source passes', () => {
  const r = c2paCheck({
    claim: { claim_generator: 'demo/1.0', assertions: [{ label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.created', digitalSourceType: 'trainedAlgorithmicMedia' }] } }] },
    signature: 'sig',
  });
  assert.equal(r.structurallyValid, true);
  assert.equal(r.declaresAiGeneratedSource, true);
});

test('C2PA: actions without an AI source type warns rather than silently passing', () => {
  const r = c2paCheck({
    claim: { claim_generator: 'demo/1.0', assertions: [{ label: 'c2pa.actions', data: { actions: [{ action: 'c2pa.opened' }] } }] },
    signature: 'sig',
  });
  assert.equal(r.declaresAiGeneratedSource, false);
  assert.ok(r.warnings.length > 0);
});

// ---------- evidence + signing ----------
test('every decision kind has an evidence record with limitations', () => {
  for (const k of ['cbam.scope', 'cbam.threshold', 'cbam.estimate', 'cbam.declaration', 'eudr.scope', 'eudr.geo', 'eudr.dds', 'art50.check', 'c2pa.check']) {
    const e = buildEvidence(k);
    assert.ok(e, `no evidence for ${k}`);
    assert.ok(e.limitations.length > 0, `no limitations for ${k}`);
    assert.ok(e.globalLimitations.length > 0);
    assert.ok(e.semantics.structuralIsNotSubstantive);
  }
});

test('methodology names what is deliberately not done', () => {
  const m = methodologyDocument();
  assert.ok(m.whatIsDeliberatelyNotDone.some((s) => /default emission factors/.test(s)));
  assert.ok(m.whatIsDeliberatelyNotDone.some((s) => /satellite/.test(s)));
});

test('signature verifies against the published JWK', () => {
  const s = new Signer(null);
  const jws = s.sign({ hello: 'world' });
  const [h, p, sig] = jws.split('.');
  const pub = crypto.createPublicKey({ key: s.jwk, format: 'jwk' });
  assert.equal(crypto.verify(null, Buffer.from(`${h}.${p}`), pub, Buffer.from(sig, 'base64url')), true);
});

test('a pinned key survives a restart; an unpinned key does not', () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const b64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  assert.equal(new Signer(b64).keyId, new Signer(b64).keyId);
  assert.equal(new Signer(b64).ephemeral, false);
  assert.notEqual(new Signer(null).keyId, new Signer(null).keyId);
});
