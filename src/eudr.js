// EUDR — Regulation (EU) 2023/1115 on deforestation-free products.
//
// Same design rule as CBAM: bundle only the stable, publicly checkable structure.
// HS prefixes below are indicative and every response says so — Annex I is the
// authority and a simplification package was in trilogue as of August 2026.

export const EUDR_AS_OF = '2026-08-11';
export const EUDR_REGULATION = 'Regulation (EU) 2023/1115';

export const EUDR_DEADLINES = {
  largeAndMedium: '2026-12-30',
  smallAndMicro: '2027-06-30',
  smallAndMicroCriterion: 'Applies to operators that are natural persons or micro/small undertakings ESTABLISHED AS SUCH BY 31 DECEMBER 2024 (Art. 38(3) as amended by Reg. 2025/2650). Being small today is not sufficient.',
  eutrException: 'Products covered by the former EUTR Annex are expressly excluded from the 30 June 2027 deferral. Transitional EUTR treatment is preserved for certain timber placed on the market before 29 June 2023 until 31 December 2029 (Arts. 37(2), 38(3)).',
  note: 'A Commission delegated act amending Annex I was adopted 13 July 2026; its publication and entry-into-force status is not reflected here. Verify against the consolidated text.',
};

// Scope entries. `ex` marks a heading Annex I lists only PARTIALLY ("ex NNNN") —
// only specified products within it are covered, so a heading-level match cannot
// decide scope and we return `requires_verification` rather than a confident yes.
//
// Corrected 11 Aug 2026 after external review against the consolidated text
// (Reg. 2023/1115 as amended by Reg. 2024/3234 and Reg. 2025/2650). The previous
// version used naked prefixes, omitted Chapters 47-48 pulp and paper entirely,
// omitted cattle headings 0206 and 1602, omitted several oil-palm codes, and
// carried three codes that are not in Annex I at all.
const COMMODITIES = [
  { commodity: 'cattle', entries: [
    { code: '010221' }, { code: '010229' },
    { code: '0201', ex: true, note: 'ex 0201 — cattle meat only' },
    { code: '0202', ex: true, note: 'ex 0202 — cattle meat only' },
    { code: '020610', ex: true, note: 'ex 0206 10 — bovine edible offal only' },
    { code: '020622', ex: true, note: 'ex 0206 22 — bovine edible offal only' },
    { code: '020629', ex: true, note: 'ex 0206 29 — bovine edible offal only' },
    { code: '160250', ex: true, note: 'ex 1602 50 — prepared/preserved bovine meat only' },
    { code: '4101', ex: true, note: 'ex 4101 — raw cattle hides and skins only' },
    { code: '4104', ex: true, note: 'ex 4104 — cattle leather only' },
    { code: '4107', ex: true, note: 'ex 4107 — cattle leather only' },
    // Resolved 11 Aug 2026. 4114 is NOT an EUDR product: the ex-4107 cattle entry
    // itself reads "other than leather of heading 4114", so 4114 was never within it.
    // 4112 (sheep/lamb), ex 4113 (other animals) and 4115 10 00 (composition leather)
    // do appear in Annex I but relate to NON-cattle animals — "is it cattle-derived"
    // is the wrong question for them.
    { code: '4112', ex: true, note: 'Annex I entry relates to sheep/lamb leather, not cattle. Cattle-derived status is not the test here.' },
    { code: '4113', ex: true, note: 'ex 4113 — leather of other animals, subject to the stated exclusions. Not a cattle entry.' },
    { code: '411510', ex: true, note: 'composition leather. Not a cattle entry.' },
  ]},
  { commodity: 'cocoa', entries: [
    { code: '1801' }, { code: '1802' }, { code: '1803' }, { code: '1804' }, { code: '1805' }, { code: '1806' },
  ]},
  { commodity: 'coffee', entries: [{ code: '0901' }] },
  { commodity: 'oil_palm', entries: [
    { code: '120710', note: 'palm nuts and kernels' },
    { code: '1511' }, { code: '151321' }, { code: '151329' }, { code: '230660' },
    { code: '290545', ex: true, originDependent: true, note: 'ex 2905 45 — glycerol of purity 95% or more' },
    { code: '291570', ex: true, originDependent: true, note: 'palmitic/stearic acid, their salts and esters' },
    { code: '291590', ex: true, originDependent: true, note: 'specified saturated acyclic monocarboxylic acids and derivatives' },
    { code: '382311', ex: true, originDependent: true }, { code: '382312', ex: true, originDependent: true },
    { code: '382319', ex: true, originDependent: true }, { code: '382370', ex: true, originDependent: true },
  ]},
  { commodity: 'rubber', entries: [
    { code: '4001' },
    { code: '4005', ex: true }, { code: '4006', ex: true }, { code: '4007', ex: true },
    { code: '4008', ex: true }, { code: '4010', ex: true }, { code: '4011', ex: true },
    { code: '4012', ex: true }, { code: '4013', ex: true }, { code: '4015', ex: true },
    { code: '4016', ex: true }, { code: '4017', ex: true },
  ]},
  { commodity: 'soya', entries: [
    { code: '1201' }, { code: '120810' }, { code: '1507' }, { code: '2304' },
  ]},
  { commodity: 'wood', entries: [
    { code: '44', ex: true, note: 'Annex I covers headings 4401-4421; 4415 excludes packaging material used exclusively to support, protect or carry another product placed on the market' },
    { code: '47', ex: true, note: 'pulp of Chapter 47; Annex I excludes bamboo-based and recovered waste/scrap products' },
    { code: '48', ex: true, note: 'paper of Chapter 48; Annex I excludes bamboo-based and recovered waste/scrap products' },
    { code: '9401', ex: true, note: 'ex 9401 — wooden seats and parts only' },
    { code: '940330', ex: true }, { code: '940340', ex: true }, { code: '940350', ex: true },
    { code: '940360', ex: true }, { code: '940391', ex: true },
    { code: '940610', ex: true, note: 'ex 9406 10 — prefabricated buildings of wood only' },
  ]},
];

export function normaliseHs(input) {
  return String(input ?? '').replace(/[^0-9]/g, '');
}

// Adopted but NOT yet in force. Surfaced on affected codes so a user is warned that
// today's answer has a known expiry, without the pending act changing today's answer.
export const PENDING_ACTS = [
  {
    id: 'C(2026)4920',
    status: 'ADOPTED_NOT_IN_FORCE',
    adopted: '2026-07-13',
    mechanism: 'Commission delegated act amending Annex I. Enters into force only if neither the European Parliament nor the Council objects within the scrutiny period (Art. 35(6)). Not law as of the asOf date below.',
    removes: ['4101', '4104', '4107'],
    removesNote: 'removes the cattle hides, skins and leather entries ex 4101, ex 4104 and ex 4107',
    adds: ['210111'],
    addsNote: 'adds certain products including soluble coffee and frozen cattle tongues; some additions reported to apply only from 2027-12-30',
  },
];

function pendingFor(code) {
  const hits = [];
  for (const act of PENDING_ACTS) {
    if ((act.removes || []).some((c) => code.startsWith(c) || c.startsWith(code))) {
      hits.push({ act: act.id, status: act.status, effect: 'REMOVES this entry from Annex I', detail: act.removesNote, mechanism: act.mechanism });
    }
    if ((act.adds || []).some((c) => code.startsWith(c) || c.startsWith(code))) {
      hits.push({ act: act.id, status: act.status, effect: 'ADDS this to Annex I', detail: act.addsNote, mechanism: act.mechanism });
    }
  }
  return hits.length ? hits : undefined;
}

export function eudrScope(rawCode) {
  const hs = normaliseHs(rawCode);
  if (!hs) return { input: rawCode ?? null, valid: false, reason: 'no digits found in code', inScope: null };
  if (hs.length < 4) return { input: rawCode, hs, valid: false, reason: 'HS code must have at least 4 digits', inScope: null };

  let best = null;
  for (const c of COMMODITIES) {
    for (const e of c.entries) {
      if (hs.startsWith(e.code) && (!best || e.code.length > best.entry.code.length)) {
        best = { commodity: c.commodity, entry: e };
      }
    }
  }

  if (!best) {
    return {
      input: rawCode, hs, valid: true, inScope: false, commodity: null, qualified: false,
      note: 'No EUDR commodity entry matched. Absence of a match is NOT proof the product is outside scope — Annex I is the authority.',
      pendingChanges: pendingFor(hs),
      legalBasis: 'Regulation (EU) 2023/1115, Annex I (consolidated 2025-12-26, incl. Reg. 2024/3234 and Reg. 2025/2650)',
      asOf: EUDR_AS_OF,
    };
  }

  const { commodity, entry } = best;
  const out = {
    input: rawCode, hs, valid: true, inScope: true, commodity,
    matchedEntry: entry.code,
    qualified: Boolean(entry.ex),
    obligations: { ddsRequired: true, geolocationRequired: true, deadlines: EUDR_DEADLINES },
    pendingChanges: pendingFor(entry.code),
    legalBasis: `Regulation (EU) 2023/1115, Annex I, ${commodity} (consolidated 2025-12-26, incl. Reg. 2024/3234 and Reg. 2025/2650)`,
    asOf: EUDR_AS_OF,
  };
  if (entry.note) out.qualifierNote = entry.note;
  if (entry.ex) {
    out.inScope = 'requires_verification';
    out.warning = 'Annex I lists this heading only PARTIALLY (an "ex" entry). A code match at heading level does NOT establish that this specific product is in scope. Check the exact subheading and the product description against Annex I before relying on this.';
  }
  if (entry.originDependent) {
    out.originDependent = true;
    out.warning = 'ORIGIN-DEPENDENT. This heading covers oleochemicals and derivatives regardless of feedstock. EUDR applies only where the product is DERIVED FROM OIL PALM. The identical CN code covers tallow-based, coconut-based and synthetic material that is NOT in scope. A code match cannot decide this — only the feedstock can.';
  }
  if (entry.disputed) {
    out.disputed = true;
    out.warning = 'DISPUTED ENTRY. Two independent reviews disagreed about whether this heading is in Annex I, and neither verified it against the primary text. RegRails will not assert either answer. Check Annex I directly.';
  }
  return out;
}


// --- geolocation ------------------------------------------------------------
// Plots above 4 hectares must be given as polygons; at or below 4 ha a point is
// accepted. This is the rule operators most often get wrong, so it is checked
// explicitly and the reason is returned.

const POLYGON_REQUIRED_ABOVE_HA = 4;
const MIN_COORD_DECIMALS = 6;

// Art. 2(28): the polygon rule applies to plots for commodities OTHER THAN cattle.
// For cattle the geolocation concerns the establishments where the animals were kept.
// Art. 2(28) requires at least six decimal digits. This CANNOT be enforced on a
// parsed JSON number: -1.200000 becomes -1.2 and the trailing zeros are gone before
// we see it. So we flag coordinates whose retained precision is so coarse that the
// point is unlikely to identify a plot at all, and we say why it is a warning.
const SUSPICIOUS_DECIMALS = 4;
function coarseDecimals(p) {
  return p.some((v) => {
    const str = String(v);
    const dot = str.indexOf('.');
    return dot < 0 || str.length - dot - 1 < SUSPICIOUS_DECIMALS;
  });
}

function pointValid(p) {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))
    && Math.abs(Number(p[0])) <= 180 && Math.abs(Number(p[1])) <= 90;
}

// Shoelace on lon/lat degrees converted to an approximate planar area in hectares.
function approxPolygonHectares(ring) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const latRef = toRad(ring.reduce((s, p) => s + Number(p[1]), 0) / ring.length);
  const pts = ring.map((p) => [toRad(Number(p[0])) * R * Math.cos(latRef), toRad(Number(p[1])) * R]);
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2) / 10000;
}

function segmentsIntersect(a, b, c, d) {
  const cr = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function eudrGeoCheck({ geometry = null, declaredAreaHectares = null, commodity = null } = {}) {
  const errors = [];
  const warnings = [];
  if (!geometry || typeof geometry !== 'object') {
    return { valid: false, errors: ['geometry required: GeoJSON Point or Polygon'], asOf: EUDR_AS_OF };
  }

  const type = geometry.type;
  const coords = geometry.coordinates;
  let computedHa = null;
  let ring = null;

  if (type === 'Point') {
    if (!pointValid(coords)) errors.push('Point coordinates must be [longitude, latitude] within valid bounds');
  } else if (type === 'Polygon') {
    if (!Array.isArray(coords) || !Array.isArray(coords[0])) {
      errors.push('Polygon coordinates must be an array of linear rings');
    } else {
      ring = coords[0];
      if (ring.length < 4) errors.push('polygon ring needs at least 4 positions (first and last identical)');
      const bad = ring.filter((p) => !pointValid(p)).length;
      if (bad) errors.push(`${bad} position(s) outside valid longitude/latitude bounds`);
      const first = ring[0], last = ring[ring.length - 1];
      if (first && last && (Number(first[0]) !== Number(last[0]) || Number(first[1]) !== Number(last[1]))) {
        errors.push('polygon ring is not closed: first and last position must be identical');
      }
      if (!errors.length) {
        computedHa = Number(approxPolygonHectares(ring.slice(0, -1)).toFixed(4));
        const r = ring.slice(0, -1);
        let selfIntersects = false;
        for (let i = 0; i < r.length && !selfIntersects; i++) {
          for (let j = i + 2; j < r.length; j++) {
            if (i === 0 && j === r.length - 1) continue;
            if (segmentsIntersect(r[i], r[(i + 1) % r.length], r[j], r[(j + 1) % r.length])) { selfIntersects = true; break; }
          }
        }
        if (selfIntersects) errors.push('polygon is self-intersecting');
      }
    }
  } else {
    errors.push(`unsupported geometry type "${type}" — EUDR geolocation is a Point or a Polygon`);
  }

  const declared = Number(declaredAreaHectares);
  const hasDeclared = Number.isFinite(declared) && declared > 0;

  const isCattle = String(commodity || '').toLowerCase() === 'cattle';
  if (type === 'Point' && hasDeclared && declared > POLYGON_REQUIRED_ABOVE_HA && !isCattle) {
    errors.push(`declared area ${declared} ha is MORE THAN ${POLYGON_REQUIRED_ABOVE_HA} ha — a polygon is required, a point is not sufficient (Art. 2(28))`);
  }
  if (isCattle) {
    warnings.push('commodity is cattle: the polygon-above-4ha rule does not apply, and geolocation concerns the establishments where the animals were kept rather than a plot of land (Art. 2(28), Annex II)');
  }
  if (type === 'Point' && Array.isArray(coords) && pointValid(coords) && coarseDecimals(coords)) {
    warnings.push(`Art. 2(28) requires at least ${MIN_COORD_DECIMALS} decimal digits of precision. These coordinates retain fewer than ${SUSPICIOUS_DECIMALS}, which locates the point to roughly a kilometre or worse. Note this cannot be checked reliably: JSON parsing discards trailing zeros, so 1.200000 and 1.2 are indistinguishable here. Verify precision in your source data, not in this response.`);
  }
  if (computedHa !== null && hasDeclared) {
    const ratio = computedHa / declared;
    if (ratio < 0.5 || ratio > 2) {
      warnings.push(`computed polygon area ${computedHa} ha differs from declared ${declared} ha by more than a factor of two — check units and coordinate order (GeoJSON is [lon, lat])`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    geometryType: type ?? null,
    computedAreaHectares: computedHa,
    declaredAreaHectares: hasDeclared ? declared : null,
    polygonRequiredAboveHectares: POLYGON_REQUIRED_ABOVE_HA,
    areaBasis: 'The threshold is "more than four hectares". The Regulation defines the object as a "plot of land" under Art. 2(27) — land within a single real-estate property as recognised by the law of the country of production. It does not specify whether the threshold is measured on a declared, cadastral or GIS-computed area. Do NOT use the computed figure below to decide a marginal case.',
    areaMethod: computedHa === null ? null : 'shoelace on a local equirectangular projection; indicative only, not a survey-grade area',
    asOf: EUDR_AS_OF,
  };
}

// --- DDS --------------------------------------------------------------------
const DDS_REQUIRED = ['operatorName', 'operatorAddress', 'eoriNumber', 'hsCode', 'productDescription', 'quantity', 'countryOfProduction', 'plots'];

export function eudrDdsValidate(dds = {}) {
  const errors = [];
  const warnings = [];

  for (const f of DDS_REQUIRED) {
    const v = dds[f];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) errors.push(`missing required field: ${f}`);
  }

  const scope = eudrScope(dds.hsCode);
  if (dds.hsCode !== undefined && !scope.inScope) {
    errors.push(`hsCode ${scope.hs ?? dds.hsCode} did not match an EUDR commodity — a DDS may not be required, or the code is wrong`);
  }
  if (dds.commodity && scope.commodity && dds.commodity !== scope.commodity) {
    errors.push(`declared commodity "${dds.commodity}" is inconsistent with hsCode ${scope.hs} which maps to "${scope.commodity}"`);
  }

  if (dds.eoriNumber !== undefined && !/^[A-Z]{2}[A-Za-z0-9]{1,15}$/.test(String(dds.eoriNumber))) {
    errors.push('eoriNumber must start with an ISO 3166-1 alpha-2 country code followed by up to 15 alphanumerics');
  }
  if (dds.countryOfProduction !== undefined && !/^[A-Z]{2}$/.test(String(dds.countryOfProduction))) {
    errors.push('countryOfProduction must be an ISO 3166-1 alpha-2 code');
  }

  const qty = dds.quantity;
  if (qty !== undefined && qty !== null) {
    const n = Number(qty?.value ?? qty);
    if (!Number.isFinite(n) || n <= 0) errors.push('quantity must be a positive number (net mass, or volume where applicable)');
    if (typeof qty === 'object' && !qty.unit) warnings.push('quantity has no unit — state kg, tonnes or m3 explicitly');
  }

  const plots = Array.isArray(dds.plots) ? dds.plots : [];
  const plotResults = [];
  let totalHa = 0;
  plots.forEach((plot, i) => {
    const geo = eudrGeoCheck({ geometry: plot?.geometry, declaredAreaHectares: plot?.areaHectares, commodity: scope.commodity });
    if (geo.computedAreaHectares) totalHa += geo.computedAreaHectares;
    if (!plot?.productionDate && !plot?.productionDateRange) {
      warnings.push(`plots[${i}]: no production date or date range given`);
    }
    plotResults.push({ index: i, valid: geo.valid, errors: geo.errors, warnings: geo.warnings, computedAreaHectares: geo.computedAreaHectares });
    errors.push(...geo.errors.map((e) => `plots[${i}]: ${e}`));
    warnings.push(...geo.warnings.map((w) => `plots[${i}]: ${w}`));
  });

  const cutoff = '2020-12-31';
  if (dds.productionAfterCutoffConfirmed === undefined) {
    warnings.push(`no confirmation that production land was deforestation-free after the ${cutoff} cut-off date — the DDS must assert this`);
  } else if (dds.productionAfterCutoffConfirmed !== true) {
    errors.push(`productionAfterCutoffConfirmed is not true — a DDS asserts the commodity was not produced on land deforested after ${cutoff}`);
  }

  // Art. 4(2) / Annex II: the DDS contains a prescribed DECLARATION that due diligence
  // was carried out and found no or only negligible risk. That is the operative
  // statement, not a field like the others.
  if (dds.dueDiligenceDeclaration !== true) {
    errors.push('missing the operative declaration: the DDS must state that due diligence was carried out and that no or only negligible risk of non-compliance with Art. 3(a) or (b) was found (Art. 4(2), Annex II). Set dueDiligenceDeclaration: true only if that is true.');
  }

  // Art. 3(b) / 2(40) / 9(1)(h): legality of production is an independent limb of the
  // obligation and this service does not test it at all. Say so every time, loudly.
  warnings.push('LEGALITY LIMB NOT CHECKED: Art. 3(b) also requires production in accordance with the relevant legislation of the country of production — land use rights, environmental protection, forest rules, third-party rights, labour rights, human rights, FPIC, tax, anti-corruption, trade and customs (Art. 2(40)). Art. 9(1)(h) requires adequately conclusive and verifiable evidence of that. Nothing here tests it.');

  // ARTICLE 9 vs ANNEX II. These are different obligations and conflating them was a
  // real defect. Annex II is the DDS submission form. Article 9 is the information the
  // operator must COLLECT and HOLD. An operator can file a complete Annex II DDS while
  // failing Article 9 entirely. Reported separately so the distinction is visible.
  const article9Gaps = [];
  if (!dds.productionDateRange && !dds.plots?.some?.((p) => p?.productionDate || p?.productionDateRange)) {
    article9Gaps.push('Art. 9(1)(d): date or time range of production is not present alongside the geolocation.');
  }
  if (!dds.suppliers) {
    article9Gaps.push('Art. 9(1)(e): no information on the business or person from whom the products were supplied.');
  }
  if (!dds.customers) {
    article9Gaps.push('Art. 9(1)(f): no information on the business, operator or trader to whom the products have been supplied.');
  }
  if (dds.legalityEvidence === undefined) {
    article9Gaps.push('Art. 9(1)(h): no evidence of compliance with the relevant legislation of the country of production. The Regulation requires this to be adequately conclusive and verifiable.');
  }
  if (dds.deforestationFreeConfirmed !== true && dds.productionAfterCutoffConfirmed === true) {
    warnings.push('You asserted the post-cutoff condition but not an explicit deforestation-free attestation under Art. 3(a). Consider whether both statements are required.');
  }

  if (dds.simplifiedDeclarationArt4a === true) {
    warnings.push('Art. 4a simplified declaration claimed: micro/small primary operators may file a one-time declaration under Annex III, and Art. 4a(5) permits the postal address of the plots or establishment to replace geolocation. The field expectations checked here are those of the standard Annex II DDS and may not apply to you.');
  }

  return {
    structurallyValid: errors.length === 0,
    errors,
    warnings,
    // Distinct from `errors`: these are not DDS form defects, they are gaps in the
    // due-diligence information set the operator must hold under Art. 9.
    article9InformationGaps: article9Gaps,
    article9Note: 'A structurally valid Annex II DDS does NOT mean the Art. 8-9 due-diligence obligation has been met. These are separate requirements and RegRails checks only whether you told it about them.',
    legalBasis: 'Regulation (EU) 2023/1115, Annex II and Arts. 8-9 (consolidated 2025-12-26). Annex II point 4 (previous-DDS reference number) was deleted by Reg. (EU) 2025/2650.',
    commodity: scope.commodity ?? null,
    hsCode: scope.hs ?? null,
    plotsChecked: plotResults.length,
    totalComputedAreaHectares: Number(totalHa.toFixed(4)),
    perPlot: plotResults,
    deadlines: EUDR_DEADLINES,
    cutoffDate: cutoff,
    scope: 'Structural and internal-consistency validation of a draft Due Diligence Statement against the Annex II field set. It does NOT check deforestation against any satellite or forest dataset, does NOT test the legality-of-production limb under Art. 3(b), and is NOT a submission to the EU Information System. A structurally valid DDS containing false statements remains a false statement, with the operator liable.',
    asOf: EUDR_AS_OF,
  };
}
