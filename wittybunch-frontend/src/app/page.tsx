import { isAuthenticated } from "@/lib/auth";
import { getDashboardData } from "@/lib/sheets";
import type { ParsedSubmission, PaymentCycleSummary, SignupRow } from "@/lib/types";
import {
  archiveAction,
  createInvoiceAction,
  exemptAction,
  logoutAction,
  messageAction,
  removeEnrolmentAction,
  updatePaymentAdjustmentAction,
  updateEnrolmentAction
} from "./actions";
import { BatchEmailPanel, LoginForm } from "./components";

export const dynamic = "force-dynamic";

function money(amount: number | string) {
  const value = typeof amount === "number" ? amount : Number(amount || 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function invoicePayload(submission: ParsedSubmission) {
  return {
    parent: {
      email: submission.parent_email,
      name: submission.parent_name,
      phone: submission.parent_phone,
      address: submission.parent_address
    },
    kids: submission.valid_children.map((kid) => ({
      ...kid,
      source_row_key: submission.source_row_key,
      source_form_key: submission.source_form_key,
      submitted_at: submission.submitted_at,
      parent_email: submission.parent_email,
      parent_name: submission.parent_name,
      parent_phone: submission.parent_phone,
      parent_address: submission.parent_address
    }))
  };
}

function paymentProofMessage(row: SignupRow) {
  const childLine = row.kid_name ? ` concernant l'inscription de ${row.kid_name}` : "";
  const invoiceLine = row.pennylane_invoice_id ? ` La facture ${row.pennylane_invoice_id} a donc été envoyée comme justificatif.` : " La facture a donc été envoyée comme justificatif.";
  return [
    "Bonjour,",
    "",
    `Nous vous confirmons que le montant a déjà été réglé${childLine}.`,
    `${invoiceLine} Elle a été établie et envoyée conformément aux règles générales de facturation.`,
    "",
    "Aucune action supplémentaire n'est requise de votre part. Ce document sert principalement de preuve de paiement pour vos dossiers.",
    "",
    "Bien cordialement,",
    "Witty Bunch"
  ].join("\n");
}

function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <p className="eyebrow">Wittybunch</p>
        <h1>Payment cockpit</h1>
        <p className="muted">Private view for sign-ups, deposit invoices, and payment follow-up.</p>
        <LoginForm />
      </section>
    </main>
  );
}

function Metric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <article className={`metric-card ${alert ? "alert" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function MissingSetupPage({ error }: { error: string }) {
  const requiredVariables = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "WITTYBUNCH_FORM_RESPONSES_SHEET_ID",
    "WITTYBUNCH_TRACKING_SHEET_ID"
  ];

  return (
    <main className="dashboard-shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Wittybunch</p>
          <h1>Local setup needed</h1>
          <p className="muted">The password worked. The dashboard needs Google Sheets settings before it can load live data locally.</p>
        </div>
        <form action={logoutAction}><button className="secondary-button">Log out</button></form>
      </div>

      <section className="panel setup-panel">
        <div className="section-heading">
          <h2>Missing local data access</h2>
          <span>No secrets are shown here.</span>
        </div>
        <div className="banner danger-banner">{error}</div>
        <p className="muted">
          Add these variable names to <strong>.env.local</strong>, then restart the local dashboard.
        </p>
        <ul className="setup-list">
          {requiredVariables.map((name) => <li key={name}><code>{name}</code></li>)}
        </ul>
      </section>
    </main>
  );
}

function PaymentCyclePanel({ summaries }: { summaries: PaymentCycleSummary[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Payment cycles</h2>
        <span>Paid totals include Pennylane reconciled rows and justified dashboard adjustments.</span>
      </div>
      <div className="cycle-grid">
        {summaries.map((summary) => (
          <article className="cycle-card" key={summary.cycle}>
            <div>
              <h3>{summary.label}</h3>
              <span>{summary.paidRows} paid · {summary.partialRows} partial · {summary.pendingRows} pending</span>
            </div>
            <dl>
              <div><dt>Expected</dt><dd>{money(summary.expectedTotal)}</dd></div>
              <div><dt>Paid</dt><dd>{money(summary.paidTotal)}</dd></div>
              <div><dt>Outstanding</dt><dd>{money(summary.outstandingTotal)}</dd></div>
            </dl>
            {summary.adjustedRows > 0 ? <p>{summary.adjustedRows} justified adjustment{summary.adjustedRows > 1 ? "s" : ""}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ReadyItem({ submission }: { submission: ParsedSubmission }) {
  const payload = JSON.stringify(invoicePayload(submission));
  return (
    <article className="ready-item">
      <div className="ready-main">
        <div className="ready-who">
          <strong>{submission.parent_name}</strong>
          <span className="pill source-badge">{submission.valid_children.length} valid child{submission.valid_children.length > 1 ? "ren" : ""}</span>
        </div>
        <div className="ready-contact">{submission.parent_email} · {submission.parent_phone || "no phone"}</div>
        <div className="enrolment-list">
          {submission.valid_children.map((kid) => (
            <div className="enrolment-row" key={`${submission.source_row_key}-${kid.kid_index}`}>
              <div className="enrolment-child">
                <strong>{kid.kid_name}</strong>
                <span>{kid.sessions_per_week || "No session value"}</span>
              </div>
              <form action={updateEnrolmentAction} className="enrolment-edit">
                <input type="hidden" name="source_row_key" value={submission.source_row_key} />
                <input type="hidden" name="kid_index" value={kid.kid_index} />
                <label>
                  Sessions
                  <input name="sessions_per_week" defaultValue={kid.sessions_per_week} aria-label={`Sessions for ${kid.kid_name}`} />
                </label>
                <button className="ghost-button" type="submit">Save</button>
              </form>
              <form action={removeEnrolmentAction} className="inline-form">
                <input type="hidden" name="source_row_key" value={submission.source_row_key} />
                <input type="hidden" name="kid_index" value={kid.kid_index} />
                <button className="ghost-button danger-ghost" type="submit">Remove</button>
              </form>
            </div>
          ))}
        </div>
        {submission.ignored_children.length > 0 ? (
          <div className="ignored-box">
            <strong>Ignored extra child sections:</strong>
            {submission.ignored_children.map((kid) => (
              <span key={`${kid.kid_index}-${kid.raw_name}`}>
                Child {kid.kid_index}: {kid.raw_name || "blank"} — {kid.reason}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="ready-action">
        <span className="ready-total">{money(submission.total_amount)}</span>
        <form action={createInvoiceAction}>
          <input type="hidden" name="payload" value={payload} />
          <button className="invoice-cta-primary" type="submit">Create invoice</button>
        </form>
      </div>
    </article>
  );
}

function SignupTable({ signups }: { signups: SignupRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Parent</th>
            <th>Child</th>
            <th>Invoice</th>
            <th>Cycle</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {signups.slice(0, 80).map((row, index) => (
            <tr key={`${row.source_row_key}-${row.kid_index}-${index}`} className={!row.kid_name ? "attention-row" : ""}>
              <td>
                {row.parent_name || "Missing parent"}
                <span>{row.parent_email}</span>
              </td>
              <td>
                {row.kid_name || "Missing child name"}
                <span>{row.sessions_per_week || "No session value"}</span>
              </td>
              <td>
                {row.pennylane_invoice_id || "No invoice id"}
                <span>Invoice: {row.invoice_amount ? money(row.invoice_amount) : "No amount"}</span>
                <span>Expected: {money(row.payment_expected_amount)} · Paid: {money(row.payment_paid_amount)}</span>
              </td>
              <td>
                {row.payment_cycle_label}
                {row.payment_adjustment_reason ? <span>{row.payment_adjustment_reason}</span> : null}
                {row.payment_adjustment_notes ? <span>{row.payment_adjustment_notes}</span> : null}
              </td>
              <td><span className={`pill ${row.payment_status === "paid" || row.payment_status === "overpaid" || row.payment_status === "waived" ? "success" : row.payment_status === "partial" ? "warning" : "neutral"}`}>{row.payment_status}</span></td>
              <td>
                <div className="kid-actions">
                  <form action={messageAction} className="inline-form">
                    <input type="hidden" name="parent_email" value={row.parent_email} />
                    <input type="hidden" name="parent_name" value={row.parent_name} />
                    <input type="hidden" name="subject" value="Witty Bunch payment follow-up" />
                    <input type="hidden" name="message" value={`Bonjour, petit rappel concernant l'inscription de ${row.kid_name || "votre enfant"}.`} />
                    <button className="ghost-button" type="submit">Message</button>
                  </form>
                  <form action={messageAction} className="inline-form">
                    <input type="hidden" name="parent_email" value={row.parent_email} />
                    <input type="hidden" name="parent_name" value={row.parent_name} />
                    <input type="hidden" name="subject" value="Witty Bunch invoice for payment proof" />
                    <input type="hidden" name="message" value={paymentProofMessage(row)} />
                    <button className="ghost-button proof-ghost" type="submit">Proof email</button>
                  </form>
                  <form action={exemptAction} className="inline-form">
                    <input type="hidden" name="parent_email" value={row.parent_email} />
                    <input type="hidden" name="source_row_key" value={row.source_row_key} />
                    <input type="hidden" name="kid_index" value={row.kid_index} />
                    <button className="ghost-button" type="submit">Exempt</button>
                  </form>
                  <form action={archiveAction} className="inline-form">
                    <input type="hidden" name="parent_email" value={row.parent_email} />
                    <input type="hidden" name="source_row_key" value={row.source_row_key} />
                    <button className="ghost-button danger-ghost" type="submit">Archive</button>
                  </form>
                </div>
                <form action={updatePaymentAdjustmentAction} className="payment-adjust-form">
                  <input type="hidden" name="source_row_key" value={row.source_row_key} />
                  <input type="hidden" name="kid_index" value={row.kid_index} />
                  <input type="hidden" name="pennylane_invoice_id" value={row.pennylane_invoice_id} />
                  <label>
                    Cycle
                    <select name="payment_cycle" defaultValue={row.payment_cycle}>
                      <option value="reservation">Reservation</option>
                      <option value="trimester_1">1st trimester</option>
                      <option value="trimester_2">2nd trimester</option>
                      <option value="trimester_3">3rd trimester</option>
                    </select>
                  </label>
                  <label>
                    Expected
                    <input name="expected_amount" inputMode="decimal" defaultValue={String(row.payment_expected_amount || "")} />
                  </label>
                  <label>
                    Paid
                    <input name="paid_amount" inputMode="decimal" defaultValue={String(row.payment_paid_amount || "")} />
                  </label>
                  <label>
                    Status
                    <select name="payment_status" defaultValue={row.payment_status}>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="overpaid">Overpaid</option>
                      <option value="waived">Waived</option>
                    </select>
                  </label>
                  <label>
                    Reason
                    <select name="justification_type" defaultValue={row.payment_adjustment_reason}>
                      <option value="">Choose reason</option>
                      <option value="pennylane_reconciliation">Pennylane reconciliation</option>
                      <option value="recommendation_credit">Recommendation credit</option>
                      <option value="book_credit">Books paid but not needed</option>
                      <option value="multi_trimester_payment">Several trimesters paid at once</option>
                      <option value="amount_correction">Amount correction</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="wide-field">
                    Justification notes
                    <input name="justification_notes" defaultValue={row.payment_adjustment_notes} placeholder="Required for accounting trace" />
                  </label>
                  <button className="ghost-button proof-ghost" type="submit">Save accounting</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Page() {
  if (!(await isAuthenticated())) return <LoginPage />;

  let data;
  try {
    data = await getDashboardData();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The dashboard could not load its Google Sheets data.";
    return <MissingSetupPage error={message} />;
  }

  return (
    <main className="dashboard-shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Wittybunch</p>
          <h1>Payment dashboard</h1>
          <p className="muted">Totals below are calculated only from validated child registrations. Empty, negative, and partial extra-child sections are ignored.</p>
        </div>
        <form action={logoutAction}><button className="secondary-button">Log out</button></form>
      </div>

      {data.metrics.ignoredChildSections > 0 ? (
        <div className="banner danger-banner">
          {data.metrics.ignoredChildSections} extra-child section{data.metrics.ignoredChildSections > 1 ? "s were" : " was"} ignored because it did not contain enough real registration information.
        </div>
      ) : null}

      <section className="metric-grid">
        <Metric label="Families ready" value={data.metrics.readyFamilies} />
        <Metric label="Valid children pending" value={data.metrics.validChildrenPending} />
        <Metric label="Ignored child sections" value={data.metrics.ignoredChildSections} alert={data.metrics.ignoredChildSections > 0} />
        <Metric label="Tracked invoices" value={data.metrics.trackedInvoices} />
        <Metric label="Paid invoices" value={data.metrics.paidInvoices} />
      </section>

      <BatchEmailPanel />

      <PaymentCyclePanel summaries={data.paymentCycleSummaries} />

      <section className="panel">
        <div className="section-heading">
          <h2>Ready to invoice</h2>
          <span>Invoice totals use validated children only: €85 per valid child.</span>
        </div>
        <div className="ready-list">
          {data.readyToInvoice.length === 0 ? <p className="empty-state">No validated children waiting for invoice creation.</p> : null}
          {data.readyToInvoice.map((submission) => <ReadyItem key={submission.id} submission={submission} />)}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <h2>Tracked signups and invoices</h2>
          <span>Rows with missing child names are highlighted because they may come from historical bad data.</span>
        </div>
        <SignupTable signups={data.signups} />
      </section>
    </main>
  );
}
