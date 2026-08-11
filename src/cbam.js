// CBAM — Carbon Border Adjustment Mechanism, Regulation (EU) 2023/956.
//
// DESIGN RULE FOR THIS WHOLE FILE:
// We bundle only things that are (a) published in the legal text, (b) stable, and
// (c) independently checkable by the caller in about a minute. That means CN-code
// scope and the de minimis threshold. We deliberately do NOT bundle default
// emission factors: they move by implementing act, a stale factor produces a wrong
// liability number, and a wrong liability number is the one output that can cost a
// caller real money. Emission intensity is always supplied BY the caller and we do
// the arithmetic on it, transparently, showing every step.

export const CBAM_AS_OF = '2026-08-11';
export const CBAM_REGULATION = 'Regulation (EU) 2023/956; definitive period from 2026-01-01';

// De minimis: importers at or below this net mass per calendar year are out of scope.
// Crossing it at any point pulls ALL imports that year back into scope, retroactively.
// Does not apply to electricity or hydrogen.
export const DE_MINIMIS_TONNES = 50;
const DE_MINIMIS_EXEMPT_SECTORS = new Set(['electricity', 'hydrogen']);

// CN prefixes by sector. Prefix match on the digits of a CN/HS code.
// Indicative and must be checked against Annex I of the Regulation before reliance —
// this is stated in every response.
// Scope entries. `ex` marks a heading that Annex I lists only PARTIALLY — Annex I
// writes it as "ex NNNN", meaning only specified products within the heading are
// covered. A prefix match on an `ex` heading CANNOT decide scope on its own, so we
// return `qualified: true` and refuse to assert a clean yes.
//
// `excludes` are codes expressly carved out of a listed heading.
//
// Corrected 11 Aug 2026 after external review against the consolidated text
// (Reg. 2023/956 as amended by Reg. 2025/2083). Prior versions used naked prefixes
// and returned confident answers for goods Annex I excludes.
const SECTORS = [
  { sector: 'cement', entries: [
    { code: '250700', ex: true, note: 'Annex I lists ex 2507 00 80 and excludes non-calcined kaolinic clays' },
    { code: '2523' },
  ]},
  { sector: 'electricity', entries: [{ code: '2716' }] },
  { sector: 'fertilisers', entries: [
    { code: '2808' }, { code: '2814' },
    { code: '283421', note: 'only potassium nitrates (2834 21); the rest of heading 2834 is not listed' },
    { code: '3102' },
    { code: '3105', excludes: ['310560'], note: 'heading 3105 except 3105 60 00' },
  ]},
  { sector: 'iron_steel', entries: [
    // Chapter 72 is listed as a whole EXCEPT all 7204 ferrous waste/scrap and
    // specified 7202 ferro-alloys. 7204 is a clean exclusion. 7202 is partial, so it
    // gets its own entry and returns requires_verification rather than a yes or a no.
    { code: '72', excludes: ['7204'],
      note: 'Annex I lists chapter 72 except specified 7202 ferro-alloys and all 7204 ferrous waste and scrap' },
    { code: '7202', ex: true,
      note: 'Annex I excludes SPECIFIED 7202 ferro-alloys but not all of heading 7202. Check the exact subheading against Annex I — this is the one place in chapter 72 where a heading match cannot decide it.' },
    { code: '7301' }, { code: '7302' }, { code: '7303' }, { code: '7304' }, { code: '7305' },
    { code: '7306' }, { code: '7307' }, { code: '7308' }, { code: '7309' }, { code: '7310' },
    { code: '7311' }, { code: '7318' }, { code: '7326' },
  ]},
  { sector: 'aluminium', entries: [
    { code: '7601' }, { code: '7603' }, { code: '7604' }, { code: '7605' }, { code: '7606' },
    { code: '7607' }, { code: '7608' }, { code: '7609' }, { code: '7610' }, { code: '7611' },
    { code: '7612' }, { code: '7613' }, { code: '7614' }, { code: '7616' },
  ]},
  { sector: 'hydrogen', entries: [{ code: '280410' }] },

  // Resolved 11 Aug 2026 (third review, cited to Annex I):
  //   2601 12 00 IS expressly listed under Iron and steel -> clean entry below.
  //   7317, 7323, 7324, 7602, 7615 are NOT listed -> removed entirely. Annex I is an
  //   enumerated list; do not infer chapter-wide coverage from neighbouring headings.
  { sector: 'iron_steel', entries: [
    { code: '260112', note: 'agglomerated iron ores and concentrates, other than roasted iron pyrites — expressly listed in Annex I, Iron and steel' },
  ]},
];

export function normaliseCn(input) {
  return String(input ?? '').replace(/[^0-9]/g, '');
}

export function cbamScope(rawCode) {
  const cn = normaliseCn(rawCode);
  if (!cn) return { input: rawCode ?? null, valid: false, reason: 'no digits found in code', inScope: null };
  if (cn.length < 4) {
    return { input: rawCode, cn, valid: false, reason: 'CN code must have at least 4 digits (chapter+heading)', inScope: null };
  }

  let best = null;
  for (const s of SECTORS) {
    for (const e of s.entries) {
      if (cn.startsWith(e.code) && (!best || e.code.length > best.entry.code.length)) {
        best = { sector: s.sector, entry: e };
      }
    }
  }

  if (!best) {
    return {
      input: rawCode, cn, valid: true, inScope: false, sector: null, qualified: false,
      note: 'No CBAM sector entry matched. Absence of a match is NOT proof the good is out of scope — Annex I is the authority and this list can lag amendment.',
      asOf: CBAM_AS_OF,
    };
  }

  const { sector, entry } = best;
  const excluded = (entry.excludes || []).find((x) => cn.startsWith(x));
  if (excluded) {
    return {
      input: rawCode, cn, valid: true, inScope: false, sector, qualified: false,
      excludedBy: excluded,
      note: `CN ${cn} falls under an exclusion carved out of heading ${entry.code}. ${entry.note || ''}`.trim(),
      asOf: CBAM_AS_OF,
    };
  }

  const deMinimis = !DE_MINIMIS_EXEMPT_SECTORS.has(sector);
  const out = {
    input: rawCode, cn, valid: true, inScope: true, sector,
    matchedEntry: entry.code,
    qualified: Boolean(entry.ex),
    deMinimisApplies: deMinimis,
    deMinimisTonnes: deMinimis ? DE_MINIMIS_TONNES : null,
    obligations: {
      authorisedDeclarantRequired: true,
      annualDeclarationDue: '30 September of the year following import',
      certificateSalesOpen: '2027-02-01',
      firstSurrenderFor2026Imports: '2027-09-30',
    },
    asOf: CBAM_AS_OF,
  };
  if (entry.note) out.qualifierNote = entry.note;
  if (entry.ex) {
    out.inScope = 'requires_verification';
    out.warning = 'Annex I lists this heading only PARTIALLY (an "ex" entry). A code match at heading level does NOT establish that this specific good is in scope. Check the exact subheading against Annex I before relying on this.';
  }
  if (entry.disputed) {
    out.disputed = true;
    out.warning = 'DISPUTED ENTRY. Two independent reviews disagreed about whether this heading is in Annex I, and neither verified it against the primary text. RegRails will not assert either answer. Check Annex I directly.';
  }
  return out;
}


// Running de minimis tracker. Caller supplies their own import lines; we do the
// arithmetic and flag the retroactivity trap, which is the part people get wrong.
export function cbamThreshold({ lines = [], year = null } = {}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { valid: false, reason: 'lines[] required: [{cn, netMassTonnes, date?}]' };
  }

  const evaluated = [];
  let counted = 0;
  let crossedAt = null;
  const perSector = {};
  const problems = [];

  lines.forEach((line, i) => {
    const scope = cbamScope(line?.cn);
    const mass = Number(line?.netMassTonnes);
    const massOk = Number.isFinite(mass) && mass >= 0;
    if (!massOk) problems.push(`line ${i}: netMassTonnes missing or not a non-negative number`);

    const countsTowardThreshold = Boolean(scope.inScope && scope.deMinimisApplies && massOk);
    if (countsTowardThreshold) {
      counted += mass;
      perSector[scope.sector] = Number(((perSector[scope.sector] || 0) + mass).toFixed(6));
      if (crossedAt === null && counted > DE_MINIMIS_TONNES) crossedAt = i;
    }

    evaluated.push({
      index: i, cn: scope.cn ?? null, inScope: scope.inScope, sector: scope.sector ?? null,
      netMassTonnes: massOk ? mass : null,
      countsTowardThreshold,
      cumulativeCountedTonnes: Number(counted.toFixed(6)),
      date: line?.date ?? null,
    });
  });

  counted = Number(counted.toFixed(6));
  const exceeded = counted > DE_MINIMIS_TONNES;

  return {
    valid: problems.length === 0,
    problems,
    year: year ?? null,
    deMinimisTonnes: DE_MINIMIS_TONNES,
    countedTonnes: counted,
    headroomTonnes: Number((DE_MINIMIS_TONNES - counted).toFixed(6)),
    thresholdExceeded: exceeded,
    crossedAtLineIndex: crossedAt,
    perSectorTonnes: perSector,
    retroactivity: exceeded
      ? 'Threshold exceeded. The obligation applies to ALL in-scope goods imported in this calendar year, including those imported before the crossing point — not only the excess.'
      : 'Threshold not exceeded on the lines supplied. Crossing it at any point in the year pulls every in-scope import that year into scope retroactively.',
    excluded: 'Electricity and hydrogen do not benefit from the de minimis and are never counted here.',
    asOf: CBAM_AS_OF,
  };
}

// Deterministic arithmetic only. Every factor comes from the caller.
export function cbamEstimate({ lines = [], certificatePriceEur = null, freeAllocationShare = 0 } = {}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { valid: false, reason: 'lines[] required: [{cn, netMassTonnes, embeddedEmissionsTco2ePerTonne}]' };
  }
  const share = Number(freeAllocationShare);
  if (!Number.isFinite(share) || share < 0 || share > 1) {
    return { valid: false, reason: 'freeAllocationShare must be a number between 0 and 1' };
  }

  const problems = [];
  const rows = [];
  let totalTco2e = 0;
  let totalAdjusted = 0;

  lines.forEach((line, i) => {
    const scope = cbamScope(line?.cn);
    const mass = Number(line?.netMassTonnes);
    const intensity = Number(line?.embeddedEmissionsTco2ePerTonne);
    if (!Number.isFinite(mass) || mass < 0) problems.push(`line ${i}: netMassTonnes invalid`);
    if (!Number.isFinite(intensity) || intensity < 0) problems.push(`line ${i}: embeddedEmissionsTco2ePerTonne invalid — this service does not supply default factors`);
    if (!scope.inScope) problems.push(`line ${i}: CN ${scope.cn ?? '?'} did not match a CBAM sector; excluded from the total`);

    const ok = scope.inScope && Number.isFinite(mass) && Number.isFinite(intensity) && mass >= 0 && intensity >= 0;
    const tco2e = ok ? mass * intensity : null;
    const adjusted = ok ? tco2e * (1 - share) : null;
    if (ok) { totalTco2e += tco2e; totalAdjusted += adjusted; }

    rows.push({
      index: i, cn: scope.cn ?? null, sector: scope.sector ?? null, inScope: scope.inScope,
      netMassTonnes: Number.isFinite(mass) ? mass : null,
      embeddedEmissionsTco2ePerTonne: Number.isFinite(intensity) ? intensity : null,
      embeddedTco2e: tco2e === null ? null : Number(tco2e.toFixed(6)),
      adjustedTco2e: adjusted === null ? null : Number(adjusted.toFixed(6)),
      arithmetic: ok ? `${mass} t x ${intensity} tCO2e/t x (1 - ${share}) = ${Number(adjusted.toFixed(6))} tCO2e` : null,
    });
  });

  totalTco2e = Number(totalTco2e.toFixed(6));
  totalAdjusted = Number(totalAdjusted.toFixed(6));
  const price = Number(certificatePriceEur);
  const hasPrice = Number.isFinite(price) && price >= 0;

  return {
    valid: problems.length === 0,
    problems,
    lines: rows,
    freeAllocationShare: share,
    totalEmbeddedTco2e: totalTco2e,
    certificatesImpliedTco2e: totalAdjusted,
    certificatePriceEur: hasPrice ? price : null,
    indicativeCostEur: hasPrice ? Number((totalAdjusted * price).toFixed(2)) : null,
    costArithmetic: hasPrice ? `${totalAdjusted} tCO2e x EUR ${price} = EUR ${Number((totalAdjusted * price).toFixed(2))}` : null,
    penaltyReference: 'Regulation sets a penalty per excess tonne not surrendered. Confirm the current figure against the Regulation and any amending act before relying on it.',
    asOf: CBAM_AS_OF,
  };
}

// Structural completeness check on a draft annual declaration.
const DECLARATION_REQUIRED = ['declarantId', 'reportingYear', 'goods'];
const GOODS_REQUIRED = ['cn', 'netMassTonnes', 'countryOfOrigin', 'embeddedEmissionsTco2e'];

export function cbamDeclarationCheck(doc = {}) {
  const errors = [];
  const warnings = [];

  for (const f of DECLARATION_REQUIRED) {
    if (doc[f] === undefined || doc[f] === null || doc[f] === '') errors.push(`missing required field: ${f}`);
  }

  const year = Number(doc.reportingYear);
  if (doc.reportingYear !== undefined) {
    if (!Number.isInteger(year)) errors.push('reportingYear must be an integer');
    else if (year < 2026) errors.push(`reportingYear ${year} precedes the definitive period (from 2026); no declaration is due for it`);
    else if (year > new Date().getUTCFullYear()) warnings.push(`reportingYear ${year} is in the future`);
  }

  const goods = Array.isArray(doc.goods) ? doc.goods : null;
  if (doc.goods !== undefined && !goods) errors.push('goods must be an array');

  const perGood = [];
  let totalMass = 0;
  if (goods) {
    if (goods.length === 0) errors.push('goods[] is empty');
    goods.forEach((g, i) => {
      const gErr = [];
      for (const f of GOODS_REQUIRED) {
        if (g?.[f] === undefined || g?.[f] === null || g?.[f] === '') gErr.push(`missing ${f}`);
      }
      const scope = cbamScope(g?.cn);
      if (g?.cn !== undefined && !scope.inScope) gErr.push(`CN ${scope.cn ?? g.cn} did not match a CBAM sector`);
      const mass = Number(g?.netMassTonnes);
      if (Number.isFinite(mass) && mass >= 0) totalMass += mass;
      else if (g?.netMassTonnes !== undefined) gErr.push('netMassTonnes must be a non-negative number');
      const cc = String(g?.countryOfOrigin ?? '');
      if (cc && !/^[A-Z]{2}$/.test(cc)) gErr.push('countryOfOrigin should be an ISO 3166-1 alpha-2 code');
      if (cc === 'EU' || (cc && ['DE','FR','LU','BE','NL','IT','ES','PL','IE','AT','PT','SE','DK','FI','CZ','SK','HU','RO','BG','HR','SI','EE','LV','LT','GR','CY','MT'].includes(cc))) {
        gErr.push(`countryOfOrigin ${cc} is an EU member state — CBAM applies to imports from third countries`);
      }
      perGood.push({ index: i, cn: scope.cn ?? null, sector: scope.sector ?? null, errors: gErr });
      errors.push(...gErr.map((e) => `goods[${i}]: ${e}`));
    });
  }

  totalMass = Number(totalMass.toFixed(6));
  if (totalMass > 0 && totalMass <= DE_MINIMIS_TONNES) {
    warnings.push(`total net mass ${totalMass} t is at or below the ${DE_MINIMIS_TONNES} t de minimis — check whether a declaration is required at all (electricity and hydrogen excepted)`);
  }

  return {
    structurallyComplete: errors.length === 0,
    errors,
    warnings,
    goodsChecked: perGood.length,
    totalNetMassTonnes: totalMass,
    perGood,
    scope: 'Structural and internal-consistency checks only. This does not verify emissions data against any registry and is not a submission.',
    asOf: CBAM_AS_OF,
  };
}
