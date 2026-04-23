import {
  Student,
  Teacher,
  ProgressRecord,
  Contract,
  PendingContract,
  PendingRecord,
  VeilleData,
  TeacherViewData,
  Message,
} from "./types";

// --- Fake Google IDs (realistic format) ---
const fakeDocId = (seed: string) =>
  `1${seed.padEnd(43, "abcdefghijklmnopqrstuvwxyz0123456789ABCDE")}`.slice(0, 44);
const fakeFolderId = (seed: string) =>
  `1${seed.padEnd(32, "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345")}`.slice(0, 33);

// Helper to generate a student quickly
function makeStudent(
  id: string,
  name: string,
  email: string,
  teacher: string | null,
  language: string,
  level: string | null,
  totalHours: number,
  completedHours: number | null,
  progressPercent: number | null,
  lessonCount: number | null,
  hasFiche: boolean,
  hasOralTest: boolean,
  hasWrittenTest: boolean,
  fiftyAlert: boolean,
  sixtySevenAlert: boolean,
): Student {
  const seed = name.replace(/\s/g, "");
  return {
    id,
    studentFolderName: name,
    email,
    folderId: fakeFolderId(seed),
    oralTestLink: hasOralTest ? `https://docs.google.com/document/d/${fakeDocId(seed + "OT")}/edit` : null,
    writtenTestLink: hasWrittenTest ? `https://docs.google.com/forms/d/e/${fakeDocId(seed + "WT")}/viewscore` : null,
    languageTestLink: null,
    fichePedagogique_folder: hasFiche ? fakeFolderId(seed + "FP") : null,
    fichePedagogique_docId: hasFiche ? fakeDocId(seed + "Fiche") : null,
    fichePedagogique_url: hasFiche ? `https://docs.google.com/document/d/${fakeDocId(seed + "Fiche")}/edit` : null,
    ficheName: hasFiche ? `Fiche Pédagogique - ${name} - ${language === "English" ? "Anglais" : language === "Spanish" ? "Espagnol" : "Français"}` : null,
    totalHours,
    completedHours,
    progressPercent,
    lessonCount,
    fiftyPercentAlertSent: fiftyAlert,
    sixtySevenPercentAlertSent: sixtySevenAlert,
    status: "active",
    teacherAssigned: teacher,
    language,
    initialLevel: level,
  };
}

// ===== REAL TEACHER NAMES (from screenshot) =====
const T = {
  megan: "Megan Tierney",
  jennifer: "Jennifer Harbin",
  zafar: "Zafar Matin",
  jessica: "Jessica Morris Macor",
  rachel: "Rachel Hasson",
  lara: "Lara Garcia Novella",
  georgina: "Georgina Couchot",
  isabelle: "Isabelle Nishikawa",
  pascale: "Pascale Albouy",
  alexandra: "Alexandra Gabrielle Billet",
  caroline: "Caroline Aoustin",
  rebecca: "Price Rebecca",
  hannah: "Hannah Lamarque",
};

// ===== STUDENTS (43 entries across all stages) =====
export const demoStudents: Student[] = [
  // --- Completed (6) ---
  makeStudent("s-001", "Bruno Rameaux", "bruno.rameaux@orange.fr", T.jessica, "English", "B1", 60, 60, 100, 40, true, true, true, true, true),
  makeStudent("s-002", "Sophie Durand", "sophie.durand@gmail.com", T.rebecca, "English", "B2", 40, 40, 100, 27, true, true, true, true, true),
  makeStudent("s-003", "Michel Garnier", "michel.garnier@sfr.fr", T.megan, "English", "B1", 30, 30, 100, 20, true, true, true, true, true),
  makeStudent("s-004", "Aurelie Blanc", "aurelie.blanc@gmail.com", T.jennifer, "English", "A2", 20, 20, 100, 14, true, true, true, true, true),
  makeStudent("s-005", "Thierry Collet", "thierry.collet@wanadoo.fr", T.rachel, "English", "B2", 50, 50, 100, 33, true, true, true, true, true),
  makeStudent("s-006", "Sandrine Faure", "sandrine.faure@laposte.net", T.georgina, "English", "C1", 40, 40, 100, 26, true, true, true, true, true),

  // --- In Progress (18) ---
  makeStudent("s-007", "Majda Jabour", "majda.jabour@gmail.com", T.jessica, "English", "A2", 20, 4, 20, 4, true, true, true, false, false),
  makeStudent("s-008", "Lea Gachignard", "lea.gachignard@laposte.net", T.rebecca, "English", "B1", 60, 8, 13, 8, true, true, true, false, false),
  makeStudent("s-009", "Philippe Martin", "philippe.martin@sfr.fr", T.jessica, "English", "B2", 40, 30, 75, 20, true, true, true, true, true),
  makeStudent("s-010", "Carmen Rodriguez", "carmen.rodriguez@hotmail.fr", T.lara, "Spanish", "A2", 30, 12, 40, 10, true, true, false, false, false),
  makeStudent("s-011", "Francois Lemaire", "francois.lemaire@orange.fr", T.megan, "English", "B1", 50, 35, 70, 23, true, true, true, true, true),
  makeStudent("s-012", "Valerie Perrin", "valerie.perrin@gmail.com", T.jennifer, "English", "A2", 40, 10, 25, 8, true, true, true, false, false),
  makeStudent("s-013", "Laurent Boucher", "laurent.boucher@free.fr", T.rachel, "English", "B2", 60, 42, 70, 28, true, true, true, true, true),
  makeStudent("s-014", "Nadia Benali", "nadia.benali@hotmail.fr", T.zafar, "English", "B1", 30, 18, 60, 12, true, true, true, true, false),
  makeStudent("s-015", "Christophe Roux", "christophe.roux@sfr.fr", T.georgina, "English", "C1", 40, 8, 20, 6, true, true, false, false, false),
  makeStudent("s-016", "Marie-Claire Dupont", "mc.dupont@gmail.com", T.isabelle, "English", "B1", 50, 30, 60, 20, true, true, true, true, false),
  makeStudent("s-017", "Yannick Le Gall", "yannick.legall@orange.fr", T.caroline, "English", "A2", 30, 6, 20, 5, true, true, true, false, false),
  makeStudent("s-018", "Sylvie Morel", "sylvie.morel@laposte.net", T.pascale, "English", "B2", 40, 28, 70, 18, true, true, true, true, true),
  makeStudent("s-019", "Dominique Girard", "dominique.girard@free.fr", T.alexandra, "English", "B1", 60, 15, 25, 10, true, true, true, false, false),
  makeStudent("s-020", "Patricia Vidal", "patricia.vidal@gmail.com", T.hannah, "English", "A2", 20, 8, 40, 6, true, true, false, false, false),
  makeStudent("s-021", "Emilio Sanchez", "emilio.sanchez@hotmail.fr", T.lara, "Spanish", "B1", 40, 20, 50, 14, true, true, true, true, false),
  makeStudent("s-022", "Jean-Pierre Arnaud", "jp.arnaud@sfr.fr", T.megan, "English", "B1", 50, 5, 10, 4, true, true, true, false, false),
  makeStudent("s-023", "Celine Marchand", "celine.marchand@gmail.com", T.rebecca, "English", "B2", 30, 22, 73, 15, true, true, true, true, true),
  makeStudent("s-024", "Bertrand Leclerc", "bertrand.leclerc@orange.fr", T.jennifer, "English", "C1", 40, 16, 40, 11, true, true, true, false, false),

  // --- Fiche Created (6) ---
  makeStudent("s-025", "Kevin Leneyle", "kevin.leneyle@gmail.com", T.rebecca, "English", "B1", 40, 0, 0, 0, true, true, true, false, false),
  makeStudent("s-026", "Isabelle Moreau", "isabelle.moreau@outlook.fr", T.lara, "Spanish", "B1", 50, 0, 0, 0, true, true, false, false, false),
  makeStudent("s-027", "Guillaume Fournier", "guillaume.fournier@free.fr", T.zafar, "English", "A2", 30, 0, 0, 0, true, true, true, false, false),
  makeStudent("s-028", "Stephanie Duval", "stephanie.duval@gmail.com", T.rachel, "English", "B2", 40, 0, 0, 0, true, true, false, false, false),
  makeStudent("s-029", "Olivier Mercier", "olivier.mercier@sfr.fr", T.georgina, "English", "B1", 60, 0, 0, 0, true, true, true, false, false),
  makeStudent("s-030", "Helene Picard", "helene.picard@laposte.net", T.caroline, "French", "B1", 30, 0, 0, 0, true, true, false, false, false),

  // --- Oral Test Done (5) ---
  makeStudent("s-031", "Antoine Lefevre", "antoine.lefevre@free.fr", T.jessica, "English", "C1", 60, null, null, null, false, true, false, false, false),
  makeStudent("s-032", "Nathalie Petit", "nathalie.petit@wanadoo.fr", T.rebecca, "French", "B1", 30, null, null, null, false, true, false, false, false),
  makeStudent("s-033", "Thomas Renault", "thomas.renault@gmail.com", T.megan, "English", "B2", 40, null, null, null, false, true, false, false, false),
  makeStudent("s-034", "Veronique Chevalier", "veronique.chevalier@orange.fr", T.isabelle, "English", "A2", 20, null, null, null, false, true, false, false, false),
  makeStudent("s-035", "Sebastien Lambert", "sebastien.lambert@hotmail.fr", T.pascale, "English", "B1", 50, null, null, null, false, true, false, false, false),

  // --- Enrolled (8) ---
  makeStudent("s-036", "Marc Dubois", "marc.dubois@gmail.com", null, "English", null, 40, null, null, null, false, false, false, false, false),
  makeStudent("s-037", "Claire Rousseau", "claire.rousseau@yahoo.fr", null, "English", null, 20, null, null, null, false, false, false, false, false),
  makeStudent("s-038", "Nicolas Bernard", "nicolas.bernard@free.fr", null, "English", null, 60, null, null, null, false, false, false, false, false),
  makeStudent("s-039", "Elise Fontaine", "elise.fontaine@gmail.com", null, "English", null, 30, null, null, null, false, false, false, false, false),
  makeStudent("s-040", "Remi Gauthier", "remi.gauthier@sfr.fr", null, "Spanish", null, 40, null, null, null, false, false, false, false, false),
  makeStudent("s-041", "Camille Prevost", "camille.prevost@laposte.net", null, "English", null, 50, null, null, null, false, false, false, false, false),
  makeStudent("s-042", "Julien Masson", "julien.masson@orange.fr", null, "English", null, 30, null, null, null, false, false, false, false, false),
  makeStudent("s-043", "Margaux Delorme", "margaux.delorme@gmail.com", null, "French", null, 20, null, null, null, false, false, false, false, false),
];

// ===== TEACHERS (14 entries matching real data) =====
export const demoTeachers: Teacher[] = [
  {
    id: "t-001", Name: "Megan Tierney", Email: "megan.tierney@learninggoals.fr", Phone: "+33 6 12 34 56 01",
    Business_Entity: "MT Language Services", SIRET_SIREN_Notes: "123 456 789 00012", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "10 Rue de Siam", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000001",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("meganC")}/edit`, teacherContractSentDate: "2025-12-10",
  },
  {
    id: "t-002", Name: "Jennifer Harbin", Email: "jennifer.harbin@learninggoals.fr", Phone: "+33 6 12 34 56 02",
    Business_Entity: "JH English Training", SIRET_SIREN_Notes: "234 567 890 00023", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "15 Rue Jean Jaurès", City_and_Postal_Code: "29000 Quimper", Country: "France", NDA: "53290000002",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("jenniferC")}/edit`, teacherContractSentDate: "2025-12-12",
  },
  {
    id: "t-003", Name: "Zafar Matin", Email: "zafar.matin@learninggoals.fr", Phone: "+33 6 12 34 56 03",
    Business_Entity: "ZM Formations", SIRET_SIREN_Notes: "345 678 901 00034", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "8 Place de la Liberté", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000003",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("zafarC")}/edit`, teacherContractSentDate: "2025-12-15",
  },
  {
    id: "t-004", Name: "Jessica Morris Macor", Email: "jessica.morris@learninggoals.fr", Phone: "+33 6 12 34 56 04",
    Business_Entity: "JM Language Services", SIRET_SIREN_Notes: "456 789 012 00045", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "22 Rue de Paris", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000004",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("jessicaC")}/edit`, teacherContractSentDate: "2025-12-15",
  },
  {
    id: "t-005", Name: "Rachel Hasson", Email: "rachel.hasson@learninggoals.fr", Phone: "+33 6 12 34 56 05",
    Business_Entity: "RH English Academy", SIRET_SIREN_Notes: "567 890 123 00056", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "5 Avenue Clemenceau", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000005",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("rachelC")}/edit`, teacherContractSentDate: "2025-12-18",
  },
  {
    id: "t-006", Name: "Lara Garcia Novella", Email: "lara.garcia@learninggoals.fr", Phone: "+33 6 12 34 56 06",
    Business_Entity: "LGN Langues", SIRET_SIREN_Notes: "678 901 234 00067", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "12 Rue Voltaire", City_and_Postal_Code: "44000 Nantes", Country: "France", NDA: "52440000001",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("laraC")}/edit`, teacherContractSentDate: "2026-01-05",
  },
  {
    id: "t-007", Name: "Georgina Couchot", Email: "georgina.couchot@learninggoals.fr", Phone: "+33 6 12 34 56 07",
    Business_Entity: "GC Formation", SIRET_SIREN_Notes: "789 012 345 00078", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "3 Rue du Château", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000006",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("georginaC")}/edit`, teacherContractSentDate: "2026-01-08",
  },
  {
    id: "t-008", Name: "Isabelle Nishikawa", Email: "isabelle.nishikawa@learninggoals.fr", Phone: "+33 6 12 34 56 08",
    Business_Entity: "IN English Pro", SIRET_SIREN_Notes: "890 123 456 00089", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "17 Boulevard Montaigne", City_and_Postal_Code: "35000 Rennes", Country: "France", NDA: "53350000001",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("isabelleNC")}/edit`, teacherContractSentDate: "2026-01-10",
  },
  {
    id: "t-009", Name: "Pascale Albouy", Email: "pascale.albouy@learninggoals.fr", Phone: "+33 6 12 34 56 09",
    Business_Entity: "PA Formations Langues", SIRET_SIREN_Notes: "901 234 567 00090", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "25 Rue de la Gare", City_and_Postal_Code: "56000 Vannes", Country: "France", NDA: "53560000001",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("pascaleC")}/edit`, teacherContractSentDate: "2026-01-12",
  },
  {
    id: "t-010", Name: "Alexandra Gabrielle Billet", Email: "alexandra.billet@learninggoals.fr", Phone: "+33 6 12 34 56 10",
    Business_Entity: "AGB Langues", SIRET_SIREN_Notes: "012 345 678 00001", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "9 Place Wilson", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000007",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("alexandraC")}/edit`, teacherContractSentDate: "2026-01-15",
  },
  {
    id: "t-011", Name: "Caroline Aoustin", Email: "caroline.aoustin@learninggoals.fr", Phone: "+33 6 12 34 56 11",
    Business_Entity: "CA English Solutions", SIRET_SIREN_Notes: "112 345 678 00012", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "6 Rue du Port", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000008",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("carolineC")}/edit`, teacherContractSentDate: "2026-01-18",
  },
  {
    id: "t-012", Name: "Price Rebecca", Email: "rebecca.price@learninggoals.fr", Phone: "+33 6 12 34 56 12",
    Business_Entity: "RP English Training", SIRET_SIREN_Notes: "223 456 789 00023", CERTIFIE_OU_NON_CERTIFIE: "Certifié",
    Address: "8 Avenue Victor Hugo", City_and_Postal_Code: "29200 Brest", Country: "France", NDA: "53290000009",
    teacherContractStatus: "Signed", teacherContractURL: `https://docs.google.com/document/d/${fakeDocId("rebeccaC")}/edit`, teacherContractSentDate: "2025-12-20",
  },
  {
    id: "t-013", Name: "Hannah Lamarque", Email: "hannah.lamarque@learninggoals.fr", Phone: "+33 6 12 34 56 13",
    Business_Entity: null, SIRET_SIREN_Notes: null, CERTIFIE_OU_NON_CERTIFIE: "Non certifié",
    Address: "5 Place de la République", City_and_Postal_Code: "35000 Rennes", Country: "France", NDA: null,
    teacherContractStatus: null, teacherContractURL: null, teacherContractSentDate: null,
  },
];

// ===== PROGRESS RECORDS =====
export const demoProgress: ProgressRecord[] = [
  // Completed
  { id: "p-001", studentEmail: "bruno.rameaux@orange.fr", studentName: "Bruno Rameaux", ficheName: "Fiche Pédagogique - Bruno Rameaux - Anglais", totalHours: 60, completedHours: 60, progressPercent: 100, lessonCount: 40, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-10", status: "completed" },
  { id: "p-002", studentEmail: "sophie.durand@gmail.com", studentName: "Sophie Durand", ficheName: "Fiche Pédagogique - Sophie Durand - Anglais", totalHours: 40, completedHours: 40, progressPercent: 100, lessonCount: 27, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-05", status: "completed" },
  { id: "p-003", studentEmail: "michel.garnier@sfr.fr", studentName: "Michel Garnier", ficheName: "Fiche Pédagogique - Michel Garnier - Anglais", totalHours: 30, completedHours: 30, progressPercent: 100, lessonCount: 20, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-02-28", status: "completed" },
  { id: "p-004", studentEmail: "aurelie.blanc@gmail.com", studentName: "Aurelie Blanc", ficheName: "Fiche Pédagogique - Aurelie Blanc - Anglais", totalHours: 20, completedHours: 20, progressPercent: 100, lessonCount: 14, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-15", status: "completed" },
  // In Progress
  { id: "p-005", studentEmail: "majda.jabour@gmail.com", studentName: "Majda Jabour", ficheName: "Fiche Pédagogique - Majda Jabour - Anglais", totalHours: 20, completedHours: 4, progressPercent: 20, lessonCount: 4, fiftyPercentAlertSent: false, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-18", status: "active" },
  { id: "p-006", studentEmail: "lea.gachignard@laposte.net", studentName: "Lea Gachignard", ficheName: "Fiche Pédagogique - Lea Gachignard - Anglais", totalHours: 60, completedHours: 8, progressPercent: 13, lessonCount: 8, fiftyPercentAlertSent: false, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-20", status: "active" },
  { id: "p-007", studentEmail: "philippe.martin@sfr.fr", studentName: "Philippe Martin", ficheName: "Fiche Pédagogique - Philippe Martin - Anglais", totalHours: 40, completedHours: 30, progressPercent: 75, lessonCount: 20, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-22", status: "active" },
  { id: "p-008", studentEmail: "carmen.rodriguez@hotmail.fr", studentName: "Carmen Rodriguez", ficheName: "Fiche Pédagogique - Carmen Rodriguez - Espagnol", totalHours: 30, completedHours: 12, progressPercent: 40, lessonCount: 10, fiftyPercentAlertSent: false, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-19", status: "active" },
  { id: "p-009", studentEmail: "francois.lemaire@orange.fr", studentName: "Francois Lemaire", ficheName: "Fiche Pédagogique - Francois Lemaire - Anglais", totalHours: 50, completedHours: 35, progressPercent: 70, lessonCount: 23, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-21", status: "active" },
  { id: "p-010", studentEmail: "valerie.perrin@gmail.com", studentName: "Valerie Perrin", ficheName: "Fiche Pédagogique - Valerie Perrin - Anglais", totalHours: 40, completedHours: 10, progressPercent: 25, lessonCount: 8, fiftyPercentAlertSent: false, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-17", status: "active" },
  { id: "p-011", studentEmail: "laurent.boucher@free.fr", studentName: "Laurent Boucher", ficheName: "Fiche Pédagogique - Laurent Boucher - Anglais", totalHours: 60, completedHours: 42, progressPercent: 70, lessonCount: 28, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-23", status: "active" },
  { id: "p-012", studentEmail: "nadia.benali@hotmail.fr", studentName: "Nadia Benali", ficheName: "Fiche Pédagogique - Nadia Benali - Anglais", totalHours: 30, completedHours: 18, progressPercent: 60, lessonCount: 12, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-20", status: "active" },
  { id: "p-013", studentEmail: "mc.dupont@gmail.com", studentName: "Marie-Claire Dupont", ficheName: "Fiche Pédagogique - Marie-Claire Dupont - Anglais", totalHours: 50, completedHours: 30, progressPercent: 60, lessonCount: 20, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-22", status: "active" },
  { id: "p-014", studentEmail: "sylvie.morel@laposte.net", studentName: "Sylvie Morel", ficheName: "Fiche Pédagogique - Sylvie Morel - Anglais", totalHours: 40, completedHours: 28, progressPercent: 70, lessonCount: 18, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-21", status: "active" },
  { id: "p-015", studentEmail: "emilio.sanchez@hotmail.fr", studentName: "Emilio Sanchez", ficheName: "Fiche Pédagogique - Emilio Sanchez - Espagnol", totalHours: 40, completedHours: 20, progressPercent: 50, lessonCount: 14, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-19", status: "active" },
  { id: "p-016", studentEmail: "celine.marchand@gmail.com", studentName: "Celine Marchand", ficheName: "Fiche Pédagogique - Celine Marchand - Anglais", totalHours: 30, completedHours: 22, progressPercent: 73, lessonCount: 15, fiftyPercentAlertSent: true, sixtySevenPercentAlertSent: true, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: "2026-03-23", status: "active" },
  // Fiche Created (0 progress)
  { id: "p-017", studentEmail: "kevin.leneyle@gmail.com", studentName: "Kevin Leneyle", ficheName: "Fiche Pédagogique - Kevin Leneyle - Anglais", totalHours: 40, completedHours: 0, progressPercent: 0, lessonCount: 0, fiftyPercentAlertSent: false, sixtySevenPercentAlertSent: false, eightyPercentAlertSent: false, staleAlertSent: false, lastCheckDate: "2026-03-24", lastLessonDate: null, status: "active" },
];

// ===== CONTRACTS (teacher contracts) =====
export const demoContracts: Contract[] = [
  { id: "c-001", Contract_name: "Contrat_Enseignant_Jessica_Morris_Macor_Bruno_Rameaux_15-12-2025", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c1")}/edit`, teacherName: "Jessica Morris Macor Bruno Rameaux", studentName: "", date: "15-12-2025" },
  { id: "c-002", Contract_name: "Contrat_Enseignant_Jessica_Morris_Macor_Majda_Jabour_15-12-2025", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c2")}/edit`, teacherName: "Jessica Morris Macor Majda Jabour", studentName: "", date: "15-12-2025" },
  { id: "c-003", Contract_name: "Contrat_Enseignant_Price_Rebecca_Sophie_Durand_20-12-2025", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c3")}/edit`, teacherName: "Price Rebecca Sophie Durand", studentName: "", date: "20-12-2025" },
  { id: "c-004", Contract_name: "Contrat_Enseignant_Price_Rebecca_Kevin_Leneyle_05-01-2026", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c4")}/edit`, teacherName: "Price Rebecca Kevin Leneyle", studentName: "", date: "05-01-2026" },
  { id: "c-005", Contract_name: "Contrat_Enseignant_Megan_Tierney_Francois_Lemaire_10-01-2026", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c5")}/edit`, teacherName: "Megan Tierney Francois Lemaire", studentName: "", date: "10-01-2026" },
  { id: "c-006", Contract_name: "Contrat_Enseignant_Lara_Garcia_Novella_Carmen_Rodriguez_15-01-2026", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c6")}/edit`, teacherName: "Lara Garcia Novella Carmen Rodriguez", studentName: "", date: "15-01-2026" },
  { id: "c-007", Contract_name: "Contrat_Enseignant_Rachel_Hasson_Laurent_Boucher_18-01-2026", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c7")}/edit`, teacherName: "Rachel Hasson Laurent Boucher", studentName: "", date: "18-01-2026" },
  { id: "c-008", Contract_name: "Contrat_Enseignant_Jennifer_Harbin_Valerie_Perrin_20-01-2026", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c8")}/edit`, teacherName: "Jennifer Harbin Valerie Perrin", studentName: "", date: "20-01-2026" },
  { id: "c-009", Contract_name: "Contrat_Enseignant_Georgina_Couchot_Christophe_Roux_22-01-2026", Contract_url: `https://docs.google.com/document/d/${fakeDocId("c9")}/edit`, teacherName: "Georgina Couchot Christophe Roux", studentName: "", date: "22-01-2026" },
];

// ===== PENDING CONTRACTS (awaiting Lily's approval) =====
export const demoPendingContracts: PendingContract[] = [
  {
    id: "pc-001", studentName: "Antoine Lefevre", studentEmail: "antoine.lefevre@free.fr",
    teacherName: "Jessica Morris Macor", teacherEmail: "jessica.morris@learninggoals.fr",
    contractType: "student", contractDocId: fakeDocId("antoineContract"),
    contractDocUrl: `https://docs.google.com/document/d/${fakeDocId("antoineContract")}/edit`,
    conventionDocUrl: `https://docs.google.com/document/d/${fakeDocId("antoineConvention")}/edit`,
    convocationDocUrl: `https://docs.google.com/document/d/${fakeDocId("antoineConvocation")}/edit`,
    programmeDocUrl: `https://docs.google.com/document/d/${fakeDocId("antoineProgramme")}/edit`,
    examGuideDocId: null, studentFolderId: fakeFolderId("antoineL"),
    status: "Draft", generatedAt: "2026-03-22T14:30:00Z", sentAt: null, signedAt: null,
    language: "English", totalHours: 60, paymentAmount: 3600,
    oralTestLink: `https://docs.google.com/document/d/${fakeDocId("antoineOT")}/edit`, languageTestLink: null,
  },
  {
    id: "pc-002", studentName: "Nathalie Petit", studentEmail: "nathalie.petit@wanadoo.fr",
    teacherName: "Price Rebecca", teacherEmail: "rebecca.price@learninggoals.fr",
    contractType: "student", contractDocId: fakeDocId("nathalieContract"),
    contractDocUrl: `https://docs.google.com/document/d/${fakeDocId("nathalieContract")}/edit`,
    conventionDocUrl: `https://docs.google.com/document/d/${fakeDocId("nathalieConvention")}/edit`,
    convocationDocUrl: null,
    programmeDocUrl: `https://docs.google.com/document/d/${fakeDocId("nathalieProgramme")}/edit`,
    examGuideDocId: null, studentFolderId: fakeFolderId("nathalieP"),
    status: "Awaiting Signature", generatedAt: "2026-03-18T09:15:00Z", sentAt: "2026-03-18T10:00:00Z", signedAt: null,
    language: "French", totalHours: 30, paymentAmount: 1800,
    oralTestLink: `https://docs.google.com/document/d/${fakeDocId("nathalieOT")}/edit`, languageTestLink: null,
  },
  {
    id: "pc-003", studentName: "Marc Dubois", studentEmail: "marc.dubois@gmail.com",
    teacherName: "Megan Tierney", teacherEmail: "megan.tierney@learninggoals.fr",
    contractType: "student", contractDocId: fakeDocId("marcContract"),
    contractDocUrl: `https://docs.google.com/document/d/${fakeDocId("marcContract")}/edit`,
    conventionDocUrl: null, convocationDocUrl: null, programmeDocUrl: null,
    examGuideDocId: null, studentFolderId: fakeFolderId("marcD"),
    status: "Draft", generatedAt: "2026-03-23T16:45:00Z", sentAt: null, signedAt: null,
    language: "English", totalHours: 40, paymentAmount: 2400,
    oralTestLink: null, languageTestLink: null,
  },
];

// ===== PENDING ORAL TEST QUEUE =====
export const demoPending: PendingRecord[] = [
  {
    id: "pq-001", studentEmail: "antoine.lefevre@free.fr", studentName: "Antoine Lefevre",
    oralTestTimestamp: "2026-03-22T14:00:00Z", oralTestData: '{"level":"C1","language":"English","examType":"TOEIC"}',
    retryCount: 2, lastRetryAt: "2026-03-23T08:00:00Z", status: "pending", alertSent: false,
    oralTestDocUrl: `https://docs.google.com/document/d/${fakeDocId("antoineOT")}/edit`,
    language: "English", initial_level: "C1", test_date: "2026-03-22",
    trainingStartDate: "2026-04-01", trainingEndDate: "2026-09-30", totalHours: 60, examType: "TOEIC",
    personalized_objectives: "Renforcer les compétences en communication professionnelle, préparer le TOEIC avec objectif 850+, améliorer la fluidité en réunion et présentations.",
    trainingType: "CPF",
  },
  {
    id: "pq-002", studentEmail: "claire.rousseau@yahoo.fr", studentName: "Claire Rousseau",
    oralTestTimestamp: "2026-03-23T10:30:00Z", oralTestData: '{"level":"A2","language":"English","examType":"CLOE"}',
    retryCount: 1, lastRetryAt: "2026-03-23T11:00:00Z", status: "pending", alertSent: false,
    oralTestDocUrl: `https://docs.google.com/document/d/${fakeDocId("claireOT")}/edit`,
    language: "English", initial_level: "A2", test_date: "2026-03-23",
    trainingStartDate: "2026-04-15", trainingEndDate: "2026-07-15", totalHours: 20, examType: "CLOE",
    personalized_objectives: "Acquérir les bases de l'anglais professionnel, vocabulaire du secteur commercial, rédaction d'emails simples.",
    trainingType: "CPF",
  },
];

// ===== VEILLE QUALIOPI =====
export const demoVeille: VeilleData = {
  entries: [
    { id: "v-001", date: "2026-03-20", source: "Légifrance", sourceUrl: "https://www.legifrance.gouv.fr", indicateur: "23", category: "Réforme CPF", summary: "Mise à jour des conditions de prise en charge CPF pour les formations linguistiques professionnelles. Nouveaux critères de reste à charge applicables au 1er mai 2026.", actionTaken: "Mis à jour les modèles de convention et contrats pour refléter les nouvelles conditions de financement CPF.", status: "Approved", evidenceLink: `https://docs.google.com/document/d/${fakeDocId("veille1")}/edit`, addedBy: "Manual", approvedDate: "2026-03-21" },
    { id: "v-002", date: "2026-03-15", source: "France Compétences", sourceUrl: "https://www.francecompetences.fr", indicateur: "23", category: "Qualiopi RNQ", summary: "Publication du nouveau guide de lecture du RNQ v8 — clarifications sur les indicateurs 1, 5, et 22 concernant la personnalisation des parcours.", actionTaken: "Vérifié la conformité de nos fiches pédagogiques avec les nouvelles clarifications.", status: "Approved", evidenceLink: null, addedBy: "Manual", approvedDate: "2026-03-16" },
    { id: "v-003", date: "2026-03-10", source: "ETS Global", sourceUrl: "https://www.etsglobal.org", indicateur: "24", category: "Certifications linguistiques", summary: "Annonce de la mise à jour du format TOEIC Listening & Reading pour 2026 — nouvelles sections d'écoute avec accents variés, durée identique.", actionTaken: "Préparation de fiches de pratique actualisées pour les étudiants TOEIC. Mis à jour les liens de tests blancs dans les fiches pédagogiques.", status: "Approved", evidenceLink: `https://docs.google.com/document/d/${fakeDocId("veille3")}/edit`, addedBy: "Manual", approvedDate: "2026-03-12" },
    { id: "v-004", date: "2026-03-05", source: "EdTech Magazine", sourceUrl: "https://www.edtechmagazine.com", indicateur: "25", category: "IA et pédagogie", summary: "Déploiement d'un système d'automatisation n8n pour la gestion administrative : création automatique de fiches pédagogiques, suivi de progression par IA (Gemini), tableau de bord temps réel.", actionTaken: "Système opérationnel — 20+ workflows actifs couvrant l'ensemble du cycle étudiant. Preuve concrète de veille technologique et d'adoption de l'IA dans la pratique pédagogique.", status: "Approved", evidenceLink: "https://dashboard-psi-five-93.vercel.app", addedBy: "Auto", approvedDate: "2026-03-06" },
    { id: "v-005", date: "2026-02-25", source: "Ministère du Travail", sourceUrl: "https://travail-emploi.gouv.fr", indicateur: "23", category: "Droit du travail", summary: "Nouvelle obligation de déclaration SIRET pour les sous-traitants en formation professionnelle à compter du 1er avril 2026.", actionTaken: "Vérifié que tous les contrats enseignants incluent déjà le numéro SIRET. Conformité assurée.", status: "Approved", evidenceLink: null, addedBy: "Manual", approvedDate: "2026-02-26" },
    { id: "v-006", date: "2026-03-22", source: "Cambridge English", sourceUrl: "https://www.cambridgeenglish.org", indicateur: "24", category: "Méthodologie d'évaluation", summary: "Nouvelles recommandations pour l'évaluation des compétences orales en anglais professionnel — grilles d'évaluation CECRL actualisées.", actionTaken: null, status: "Draft", evidenceLink: null, addedBy: "Manual", approvedDate: null },
  ],
  metrics: {
    readinessScore: 78,
    lastEntryDates: { "23": "2026-03-20", "24": "2026-03-22", "25": "2026-03-05" },
    countByIndicator: { "23": 3, "24": 2, "25": 1 },
  },
};

// ===== TEACHER VIEW (for teacher portal) =====
export function getDemoTeacherView(email: string): TeacherViewData {
  const teacher = demoTeachers.find(
    (t) => t.Email.toLowerCase() === email.toLowerCase()
  );
  if (!teacher) {
    return {
      teacher: { name: "", email: "", phone: "", contractStatus: null, contractUrl: null, certified: null },
      students: [], alerts: [],
      error: "Teacher not found",
    };
  }

  const teacherStudents = demoStudents
    .filter((s) => s.teacherAssigned === teacher.Name)
    .map((s) => ({
      studentFolderName: s.studentFolderName, email: s.email, language: s.language,
      initialLevel: s.initialLevel, totalHours: s.totalHours ?? 0,
      completedHours: s.completedHours ?? 0, progressPercent: s.progressPercent ?? 0,
      lessonCount: s.lessonCount ?? 0, ficheUrl: s.fichePedagogique_url,
      fiftyPercentAlert: s.fiftyPercentAlertSent, sixtySevenPercentAlert: s.sixtySevenPercentAlertSent,
    }));

  const alerts: { studentName: string; alertType: string }[] = [];
  if (teacher.Name === T.jessica) {
    alerts.push({ studentName: "Philippe Martin", alertType: "67% - Exam Registration" });
  }

  return {
    teacher: {
      name: teacher.Name, email: teacher.Email, phone: teacher.Phone,
      contractStatus: teacher.teacherContractStatus, contractUrl: teacher.teacherContractURL,
      certified: teacher.CERTIFIE_OU_NON_CERTIFIE,
    },
    students: teacherStudents, alerts,
  };
}

// ===== STUDENT PROFILE (for modal) =====
export function getDemoStudentProfile(email: string): Record<string, string | null> {
  const profiles: Record<string, Record<string, string | null>> = {
    "bruno.rameaux@orange.fr": {
      "Prénom et Nom": "Bruno Rameaux", "Email Address": "bruno.rameaux@orange.fr",
      "Adresse": "12 Rue des Lilas, 29200 Brest", "Langue souhaitée": "Anglais",
      "Date de début de la formation": "01/09/2025", "Date de fin de formation": "28/02/2026",
      "Durée de la formation/nombre d'heures souhaitées": "60", "Nombre d'heures souhaitées par semaine": "3",
      "Frais de formation": "3600€", "Type d'éxamen TOEIC/CLOE": "TOEIC",
      "Type de formation": "CPF", "Timestamp": "2025-08-15T10:30:00Z",
    },
    "majda.jabour@gmail.com": {
      "Prénom et Nom": "Majda Jabour", "Email Address": "majda.jabour@gmail.com",
      "Adresse": "5 Avenue de la Liberté, 29000 Quimper", "Langue souhaitée": "Anglais",
      "Date de début de la formation": "01/02/2026", "Date de fin de formation": "30/04/2026",
      "Durée de la formation/nombre d'heures souhaitées": "20", "Nombre d'heures souhaitées par semaine": "2",
      "Frais de formation": "1200€", "Type d'éxamen TOEIC/CLOE": "CLOE",
      "Type de formation": "CPF", "Timestamp": "2026-01-10T14:00:00Z",
    },
    "philippe.martin@sfr.fr": {
      "Prénom et Nom": "Philippe Martin", "Email Address": "philippe.martin@sfr.fr",
      "Adresse": "33 Boulevard Gambetta, 56000 Vannes", "Langue souhaitée": "Anglais",
      "Date de début de la formation": "15/10/2025", "Date de fin de formation": "15/04/2026",
      "Durée de la formation/nombre d'heures souhaitées": "40", "Nombre d'heures souhaitées par semaine": "2",
      "Frais de formation": "2400€", "Type d'éxamen TOEIC/CLOE": "TOEIC",
      "Type de formation": "CPF", "Timestamp": "2025-10-01T09:00:00Z",
    },
    "carmen.rodriguez@hotmail.fr": {
      "Prénom et Nom": "Carmen Rodriguez", "Email Address": "carmen.rodriguez@hotmail.fr",
      "Adresse": "18 Rue Jean Jaurès, 44000 Nantes", "Langue souhaitée": "Espagnol",
      "Date de début de la formation": "01/01/2026", "Date de fin de formation": "30/06/2026",
      "Durée de la formation/nombre d'heures souhaitées": "30", "Nombre d'heures souhaitées par semaine": "2",
      "Frais de formation": "1800€", "Type d'éxamen TOEIC/CLOE": "V-Test",
      "Type de formation": "CPF", "Timestamp": "2025-12-05T11:30:00Z",
    },
  };
  return profiles[email.toLowerCase()] || { error: `No profile found for ${email}` };
}

// ===== DEMO MESSAGES =====
export const demoMessages: Message[] = [
  { id: "msg-1", createdAt: "2026-03-25T10:00:00Z", senderName: "Lily Riou", senderEmail: "learninggoalsformations@gmail.com", senderRole: "admin", recipientType: "all", recipientName: "", recipientEmail: "", subject: "Mise à jour des horaires — Semaine 14", body: "Bonjour à tous,\n\nVeuillez noter que les cours du lundi 31 mars seront décalés de 30 minutes. Merci de prévenir vos élèves.\n\nCordialement,\nLily", category: "schedule_change", studentContext: "" },
  { id: "msg-2", createdAt: "2026-03-24T14:30:00Z", senderName: "Lily Riou", senderEmail: "learninggoalsformations@gmail.com", senderRole: "admin", recipientType: "teacher", recipientName: "Megan Tierney", recipientEmail: "megan.tierney@email.com", subject: "Devoirs Bruno Rameaux", body: "Bonjour Megan,\n\nPourriez-vous préparer un exercice supplémentaire pour Bruno ? Il a besoin de renforcement en grammaire.\n\nMerci !", category: "homework", studentContext: "Bruno Rameaux" },
  { id: "msg-3", createdAt: "2026-03-23T09:15:00Z", senderName: "Lily Riou", senderEmail: "learninggoalsformations@gmail.com", senderRole: "admin", recipientType: "teacher", recipientName: "Jennifer Harbin", recipientEmail: "jennifer.harbin@email.com", subject: "Nouveau matériel pédagogique disponible", body: "Bonjour Jennifer,\n\nDe nouveaux supports de cours sont disponibles sur le Drive partagé. N'hésitez pas à les utiliser pour vos prochaines sessions.\n\nBonne journée !", category: "class_update", studentContext: "" },
  { id: "msg-4", createdAt: "2026-03-22T16:00:00Z", senderName: "Lily Riou", senderEmail: "learninggoalsformations@gmail.com", senderRole: "admin", recipientType: "all", recipientName: "", recipientEmail: "", subject: "Rappel — Fiches pédagogiques à jour", body: "Bonjour,\n\nMerci de vérifier que toutes vos fiches pédagogiques sont à jour avant la fin du mois. C'est important pour notre conformité Qualiopi.\n\nMerci de votre coopération.", category: "general", studentContext: "" },
  { id: "msg-5", createdAt: "2026-03-20T11:45:00Z", senderName: "Lily Riou", senderEmail: "learninggoalsformations@gmail.com", senderRole: "admin", recipientType: "teacher", recipientName: "Zafar Matin", recipientEmail: "zafar.matin@email.com", subject: "Session annulée — Majda Jabour", body: "Bonjour Zafar,\n\nLa session de Majda Jabour prévue vendredi est annulée. Merci de reporter à la semaine prochaine.\n\nCordialement,\nLily", category: "schedule_change", studentContext: "Majda Jabour" },
];

// ===== DEMO MODE CHECK =====
// Set to true to enable demo mode with mock data (bypasses n8n API calls)
export const DEMO_MODE = false;
