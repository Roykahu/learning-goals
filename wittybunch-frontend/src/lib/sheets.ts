import { google } from "googleapis";
import { clean, validateChildren } from "./child-validation";
import { simpleHash } from "./hash";
import type {
  DashboardData,
  ParsedSubmission,
  PaymentCycle,
  PaymentCycleSummary,
  PaymentStatus,
  SheetRow,
  SignupRow
} from "./types";

const SIGNUPS_TAB = "_signups";
const MESSAGES_TAB = "_messages";
const OVERRIDES_TAB = "_dashboard_overrides";
const PAYMENT_ADJUSTMENTS_TAB = "_payment_adjustments";
const DEPOSIT_TOTAL = 85;
const FORM_RESPONSES_RANGE = "Form responses 1!A:BP";
const EXTRA_FORM_SOURCES = [
  {
    env: "WITTYBUNCH_BILINGUAL_PAYMENT_FORM_RESPONSES_SHEET_ID",
    sourceFormKey: "bilingual_payment_2026_2027"
  }
];

const PAYMENT_CYCLES: { cycle: PaymentCycle; label: string }[] = [
  { cycle: "reservation", label: "Reservation" },
  { cycle: "trimester_1", label: "1st trimester" },
  { cycle: "trimester_2", label: "2nd trimester" },
  { cycle: "trimester_3", label: "3rd trimester" }
];

type EnrolmentOverrideAction = "exclude" | "update" | "restore";

type EnrolmentOverride = {
  source_row_key: string;
  kid_index: string;
  action: EnrolmentOverrideAction;
  sessions_per_week: string;
  reason: string;
  created_at: string;
};

type PaymentAdjustment = {
  source_row_key: string;
  kid_index: string;
  pennylane_invoice_id: string;
  payment_cycle: PaymentCycle;
  expected_amount: string;
  paid_amount: string;
  payment_status: PaymentStatus;
  justification_type: string;
  justification_notes: string;
  created_at: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name: string): string {
  return process.env[name] || "";
}

function sheetsClient() {
  const email = requireEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const key = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

function rowObjects(values: string[][]): SheetRow[] {
  const [headers = [], ...rows] = values;
  return rows.map((row) => {
    const object: SheetRow = {};
    headers.forEach((header, index) => {
      const key = clean(header) || `Column ${index + 1}`;
      if (object[key]) {
        object[`${key}__${index + 1}`] = clean(row[index]);
      } else {
        object[key] = clean(row[index]);
      }
    });
    return object;
  });
}

async function readValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const sheets = sheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "FORMATTED_VALUE"
  });
  return (response.data.values || []) as string[][];
}

async function readOptionalValues(spreadsheetId: string, range: string): Promise<string[][]> {
  try {
    return await readValues(spreadsheetId, range);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unable to parse range") || message.includes("Requested entity was not found")) {
      return [];
    }
    throw error;
  }
}

function overrideKey(sourceRowKey: string, kidIndex: string): string {
  return `${sourceRowKey}::${kidIndex}`;
}

function latestOverrides(values: string[][]): Map<string, EnrolmentOverride> {
  const overrides = new Map<string, EnrolmentOverride>();
  for (const row of rowObjects(values)) {
    const action = clean(row.action) as EnrolmentOverrideAction;
    const sourceRowKey = clean(row.source_row_key);
    const kidIndex = clean(row.kid_index);
    if (!sourceRowKey || !kidIndex) continue;
    const key = overrideKey(sourceRowKey, kidIndex);
    if (action === "restore") {
      overrides.delete(key);
      continue;
    }
    if (action === "exclude" || action === "update") {
      overrides.set(key, {
        source_row_key: sourceRowKey,
        kid_index: kidIndex,
        action,
        sessions_per_week: clean(row.sessions_per_week),
        reason: clean(row.reason),
        created_at: clean(row.created_at)
      });
    }
  }
  return overrides;
}

function parseAmount(value: string): number {
  const normalized = clean(value).replace(/\s/g, "").replace("€", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paymentCycleLabel(cycle: PaymentCycle): string {
  return PAYMENT_CYCLES.find((item) => item.cycle === cycle)?.label || "Reservation";
}

function normalizePaymentCycle(value: string): PaymentCycle {
  const normalized = clean(value).toLowerCase();
  if (normalized.includes("3")) return "trimester_3";
  if (normalized.includes("2")) return "trimester_2";
  if (normalized.includes("1")) return "trimester_1";
  if (normalized.includes("reservation") || normalized.includes("deposit")) return "reservation";
  if (["trimester_1", "trimester_2", "trimester_3", "reservation"].includes(normalized)) {
    return normalized as PaymentCycle;
  }
  return "reservation";
}

function normalizePaymentStatus(value: string, paidAt = ""): PaymentStatus {
  const normalized = clean(value).toLowerCase();
  if (clean(paidAt)) return "paid";
  if (/overpaid|surpay/.test(normalized)) return "overpaid";
  if (/partial|partiel/.test(normalized)) return "partial";
  if (/waived|exempt|cancel|annul/.test(normalized)) return "waived";
  if (/paid|payé|paye|reconciled|settled|lettr/.test(normalized)) return "paid";
  return "pending";
}

function paymentKey(sourceRowKey: string, kidIndex: string, invoiceId: string): string {
  const invoice = clean(invoiceId);
  if (invoice) return `invoice:${invoice}`;
  return `row:${sourceRowKey}::${kidIndex}`;
}

function latestPaymentAdjustments(values: string[][]): Map<string, PaymentAdjustment> {
  const adjustments = new Map<string, PaymentAdjustment>();
  for (const row of rowObjects(values)) {
    const sourceRowKey = clean(row.source_row_key);
    const kidIndex = clean(row.kid_index);
    const invoiceId = clean(row.pennylane_invoice_id);
    if (!sourceRowKey || !kidIndex) continue;
    adjustments.set(paymentKey(sourceRowKey, kidIndex, invoiceId), {
      source_row_key: sourceRowKey,
      kid_index: kidIndex,
      pennylane_invoice_id: invoiceId,
      payment_cycle: normalizePaymentCycle(row.payment_cycle),
      expected_amount: clean(row.expected_amount),
      paid_amount: clean(row.paid_amount),
      payment_status: normalizePaymentStatus(row.payment_status),
      justification_type: clean(row.justification_type),
      justification_notes: clean(row.justification_notes),
      created_at: clean(row.created_at)
    });
  }
  return adjustments;
}

async function ensureOverridesSheet(spreadsheetId: string) {
  const sheets = sheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });
  const exists = (metadata.data.sheets || []).some((sheet) => sheet.properties?.title === OVERRIDES_TAB);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: OVERRIDES_TAB } } }]
      }
    });
  }
  const values = await readOptionalValues(spreadsheetId, `${OVERRIDES_TAB}!A1:F1`);
  if (values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${OVERRIDES_TAB}!A1:F1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["source_row_key", "kid_index", "action", "sessions_per_week", "reason", "created_at"]]
      }
    });
  }
}

async function ensurePaymentAdjustmentsSheet(spreadsheetId: string) {
  const sheets = sheetsClient();
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title"
  });
  const exists = (metadata.data.sheets || []).some((sheet) => sheet.properties?.title === PAYMENT_ADJUSTMENTS_TAB);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: PAYMENT_ADJUSTMENTS_TAB } } }]
      }
    });
  }
  const values = await readOptionalValues(spreadsheetId, `${PAYMENT_ADJUSTMENTS_TAB}!A1:J1`);
  if (values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${PAYMENT_ADJUSTMENTS_TAB}!A1:J1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "source_row_key",
          "kid_index",
          "pennylane_invoice_id",
          "payment_cycle",
          "expected_amount",
          "paid_amount",
          "payment_status",
          "justification_type",
          "justification_notes",
          "created_at"
        ]]
      }
    });
  }
}

function first(row: SheetRow, names: string[]): string {
  for (const name of names) {
    const value = clean(row[name]);
    if (value) return value;
  }
  return "";
}

function byHeaderOccurrence(headers: string[], row: string[], header: string, occurrence = 0): string {
  let seen = 0;
  for (let index = 0; index < headers.length; index += 1) {
    if (clean(headers[index]) === header) {
      if (seen === occurrence) return clean(row[index]);
      seen += 1;
    }
  }
  return "";
}

function byHeaderIncludes(headers: string[], row: string[], needles: string[], occurrence = 0): string {
  let seen = 0;
  const normalizedNeedles = needles.map((needle) => needle.toLowerCase());
  for (let index = 0; index < headers.length; index += 1) {
    const header = clean(headers[index]).toLowerCase();
    if (normalizedNeedles.every((needle) => header.includes(needle))) {
      if (seen === occurrence) return clean(row[index]);
      seen += 1;
    }
  }
  return "";
}

function sourceKey(rowObject: SheetRow, sourceFormKey: string): string {
  const submittedAt = first(rowObject, ["Timestamp", "Column 1", "timestamp"]);
  const email = first(rowObject, ["Email address", "email", "Email"]).toLowerCase();
  if (sourceFormKey === "signup_2026_2027") return simpleHash(`${submittedAt}::${email}`);
  return simpleHash(`${sourceFormKey}::${submittedAt}::${email}`);
}

function parseSubmission(headers: string[], row: string[], sourceFormKey: string): ParsedSubmission | null {
  const object = rowObjects([headers, row])[0] || {};
  const parentEmail = first(object, ["Email address", "email", "Email"]).toLowerCase();
  const parentName = first(object, ["Prénoms et noms des parents", "Prenoms et noms des parents"]);
  if (!parentEmail || !parentName) return null;

  const submittedAt = first(object, ["Timestamp", "Column 1", "timestamp"]);
  const source_row_key = sourceKey(object, sourceFormKey);

  const childCandidates = [
    {
      kid_index: "1",
      name:
        byHeaderIncludes(headers, row, ["premier enfant", "nom"]) ||
        byHeaderOccurrence(headers, row, "Nom et prénom de l'enfant ", 0) ||
        byHeaderOccurrence(headers, row, "Nom et prénom de l'enfant", 0),
      sessions: byHeaderIncludes(headers, row, ["souhaitez-vous inscrire", "séances"], 0),
      paymentPlan: byHeaderOccurrence(headers, row, "Le solde annuel devra être réglé selon le mode choisi :", 0),
      extraEvidence: [
        byHeaderIncludes(headers, row, ["premier enfant", "langue"], 0),
        byHeaderIncludes(headers, row, ["âge", "date"], 0),
        byHeaderIncludes(headers, row, ["école", "niveau"], 0),
        byHeaderIncludes(headers, row, ["disponibilités", "mercredi"], 0)
      ]
    },
    {
      kid_index: "2",
      name:
        byHeaderIncludes(headers, row, ["deuxième enfant", "nom"], 0) ||
        byHeaderOccurrence(headers, row, "Prénom et nom de l'enfant", 0),
      sessions:
        byHeaderIncludes(headers, row, ["deuxième enfant", "combien"], 0) ||
        byHeaderOccurrence(headers, row, "Combien de séances voulez vous inscrire votre enfant?", 0),
      paymentPlan: byHeaderOccurrence(headers, row, "Le solde annuel devra être réglé selon le mode choisi :", 1),
      extraEvidence: [
        byHeaderIncludes(headers, row, ["deuxième enfant", "langue"], 0),
        byHeaderIncludes(headers, row, ["âge", "date"], 1),
        byHeaderIncludes(headers, row, ["école", "niveau"], 1),
        byHeaderIncludes(headers, row, ["disponibilités", "mercredi"], 1)
      ]
    },
    {
      kid_index: "3",
      name:
        byHeaderIncludes(headers, row, ["troisième enfant", "nom"], 0) ||
        byHeaderOccurrence(headers, row, "Prénom et nom de l'enfant", 1),
      sessions:
        byHeaderIncludes(headers, row, ["troisième enfant", "combien"], 0) ||
        byHeaderOccurrence(headers, row, "A combien de séances voulez-vous inscrire votre enfant?", 0),
      paymentPlan: byHeaderOccurrence(headers, row, "Le solde annuel devra être réglé selon le mode choisi :", 2),
      extraEvidence: [
        byHeaderIncludes(headers, row, ["troisième enfant", "langue"], 0),
        byHeaderIncludes(headers, row, ["âge", "date"], 2),
        byHeaderIncludes(headers, row, ["école", "niveau"], 2),
        byHeaderIncludes(headers, row, ["disponibilités", "mercredi"], 2)
      ]
    }
  ];

  const { valid, ignored } = validateChildren(childCandidates);

  return {
    id: source_row_key,
    submitted_at: submittedAt,
    source_form_key: sourceFormKey,
    source_row_key,
    parent_email: parentEmail,
    parent_name: parentName,
    parent_phone: first(object, ["Numéro de téléphone des parents", "Numero de telephone des parents"]),
    parent_address: first(object, ["Votre adresse complet", "Votre adresse complète", "Votre adresse complete", "Votre adresse"]),
    valid_children: valid,
    ignored_children: ignored,
    total_amount: valid.length * DEPOSIT_TOTAL,
    already_invoiced: 0
  };
}

function normalizeSignup(row: SheetRow): SignupRow {
  const invoiceAmount = parseAmount(row.invoice_amount);
  const paymentStatus = normalizePaymentStatus(row.invoice_status, row.paid_at);
  return {
    submitted_at: clean(row.submitted_at),
    source_row_key: clean(row.source_row_key),
    kid_index: clean(row.kid_index),
    parent_email: clean(row.parent_email).toLowerCase(),
    parent_name: clean(row.parent_name),
    parent_phone: clean(row.parent_phone),
    parent_address: clean(row.parent_address),
    kid_name: clean(row.kid_name),
    sessions_per_week: clean(row.sessions_per_week),
    pennylane_customer_id: clean(row.pennylane_customer_id),
    pennylane_invoice_id: clean(row.pennylane_invoice_id),
    invoice_amount: clean(row.invoice_amount),
    invoice_status: clean(row.invoice_status),
    created_at: clean(row.created_at),
    paid_at: clean(row.paid_at),
    contract_status: clean(row.contract_status),
    error_notes: clean(row.error_notes),
    payment_cycle: "reservation",
    payment_cycle_label: paymentCycleLabel("reservation"),
    payment_expected_amount: invoiceAmount,
    payment_paid_amount: paymentStatus === "pending" ? 0 : invoiceAmount,
    payment_status: paymentStatus,
    payment_adjustment_reason: "",
    payment_adjustment_notes: "",
    payment_adjusted_at: ""
  };
}

function applyPaymentAdjustment(row: SignupRow, adjustment?: PaymentAdjustment): SignupRow {
  if (!adjustment) return row;
  const expectedAmount = adjustment.expected_amount ? parseAmount(adjustment.expected_amount) : row.payment_expected_amount;
  const paidAmount = adjustment.paid_amount ? parseAmount(adjustment.paid_amount) : row.payment_paid_amount;
  const cycle = adjustment.payment_cycle || row.payment_cycle;
  return {
    ...row,
    payment_cycle: cycle,
    payment_cycle_label: paymentCycleLabel(cycle),
    payment_expected_amount: expectedAmount,
    payment_paid_amount: paidAmount,
    payment_status: adjustment.payment_status || row.payment_status,
    payment_adjustment_reason: adjustment.justification_type,
    payment_adjustment_notes: adjustment.justification_notes,
    payment_adjusted_at: adjustment.created_at
  };
}

function summarizePaymentCycles(signups: SignupRow[]): PaymentCycleSummary[] {
  return PAYMENT_CYCLES.map(({ cycle, label }) => {
    const rows = signups.filter((row) => row.payment_cycle === cycle);
    const paidTotal = rows.reduce((sum, row) => sum + row.payment_paid_amount, 0);
    const expectedTotal = rows.reduce((sum, row) => sum + row.payment_expected_amount, 0);
    return {
      cycle,
      label,
      expectedTotal,
      paidTotal,
      outstandingTotal: Math.max(0, expectedTotal - paidTotal),
      paidRows: rows.filter((row) => row.payment_status === "paid" || row.payment_status === "overpaid" || row.payment_status === "waived").length,
      partialRows: rows.filter((row) => row.payment_status === "partial").length,
      pendingRows: rows.filter((row) => row.payment_status === "pending").length,
      adjustedRows: rows.filter((row) => row.payment_adjustment_reason || row.payment_adjustment_notes).length
    };
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  const trackingSheetId = requireEnv("WITTYBUNCH_TRACKING_SHEET_ID");
  const formSources = [
    {
      spreadsheetId: requireEnv("WITTYBUNCH_FORM_RESPONSES_SHEET_ID"),
      sourceFormKey: "signup_2026_2027"
    },
    ...EXTRA_FORM_SOURCES.flatMap((source) => {
      const spreadsheetId = optionalEnv(source.env);
      return spreadsheetId ? [{ spreadsheetId, sourceFormKey: source.sourceFormKey }] : [];
    })
  ];

  const [formValueSets, signupValues, overrideValues, paymentAdjustmentValues] = await Promise.all([
    Promise.all(formSources.map(async (source) => ({
      ...source,
      values: await readValues(source.spreadsheetId, FORM_RESPONSES_RANGE)
    }))),
    readValues(trackingSheetId, `${SIGNUPS_TAB}!A:Q`),
    readOptionalValues(trackingSheetId, `${OVERRIDES_TAB}!A:F`),
    readOptionalValues(trackingSheetId, `${PAYMENT_ADJUSTMENTS_TAB}!A:J`)
  ]);

  const submissions = formValueSets
    .flatMap(({ values, sourceFormKey }) => {
      const headers = values[0] || [];
      return values.slice(1).map((row) => parseSubmission(headers, row, sourceFormKey));
    })
    .filter((row): row is ParsedSubmission => Boolean(row));

  const paymentAdjustments = latestPaymentAdjustments(paymentAdjustmentValues);
  const signups = rowObjects(signupValues)
    .map(normalizeSignup)
    .map((row) => applyPaymentAdjustment(
      row,
      paymentAdjustments.get(paymentKey(row.source_row_key, row.kid_index, row.pennylane_invoice_id))
    ));
  const processed = new Set(signups.map((row) => `${row.source_row_key}::${row.kid_index}`));
  const overrides = latestOverrides(overrideValues);

  const submissionsWithPending = submissions.map((submission) => {
    const adjustedChildren = submission.valid_children.flatMap((child) => {
      const override = overrides.get(overrideKey(submission.source_row_key, child.kid_index));
      if (override?.action === "exclude") return [];
      if (override?.action === "update" && override.sessions_per_week) {
        return [{
          ...child,
          sessions_per_week: override.sessions_per_week,
          evidence: [...child.evidence, `Dashboard override ${override.created_at || "recorded"}`]
        }];
      }
      return [child];
    });
    const pendingChildren = adjustedChildren.filter(
      (child) => !processed.has(`${submission.source_row_key}::${child.kid_index}`)
    );
    return {
      ...submission,
      valid_children: pendingChildren,
      already_invoiced: adjustedChildren.length - pendingChildren.length,
      total_amount: pendingChildren.length * DEPOSIT_TOTAL
    };
  });

  const readyToInvoice = submissionsWithPending.filter((submission) => submission.valid_children.length > 0);
  const paidInvoices = signups.filter((row) => row.paid_at || /paid|payé|paye/i.test(row.invoice_status)).length;

  return {
    submissions: submissionsWithPending,
    readyToInvoice,
    signups,
    paymentCycleSummaries: summarizePaymentCycles(signups),
    metrics: {
      validChildrenPending: readyToInvoice.reduce((sum, submission) => sum + submission.valid_children.length, 0),
      ignoredChildSections: submissionsWithPending.reduce((sum, submission) => sum + submission.ignored_children.length, 0),
      readyFamilies: readyToInvoice.length,
      trackedInvoices: signups.filter((row) => row.pennylane_invoice_id).length,
      paidInvoices
    }
  };
}

export async function upsertPaymentAdjustment(input: {
  source_row_key: string;
  kid_index: string;
  pennylane_invoice_id?: string;
  payment_cycle: string;
  expected_amount: string;
  paid_amount: string;
  payment_status: string;
  justification_type: string;
  justification_notes: string;
}) {
  const trackingSheetId = requireEnv("WITTYBUNCH_TRACKING_SHEET_ID");
  const sourceRowKey = clean(input.source_row_key);
  const kidIndex = clean(input.kid_index);
  const invoiceId = clean(input.pennylane_invoice_id);
  const cycle = normalizePaymentCycle(input.payment_cycle);
  const expectedAmount = clean(input.expected_amount);
  const paidAmount = clean(input.paid_amount);
  const status = normalizePaymentStatus(input.payment_status);
  const justificationType = clean(input.justification_type);
  const justificationNotes = clean(input.justification_notes);

  if (!sourceRowKey || !kidIndex) throw new Error("Missing payment row identity.");
  if (!justificationType || !justificationNotes) {
    throw new Error("Add an accounting justification before saving a payment adjustment.");
  }

  await ensurePaymentAdjustmentsSheet(trackingSheetId);
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: trackingSheetId,
    range: `${PAYMENT_ADJUSTMENTS_TAB}!A:J`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        sourceRowKey,
        kidIndex,
        invoiceId,
        cycle,
        expectedAmount,
        paidAmount,
        status,
        justificationType,
        justificationNotes,
        new Date().toISOString()
      ]]
    }
  });
}

export async function upsertEnrolmentOverride(input: {
  source_row_key: string;
  kid_index: string;
  action: EnrolmentOverrideAction;
  sessions_per_week?: string;
  reason?: string;
}) {
  const trackingSheetId = requireEnv("WITTYBUNCH_TRACKING_SHEET_ID");
  const sourceRowKey = clean(input.source_row_key);
  const kidIndex = clean(input.kid_index);
  const action = input.action;
  const sessions = clean(input.sessions_per_week);
  const reason = clean(input.reason);

  if (!sourceRowKey || !kidIndex) throw new Error("Missing enrolment row identity.");
  if (!["exclude", "update", "restore"].includes(action)) throw new Error("Invalid enrolment override action.");
  if (action === "update" && !sessions) throw new Error("Enter the updated sessions value before saving.");

  await ensureOverridesSheet(trackingSheetId);
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: trackingSheetId,
    range: `${OVERRIDES_TAB}!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[sourceRowKey, kidIndex, action, sessions, reason, new Date().toISOString()]]
    }
  });
}

export async function appendMessageLog(input: {
  parent_email: string;
  parent_name: string;
  subject: string;
  message: string;
  status: string;
}) {
  const sheets = sheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: requireEnv("WITTYBUNCH_TRACKING_SHEET_ID"),
    range: `${MESSAGES_TAB}!A:H`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[new Date().toISOString(), input.parent_email, input.parent_name, input.subject, input.message, "dashboard", input.status, "dashboard"]]
    }
  });
}
