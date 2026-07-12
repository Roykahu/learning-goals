"use client";

import { useActionState } from "react";
import type { DryRunReport, PreparedEmail } from "@/lib/email-batch";
import {
  dryRunBatchEmailsAction,
  loginAction,
  previewBatchEmailsAction,
  sendRemainingEmailsAction,
  sendTestEmailsAction
} from "./actions";

type BatchPreviewState = {
  totalRecipients: number;
  duplicateRecipientsRemoved: number;
  samples: PreparedEmail[];
  missingCategories: string[];
};

type SendReportState = {
  totalRecipients: number;
  duplicatesRemoved: number;
  attempted: number;
  sent: number;
  failures: { email: string; error: string }[];
  bcc: string;
  bccConfirmed: boolean;
};

const emptyDryRun: DryRunReport = {
  totalFamilies: 0,
  totalEmailsToSend: 0,
  duplicateEmailsRemoved: 0,
  invalidOrMissingEmailAddresses: 0,
  internalTestAccountsExcluded: 0,
  categoryCounts: { new: 0, returning: 0, "multi-child": 0 },
  recipients: [],
  previewEmails: [],
  missingCategories: [],
  everyEmailHasArchiveBcc: false,
  everyRecipientUnique: false,
  sendsIndividually: false
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, { error: "" });
  return (
    <form className="login-form" action={formAction}>
      <label htmlFor="password">Dashboard password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" />
      {state?.error ? <p className="error-text">{state.error}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Opening…" : "Open dashboard"}</button>
    </form>
  );
}

export function BatchEmailPanel() {
  const [dryRunState, dryRunAction, dryRunPending] = useActionState(dryRunBatchEmailsAction, emptyDryRun);
  const [previewState, previewAction, previewPending] = useActionState(previewBatchEmailsAction, {
    totalRecipients: 0,
    duplicateRecipientsRemoved: 0,
    samples: [],
    missingCategories: []
  } as BatchPreviewState);
  const [testState, testAction, testPending] = useActionState(sendTestEmailsAction, {
    totalRecipients: 0,
    duplicatesRemoved: 0,
    attempted: 0,
    sent: 0,
    failures: [],
    bcc: "",
    bccConfirmed: false
  } as SendReportState);
  const [remainingState, remainingAction, remainingPending] = useActionState(sendRemainingEmailsAction, {
    totalRecipients: 0,
    duplicatesRemoved: 0,
    attempted: 0,
    sent: 0,
    failures: [],
    bcc: "",
    bccConfirmed: false
  } as SendReportState);
  const canSendTest = previewState.samples.length > 0;
  const testRecipients = JSON.stringify(previewState.samples.map((email) => email.to));
  const canSendRemaining = testState.attempted > 0 && testState.failures.length === 0;

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Pending payment emails</h2>
        <span>One personalised email per family, with wittybunch@gmail.com BCC'd on each message.</span>
      </div>

      <div className="batch-actions">
        <form action={dryRunAction}>
          <button type="submit" disabled={dryRunPending}>
            {dryRunPending ? "Running dry run..." : "Run full dry run"}
          </button>
        </form>
        <form action={previewAction}>
          <button type="submit" disabled={previewPending}>
            {previewPending ? "Preparing samples..." : "Preview safety samples"}
          </button>
        </form>
        {canSendTest ? (
          <form action={testAction}>
            <button className="secondary-button" type="submit" disabled={testPending}>
              {testPending ? "Sending test..." : `Send ${previewState.samples.length} test emails`}
            </button>
          </form>
        ) : null}
        {canSendRemaining ? (
          <form action={remainingAction}>
            <input type="hidden" name="test_recipients" value={testRecipients} />
            <button className="secondary-button" type="submit" disabled={remainingPending}>
              {remainingPending ? "Sending remaining..." : "Send remaining after inbox approval"}
            </button>
          </form>
        ) : null}
      </div>

      {dryRunState.totalEmailsToSend > 0 ? (
        <div className="dry-run-report">
          <div className="dry-run-metrics">
            <div><span>Total families</span><strong>{dryRunState.totalFamilies}</strong></div>
            <div><span>Total emails</span><strong>{dryRunState.totalEmailsToSend}</strong></div>
            <div><span>Duplicates removed</span><strong>{dryRunState.duplicateEmailsRemoved}</strong></div>
            <div><span>Missing/invalid email rows</span><strong>{dryRunState.invalidOrMissingEmailAddresses}</strong></div>
            <div><span>Internal/test rows excluded</span><strong>{dryRunState.internalTestAccountsExcluded}</strong></div>
          </div>
          <p className="muted batch-count">
            Categories: {dryRunState.categoryCounts.new} new,
            {" "}{dryRunState.categoryCounts.returning} returning,
            {" "}{dryRunState.categoryCounts["multi-child"]} multi-child.
          </p>
          <div className={`banner ${dryRunState.everyEmailHasArchiveBcc && dryRunState.everyRecipientUnique ? "success-banner" : "danger-banner"}`}>
            Dry run only. Sends individually: {dryRunState.sendsIndividually ? "yes" : "no"}.
            {" "}Every email BCC'd to wittybunch@gmail.com: {dryRunState.everyEmailHasArchiveBcc ? "yes" : "no"}.
            {" "}No recipient appears more than once: {dryRunState.everyRecipientUnique ? "yes" : "no"}.
          </div>
          {dryRunState.missingCategories.length > 0 ? (
            <div className="banner danger-banner">
              Missing preview categor{dryRunState.missingCategories.length === 1 ? "y" : "ies"} from live data: {dryRunState.missingCategories.join(", ")}.
            </div>
          ) : null}
          <h3>Three real preview emails</h3>
          <div className="email-samples">
            {dryRunState.previewEmails.map((email) => (
              <article className="email-sample" key={`dry-${email.to}`}>
                <div><strong>Sample type:</strong> {email.category || "pending"}</div>
                <div><strong>To:</strong> {email.to}</div>
                <div><strong>BCC:</strong> {email.bcc.join(", ")}</div>
                <div><strong>Subject:</strong> {email.subject}</div>
                <div><strong>Parent:</strong> {email.parent_name || "Missing parent name"}</div>
                <div><strong>Children:</strong> {email.children.length > 0 ? email.children.join(", ") : "Missing child names"}</div>
                <pre>{email.message}</pre>
              </article>
            ))}
          </div>
          <h3>Exact recipient list</h3>
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Parent</th>
                  <th>Children</th>
                  <th>Category</th>
                  <th>BCC</th>
                </tr>
              </thead>
              <tbody>
                {dryRunState.recipients.map((recipient) => (
                  <tr key={recipient.to}>
                    <td>{recipient.to}</td>
                    <td>{recipient.parent_name || "Missing parent name"}</td>
                    <td>{recipient.children.length > 0 ? recipient.children.join(", ") : "Missing child names"}</td>
                    <td>{recipient.category || "pending"}</td>
                    <td>{recipient.bcc.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {previewState.totalRecipients > 0 ? (
        <p className="muted batch-count">
          {previewState.totalRecipients} deduplicated parent email{previewState.totalRecipients === 1 ? "" : "s"} ready after excluding internal/test addresses.
          {" "}{previewState.duplicateRecipientsRemoved} duplicate row{previewState.duplicateRecipientsRemoved === 1 ? "" : "s"} removed.
        </p>
      ) : null}

      {previewState.missingCategories.length > 0 ? (
        <div className="banner danger-banner">
          Missing sample categor{previewState.missingCategories.length === 1 ? "y" : "ies"}: {previewState.missingCategories.join(", ")}.
        </div>
      ) : null}

      {previewState.samples.length > 0 ? (
        <div className="email-samples">
          {previewState.samples.map((email) => (
            <article className="email-sample" key={email.to}>
              <div><strong>Sample type:</strong> {email.category || "pending"}</div>
              <div><strong>To:</strong> {email.to}</div>
              <div><strong>BCC:</strong> {email.bcc.join(", ")}</div>
              <div><strong>Subject:</strong> {email.subject}</div>
              <div><strong>Parent:</strong> {email.parent_name || "Missing parent name"}</div>
              <div><strong>Children:</strong> {email.children.length > 0 ? email.children.join(", ") : "Missing child names"}</div>
              <pre>{email.message}</pre>
            </article>
          ))}
        </div>
      ) : null}

      {testState.attempted > 0 ? (
        <div className={`banner ${testState.failures.length > 0 ? "danger-banner" : "success-banner"}`}>
          Test sent {testState.sent} of {testState.attempted} email{testState.attempted === 1 ? "" : "s"}.
          {" "}BCC confirmed: {testState.bccConfirmed ? testState.bcc : "no"}.
          {testState.failures.length > 0 ? (
            <ul className="failure-list">
              {testState.failures.map((failure, index) => (
                <li key={`${failure.email}-${index}`}>{failure.email}: {failure.error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {remainingState.attempted > 0 ? (
        <div className={`banner ${remainingState.failures.length > 0 ? "danger-banner" : "success-banner"}`}>
          Final report: {remainingState.totalRecipients} total recipient{remainingState.totalRecipients === 1 ? "" : "s"};
          {" "}{remainingState.duplicatesRemoved} duplicate{remainingState.duplicatesRemoved === 1 ? "" : "s"} removed;
          {" "}{remainingState.sent} of {remainingState.attempted} remaining email{remainingState.attempted === 1 ? "" : "s"} sent.
          {" "}Every sent email BCC'd to {remainingState.bccConfirmed ? remainingState.bcc : "not confirmed"}.
          {remainingState.failures.length > 0 ? (
            <ul className="failure-list">
              {remainingState.failures.map((failure, index) => (
                <li key={`${failure.email}-${index}`}>{failure.email}: {failure.error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
