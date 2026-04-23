export interface Student {
  id: string;
  studentFolderName: string;
  email: string;
  folderId: string;
  oralTestLink: string | null;
  writtenTestLink: string | null;
  languageTestLink: string | null;
  fichePedagogique_folder: string | null;
  fichePedagogique_docId: string | null;
  fichePedagogique_url: string | null;
  ficheName: string | null;
  totalHours: number | null;
  completedHours: number | null;
  progressPercent: number | null;
  lessonCount: number | null;
  fiftyPercentAlertSent: boolean;
  sixtySevenPercentAlertSent: boolean;
  status: string | null;
  teacherAssigned: string | null;
  language: string | null;
  initialLevel: string | null;
}

export type StudentStage =
  | "Enrolled"
  | "Oral Test Done"
  | "Fiche Created"
  | "In Progress"
  | "Completed";

export function getStudentStage(student: Student): StudentStage {
  const progress = student.progressPercent ?? 0;
  if (progress >= 100) return "Completed";
  if (progress > 0) return "In Progress";
  if (student.fichePedagogique_docId) return "Fiche Created";
  if (student.oralTestLink) return "Oral Test Done";
  return "Enrolled";
}

export interface Teacher {
  id: string;
  Name: string;
  Email: string;
  Phone: string;
  Business_Entity: string | null;
  SIRET_SIREN_Notes: string | null;
  CERTIFIE_OU_NON_CERTIFIE: string | null;
  Address: string | null;
  City_and_Postal_Code: string | null;
  Country: string | null;
  NDA: string | null;
  teacherContractStatus: string | null;
  teacherContractURL: string | null;
  teacherContractSentDate: string | null;
}

export interface ProgressRecord {
  id: string;
  studentEmail: string;
  studentName: string;
  ficheName: string | null;
  totalHours: number | null;
  completedHours: number | null;
  progressPercent: number | null;
  lessonCount: number | null;
  fiftyPercentAlertSent: boolean;
  sixtySevenPercentAlertSent: boolean;
  eightyPercentAlertSent: boolean;
  staleAlertSent: boolean;
  lastCheckDate: string | null;
  lastLessonDate: string | null;
  status: string | null;
}

export interface Contract {
  id: string;
  Contract_name: string;
  Contract_url: string;
  // Parsed from name
  teacherName?: string;
  studentName?: string;
  date?: string;
}

export interface PendingContract {
  id: string;
  studentName: string;
  studentEmail: string;
  teacherName: string;
  teacherEmail: string;
  contractType: "student" | "teacher";
  contractDocId: string;
  contractDocUrl: string;
  conventionDocUrl: string | null;
  convocationDocUrl: string | null;
  programmeDocUrl: string | null;
  examGuideDocId: string | null;
  studentFolderId: string;
  status: "Draft" | "Sent" | "Awaiting Signature" | "Signed";
  generatedAt: string;
  sentAt: string | null;
  signedAt: string | null;
  language: string;
  totalHours: number;
  paymentAmount: number;
  oralTestLink: string | null;
  languageTestLink: string | null;
}

export interface PendingRecord {
  id: string;
  studentEmail: string;
  studentName: string;
  oralTestTimestamp: string;
  oralTestData: string;
  retryCount: number;
  lastRetryAt: string;
  status: string;
  alertSent: boolean;
  oralTestDocUrl: string;
  language: string | null;
  initial_level: string | null;
  test_date: string | null;
  trainingStartDate: string | null;
  trainingEndDate: string | null;
  totalHours: number | null;
  examType: string | null;
  personalized_objectives: string | null;
  trainingType: string | null;
}

export interface TeacherViewStudent {
  studentFolderName: string;
  email: string;
  language: string | null;
  initialLevel: string | null;
  totalHours: number;
  completedHours: number;
  progressPercent: number;
  lessonCount: number;
  ficheUrl: string | null;
  fiftyPercentAlert: boolean;
  sixtySevenPercentAlert: boolean;
}

export interface TeacherViewData {
  teacher: {
    name: string;
    email: string;
    phone: string;
    contractStatus: string | null;
    contractUrl: string | null;
    certified: string | null;
  };
  students: TeacherViewStudent[];
  alerts: { studentName: string; alertType: string }[];
  error?: string;
}

export interface VeilleEntry {
  id: string;
  date: string;
  source: string;
  sourceUrl: string | null;
  indicateur: "23" | "24" | "25";
  category: string;
  summary: string;
  actionTaken: string | null;
  status: "Draft" | "Approved" | "Archived";
  evidenceLink: string | null;
  addedBy: "Auto" | "Manual";
  approvedDate: string | null;
}

export interface VeilleMetrics {
  readinessScore: number;
  lastEntryDates: { "23": string | null; "24": string | null; "25": string | null };
  countByIndicator: { "23": number; "24": number; "25": number };
}

export interface VeilleData {
  entries: VeilleEntry[];
  metrics: VeilleMetrics;
}

export interface Message {
  id: string;
  createdAt: string;
  senderName: string;
  senderEmail: string;
  senderRole: string;
  recipientType: "all" | "teacher" | "student";
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  category: "schedule_change" | "homework" | "class_update" | "general";
  studentContext: string;
}

export interface MessageInput {
  senderName: string;
  senderEmail: string;
  senderRole: string;
  recipientType: "all" | "teacher" | "student";
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  category: string;
  studentContext: string;
}

export interface VeilleSendLogEntry {
  sentAt: string;
  teacherName: string;
  teacherEmail: string;
  docUrl: string;
  sentBy: string;
}

// --- New types for V2 features ---

export interface InvoiceStatus {
  id: string;
  studentName: string;
  studentEmail: string;
  emailSubject: string;
  emailDate: string;
  ficheComplete: boolean;
  paymentStatus: "Pending-Fiche-Incomplete" | "Ready-to-Pay" | "Paid" | "Unmatched";
  teacherNotifiedAt: string | null;
  teacherName: string;
  senderEmail: string;
}

export interface CDCAuditEntry {
  id: string;
  date: string;
  auditType: "DREETS" | "CDC" | "Qualiopi" | "Internal";
  inspectorName: string;
  questionsAsked: string;
  findings: string;
  outcome: "Pass" | "Conditional" | "Fail" | "Pending";
  followUpActions: string;
  status: "Completed" | "Upcoming" | "In-Preparation";
  evidenceLinks: string;
  createdAt: string;
}

export interface CDCAIPrepRecommendation {
  priorities: string[];
  weakSpots: string[];
  newRequirements: string[];
  evidenceToPrep: string[];
}

export interface FeedbackRecord {
  id: string;
  formType: "Student" | "Teacher" | "Donateur";
  recipientName: string;
  recipientEmail: string;
  studentName: string;
  courseName: string;
  sentDate: string;
  reminderSentDate: string | null;
  responseDate: string | null;
  responseStatus: "Sent" | "Reminded" | "Responded" | "Overdue";
  formUrl: string;
}

export interface BPFRecord {
  id: string;
  year: number;
  month: number;
  studentName: string;
  studentEmail: string;
  fundingSource: "CPF" | "Company" | "Self-Pay";
  teacherName: string;
  teacherType: "Freelance" | "Salaried";
  hoursDelivered: number;
  amountPaid: number;
  invoiceDocUrl: string;
  invoiceDate: string;
}

export interface BPFAggregation {
  studentsByFunding: { CPF: number; Company: number; "Self-Pay": number };
  teachersByType: { Freelance: number; Salaried: number };
  hoursPerTeacher: Record<string, number>;
  amountPerTeacher: Record<string, number>;
  monthly: {
    month: number;
    studentCount: number;
    hoursDelivered: number;
    amountInvoiced: number;
    runningTotal: number;
  }[];
  totalRevenue: number;
  totalHours: number;
}

export interface TimetableClass {
  teacher: string;
  student: string;
}

export interface TimetableSlot {
  time: string;
  classes: TimetableClass[];
}

export interface TimetableDay {
  day: string;
  teachers: string[];
  slots: TimetableSlot[];
}

export interface TimetableData {
  week: string;
  days: TimetableDay[];
  tabs: string[];
  columnCount?: number;
}

export interface StudentImportRow {
  studentName: string;
  email: string;
  language: string;
  initialLevel: string;
  totalHours: number;
  completedHours: number;
  teacherName: string;
}

export interface ImportResult {
  success: boolean;
  total: number;
  imported: number;
  skipped: number;
  errors: number;
  details?: {
    imported: { email: string; name: string }[];
    skipped: { email: string; name: string; reason: string }[];
    errors: { email: string; name: string; reason: string }[];
  };
}

export function parseContractName(name: string): {
  teacherName: string;
  studentName: string;
  date: string;
} {
  // Format: Contrat_Enseignant_{Teacher}_{Student}_{Date}
  // Example: Contrat_Enseignant_Jessica_Morris_Macor_GOURLAOUEN_Christopher_31-12-2024
  // This is tricky because names can have multiple parts.
  // We'll split by _ and try to extract the date from the end first.
  const parts = name.split("_");

  // Find date at the end (DD-MM-YYYY pattern)
  const datePattern = /^\d{2}-\d{2}-\d{4}$/;
  let dateIdx = parts.length;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (datePattern.test(parts[i])) {
      dateIdx = i;
      break;
    }
  }

  const date = dateIdx < parts.length ? parts[dateIdx] : "Unknown";

  // Everything after "Enseignant" and before the date is teacher + student names
  // We need a heuristic. The prefix is "Contrat_Enseignant_"
  const nameSegment = parts.slice(2, dateIdx).join(" ");

  // Without more structure, return the full name segment as-is
  return {
    teacherName: nameSegment,
    studentName: "",
    date,
  };
}
