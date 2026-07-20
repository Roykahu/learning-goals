import type { ChildRecord, IgnoredChild } from "./types";

const NEGATIVE_PATTERNS = [
  /\bpas\s+d[eu]\b/i,
  /\bpas\s+de\s+(deuxi[eè]me|2|troisi[eè]me|3)/i,
  /\baucun(?:e)?\b/i,
  /\bn\/?a\b/i,
  /\bnon\b/i,
  /\bnone\b/i,
  /\bno\s+child\b/i,
  /\bnous\s+n['’]avons\s+pas\b/i,
  /\bne\s+souhaitons\s+pas\b/i,
  /\brien\b/i
];

export function clean(value: unknown): string {
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function normalize(value: string): string {
  return clean(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function isNegativeAnswer(value: string): boolean {
  const raw = clean(value);
  if (!raw) return true;
  const normalized = normalize(raw);
  return NEGATIVE_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(normalized));
}

function hasPlausibleName(value: string): boolean {
  const raw = clean(value);
  if (!raw || isNegativeAnswer(raw)) return false;
  if (raw.length < 2 || raw.length > 90) return false;
  if (!/[a-zA-ZÀ-ÿ]/.test(raw)) return false;
  if (/^\d+$/.test(raw)) return false;
  return true;
}

function hasValidSessions(value: string): boolean {
  const raw = clean(value);
  if (!raw || isNegativeAnswer(raw)) return false;
  if (/\b[1-9]\d*\b/.test(raw)) return true;
  return /une|deux|three|two|one|séance|seance|session/i.test(raw);
}

export function validateChild(input: {
  kid_index: string;
  name: string;
  sessions: string;
  paymentPlan?: string;
  extraEvidence?: string[];
}): { child?: ChildRecord; ignored?: IgnoredChild } | undefined {
  const kidIndex = clean(input.kid_index);
  const name = clean(input.name);
  const sessions = clean(input.sessions);
  const paymentPlan = clean(input.paymentPlan);
  const extraEvidence = (input.extraEvidence || []).map(clean).filter(Boolean);
  const evidence = [name, sessions, paymentPlan, ...extraEvidence].filter((value) => !isNegativeAnswer(value));

  if (!name && !sessions && extraEvidence.length === 0) {
    return undefined;
  }

  if (!hasPlausibleName(name)) {
    return {
      ignored: {
        kid_index: kidIndex,
        raw_name: name,
        raw_sessions: sessions,
        reason: name ? "Ignored because the child name is a negative/placeholder answer." : "Ignored because no child name was provided."
      }
    };
  }

  if (!hasValidSessions(sessions) && evidence.length < 3) {
    return {
      ignored: {
        kid_index: kidIndex,
        raw_name: name,
        raw_sessions: sessions,
        reason: "Ignored because the child section is incomplete."
      }
    };
  }

  return {
    child: {
      kid_index: kidIndex,
      kid_name: name,
      sessions_per_week: sessions,
      payment_plan: paymentPlan,
      evidence
    }
  };
}

export function validateChildren(
  candidates: Array<{ kid_index: string; name: string; sessions: string; paymentPlan?: string; extraEvidence?: string[] }>
): { valid: ChildRecord[]; ignored: IgnoredChild[] } {
  const valid: ChildRecord[] = [];
  const ignored: IgnoredChild[] = [];

  for (const candidate of candidates) {
    const result = validateChild(candidate);
    if (!result) continue;
    if (result.child) valid.push(result.child);
    if (result.ignored) ignored.push(result.ignored);
  }

  return { valid, ignored };
}
