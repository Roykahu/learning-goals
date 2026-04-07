"use client";

import { useState } from "react";
import { ProgressRecord, Student, Teacher } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function getAlerts(record: ProgressRecord): string[] {
  const alerts: string[] = [];
  const progress = record.progressPercent ?? 0;
  if (progress >= 80) alerts.push("80% Cert Prep");
  else if (progress >= 67) alerts.push("67% Teacher Alert");
  else if (progress >= 50) alerts.push("50% Mid-Course");
  if (record.lastLessonDate) {
    const lastLesson = new Date(record.lastLessonDate);
    const daysSince = Math.floor((Date.now() - lastLesson.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince > 14) alerts.push(`Stale (${daysSince}d)`);
  }
  return alerts;
}

// Only stale + general remain as manual options — 50%/67%/80% are now fully automatic
type TemplateType = "stale" | "general";

function getBadgeStyle(alert: string): string {
  if (alert.includes("80%")) return "bg-purple-900/40 text-purple-300 border border-purple-700";
  if (alert.includes("67%")) return "bg-orange-900/40 text-orange-300 border border-orange-700";
  if (alert.includes("50%")) return "bg-emerald-900/40 text-emerald-300 border border-emerald-700";
  if (alert.includes("Stale")) return "bg-red-900/40 text-red-300 border border-red-700";
  return "bg-amber-900/40 text-amber-300 border border-amber-700";
}

interface Props {
  records: ProgressRecord[];
  students?: Student[];
  teachers?: Teacher[];
}

interface TestResult {
  success: boolean;
  message?: string;
  testUrl?: string;
  answerKeyUrl?: string;
}

export function ProgressAlerts({ records, students = [], teachers = [] }: Props) {
  // Send reminder dialog (stale / general)
  const [reminderTarget, setReminderTarget] = useState<ProgressRecord | null>(null);
  const [templateType, setTemplateType] = useState<TemplateType>("general");
  const [selectedTeacherEmail, setSelectedTeacherEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Generate test dialog
  const [testTarget, setTestTarget] = useState<ProgressRecord | null>(null);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  function getStudentFicheDocId(record: ProgressRecord): string | null {
    const student = students.find(s => s.email?.toLowerCase() === record.studentEmail?.toLowerCase());
    return student?.fichePedagogique_docId || null;
  }

  function getStudentTeacher(record: ProgressRecord): { name: string; email: string }[] {
    const student = students.find(s => s.email?.toLowerCase() === record.studentEmail?.toLowerCase());
    if (!student?.teacherAssigned) return [];
    const teacher = teachers.find(t => t.Name === student.teacherAssigned);
    if (teacher) return [{ name: teacher.Name, email: teacher.Email }];
    return [{ name: student.teacherAssigned, email: "" }];
  }

  function openTestDialog(record: ProgressRecord) {
    setTestResult(null);
    setTestTarget(record);
  }

  async function handleGenerateTest() {
    if (!testTarget) return;
    const ficheDocId = getStudentFicheDocId(testTarget);
    if (!ficheDocId) {
      setTestResult({ success: false, message: "No fiche found for this student. Make sure their fiche pédagogique document ID is set." });
      return;
    }
    const teacherEmail = getStudentTeacher(testTarget)[0]?.email || null;
    setGeneratingTest(true);
    try {
      const res = await fetch("/api/progress/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: testTarget.studentEmail,
          studentName: testTarget.studentName,
          ficheDocId,
          teacherEmail,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setTestResult({
          success: true,
          testUrl: result.testUrl,
          answerKeyUrl: result.answerKeyUrl,
          message: "Test and answer key generated and sent!",
        });
      } else {
        setTestResult({ success: false, message: result.message || "Failed to generate test" });
      }
    } catch {
      setTestResult({ success: false, message: "Failed to reach test generator" });
    } finally {
      setGeneratingTest(false);
    }
  }

  function openReminderDialog(record: ProgressRecord) {
    const alerts = getAlerts(record);
    setTemplateType(alerts.some(a => a.includes("Stale")) ? "stale" : "general");
    const teacherOptions = getStudentTeacher(record);
    setSelectedTeacherEmail(teacherOptions[0]?.email || "");
    setSendResult(null);
    setReminderTarget(record);
  }

  async function handleSendReminder() {
    if (!reminderTarget || !selectedTeacherEmail) return;
    setSending(true);
    setSendResult(null);
    const teacher = teachers.find(t => t.Email === selectedTeacherEmail);
    try {
      const res = await fetch("/api/progress/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentEmail: reminderTarget.studentEmail,
          studentName: reminderTarget.studentName,
          teacherEmail: selectedTeacherEmail,
          teacherName: teacher?.Name || "Teacher",
          progressPercent: reminderTarget.progressPercent ?? 0,
          completedHours: reminderTarget.completedHours ?? 0,
          totalHours: reminderTarget.totalHours ?? 0,
          alertType: getAlerts(reminderTarget)[0] || "general",
          templateType,
        }),
      });
      const result = await res.json();
      setSendResult(result);
    } catch {
      setSendResult({ success: false, message: "Failed to send reminder" });
    } finally {
      setSending(false);
    }
  }

  const sorted = [...records].sort((a, b) => {
    const diff = getAlerts(b).length - getAlerts(a).length;
    return diff !== 0 ? diff : (b.progressPercent ?? 0) - (a.progressPercent ?? 0);
  });

  const totalActive = records.filter((r) => r.status?.toLowerCase() !== "completed").length;
  const withAlerts = records.filter((r) => getAlerts(r).length > 0).length;
  const avgProgress = records.length > 0
    ? Math.round(records.reduce((sum, r) => sum + (r.progressPercent ?? 0), 0) / records.length)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Students", value: totalActive, color: "from-blue-500 to-blue-600" },
          { label: "With Alerts", value: withAlerts, color: "from-amber-500 to-red-500", valueClass: "text-amber-400" },
          { label: "Average Progress", value: `${avgProgress}%`, color: "from-cyan-500 to-cyan-600" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl bg-[#111827] border border-[#1e293b] p-5 relative overflow-hidden">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.color}`} />
            <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider mt-1">{card.label}</p>
            <p className={`text-3xl font-bold mt-2 ${"valueClass" in card && card.valueClass ? card.valueClass : "text-white"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e293b] bg-[#111827] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#1e293b] hover:bg-transparent">
              {["Student", "Progress", "Hours", "Lessons", "Days Since Lesson", "Last Check", "Alerts", "Actions"].map((h) => (
                <TableHead key={h} className="text-[#64748b] font-semibold text-xs uppercase tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((record) => {
              const alerts = getAlerts(record);
              const progress = record.progressPercent ?? 0;
              return (
                <TableRow key={record.id} className="border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30">
                  <TableCell className="font-medium text-white">{record.studentName || record.studentEmail}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="w-24 h-2 bg-[#1e293b] rounded-full overflow-hidden flex-1">
                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400" style={{ width: `${Math.min(progress, 100)}%` }} />
                      </div>
                      <span className="text-sm font-medium text-[#94a3b8] w-10 text-right">{Math.round(progress)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#94a3b8]">{record.completedHours ?? 0}/{record.totalHours ?? "?"}h</TableCell>
                  <TableCell className="text-[#94a3b8]">{record.lessonCount ?? "--"}</TableCell>
                  <TableCell>
                    {record.lastLessonDate ? (() => {
                      const days = Math.floor((Date.now() - new Date(record.lastLessonDate).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <span className={days > 14 ? "text-red-400 font-medium" : days > 7 ? "text-amber-400" : "text-[#94a3b8]"}>
                          {days}d
                        </span>
                      );
                    })() : <span className="text-[#475569]">--</span>}
                  </TableCell>
                  <TableCell className="text-sm text-[#94a3b8]">{record.lastCheckDate ? new Date(record.lastCheckDate).toLocaleDateString() : "--"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {alerts.map((alert) => (
                        <Badge key={alert} className={getBadgeStyle(alert)}>
                          {alert}
                        </Badge>
                      ))}
                      {record.fiftyPercentAlertSent && (
                        <Badge className="bg-blue-900/40 text-blue-300 border border-blue-700 text-xs">
                          ✓ Test Sent
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {/* Generate Test — available for any student */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTestDialog(record)}
                        title="Generate English test + answer key"
                        className="bg-transparent border-[#334155] text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 h-8 px-2"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                        Test
                      </Button>
                      {/* Send Reminder — stale / general follow-up only */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReminderDialog(record)}
                        title="Send manual reminder"
                        className="bg-transparent border-[#334155] text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 h-8 px-2"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                        </svg>
                        Send
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-[#475569] py-12">
                  No progress records yet. Data will appear after the Fiche Monitoring workflow runs.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Generate Test Dialog */}
      <Dialog open={!!testTarget} onOpenChange={(open) => { if (!open) { setTestTarget(null); setTestResult(null); } }}>
        <DialogContent className="bg-[#111827] border-[#1e293b] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Generate English Test</DialogTitle>
          </DialogHeader>
          {testTarget && (
            <div className="space-y-4">
              <div className="bg-[#0f172a] rounded-lg p-4">
                <p className="text-sm text-[#64748b]">Student</p>
                <p className="text-white font-medium">{testTarget.studentName}</p>
                <p className="text-xs text-[#64748b]">{testTarget.progressPercent ?? 0}% — {testTarget.completedHours ?? 0}/{testTarget.totalHours ?? "?"}h</p>
              </div>

              <p className="text-sm text-[#94a3b8]">
                This will generate a personalised <strong className="text-white">30-minute English test</strong> and a separate <strong className="text-white">answer key</strong> for this student based on their fiche pédagogique.
              </p>
              <ul className="text-xs text-[#64748b] space-y-1 list-disc list-inside">
                <li>Test (5 sections) emailed to student</li>
                <li>Answer key emailed to their teacher</li>
                <li>Both documents shared with anyone with the link</li>
              </ul>

              {!getStudentFicheDocId(testTarget) && (
                <div className="p-3 rounded-lg text-sm bg-amber-900/30 text-amber-300 border border-amber-700">
                  ⚠️ No fiche pédagogique found for this student. The test cannot be generated without it.
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-lg text-sm space-y-2 ${testResult.success ? "bg-emerald-900/30 text-emerald-300 border border-emerald-700" : "bg-red-900/30 text-red-300 border border-red-700"}`}>
                  <p>{testResult.message}</p>
                  {testResult.success && testResult.testUrl && (
                    <a href={testResult.testUrl} target="_blank" rel="noopener noreferrer" className="block underline text-emerald-400 hover:text-emerald-300 truncate">
                      📄 View Test
                    </a>
                  )}
                  {testResult.success && testResult.answerKeyUrl && (
                    <a href={testResult.answerKeyUrl} target="_blank" rel="noopener noreferrer" className="block underline text-emerald-400 hover:text-emerald-300 truncate">
                      🔑 View Answer Key
                    </a>
                  )}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => { setTestTarget(null); setTestResult(null); }}
                  className="bg-transparent border-[#334155] text-[#94a3b8] hover:bg-[#1e293b]"
                >
                  {testResult?.success ? "Close" : "Cancel"}
                </Button>
                {!testResult?.success && (
                  <Button
                    onClick={handleGenerateTest}
                    disabled={generatingTest || !getStudentFicheDocId(testTarget)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  >
                    {generatingTest ? "Generating… (30s)" : "Generate & Send"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Reminder Dialog — stale + general only */}
      <Dialog open={!!reminderTarget} onOpenChange={(open) => { if (!open) setReminderTarget(null); }}>
        <DialogContent className="bg-[#111827] border-[#1e293b] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Send Reminder</DialogTitle>
          </DialogHeader>
          {reminderTarget && (
            <div className="space-y-4">
              <div className="bg-[#0f172a] rounded-lg p-4">
                <p className="text-sm text-[#64748b]">Student</p>
                <p className="text-white font-medium">{reminderTarget.studentName}</p>
                <p className="text-xs text-[#64748b]">{reminderTarget.progressPercent ?? 0}% — {reminderTarget.completedHours ?? 0}/{reminderTarget.totalHours ?? "?"}h</p>
              </div>

              <p className="text-xs text-[#64748b] bg-[#0f172a] px-3 py-2 rounded border border-[#1e293b]">
                ℹ️ 50%, 67% and 80% milestone emails are sent automatically by the Fiche Monitoring workflow.
              </p>

              <div>
                <label className="text-sm text-[#64748b] block mb-1">Template</label>
                <div className="space-y-2">
                  {([
                    { value: "stale" as const, label: "Stale Reminder", desc: "Follow up on inactive student (>14 days without a lesson)" },
                    { value: "general" as const, label: "General Follow-up", desc: "Ad-hoc progress update or check-in" },
                  ]).map((opt) => (
                    <label key={opt.value} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer border ${templateType === opt.value ? "border-cyan-500 bg-cyan-500/10" : "border-[#1e293b] hover:border-[#334155]"}`}>
                      <input
                        type="radio"
                        name="template"
                        value={opt.value}
                        checked={templateType === opt.value}
                        onChange={() => setTemplateType(opt.value)}
                        className="mt-1 accent-cyan-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-white">{opt.label}</p>
                        <p className="text-xs text-[#64748b]">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-[#64748b] block mb-1">Teacher</label>
                <select
                  value={selectedTeacherEmail}
                  onChange={(e) => setSelectedTeacherEmail(e.target.value)}
                  className="w-full h-10 rounded-md border border-[#1e293b] bg-[#0f172a] px-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">Select teacher...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.Email}>{t.Name}</option>
                  ))}
                </select>
              </div>

              {sendResult && (
                <div className={`p-3 rounded-lg text-sm ${sendResult.success ? "bg-emerald-900/30 text-emerald-300 border border-emerald-700" : "bg-red-900/30 text-red-300 border border-red-700"}`}>
                  {sendResult.message}
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setReminderTarget(null)}
                  className="bg-transparent border-[#334155] text-[#94a3b8] hover:bg-[#1e293b]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendReminder}
                  disabled={sending || !selectedTeacherEmail || sendResult?.success === true}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white disabled:opacity-50"
                >
                  {sending ? "Sending..." : sendResult?.success ? "Sent!" : "Send Reminder"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
