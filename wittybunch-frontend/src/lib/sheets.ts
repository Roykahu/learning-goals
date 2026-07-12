import { google } from "googleapis";
import { clean, validateChildren } from "./child-validation";
import { simpleHash } from "./hash";
import type { DashboardData, ParsedSubmission, SheetRow, SignupRow } from "./types";

const SIGNUPS_TAB = "_signups";
const MESSAGES_TAB = "_messages";
const DEPOSIT_TOTAL = 85;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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
      extraEvidence: [
        byHeaderIncludes(headers, row, ["premier enfant", "langue"], 0),
        byHeaderIncludes(headers, row, ["âge", "date"], 0)
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
      extraEvidence: [
        byHeaderIncludes(headers, row, ["deuxième enfant", "langue"], 0),
        byHeaderIncludes(headers, row, ["âge", "date"], 1)
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
      extraEvidence: [
        byHeaderIncludes(headers, row, ["troisième enfant", "langue"], 0),
        byHeaderIncludes(headers, row, ["âge", "date"], 2)
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
    error_notes: clean(row.error_notes)
  };
}

export async function getDashboardData(): Promise<DashboardData> {
  const formSheetId = requireEnv("WITTYBUNCH_FORM_RESPONSES_SHEET_ID");
  const trackingSheetId = requireEnv("WITTYBUNCH_TRACKING_SHEET_ID");

  const [formValues, signupValues] = await Promise.all([
    readValues(formSheetId, "Form responses 1!A:BP"),
    readValues(trackingSheetId, `${SIGNUPS_TAB}!A:Q`)
  ]);

  const headers = formValues[0] || [];
  const submissions = formValues
    .slice(1)
    .map((row) => parseSubmission(headers, row, "signup_2026_2027"))
    .filter((row): row is ParsedSubmission => Boolean(row));

  const signups = rowObjects(signupValues).map(normalizeSignup);
  const processed = new Set(signups.map((row) => `${row.source_row_key}::${row.kid_index}`));

  const submissionsWithPending = submissions.map((submission) => {
    const pendingChildren = submission.valid_children.filter(
      (child) => !processed.has(`${submission.source_row_key}::${child.kid_index}`)
    );
    return {
      ...submission,
      already_invoiced: submission.valid_children.length - pendingChildren.length,
      valid_children: pendingChildren,
      total_amount: pendingChildren.length * DEPOSIT_TOTAL
    };
  });

  const readyToInvoice = submissionsWithPending.filter((submission) => submission.valid_children.length > 0);
  const paidInvoices = signups.filter((row) => row.paid_at || /paid|payé|paye/i.test(row.invoice_status)).length;

  return {
    submissions: submissionsWithPending,
    readyToInvoice,
    signups,
    metrics: {
      validChildrenPending: readyToInvoice.reduce((sum, submission) => sum + submission.valid_children.length, 0),
      ignoredChildSections: submissionsWithPending.reduce((sum, submission) => sum + submission.ignored_children.length, 0),
      readyFamilies: readyToInvoice.length,
      trackedInvoices: signups.filter((row) => row.pennylane_invoice_id).length,
      paidInvoices
    }
  };
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
