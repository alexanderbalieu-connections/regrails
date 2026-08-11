// EU AI Act Article 50 — transparency obligations.
//
// Enforceable from 2 August 2026. NOT deferred by the AI Omnibus (in force
// 2026-07-27), which moved only the high-risk obligations: Annex III standalone
// systems to 2027-12-02 and Annex I embedded systems to 2028-08-02.
//
// Structural checks on disclosure surfaces and content-marking manifests. This
// does not classify anyone's AI system and is not a conformity assessment.

export const ART50_AS_OF = '2026-08-11';

export const AI_ACT_DATES = {
  prohibitions: '2025-02-02',
  gpaiObligations: '2025-08-02',
  article50Transparency: '2026-08-02',
  highRiskAnnexIII: '2027-12-02',
  highRiskAnnexI: '2028-08-02',
  omnibusInForce: '2026-07-27',
  note: 'Article 50 transparency applies from 2026-08-02 and was not deferred. High-risk dates shown reflect the AI Omnibus. Verify against the consolidated text before relying on any date.',
};

const OBLIGATION_KINDS = {
  chatbot: {
    label: 'AI system interacting directly with natural persons',
    requires: ['disclosureBeforeInteraction', 'disclosureMachineReadable'],
    exemption: 'Not required where it is obvious to a reasonably well-informed person, or where the use is legally authorised for criminal-offence detection.',
  },
  synthetic_content: {
    label: 'Generator of synthetic audio, image, video or text',
    requires: ['markingMachineReadable', 'markingDetectable', 'markingRobustToEditing'],
    exemption: 'Assistive or non-substantially-altering editing may be out of scope.',
  },
  deepfake: {
    label: 'Deep fake — image, audio or video resembling real persons or events',
    requires: ['disclosureVisibleToViewer', 'markingMachineReadable'],
    exemption: 'Artistic, satirical or fictional works: disclosure may be limited so as not to hamper display of the work.',
  },
  public_interest_text: {
    label: 'AI-generated text published to inform the public on matters of public interest',
    requires: ['disclosurePublished', 'humanReviewDeclared'],
    exemption: 'Not required where the content underwent human review and a person holds editorial responsibility.',
  },
};

export function art50Applicability({ kind = null } = {}) {
  if (!kind || !OBLIGATION_KINDS[kind]) {
    return {
      valid: false,
      reason: `kind must be one of: ${Object.keys(OBLIGATION_KINDS).join(', ')}`,
      kinds: Object.keys(OBLIGATION_KINDS),
    };
  }
  const o = OBLIGATION_KINDS[kind];
  return {
    valid: true, kind, label: o.label,
    requiredControls: o.requires,
    exemptionNote: o.exemption,
    applicableFrom: AI_ACT_DATES.article50Transparency,
    deferredByOmnibus: false,
    dates: AI_ACT_DATES,
    scope: 'Indicative mapping of Article 50 obligation categories to controls. Not legal advice and not a classification of your system.',
    asOf: ART50_AS_OF,
  };
}

export function art50Check({ kind = null, controls = {} } = {}) {
  const applic = art50Applicability({ kind });
  if (!applic.valid) return applic;

  const missing = [];
  const present = [];
  for (const c of applic.requiredControls) {
    if (controls?.[c] === true) present.push(c);
    else missing.push(c);
  }

  return {
    kind, label: applic.label,
    controlsPresent: present,
    controlsMissing: missing,
    structurallyConformant: missing.length === 0,
    exemptionNote: applic.exemptionNote,
    applicableFrom: AI_ACT_DATES.article50Transparency,
    scope: 'Checks only whether the controls you declared cover the categories Article 50 lists for this kind. It does not inspect your system, verify your declarations, or constitute a conformity assessment.',
    asOf: ART50_AS_OF,
  };
}

// C2PA / content-credential manifest structural check.
export function c2paCheck(manifest = {}) {
  const errors = [];
  const warnings = [];

  if (typeof manifest !== 'object' || manifest === null) {
    return { valid: false, errors: ['manifest must be a JSON object'], asOf: ART50_AS_OF };
  }

  const claim = manifest.claim ?? manifest;
  if (!claim.claim_generator && !claim.claimGenerator) errors.push('missing claim_generator: the tool that produced the assertion');
  const assertions = claim.assertions ?? claim.assertion ?? null;
  if (!Array.isArray(assertions)) errors.push('missing assertions[]');

  let hasActions = false;
  let declaresAiGenerated = false;
  if (Array.isArray(assertions)) {
    for (const a of assertions) {
      const label = String(a?.label ?? '');
      if (label.startsWith('c2pa.actions')) {
        hasActions = true;
        const actions = a?.data?.actions ?? [];
        for (const act of actions) {
          const digital = String(act?.digitalSourceType ?? '');
          if (/trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia/i.test(digital)) declaresAiGenerated = true;
        }
      }
    }
  }
  if (!hasActions) errors.push('no c2pa.actions assertion — the action history is what carries the AI-generation declaration');
  if (hasActions && !declaresAiGenerated) {
    warnings.push('actions present but no digitalSourceType indicating trained-algorithmic media; if this content is AI-generated, Article 50 marking is not satisfied by this manifest');
  }

  const sig = manifest.signature ?? claim.signature ?? null;
  if (!sig) errors.push('missing signature — an unsigned manifest is not tamper-evident and does not satisfy a marking obligation');

  return {
    structurallyValid: errors.length === 0,
    errors,
    warnings,
    hasActionAssertion: hasActions,
    declaresAiGeneratedSource: declaresAiGenerated,
    isSigned: Boolean(sig),
    scope: 'Structural check of a content-credential manifest. It does NOT verify the cryptographic signature, validate the certificate chain, or confirm the manifest is bound to any particular asset.',
    asOf: ART50_AS_OF,
  };
}
