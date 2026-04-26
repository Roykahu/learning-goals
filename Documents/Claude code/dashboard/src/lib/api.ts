import { Student, Teacher, ProgressRecord, Contract, PendingRecord, PendingContract, TeacherViewData, VeilleData, VeilleSendLogEntry, Message, MessageInput, parseContractName, InvoiceStatus, CDCAuditEntry, CDCAIPrepRecommendation, FeedbackRecord, BPFAggregation, TimetableData, StudentImportRow, ImportResult } from "./types";
import {
  DEMO_MODE,
  demoStudents,
  demoTeachers,
  demoProgress,
  demoContracts,
  demoPendingContracts,
  demoPending,
  demoVeille,
  demoMessages,
  getDemoTeacherView,
} from "./demo-data";

// Phase 9 D-06: hardcoded n8n fallback removed. Post-cutover, missing
// NEXT_PUBLIC_API_BASE_URL must fail loudly in dev. Phase 4's 3-tier
// permissive fallback served the migration-in-progress window; that window
// closed at cutover.
//
// NEXT_PUBLIC_N8N_WEBHOOK_URL stays as a fallback for one route only:
// /api/contracts/generate-teacher (teacher-contract still on n8n;
// Phase 5 deferred). See dashboard/src/app/api/contracts/generate-teacher/route.ts.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
if (!API_BASE) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL not set — dashboard cannot reach the Railway API. " +
      "Set the env var on Vercel (production) or .env.local (development).",
  );
}

async function fetchEndpoint<T>(path: string): Promise<T[]> {
  const url = `${API_BASE}/${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path}: ${res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") {
    return [] as unknown as T[];
  }
  return JSON.parse(text);
}

export async function getStudents(): Promise<Student[]> {
  if (DEMO_MODE) return demoStudents;
  const raw = await fetchEndpoint<Student>("api/dashboard-students");
  return deduplicateStudents(raw);
}

function deduplicateStudents(students: Student[]): Student[] {
  const map = new Map<string, Student>();
  for (const s of students) {
    const key = (s.studentFolderName || String(s.id)).toLowerCase().trim();
    const existing = map.get(key);
    if (!existing || scoreStudent(s) > scoreStudent(existing)) {
      map.set(key, s);
    }
  }
  return Array.from(map.values());
}

function scoreStudent(s: Student): number {
  return Object.values(s).filter(
    (v) => v !== null && v !== undefined && v !== "" && v !== 0 && v !== false
  ).length;
}

export async function getTeachers(): Promise<Teacher[]> {
  if (DEMO_MODE) return demoTeachers;
  return fetchEndpoint<Teacher>("api/dashboard-teachers");
}

export async function getProgress(): Promise<ProgressRecord[]> {
  if (DEMO_MODE) return demoProgress;
  return fetchEndpoint<ProgressRecord>("api/dashboard-progress");
}

export async function getPending(): Promise<PendingRecord[]> {
  if (DEMO_MODE) return demoPending;
  // Phase 4 D-02: Railway returns bare PendingRecord[] (no {data} wrapper).
  // The old parsed.data || [] unwrap is removed (would always return [] against new server).
  return fetchEndpoint<PendingRecord>("api/dashboard-pending");
}

export async function getTeacherView(email: string): Promise<TeacherViewData> {
  if (DEMO_MODE) return getDemoTeacherView(email);
  const url = `${API_BASE}/api/dashboard-teacher-view?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch teacher view: ${res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { teacher: { name: "", email: "", phone: "", contractStatus: null, contractUrl: null, certified: null }, students: [], alerts: [] };
  }
  return JSON.parse(text);
}

export async function getPendingContracts(): Promise<PendingContract[]> {
  if (DEMO_MODE) return demoPendingContracts;
  return fetchEndpoint<PendingContract>("api/dashboard-pending-contracts");
}

export async function approveAndSendContract(id: string): Promise<{ success: boolean; message: string }> {
  if (DEMO_MODE) return { success: true, message: "Contract sent (demo mode)" };
  const url = `${API_BASE}/api/contracts/${id}/approve`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to approve contract: ${res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { success: true, message: "Contract sent" };
  }
  return JSON.parse(text);
}

export async function generateTeacherContracts(studentEmail: string): Promise<{ success: boolean; message?: string; contracts?: { teacher: string; teacherEmail: string; docUrl: string }[]; count?: number }> {
  if (DEMO_MODE) return { success: true, message: "Generated (demo mode)", contracts: [], count: 0 };
  const res = await fetch("/api/contracts/generate-teacher", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentEmail }),
  });
  const text = await res.text();
  if (!text) {
    return { success: res.ok, message: res.ok ? "Generated" : `Failed: ${res.status}` };
  }
  return JSON.parse(text);
}

export async function getVeille(): Promise<VeilleData> {
  if (DEMO_MODE) return demoVeille;
  const url = `${API_BASE}/api/dashboard-veille`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch veille: ${res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { entries: [], metrics: { readinessScore: 0, lastEntryDates: { "23": null, "24": null, "25": null }, countByIndicator: { "23": 0, "24": 0, "25": 0 } } };
  }
  const data: VeilleData = JSON.parse(text);
  // Deduplicate entries by date+summary (DT API can insert duplicates)
  const seen = new Set<string>();
  data.entries = data.entries.filter(e => {
    const key = `${e.date}|${(e.summary || "").substring(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return data;
}

export async function approveVeilleEntry(id: string, action: "approve" | "archive"): Promise<{ success: boolean }> {
  if (DEMO_MODE) return { success: true };
  const url = `${API_BASE}/api/dashboard-veille-approve`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action }),
  });
  if (!res.ok) {
    throw new Error(`Failed to ${action} veille entry: ${res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { success: true };
  }
  return JSON.parse(text);
}

export async function addVeilleEntry(entry: { date: string; source: string; sourceUrl: string; indicateur: string; category: string; summary: string; actionTaken: string; evidenceLink: string }): Promise<{ success: boolean }> {
  if (DEMO_MODE) return { success: true };
  const url = `${API_BASE}/api/dashboard-veille-add`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    throw new Error(`Failed to add veille entry: ${res.status}`);
  }
  const text = await res.text();
  if (!text || text.trim() === "") {
    return { success: true };
  }
  return JSON.parse(text);
}

export async function sendProgressReminder(data: {
  studentEmail: string; studentName: string;
  teacherEmail: string; teacherName: string;
  progressPercent: number; completedHours: number;
  totalHours: number; alertType: string; templateType: string;
}): Promise<{ success: boolean; message: string }> {
  if (DEMO_MODE) return { success: true, message: "Reminder sent (demo)" };
  const res = await fetch("/api/progress/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getMessages(): Promise<Message[]> {
  if (DEMO_MODE) return demoMessages;
  const url = `${API_BASE}/api/messages-list`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const text = await res.text();
  if (!text || text.trim() === "") return [];
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [];
}

export async function sendMessage(data: MessageInput): Promise<{ success: boolean; message: string }> {
  if (DEMO_MODE) return { success: true, message: "Message sent (demo)" };
  const res = await fetch("/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function sendVeilleToTeachers(data: {
  teacherEmails: string[];
  teacherNames: string[];
  docUrl: string;
}): Promise<{ success: boolean; message: string; sentCount?: number }> {
  if (DEMO_MODE) return { success: true, message: "Veille sent to teachers (demo)", sentCount: data.teacherEmails.length };
  const res = await fetch("/api/veille/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// --- V2 Feature APIs ---

export async function getInvoices(): Promise<InvoiceStatus[]> {
  if (DEMO_MODE) return [];
  return fetchEndpoint<InvoiceStatus>("api/dashboard-invoices");
}

export async function markInvoicePaid(id: string): Promise<{ success: boolean }> {
  if (DEMO_MODE) return { success: true };
  const url = `${API_BASE}/api/dashboard-invoice-update`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, paymentStatus: "Paid" }),
  });
  if (!res.ok) throw new Error(`Failed to update invoice: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

export async function getCDCAudits(): Promise<CDCAuditEntry[]> {
  if (DEMO_MODE) return [];
  return fetchEndpoint<CDCAuditEntry>("api/dashboard-cdc");
}

export async function addCDCAudit(entry: Omit<CDCAuditEntry, "id" | "createdAt">): Promise<{ success: boolean }> {
  if (DEMO_MODE) return { success: true };
  const url = `${API_BASE}/api/dashboard-cdc-add`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`Failed to add audit entry: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : { success: true };
}

export async function getCDCAIPrep(): Promise<CDCAIPrepRecommendation> {
  if (DEMO_MODE) return { priorities: [], weakSpots: [], newRequirements: [], evidenceToPrep: [] };
  const url = `${API_BASE}/api/dashboard-cdc-ai-prep`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`Failed to get AI prep: ${res.status}`);
  return res.json();
}

export async function getFeedback(): Promise<FeedbackRecord[]> {
  if (DEMO_MODE) return [];
  return fetchEndpoint<FeedbackRecord>("api/dashboard-feedback");
}

export async function getBPFReport(year: number): Promise<BPFAggregation> {
  if (DEMO_MODE) {
    return {
      studentsByFunding: { CPF: 0, Company: 0, "Self-Pay": 0 },
      teachersByType: { Freelance: 0, Salaried: 0 },
      hoursPerTeacher: {},
      amountPerTeacher: {},
      monthly: [],
      totalRevenue: 0,
      totalHours: 0,
    };
  }
  const url = `${API_BASE}/api/bpf-report?year=${year}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch BPF: ${res.status}`);
  return res.json();
}

export async function getTimetable(week?: string): Promise<TimetableData> {
  const url = week
    ? `${API_BASE}/api/dashboard-timetable?week=${encodeURIComponent(week)}`
    : `${API_BASE}/api/dashboard-timetable`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch timetable: ${res.status}`);
  return res.json();
}

export async function importStudents(students: StudentImportRow[]): Promise<ImportResult> {
  if (DEMO_MODE) return { success: true, total: students.length, imported: students.length, skipped: 0, errors: 0 };
  const res = await fetch("/api/students/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ students }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Import failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function getContracts(): Promise<Contract[]> {
  if (DEMO_MODE) return demoContracts;
  const raw = await fetchEndpoint<Contract>("api/dashboard-contracts");
  return raw.map((c) => {
    const parsed = parseContractName(c.Contract_name);
    return {
      ...c,
      teacherName: parsed.teacherName,
      studentName: parsed.studentName,
      date: parsed.date,
    };
  });
}

// ---------------------------------------------------------------------------
// Phase 9 — cutover-status feed for /admin/health page (D-04a)
// ---------------------------------------------------------------------------

export interface CronStatus {
  /** Raw RunSummary blobs from logs (cron-specific shape). */
  lastTicks: unknown[];
  /** ISO timestamp of most-recent tick. null when no ticks. */
  lastTickAt: string | null;
  /** ticks.length for convenience. */
  lastN: number;
}

export interface CutoverStatusResponse {
  onboarding: CronStatus;
  ficheMonitor: CronStatus;
  signnowChecker: CronStatus;
  contractApprove: CronStatus;
  /** ISO — query window start (24h ago at request time). */
  since: string;
  source: "logs" | "postgres";
  /** Populated when Railway log query fails OR RAILWAY_API_TOKEN is unset. */
  warning?: string;
}

export async function getCutoverStatus(): Promise<CutoverStatusResponse> {
  const url = `${API_BASE}/api/cutover-status`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch cutover-status: ${res.status}`);
  }
  return res.json();
}
