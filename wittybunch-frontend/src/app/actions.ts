"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkPassword, clearAuthenticated, isPasswordConfigured, setAuthenticated } from "@/lib/auth";
import { validateChildren } from "@/lib/child-validation";
import {
  ARCHIVE_BCC,
  buildDryRunReport,
  buildPendingPaymentBatch,
  buildSafetyPreview,
  type PreparedEmail
} from "@/lib/email-batch";
import { appendMessageLog, getDashboardData, upsertEnrolmentOverride, upsertPaymentAdjustment } from "@/lib/sheets";
import type { ChildRecord } from "@/lib/types";

type SendReport = {
  totalRecipients: number;
  duplicatesRemoved: number;
  attempted: number;
  sent: number;
  failures: { email: string; error: string }[];
  bcc: string;
  bccConfirmed: boolean;
};

function requireWebhook(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing webhook: ${name}`);
  return value;
}

async function postWebhook(name: string, payload: unknown) {
  const response = await fetch(requireWebhook(name), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`${name} returned ${response.status}`);
  }
}

async function safeAppendMessageLog(input: {
  parent_email: string;
  parent_name: string;
  subject: string;
  message: string;
  status: string;
}): Promise<string | null> {
  try {
    await appendMessageLog(input);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown log error";
  }
}

async function sendPreparedEmails(emails: PreparedEmail[], statusPrefix: string): Promise<{
  sent: number;
  failures: { email: string; error: string }[];
}> {
  const failures: { email: string; error: string }[] = [];
  let sent = 0;

  for (const email of emails) {
    try {
      await postWebhook("N8N_WEBHOOK_MESSAGE", {
        to: email.to,
        bcc: email.bcc,
        parent_email: email.to,
        parent_name: email.parent_name,
        subject: email.subject,
        message: email.message
      });
      sent += 1;
      const logError = await safeAppendMessageLog({
        parent_email: email.to,
        parent_name: email.parent_name,
        subject: email.subject,
        message: email.message,
        status: `${statusPrefix}: sent_to_n8n`
      });
      if (logError) failures.push({ email: email.to, error: `Sent, but log failed: ${logError}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown send error";
      failures.push({ email: email.to, error: message });
      const logError = await safeAppendMessageLog({
        parent_email: email.to,
        parent_name: email.parent_name,
        subject: email.subject,
        message: email.message,
        status: `${statusPrefix}: failed: ${message}`
      });
      if (logError) failures.push({ email: email.to, error: `Failed, and log failed: ${logError}` });
    }
  }

  return { sent, failures };
}

function allHaveArchiveBcc(emails: PreparedEmail[]): boolean {
  return emails.every((email) => email.bcc.includes(ARCHIVE_BCC));
}

function parseTestRecipients(formData: FormData): Set<string> {
  try {
    const raw = String(formData.get("test_recipients") || "[]");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((email) => String(email).toLowerCase()));
  } catch {
    return new Set();
  }
}

export async function loginAction(_prevState: { error?: string } | undefined, formData: FormData) {
  const password = String(formData.get("password") || "");
  if (!isPasswordConfigured()) return { error: "Dashboard password is not configured locally." };
  if (!checkPassword(password)) return { error: "Incorrect password." };
  await setAuthenticated();
  redirect("/");
}

export async function logoutAction() {
  await clearAuthenticated();
  redirect("/");
}

export async function createInvoiceAction(formData: FormData) {
  const payload = JSON.parse(String(formData.get("payload") || "{}")) as {
    parent: {
      email: string;
      name: string;
      phone: string;
      address: string;
    };
    kids: ChildRecord[];
  };

  const { valid, ignored } = validateChildren(
    (payload.kids || []).map((kid) => ({
      kid_index: kid.kid_index,
      name: kid.kid_name,
      sessions: kid.sessions_per_week,
      extraEvidence: kid.evidence
    }))
  );

  if (ignored.length > 0 || valid.length !== (payload.kids || []).length) {
    throw new Error("Invoice blocked: the dashboard payload still contains invalid child sections.");
  }

  await postWebhook("N8N_WEBHOOK_INVOICE", { ...payload, kids: valid });
  revalidatePath("/");
}

export async function updateEnrolmentAction(formData: FormData) {
  await upsertEnrolmentOverride({
    source_row_key: String(formData.get("source_row_key") || ""),
    kid_index: String(formData.get("kid_index") || ""),
    action: "update",
    sessions_per_week: String(formData.get("sessions_per_week") || ""),
    reason: "Parent changed the enrolment before invoice creation"
  });
  revalidatePath("/");
}

export async function removeEnrolmentAction(formData: FormData) {
  await upsertEnrolmentOverride({
    source_row_key: String(formData.get("source_row_key") || ""),
    kid_index: String(formData.get("kid_index") || ""),
    action: "exclude",
    reason: "Parent cancelled this child before invoice creation"
  });
  revalidatePath("/");
}

export async function updatePaymentAdjustmentAction(formData: FormData) {
  await upsertPaymentAdjustment({
    source_row_key: String(formData.get("source_row_key") || ""),
    kid_index: String(formData.get("kid_index") || ""),
    pennylane_invoice_id: String(formData.get("pennylane_invoice_id") || ""),
    payment_cycle: String(formData.get("payment_cycle") || ""),
    expected_amount: String(formData.get("expected_amount") || ""),
    paid_amount: String(formData.get("paid_amount") || ""),
    payment_status: String(formData.get("payment_status") || ""),
    justification_type: String(formData.get("justification_type") || ""),
    justification_notes: String(formData.get("justification_notes") || "")
  });
  revalidatePath("/");
}

export async function messageAction(formData: FormData) {
  const parent_email = String(formData.get("parent_email") || "");
  const parent_name = String(formData.get("parent_name") || "");
  const subject = String(formData.get("subject") || "Witty Bunch payment follow-up");
  const message = String(formData.get("message") || "");
  await postWebhook("N8N_WEBHOOK_MESSAGE", {
    to: parent_email,
    bcc: ["wittybunch@gmail.com"],
    parent_email,
    parent_name,
    subject,
    message
  });
  await appendMessageLog({ parent_email, parent_name, subject, message, status: "sent_to_n8n" });
  revalidatePath("/");
}

export async function previewBatchEmailsAction(_prevState?: unknown, _formData?: FormData) {
  const data = await getDashboardData();
  return buildSafetyPreview(data.signups);
}

export async function dryRunBatchEmailsAction(_prevState?: unknown, _formData?: FormData) {
  const data = await getDashboardData();
  return buildDryRunReport(data.signups);
}

export async function sendTestEmailsAction(_prevState?: unknown, _formData?: FormData): Promise<SendReport> {
  const data = await getDashboardData();
  const batch = buildPendingPaymentBatch(data.signups);
  const preview = buildSafetyPreview(data.signups);
  const emails = preview.samples;
  const result = await sendPreparedEmails(emails, "test_batch");

  revalidatePath("/");
  return {
    totalRecipients: batch.emails.length,
    duplicatesRemoved: batch.duplicateRecipientsRemoved,
    attempted: emails.length,
    sent: result.sent,
    failures: result.failures,
    bcc: ARCHIVE_BCC,
    bccConfirmed: allHaveArchiveBcc(emails)
  };
}

export async function sendRemainingEmailsAction(_prevState: unknown, formData: FormData): Promise<SendReport> {
  const data = await getDashboardData();
  const batch = buildPendingPaymentBatch(data.signups);
  const testRecipients = parseTestRecipients(formData);
  const emails = batch.emails.filter((email) => !testRecipients.has(email.to.toLowerCase()));
  const result = await sendPreparedEmails(emails, "remaining_batch");

  revalidatePath("/");
  return {
    totalRecipients: batch.emails.length,
    duplicatesRemoved: batch.duplicateRecipientsRemoved,
    attempted: emails.length,
    sent: result.sent,
    failures: result.failures,
    bcc: ARCHIVE_BCC,
    bccConfirmed: allHaveArchiveBcc(emails)
  };
}

export async function archiveAction(formData: FormData) {
  await postWebhook("N8N_WEBHOOK_ARCHIVE", {
    parent_email: String(formData.get("parent_email") || ""),
    source_row_key: String(formData.get("source_row_key") || "")
  });
  revalidatePath("/");
}

export async function exemptAction(formData: FormData) {
  await postWebhook("N8N_WEBHOOK_EXEMPT", {
    parent_email: String(formData.get("parent_email") || ""),
    source_row_key: String(formData.get("source_row_key") || ""),
    kid_index: String(formData.get("kid_index") || "")
  });
  revalidatePath("/");
}
