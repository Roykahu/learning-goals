import type { SignupRow } from "./types";

export const ARCHIVE_BCC = "wittybunch@gmail.com";

const INTERNAL_EMAILS = new Set([ARCHIVE_BCC]);
const INTERNAL_PATTERNS = [
  /^test(?:[+._-]|$)/i,
  /[+._-]test(?:[+._-]|$)/i,
  /@example\./i,
  /@test\./i,
  /@localhost$/i,
  /\.invalid$/i
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = ["new", "returning", "multi-child"] as const;

export type PreparedEmail = {
  to: string;
  bcc: string[];
  parent_name: string;
  subject: string;
  message: string;
  children: string[];
  category?: "new" | "returning" | "multi-child";
};

export type EmailBatch = {
  emails: PreparedEmail[];
  totalRecipientRows: number;
  duplicateRecipientsRemoved: number;
  invalidOrMissingEmailRows: number;
  internalOrTestRowsExcluded: number;
  categoryCounts: Record<NonNullable<PreparedEmail["category"]>, number>;
};

export type SafetyPreview = {
  totalRecipients: number;
  duplicateRecipientsRemoved: number;
  samples: PreparedEmail[];
  missingCategories: string[];
};

export type DryRunRecipient = {
  to: string;
  bcc: string[];
  parent_name: string;
  children: string[];
  category?: PreparedEmail["category"];
};

export type DryRunReport = {
  totalFamilies: number;
  totalEmailsToSend: number;
  duplicateEmailsRemoved: number;
  invalidOrMissingEmailAddresses: number;
  internalTestAccountsExcluded: number;
  categoryCounts: Record<NonNullable<PreparedEmail["category"]>, number>;
  recipients: DryRunRecipient[];
  previewEmails: PreparedEmail[];
  missingCategories: string[];
  everyEmailHasArchiveBcc: boolean;
  everyRecipientUnique: boolean;
  sendsIndividually: boolean;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isPaid(row: SignupRow): boolean {
  return Boolean(row.paid_at) || /paid|payé|paye/i.test(row.invoice_status);
}

function isInternalOrTestEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  return INTERNAL_EMAILS.has(normalized) || INTERNAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isLikelyEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

function childSummary(children: string[]): string {
  if (children.length === 0) return "votre enfant";
  if (children.length === 1) return children[0];
  if (children.length === 2) return `${children[0]} et ${children[1]}`;
  return `${children.slice(0, -1).join(", ")} et ${children[children.length - 1]}`;
}

function buildMessage(parentName: string, children: string[]): string {
  const greetingName = parentName ? ` ${parentName}` : "";
  return [
    `Bonjour${greetingName},`,
    "",
    `Petit rappel concernant le règlement de l'inscription de ${childSummary(children)} chez Witty Bunch.`,
    "",
    "Si le paiement a déjà été effectué, merci beaucoup et vous pouvez ignorer ce message.",
    "",
    "Bien à vous,",
    "L'équipe Witty Bunch"
  ].join("\n");
}

function hasPaidHistory(rows: SignupRow[]): boolean {
  return rows.some(isPaid);
}

export function buildPendingPaymentBatch(signups: SignupRow[]): EmailBatch {
  const families = new Map<string, { parent_name: string; children: Set<string>; rows: SignupRow[]; pendingRows: number }>();
  let totalRecipientRows = 0;
  let invalidOrMissingEmailRows = 0;
  let internalOrTestRowsExcluded = 0;

  for (const row of signups) {
    if (isPaid(row)) continue;

    const email = normalizeEmail(row.parent_email);
    if (!email || !isLikelyEmail(email)) {
      invalidOrMissingEmailRows += 1;
      continue;
    }
    if (isInternalOrTestEmail(email)) {
      internalOrTestRowsExcluded += 1;
      continue;
    }
    totalRecipientRows += 1;

    const family = families.get(email) || {
      parent_name: row.parent_name.trim(),
      children: new Set<string>(),
      rows: signups.filter((candidate) => normalizeEmail(candidate.parent_email) === email),
      pendingRows: 0
    };

    if (!family.parent_name && row.parent_name.trim()) family.parent_name = row.parent_name.trim();
    if (row.kid_name.trim()) family.children.add(row.kid_name.trim());
    family.pendingRows += 1;
    families.set(email, family);
  }

  const emails = Array.from(families.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([to, family]) => {
      const children = Array.from(family.children).sort((left, right) => left.localeCompare(right));
      const returning = hasPaidHistory(family.rows) || family.rows.length > family.pendingRows;
      const category: PreparedEmail["category"] = children.length > 1 ? "multi-child" : returning ? "returning" : "new";
      return {
        to,
        bcc: [ARCHIVE_BCC],
        parent_name: family.parent_name,
        subject: "Witty Bunch payment follow-up",
        message: buildMessage(family.parent_name, children),
        children,
        category
      };
    });
  const categoryCounts = emails.reduce<Record<NonNullable<PreparedEmail["category"]>, number>>(
    (counts, email) => {
      if (email.category) counts[email.category] += 1;
      return counts;
    },
    { new: 0, returning: 0, "multi-child": 0 }
  );

  return {
    emails,
    totalRecipientRows,
    duplicateRecipientsRemoved: Math.max(0, totalRecipientRows - emails.length),
    invalidOrMissingEmailRows,
    internalOrTestRowsExcluded,
    categoryCounts
  };
}

export function preparePendingPaymentEmails(signups: SignupRow[]): PreparedEmail[] {
  return buildPendingPaymentBatch(signups).emails;
}

function firstByCategory(emails: PreparedEmail[], category: PreparedEmail["category"]): PreparedEmail | undefined {
  return emails.find((email) => email.category === category);
}

export function buildSafetyPreview(signups: SignupRow[]): SafetyPreview {
  const batch = buildPendingPaymentBatch(signups);
  const selected = new Map<string, PreparedEmail>();
  const missingCategories: string[] = [];

  for (const category of CATEGORIES) {
    const email = firstByCategory(batch.emails, category);
    if (email) {
      selected.set(email.to, email);
    } else {
      missingCategories.push(category);
    }
  }

  return {
    totalRecipients: batch.emails.length,
    duplicateRecipientsRemoved: batch.duplicateRecipientsRemoved,
    samples: Array.from(selected.values()),
    missingCategories
  };
}

export function buildDryRunReport(signups: SignupRow[]): DryRunReport {
  const batch = buildPendingPaymentBatch(signups);
  const preview = buildSafetyPreview(signups);
  const recipientEmails = batch.emails.map((email) => email.to);

  return {
    totalFamilies: batch.emails.length,
    totalEmailsToSend: batch.emails.length,
    duplicateEmailsRemoved: batch.duplicateRecipientsRemoved,
    invalidOrMissingEmailAddresses: batch.invalidOrMissingEmailRows,
    internalTestAccountsExcluded: batch.internalOrTestRowsExcluded,
    categoryCounts: batch.categoryCounts,
    recipients: batch.emails.map((email) => ({
      to: email.to,
      bcc: email.bcc,
      parent_name: email.parent_name,
      children: email.children,
      category: email.category
    })),
    previewEmails: preview.samples,
    missingCategories: preview.missingCategories,
    everyEmailHasArchiveBcc: batch.emails.every((email) => email.bcc.includes(ARCHIVE_BCC)),
    everyRecipientUnique: new Set(recipientEmails).size === recipientEmails.length,
    sendsIndividually: true
  };
}
