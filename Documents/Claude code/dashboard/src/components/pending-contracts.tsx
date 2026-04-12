"use client";

import { useState } from "react";
import { PendingContract } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

function getDaysPending(generatedAt: string): number {
  if (!generatedAt) return 0;
  const diff = Date.now() - new Date(generatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Draft":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Draft</Badge>;
    case "Sent":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Sent</Badge>;
    case "Awaiting Signature":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Awaiting</Badge>;
    case "Signed":
      return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Signed</Badge>;
    default:
      return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{status}</Badge>;
  }
}

function getTypeBadge(type: string) {
  if (type === "teacher") {
    return <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">Teacher</Badge>;
  }
  return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Student</Badge>;
}

type FilterTab = "all" | "Draft" | "Sent";

export function PendingContracts({ contracts }: { contracts: PendingContract[] }) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [genEmail, setGenEmail] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{ email: string; success: boolean; message: string } | null>(null);

  const drafts = contracts.filter((c) => c.status === "Draft");
  const sent = contracts.filter((c) => c.status === "Sent" || c.status === "Awaiting Signature" || c.status === "Signed");
  const teacherDrafts = drafts.filter((c) => c.contractType === "teacher");
  const studentDrafts = drafts.filter((c) => c.contractType === "student");

  const filtered = filter === "all" ? contracts : contracts.filter((c) => {
    if (filter === "Draft") return c.status === "Draft";
    if (filter === "Sent") return c.status !== "Draft";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    // Drafts first, then by date
    if (a.status === "Draft" && b.status !== "Draft") return -1;
    if (a.status !== "Draft" && b.status === "Draft") return 1;
    return new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime();
  });

  async function handleApprove(id: string) {
    setSendingId(id);
    setConfirmId(null);
    try {
      const res = await fetch("/api/contracts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setResult({ id, success: data.success, message: data.message || "Sent" });
    } catch {
      setResult({ id, success: false, message: "Failed to send" });
    } finally {
      setSendingId(null);
    }
  }

  async function handleGenTeachers(studentEmail: string) {
    setGenEmail(studentEmail);
    setGenResult(null);
    try {
      const res = await fetch("/api/contracts/generate-teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentEmail }),
      });
      const data = await res.json();
      const count = data.count ?? (data.contracts?.length ?? 0);
      setGenResult({
        email: studentEmail,
        success: data.success ?? false,
        message: data.success ? `Generated ${count} contract(s). Refresh to see.` : (data.message || "Failed"),
      });
    } catch {
      setGenResult({ email: studentEmail, success: false, message: "Network error" });
    } finally {
      setGenEmail(null);
    }
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Pending Draft</p>
          <p className="text-3xl font-bold text-amber-400">{drafts.length}</p>
        </div>
        <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Teacher Contracts</p>
          <p className="text-3xl font-bold text-cyan-400">{teacherDrafts.length}</p>
        </div>
        <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-5">
          <p className="text-xs text-[#64748b] uppercase tracking-wider mb-1">Student Docs</p>
          <p className="text-3xl font-bold text-blue-400">{studentDrafts.length}</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        {(["all", "Draft", "Sent"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === tab
                ? "bg-blue-600/15 text-white border border-blue-500/30"
                : "text-[#64748b] hover:text-white bg-[#111827] border border-[#1e293b]"
            }`}
          >
            {tab === "all" ? `All (${contracts.length})` : tab === "Draft" ? `Draft (${drafts.length})` : `Sent (${sent.length})`}
          </button>
        ))}
      </div>

      {/* Table */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-12 text-center">
          <p className="text-[#64748b] text-lg mb-2">No contracts to review</p>
          <p className="text-[#475569] text-sm">New contracts will appear here when Form 1 generates them.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1e293b] bg-[#111827] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e293b]">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Student</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Teacher</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Type</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Created</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Days</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#64748b] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const days = getDaysPending(c.generatedAt);
                const isSuccess = result?.id === c.id && result.success;
                const isFailed = result?.id === c.id && !result.success;
                const isSending = sendingId === c.id;
                const isConfirming = confirmId === c.id;

                return (
                  <tr key={c.id} className="border-b border-[#1e293b] hover:bg-[#1e293b]/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-white">{c.studentName}</p>
                      <p className="text-xs text-[#64748b]">{c.studentEmail}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8]">{c.teacherName || "-"}</td>
                    <td className="px-5 py-4">{getTypeBadge(c.contractType)}</td>
                    <td className="px-5 py-4">
                      {isSuccess ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Sent!</Badge>
                      ) : (
                        getStatusBadge(c.status)
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-[#94a3b8]">{formatDate(c.generatedAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-sm font-medium ${days >= 2 ? "text-red-400" : days >= 1 ? "text-amber-400" : "text-[#94a3b8]"}`}>
                        {days}d
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Document links */}
                        {c.contractType === "student" ? (
                          <>
                            {c.conventionDocUrl && (
                              <a
                                href={c.conventionDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155] transition-all"
                              >
                                Convention
                              </a>
                            )}
                            {c.convocationDocUrl && (
                              <a
                                href={c.convocationDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155] transition-all"
                              >
                                Convocation
                              </a>
                            )}
                            {c.programmeDocUrl && (
                              <a
                                href={c.programmeDocUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155] transition-all"
                              >
                                Programme
                              </a>
                            )}
                          </>
                        ) : (
                          <a
                            href={c.contractDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155] transition-all"
                          >
                            Contract
                          </a>
                        )}

                        {/* Approve & Send */}
                        {c.status === "Draft" && !isSuccess && (
                          <>
                            {isConfirming ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleApprove(c.id)}
                                  disabled={isSending}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
                                >
                                  {isSending ? "Sending..." : "Confirm"}
                                </button>
                                <button
                                  onClick={() => setConfirmId(null)}
                                  className="px-2 py-1.5 rounded-lg text-xs text-[#64748b] hover:text-white transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmId(c.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 transition-all"
                              >
                                Approve & Send
                              </button>
                            )}
                          </>
                        )}

                        {/* Gen Teachers (only on student-type Draft rows) */}
                        {c.contractType === "student" && c.status === "Draft" && c.studentEmail && (
                          <button
                            onClick={() => handleGenTeachers(c.studentEmail)}
                            disabled={genEmail === c.studentEmail}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-all disabled:opacity-50"
                            title="Generate teacher contracts for this student"
                          >
                            {genEmail === c.studentEmail ? "Generating..." : "Gen Teachers"}
                          </button>
                        )}

                        {genResult?.email === c.studentEmail && (
                          <span className={`text-xs ${genResult.success ? "text-emerald-400" : "text-red-400"}`}>
                            {genResult.message}
                          </span>
                        )}

                        {isFailed && (
                          <span className="text-xs text-red-400">{result?.message}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
