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
  note: 'A simplification package was in trilogue as of 2026-08-11 and was not yet binding. Current deadlines stand until amended in the Official Journal.',
};

const COMMODITIES = [
  { commodity: 'cattle',   prefixes: ['0102', '0201', '0202', '4101', '4104', '4107'] },
  { commodity: 'cocoa',    prefixes: ['1801', '1802', '1803', '1804', '1805', '1806'] },
  { commodity: 'coffee',   prefixes: ['0901', '210111'] },
  { commodity: 'oil_palm', prefixes: ['1511', '151321', '151329', '230660', '151620', '382311', '382312', '382319', '382370', '290570'] },
  { commodity: 'rubber',   prefixes: ['4001', '4005', '4006', '4007', '4008', '4009', '4010', '4011', '4012', '4013', '4015', '4016', '4017'] },
  { commodity: 'soya',     prefixes: ['1201', '120810', '1507', '2304'] },
  { commodity: 'wood',     prefixes: ['44', '4701', '4702', '4703', '4704', '4705', '4801', '4802', '4803', '4804', '4805', '4806', '4807', '4808', '4809', '4810', '4811', '4823', '9401', '9403', '9406'] },
];

export function normaliseHs(input) {
  return String(input ?? '').replace(/[^0-9]/g, '');
}

export function eudrScope(rawCode) {
  const hs = normaliseHs(rawCode);
  if (!hs) return { input: rawCode ?? null, valid: false, reason: 'no digits found in code', inScope: null };
  if (hs.length < 4) return { input: rawCode, hs, valid: false, reason: 'HS code must have at least 4 digits', inScope: null };

  let best = null;
  for (const c of COMMODITIES) {
    for (const p of c.prefixes) {
      if (hs.startsWith(p) && (!best || p.length > best.prefix.length)) best = { commodity: c.commodity, prefix: p };
    }
  }

  if (!best) {
    return {
      input: rawCode, hs, valid: true, inScope: false, commodity: null,
      note: 'No EUDR commodity prefix matched. Absence of a match is not proof the product is out of scope — verify against Annex I.',
      asOf: EUDR_AS_OF,
    };
  }

  return {
    input: rawCode, hs, valid: true, inScope: true,
    commodity: best.commodity,
    matchedPrefix: best.prefix,
    obligations: {
      ddsRequired: true,
      geolocationRequired: true,
      deadlines: EUDR_DEADLINES,
    },
    asOf: EUDR_AS_OF,
  };
}

// --- geolocation ------------------------------------------------------------
// Plots above 4 hectares must be given as polygons; at or below 4 ha a point is
// accepted. This is the rule operators most often get wrong, so it is checked
// explicitly and the reason is returned.

const POLYGON_REQUIRED_ABOVE_HA = 4;

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

export function eudrGeoCheck({ geometry = null, declaredAreaHectares = null } = {}) {
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

  if (type === 'Point' && hasDeclared && declared > POLYGON_REQUIRED_ABOVE_HA) {
    errors.push(`declared area ${declared} ha exceeds ${POLYGON_REQUIRED_ABOVE_HA} ha — a polygon is required, a point is not sufficient`);
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
    const geo = eudrGeoCheck({ geometry: plot?.geometry, declaredAreaHectares: plot?.areaHectares });
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

  return {
    structurallyValid: errors.length === 0,
    errors,
    warnings,
    commodity: scope.commodity ?? null,
    hsCode: scope.hs ?? null,
    plotsChecked: plotResults.length,
    totalComputedAreaHectares: Number(totalHa.toFixed(4)),
    perPlot: plotResults,
    deadlines: EUDR_DEADLINES,
    cutoffDate: cutoff,
    scope: 'Structural and internal-consistency validation of a draft Due Diligence Statement. This service does NOT check any plot against satellite deforestation data, does not verify legality of production, and is not a submission to the EU Information System.',
    asOf: EUDR_AS_OF,
  };
}
