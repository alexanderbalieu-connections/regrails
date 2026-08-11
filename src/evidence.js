// RegRails evidence layer.
//
// This is the highest-liability service in the portfolio by a wide margin. A wrong
// CBAM scope answer can lead an importer to under-declare and incur a per-tonne
// penalty; a wrong EUDR answer can lead to a rejected consignment. So the boundary
// between what a STRUCTURAL check establishes and what it does not is stated on
// every response, in the strongest terms the format allows.

export const METHODOLOGY_VERSION = 'rr-1.0.0';

const GLOBAL = [
  'RegRails performs STRUCTURAL and ARITHMETIC checks against published legal texts. It is not legal advice, not customs advice, not a customs ruling, and not a submission to any authority.',
  'RegRails does not file, lodge or transmit anything to the EU CBAM Registry, the EU Information System for EUDR, or any national authority. Producing a valid-looking result here does not discharge any obligation.',
  'Reference data (CN and HS code scope, thresholds, dates) is bundled as of a stated date and can be amended by implementing or delegated act at any time. Always verify against the consolidated text and the relevant Annex before relying on any answer.',
  'RegRails is operated by an independent professional, not an authorised customs representative, and carries no professional indemnity cover. Decisions with financial or legal consequence should be confirmed with a qualified adviser.',
];

const SEMANTICS = {
  structuralIsNotSubstantive:
    'A "structurally valid" result means the input is well-formed and internally consistent. It is NOT a statement that the underlying facts are true, that the emissions figures are correct, or that the land was deforestation-free.',
  inScopeIsAdvisory:
    'Scope answers are prefix matches against bundled code lists. A match is a strong signal; a NON-match is weak and is never proof that a good is outside scope. Annex I of the relevant Regulation is the authority.',
  arithmeticNotEstimation:
    'Where a figure is returned, RegRails performed arithmetic on values YOU supplied. It does not supply default emission factors, benchmark values, or certificate prices, because a stale default produces a wrong liability.',
  signatureProvesIntegrityNotTruth:
    'The Ed25519 signature proves RegRails produced this exact response unaltered. It does not prove the conclusion is correct. A signed wrong answer is still wrong, and still signed.',
  absenceOfErrorIsNotApproval:
    'An empty errors[] means no configured check fired. It is not an approval, a clearance, or a defence against enforcement.',
};

const REG = {
  'cbam.scope': {
    subject: 'CN/CBAM code',
    checks: ['CN digit normalisation', 'Longest-prefix match against bundled CBAM sector code list', 'De minimis applicability by sector'],
    sources: [{ name: 'Regulation (EU) 2023/956 Annex I (bundled prefixes)', refresh: 'with releases; asOf published in response' }],
    assurance: { level: 'structural', basis: 'prefix match is deterministic; the underlying code list is bundled and can lag amendments' },
    limitations: [
      'A non-match does NOT establish that the good is outside CBAM. Composite and downstream goods are the usual failure case.',
      'Does not determine the correct CN code for your goods — classification is a separate exercise and a customs matter.',
      'Scope was proposed for expansion to further product categories; bundled lists may lag.',
    ],
  },
  'cbam.threshold': {
    subject: 'annual import lines',
    checks: ['Per-line scope determination', 'Cumulative net mass against the 50 t de minimis', 'Retroactivity flag on crossing', 'Exclusion of electricity and hydrogen from the de minimis'],
    sources: [{ name: 'Regulation (EU) 2023/956 as amended; 50 t de minimis', refresh: 'with releases' }],
    assurance: { level: 'deterministic', basis: 'arithmetic on caller-supplied masses; no external data' },
    limitations: [
      'Only the lines you supply are counted. An incomplete list produces a falsely low total and a falsely reassuring result.',
      'Net mass must be the customs net mass in tonnes. Unit errors are the most common cause of a wrong answer here.',
    ],
  },
  'cbam.estimate': {
    subject: 'embedded emissions and indicative certificate cost',
    checks: ['Per-line arithmetic: mass x intensity x (1 - free allocation share)', 'Aggregation', 'Optional cost multiplication by a caller-supplied certificate price'],
    sources: [{ name: 'Caller-supplied emission intensities and prices only', refresh: 'n/a — nothing is bundled' }],
    assurance: { level: 'deterministic', basis: 'pure arithmetic on caller inputs; every step is echoed in the response' },
    limitations: [
      'RegRails supplies NO default emission factors. If your intensities are wrong, the output is wrong and the error is invisible here.',
      'Does not apply the actual free-allocation phase-out schedule, carbon price paid in the country of origin, or any adjustment. It multiplies the share you give it.',
      'Indicative only. It is not a liability calculation and must not be used as the basis for a declaration.',
    ],
  },
  'cbam.declaration': {
    subject: 'draft CBAM annual declaration',
    checks: ['Required top-level fields', 'Per-good required fields', 'CN scope consistency', 'ISO 3166-1 alpha-2 origin format', 'EU-origin contradiction', 'Reporting year plausibility', 'De minimis cross-check'],
    sources: [{ name: 'Structural expectations derived from the Regulation', refresh: 'with releases' }],
    assurance: { level: 'structural', basis: 'field presence and internal consistency only' },
    limitations: [
      'Does not validate against the official CBAM Registry schema, which is authoritative and may require fields not checked here.',
      'Does not verify any emissions figure, verifier accreditation, or supporting documentation.',
      'A structurally complete declaration can still be substantively wrong and rejected.',
    ],
  },
  'eudr.scope': {
    subject: 'HS code',
    checks: ['HS digit normalisation', 'Longest-prefix match against bundled EUDR commodity list', 'Deadline tier lookup'],
    sources: [{ name: 'Regulation (EU) 2023/1115 Annex I (bundled prefixes)', refresh: 'with releases' }],
    assurance: { level: 'structural', basis: 'prefix match is deterministic; bundled list can lag amendment' },
    limitations: [
      'A non-match is NOT proof the product is outside EUDR. Annex I is the authority.',
      'A simplification package was in trilogue as of the asOf date and was not binding. Deadlines and scope may change.',
    ],
  },
  'eudr.geo': {
    subject: 'plot geolocation',
    checks: ['GeoJSON type support', 'Coordinate bounds', 'Ring closure', 'Self-intersection', 'Approximate area', 'Point-vs-polygon rule above 4 ha', 'Declared-vs-computed area consistency'],
    sources: [{ name: 'Geometry supplied by the caller', refresh: 'n/a' }],
    assurance: { level: 'deterministic', basis: 'computational geometry on caller-supplied coordinates' },
    limitations: [
      'Area is computed on a local equirectangular projection and is indicative, NOT survey-grade. Do not use it to determine the 4 ha threshold in a marginal case.',
      'Does NOT check the plot against any satellite, forest-cover or deforestation dataset. Geometric validity says nothing about deforestation.',
      'Does not verify the plot exists, is real, or is the plot your commodity came from.',
    ],
  },
  'eudr.dds': {
    subject: 'draft Due Diligence Statement',
    checks: ['Required fields', 'HS-to-commodity consistency', 'EORI format', 'ISO country format', 'Quantity plausibility and units', 'Per-plot geometry validation', 'Cut-off date assertion present'],
    sources: [{ name: 'Structural expectations derived from the Regulation', refresh: 'with releases' }],
    assurance: { level: 'structural', basis: 'field presence, format and internal consistency only' },
    limitations: [
      'Does NOT check deforestation. Not against satellite data, not against any forest baseline, not at all.',
      'Does not verify legality of production under the laws of the country of production, which the Regulation also requires.',
      'Does not submit to the EU Information System and does not create a DDS reference number.',
      'A structurally valid DDS containing false statements remains a false statement, with the operator liable.',
    ],
  },
  'art50.check': {
    subject: 'AI Act Article 50 transparency controls',
    checks: ['Obligation-category mapping', 'Declared control coverage'],
    sources: [{ name: 'Regulation (EU) 2024/1689 Article 50; AI Omnibus in force 2026-07-27', refresh: 'with releases' }],
    assurance: { level: 'structural', basis: 'coverage check against a bundled category-to-control map' },
    limitations: [
      'Does not inspect your system. It checks only the controls you assert.',
      'Not a conformity assessment and not a classification of your system under the Act.',
      'Article 50 exemptions are fact-specific and are surfaced as notes, not applied.',
    ],
  },
  'c2pa.check': {
    subject: 'content-credential manifest',
    checks: ['Claim generator presence', 'Assertions array', 'c2pa.actions presence', 'digitalSourceType indicating trained-algorithmic media', 'Signature presence'],
    sources: [{ name: 'Manifest supplied by the caller', refresh: 'n/a' }],
    assurance: { level: 'structural', basis: 'shape inspection only' },
    limitations: [
      'Does NOT verify the cryptographic signature or validate any certificate chain.',
      'Does not confirm the manifest is bound to any particular asset, nor that the asset is unmodified.',
      'Structural validity does not establish that a marking obligation is satisfied.',
    ],
  },
};

export function buildEvidence(kind) {
  const spec = REG[kind];
  if (!spec) return null;
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    decision: kind,
    subject: spec.subject,
    checksPerformed: spec.checks,
    dataSources: spec.sources,
    freshness: {
      basis: 'deterministic',
      observedAt: new Date().toISOString(),
      guidance: 'Deterministic for identical input. Bundled legal reference data changes only with a release; see asOf in the response body.',
    },
    assurance: spec.assurance,
    semantics: SEMANTICS,
    humanApprovalRecommended: 'always_before_filing',
    limitations: spec.limitations,
    globalLimitations: GLOBAL,
    methodology: 'https://reg.chainverdict.xyz/v1/methodology',
    verifySignature: 'https://reg.chainverdict.xyz/.well-known/signing-key.json',
  };
}

export function methodologyDocument() {
  return {
    service: 'RegRails',
    methodologyVersion: METHODOLOGY_VERSION,
    published: new Date().toISOString(),
    principle:
      'Check what can be checked deterministically from published legal text — code scope, thresholds, field structure, geometry, arithmetic — and refuse to guess at everything else. Where a number would require a reference value that can go stale, RegRails asks the caller for it rather than bundling a figure that may be wrong by the time it is used.',
    whatIsDeliberatelyNotDone: [
      'No default emission factors are bundled. CBAM cost figures are arithmetic on caller-supplied intensities.',
      'No satellite or deforestation data is consulted. EUDR checks are structural and geometric only.',
      'No classification of goods. RegRails checks the code you give it; it does not tell you which code applies.',
      'No filing. Nothing is transmitted to any authority.',
      'No conformity assessment under the AI Act.',
    ],
    evidenceModel: {
      assurance: 'Ordinal, not numeric. A number would imply a calibration RegRails has not performed.',
      calibration: 'RegRails does not publish precision/recall against a labelled corpus and does not claim calibration.',
      integrityVsTruth: 'Signing proves provenance and integrity, not correctness.',
      asymmetry: 'A scope match is a strong signal. A non-match is weak and is never proof of exclusion.',
    },
    globalLimitations: GLOBAL,
    semantics: SEMANTICS,
    endpoints: Object.entries(REG).map(([k, v]) => ({
      decision: k, subject: v.subject, checksPerformed: v.checks, dataSources: v.sources,
      assurance: v.assurance, limitations: v.limitations,
    })),
    corrections: 'Errors, false positives and false negatives can be reported to contact@chainverdict.xyz. Material changes increment methodologyVersion.',
  };
}
