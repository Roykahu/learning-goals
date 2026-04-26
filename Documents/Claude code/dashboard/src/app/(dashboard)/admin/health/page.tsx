"use client";

// Phase 9 Plan 09-02 — /admin/health
//
// The 48h cutover watch surface (D-04). Roy glances at this page morning +
// evening for 48h after RECIPIENT_OVERRIDE is unset on Railway.
//
// Layout:
//   - Header: "Cutover Health" + last-refreshed timestamp + Refresh button
//   - Tripwire row: full-width banner — green ALL CLEAR or red <error count>
//   - 4-cron grid (responsive 4/2/1 cols):
//       Onboarding (every 30 min)  | Fiche Monitor (daily 6 UTC)
//       SignNow Checker (every 10) | Contract Approve (sync HTTP)
//   - Footnote: D-01c — n8n teacher-contract still active (Phase 5 deferred)
//
// NO polling, NO SSE — manual refresh only (D-04 + 09-RESEARCH §Tier 1.4).

import { useCallback, useEffect, useState } from "react";
import { getCutoverStatus, type CutoverStatusResponse, type CronStatus } from "@/lib/api";

interface CronCardProps {
  title: string;
  cadence: string;
  status: CronStatus;
}

function sumErrorsByStep(ticks: unknown[]): number {
  let total = 0;
  for (const t of ticks) {
    if (!t || typeof t !== "object") continue;
    const errs = (t as { errorsByStep?: Record<string, number> }).errorsByStep;
    if (!errs) continue;
    for (const v of Object.values(errs)) {
      if (typeof v === "number") total += v;
    }
  }
  return total;
}

function sumEmailsSent(ticks: unknown[]): number {
  let total = 0;
  for (const t of ticks) {
    if (!t || typeof t !== "object") continue;
    const sent = (t as { emailsSent?: number; alertsSentByKind?: Record<string, number> }).emailsSent;
    if (typeof sent === "number") {
      total += sent;
      continue;
    }
    // Fiche-monitor exposes alertsSentByKind not emailsSent.
    const alerts = (t as { alertsSentByKind?: Record<string, number> }).alertsSentByKind;
    if (alerts) {
      for (const v of Object.values(alerts)) {
        if (typeof v === "number") total += v;
      }
    }
  }
  return total;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function CronCard({ title, cadence, status }: CronCardProps) {
  const errorsTotal = sumErrorsByStep(status.lastTicks);
  const emailsTotal = sumEmailsSent(status.lastTicks);
  const errorTone = errorsTotal === 0 ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0f1629] p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-xs text-[#64748b]">{cadence}</div>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#64748b]">Ticks (24h)</dt>
          <dd className="text-white tabular-nums">{status.lastN}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#64748b]">Errors</dt>
          <dd className={`tabular-nums ${errorTone}`}>{errorsTotal}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#64748b]">Emails sent</dt>
          <dd className="text-white tabular-nums">{emailsTotal}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#64748b]">Last tick</dt>
          <dd className="text-white">{relativeTime(status.lastTickAt)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function AdminHealthPage() {
  const [data, setData] = useState<CutoverStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCutoverStatus();
      setData(res);
      setRefreshedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Tripwire: any non-zero errorsByStep across all 4 crons → red.
  const errorsTotal = data
    ? sumErrorsByStep(data.onboarding.lastTicks) +
      sumErrorsByStep(data.ficheMonitor.lastTicks) +
      sumErrorsByStep(data.signnowChecker.lastTicks) +
      sumErrorsByStep(data.contractApprove.lastTicks)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Cutover Health</h1>
          <p className="text-sm text-[#64748b] mt-1">
            48-hour watch surface for the n8n→Railway cutover.
          </p>
          <p className="text-xs text-[#64748b] mt-1">
            Last refreshed:{" "}
            {refreshedAt ? refreshedAt.toLocaleTimeString() : "—"}
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Warning banner — surfaces upstream Railway log query failures + missing env */}
      {data?.warning && (
        <div className="mb-4 rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          <strong className="font-semibold">Warning:</strong> {data.warning}
        </div>
      )}

      {/* Hard error (network / 500 from /api/cutover-status itself) */}
      {error && (
        <div className="mb-4 rounded-lg border border-rose-700 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
          <strong className="font-semibold">Failed to load:</strong> {error}
        </div>
      )}

      {/* Tripwire row */}
      {data && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm font-medium ${
            errorsTotal === 0
              ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
              : "border-rose-800 bg-rose-950/30 text-rose-300"
          }`}
        >
          {errorsTotal === 0
            ? "Tripwire: ALL CLEAR — 0 errors across the 4 ported crons"
            : `Tripwire: ${errorsTotal} error(s) across the 4 ported crons`}
        </div>
      )}

      {/* 4-cron grid */}
      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CronCard
            title="Onboarding"
            cadence="*/30 UTC"
            status={data.onboarding}
          />
          <CronCard
            title="Fiche Monitor"
            cadence="daily 06:00 UTC"
            status={data.ficheMonitor}
          />
          <CronCard
            title="SignNow Checker"
            cadence="*/10 UTC"
            status={data.signnowChecker}
          />
          <CronCard
            title="Contract Approve"
            cadence="sync HTTP /api/contracts/:id/approve"
            status={data.contractApprove}
          />
        </div>
      )}

      {/* Loading skeleton (only when no data yet) */}
      {loading && !data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 rounded-lg border border-[#1e293b] bg-[#0f1629] p-4 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* D-01c footnote — n8n: teacher-contract workflow still active */}
      <div className="mt-8 border-t border-[#1e293b] pt-4 text-xs text-[#64748b]">
        <p>
          <strong className="text-[#94a3b8]">Note:</strong> 4 ported crons are
          shown above. The n8n <code>teacher-contract</code> workflow
          (<code>DkUrvmqy6NhLy6UG</code>) is still active — Phase 5 deferred to
          post-cutover. Missing teacher-contract metrics here are NOT a
          regression.
        </p>
        {data && (
          <p className="mt-2">
            Window: last 24h since{" "}
            <span className="font-mono">{data.since}</span>. Source:{" "}
            <span className="font-mono">{data.source}</span>.
          </p>
        )}
      </div>
    </div>
  );
}
