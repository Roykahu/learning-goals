---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - standalone_teacher_contract_workflow.json
  - dashboard/src/components/pending-contracts.tsx
  - dashboard/src/app/api/contracts/generate-teacher/route.ts
  - dashboard/src/lib/api.ts
autonomous: false
requirements: [TC-WORKFLOW, TC-DASHBOARD, TC-CLEANUP, TC-GENERATE]

must_haves:
  truths:
    - "POST /generate-teacher-contracts webhook accepts studentEmail and generates teacher contracts"
    - "Each teacher gets an isolated contract document with correct placeholders filled"
    - "Teacher contracts appear as Draft rows in Pending Contracts DT with contractType=teacher"
    - "Dashboard has Generate Teacher Contracts button that triggers the workflow per student"
    - "Data issues fixed: Hannah newline, Fares wrong contracts deleted, Raphael email aligned"
    - "4 waiting students have their teacher contracts generated"
  artifacts:
    - path: "n8n workflow (deployed via API)"
      provides: "Standalone teacher contract generation"
    - path: "dashboard/src/app/api/contracts/generate-teacher/route.ts"
      provides: "Dashboard API proxy to n8n webhook"
    - path: "dashboard/src/components/pending-contracts.tsx"
      provides: "Generate button in pending contracts UI"
    - path: "dashboard/src/lib/api.ts"
      provides: "generateTeacherContracts() client function"
  key_links:
    - from: "pending-contracts.tsx"
      to: "/api/contracts/generate-teacher"
      via: "fetch POST with studentEmail"
      pattern: "fetch.*api/contracts/generate-teacher"
    - from: "/api/contracts/generate-teacher/route.ts"
      to: "n8n webhook /generate-teacher-contracts"
      via: "server-side fetch forwarding"
      pattern: "fetch.*webhook.*generate-teacher-contracts"
    - from: "n8n workflow"
      to: "Pending Contracts DT ab7d375L1CabAJYs"
      via: "DT upsert node"
---

<objective>
Build a standalone n8n workflow for teacher contract generation that bypasses the broken splitInBatches loop in the main onboarding workflow, add a dashboard button to trigger it, clean up known data issues, and generate contracts for 4 waiting students.

Purpose: The main onboarding workflow's splitInBatches causes cross-iteration data contamination (Kelly gets 0 teacher contracts, Fares gets wrong teacher). A standalone webhook-triggered workflow isolates each teacher in batch=1 loops, solving this permanently.

Output: Deployed n8n workflow, updated dashboard with generate button, clean data, 4 students' teacher contracts generated.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@C:\Users\ROY\.claude\plans\hazy-mapping-hoare.md

Source files:
@dashboard/src/components/pending-contracts.tsx
@dashboard/src/app/api/contracts/approve/route.ts (pattern reference)
@dashboard/src/lib/api.ts
@dashboard/src/lib/types.ts

Backup workflow (reference for node JSON structure):
@workflow_Ec1G5smZxBAkjc5N_backup_20260411.json

<interfaces>
<!-- Key types and contracts the executor needs -->

From dashboard/src/lib/types.ts:
```typescript
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
```

From dashboard/src/app/api/contracts/approve/route.ts (auth pattern):
```typescript
// Admin auth pattern: read dashboard_auth cookie, parse JSON, check role === "admin"
const authCookie = request.cookies.get("dashboard_auth");
const auth = JSON.parse(authCookie.value);
if (auth.role !== "admin") { /* 403 */ }
// Forward POST to n8n webhook with body
```

From dashboard/src/lib/api.ts (webhook base pattern):
```typescript
const WEBHOOK_BASE = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "https://learninggoalsformations.app.n8n.cloud/webhook";
```

n8n credential IDs (for workflow JSON):
- Google Drive: `ddziMFrcb3ADiTuG`
- Google Docs: `2hdoXcE8Mfr07xZt`
- Google Sheets: `iqB69W5BJDamQkKG`
- Gmail: `L9LfPs5b5L94iJ5b`

n8n Data Table IDs:
- Teacher DT: `FcvkzNqw3ghOOF99`
- Pending Contracts DT: `ab7d375L1CabAJYs`
- Oral Test Queue DT: `4vsQNiZCwFdDM1KB`
- CRM Sheet: `16t8R4NxPqECmpawN0AogN719FPMiXGLWS9qH-so34gA` (tab: "Form Responses 1")
- Contract Template: `1Bm2KxOoiY1cY1m0Rktr3ovqVWy7JIEzXx0KXuGYZ2TI`
- Contract Output Folder: `1KqdTi7p__WCDdTV5oJfU7L5itjZ9ksC0`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build and deploy standalone teacher contract n8n workflow</name>
  <files>standalone_teacher_contract_workflow.json (local reference, deployed to n8n cloud)</files>
  <action>
Build an n8n workflow JSON and deploy it via the n8n REST API. The workflow is triggered by POST webhook `/generate-teacher-contracts` with body `{ studentEmail }`.

**CRITICAL CONSTRAINTS:**
- Use Code nodes for ALL conditional logic (NO IF nodes -- they break when deployed via API)
- Loop Over Items with batch size 1 for teacher isolation (prevents cross-contamination)
- All credentials referenced by ID in the JSON, NOT by name
- All nodes must have `onError: "continueRegularOutput"` and `alwaysOutputData: true` in settings for error resilience

**Workflow nodes (in execution order):**

1. **Webhook** (n8n-nodes-base.webhook): POST path `/generate-teacher-contracts`, responseMode `lastNode`. Receives `{ studentEmail }`.

2. **Read CRM** (n8n-nodes-base.googleSheets): Read sheet `16t8R4NxPqECmpawN0AogN719FPMiXGLWS9qH-so34gA`, tab "Form Responses 1". Use Google Sheets credential `iqB69W5BJDamQkKG`. Filter by matching email column to `{{ $json.body.studentEmail }}`. Extract: fullName, language, totalHours, tarifHoraire, volumeHoraire, pourcentage, teacherName, startDate, endDate.

3. **Read Oral Test Queue** (n8n-nodes-base.dataTable): Read DT `4vsQNiZCwFdDM1KB` filtered by studentEmail. Get training dates, hours, level if available. This is optional -- if no match, continue with CRM data only.

4. **Split Teachers** (n8n-nodes-base.code): Code node using the teacher name mapping table. Input is the raw teacherName field from CRM. The exact mapping table (copy from backup workflow node 24):
```javascript
const teacherMap = [
  { key: "Megan Tierney", dbName: "Megan Tierney" },
  { key: "Jennifer Harbin", dbName: "Jennifer Harbin" },
  { key: "Jessica ParisMix", dbName: "Jessica Morris Macor" },
  { key: "Rachel Hasson", dbName: "Rachel Hasson" },
  { key: "LLE Lara langues", dbName: "Lara Garcia Novella" },
  { key: "GEORGINA COUCHOT", dbName: "Georgina Couchot" },
  { key: "NISHIKAWA ISABELLE", dbName: "Isabelle Nishikawa" },
  { key: "Pascale Albouy", dbName: "Pascale Albouy" },
  { key: "Mme Alexandra Gabrielle Billet", dbName: "Alexandra Gabrielle Billet" },
  { key: "Caroline Aoustin", dbName: "Caroline Aoustin" },
  { key: "M Z MATIN", dbName: "Zafar Matin" },
  { key: "PRICE REBECCA", dbName: "PRICE REBECCA" },
  { key: "LAMARQUE, Hannah", dbName: "Hannah Lamarque" }
];
```
Scans the raw string for each key, outputs one item per matched teacher with cleanedTeacherName + all student data passed through. Falls back to single item with `cleanedTeacherName: null` if no match.

5. **Loop Over Items** (n8n-nodes-base.splitInBatches): batch size 1, ONLY processes items where cleanedTeacherName is not null.

6. **Lookup Teacher** (n8n-nodes-base.dataTable): Read DT `FcvkzNqw3ghOOF99` filtered by `Name = cleanedTeacherName`. Gets Email, Address, City_and_Postal_Code, Country, NDA, SIRET_SIREN_Notes, CERTIFIE_OU_NON_CERTIFIE.

7. **Prepare Contract Data** (n8n-nodes-base.code): Compute all derived fields:
   - `teacherAddress` = concat(Address, City_and_Postal_Code, Country)
   - `payment` = tarifHoraire * volumeHoraire (as string with 2 decimals)
   - `contractFileName` = `Contrat_Enseignant_{safe(teacherName)}_{safe(studentName)}_{date}`
   - `todayDate` = DD/MM/YYYY format
   - `teacherEmail` = first email if semicolon-separated
   - `startDateFormatted`, `endDateFormatted` from CRM or oral test data

8. **Copy Template** (n8n-nodes-base.googleDrive): Copy file `1Bm2KxOoiY1cY1m0Rktr3ovqVWy7JIEzXx0KXuGYZ2TI` to folder `1KqdTi7p__WCDdTV5oJfU7L5itjZ9ksC0` with computed contractFileName. Credential: `ddziMFrcb3ADiTuG`.

9. **Fill Placeholders** (n8n-nodes-base.googleDocs): Update the copied doc with all 16 replacements (exact placeholder text from the backup workflow node 20):
   - `<<Nom du sous-traitant>>` -> teacherName
   - `<<adresse>>` -> teacherAddress
   - `<<langue>>` -> language
   - `<<nom de stagiaire>>` -> studentName
   - `<<MONTANT>>` -> payment
   - `<<date>>` -> todayDate
   - `<<Nom de formateur>>` -> teacherName
   - `<<NUMERO_NDA>>` -> NDA or "N/A"
   - `<<SIRET_FORMATEUR>>` -> SIRET_SIREN_Notes
   - `<<CERTIFIE_OU_NON_CERTIFIE>>` -> certification status
   - `<<heures>>` -> volumeHoraire
   - `<<lieu>>` -> Address
   - `<<date_debut>>` -> startDateFormatted
   - `<<date_fin>>` -> endDateFormatted
   - `<<Duree>>` -> totalHours
   - `<<PERCENTAGE>>` -> pourcentage (default 100)
   Credential: `2hdoXcE8Mfr07xZt`.

10. **Upsert Pending Contract** (n8n-nodes-base.dataTable): Upsert to DT `ab7d375L1CabAJYs` matching on studentEmail + teacherEmail. Fields: studentName, studentEmail, teacherName, teacherEmail, contractType="teacher", contractDocId, contractDocUrl, status="Draft", generatedAt=ISO now, language, totalHours, paymentAmount, emailData (JSON string with teacher/student info for the approve workflow). All other URL fields empty string for teacher contracts.

11. **Respond to Webhook** (n8n-nodes-base.respondToWebhook): Return JSON summary `{ success: true, contracts: [{teacher, docUrl}], count: N }`.

**Connection wiring:** Webhook -> Read CRM -> Read Oral Test Queue -> Split Teachers -> Loop Over Items -> (loop body: Lookup Teacher -> Prepare Contract Data -> Copy Template -> Fill Placeholders -> Upsert Pending Contract -> back to Loop) -> Respond to Webhook.

**Deployment steps:**
1. First, create the workflow via POST `https://learninggoalsformations.app.n8n.cloud/api/v1/workflows` with the JSON (header: `X-N8N-API-KEY`)
2. Then activate it via PATCH `https://learninggoalsformations.app.n8n.cloud/api/v1/workflows/{id}` with `{ "active": true }`
3. Test with a curl POST to the webhook URL with a known student email

**Reference the backup workflow JSON at `workflow_Ec1G5smZxBAkjc5N_backup_20260411.json`** for exact node type versions, credential format, and DT column schemas. Specifically use nodes 17 (Lookup Teacher), 18 (Prepare Teacher Contract Data), 19 (Copy Template), 20 (Fill Placeholders), 24 (Split Teachers), 43 (Prepare Teacher Pending Contract), 44 (Write Teacher Pending Contract) as the blueprint. Adapt them for the standalone context (replace `$('Extract & Clean Data')` references with the local Prepare Contract Data node, etc.)
  </action>
  <verify>
    <automated>curl -s -X POST "https://learninggoalsformations.app.n8n.cloud/webhook/generate-teacher-contracts" -H "Content-Type: application/json" -d '{"studentEmail":"kelly.amzallag@gmail.com"}' | python -c "import sys,json; d=json.load(sys.stdin); assert d.get('success')==True and d.get('count',0)>=1, f'Failed: {d}'"</automated>
  </verify>
  <done>
    - n8n workflow deployed and active at /generate-teacher-contracts webhook
    - POST with studentEmail returns success + list of generated teacher contracts
    - Each teacher gets a separate Google Doc with all 16 placeholders filled
    - Each teacher contract upserted to Pending Contracts DT as Draft
  </done>
</task>

<task type="auto">
  <name>Task 2: Dashboard integration -- generate button + API route + data cleanup + run for 4 students</name>
  <files>
    dashboard/src/app/api/contracts/generate-teacher/route.ts
    dashboard/src/lib/api.ts
    dashboard/src/components/pending-contracts.tsx
  </files>
  <action>
**2A. Create API route** at `dashboard/src/app/api/contracts/generate-teacher/route.ts`:
- POST endpoint accepting `{ studentEmail }`
- Admin auth check using the EXACT same pattern from `dashboard/src/app/api/contracts/approve/route.ts`: read `dashboard_auth` cookie, parse JSON, check `role === "admin"`, return 401/403 if invalid
- Validate that studentEmail is a non-empty string, return 400 if missing
- Forward the request to `${WEBHOOK_BASE}/generate-teacher-contracts` where WEBHOOK_BASE is `process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "https://learninggoalsformations.app.n8n.cloud/webhook"`
- Return the n8n response JSON (which contains `{ success, contracts, count }`)
- Wrap in try/catch, return `{ success: false, message: "Failed to reach n8n workflow" }` on network error

**2B. Add client function** to `dashboard/src/lib/api.ts`:
- Add `generateTeacherContracts(studentEmail: string)` function
- If DEMO_MODE, return `{ success: true, contracts: [], count: 0, message: "Generated (demo)" }`
- Otherwise, POST to `/api/contracts/generate-teacher` with `{ studentEmail }`
- Return the parsed JSON response
- Place it near the existing `approveAndSendContract` function for logical grouping

**2C. Add "Generate Teacher Contracts" button** to `dashboard/src/components/pending-contracts.tsx`:
- Add a new state: `generatingEmail` (string | null) to track which student is being generated
- Add a new state: `generateResult` (object | null) for success/error feedback
- In the table rows, for rows where `contractType === "student"` and `status === "Draft"`, add a "Gen Teachers" button BEFORE the "Approve & Send" button
- Button styling: `bg-cyan-600 text-white hover:bg-cyan-500` (cyan to match teacher badge color)
- On click: set `generatingEmail` to the student's email, call `generateTeacherContracts(c.studentEmail)`, show result, clear state
- While generating, show "Generating..." with disabled state
- On success, show a brief success message. On failure, show error in red text.
- Import `generateTeacherContracts` from `@/lib/api`

**2D. Data cleanup** (execute via curl/API before generating contracts):
- Fix Hannah Lamarque trailing newline: This must be done inside n8n (DT not accessible via REST). Create a tiny one-shot cleanup workflow OR handle it in the Split Teachers code node by trimming whitespace from the matched teacher names (`teacher.dbName.trim()`). Preferred: add `.trim()` to the cleanedTeacherName output in the Split Teachers node AND add a `.trim()` to the Lookup Teacher filter match. This handles it at the source.
- Delete Fares' 3 wrong teacher contracts (Pascale Albouy): Use the n8n API or n8n UI to delete those 3 rows from Pending Contracts DT. If deletable via API: `DELETE https://learninggoalsformations.app.n8n.cloud/api/v1/datatables/ab7d375L1CabAJYs/rows/{rowId}`. Otherwise note for manual deletion in n8n UI.
- Fix Raphael email mismatch: Update the Oral Test Queue DT row for Raphael from `raphael.virgolino1@gmail.com` to `rvirg2025@gmail.com` so CRM lookup matches.

**2E. Generate contracts for 4 waiting students** (after workflow deployed and data cleaned):
Call the webhook for each student:
1. Kelly: POST `{ "studentEmail": "kelly.amzallag@gmail.com" }` -- expects 2 teacher contracts (PRICE REBECCA + Hannah Lamarque)
2. Fares: POST `{ "studentEmail": "fabdedaim@gmail.com" }` -- expects 1 teacher contract (PRICE REBECCA)
3. Raphael: POST `{ "studentEmail": "rvirg2025@gmail.com" }` -- expects teacher contracts based on CRM teacher field
4. Balgobind: POST `{ "studentEmail": "balgobindvisham@gmail.com" }` -- expects 1 teacher contract (Pascale Albouy)

**2F. Deploy dashboard**: Run `cd dashboard && npx vercel --prod --yes` to deploy the updated dashboard.
  </action>
  <verify>
    <automated>cd "C:/Users/ROY/Documents/Claude code/dashboard" && npx next lint 2>&1 | tail -5</automated>
  </verify>
  <done>
    - /api/contracts/generate-teacher route returns 200 with contract generation results
    - pending-contracts page shows "Gen Teachers" button on student Draft rows
    - Fares' wrong Pascale Albouy contracts deleted from Pending Contracts DT
    - Raphael's email aligned in Oral Test Queue DT
    - All 4 students have teacher contracts generated (visible as Draft in /pending-contracts)
    - Dashboard deployed to Vercel
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Standalone teacher contract workflow deployed to n8n cloud, dashboard updated with Generate Teacher Contracts button, data cleaned up, and contracts generated for Kelly, Fares, Raphael, and Balgobind.
  </what-built>
  <how-to-verify>
    1. Visit https://dashboard-psi-five-93.vercel.app/pending-contracts
    2. Verify teacher contracts appear for Kelly (2 -- PRICE REBECCA + Hannah Lamarque), Fares (1 -- PRICE REBECCA), Raphael (check count), Balgobind (1 -- Pascale Albouy)
    3. All teacher contracts show cyan "Teacher" badge and "Draft" status
    4. Click the Google Doc link on one teacher contract -- verify all 16 placeholders are filled with correct data (teacher name, student name, dates, amounts, SIRET, etc.)
    5. On any remaining student Draft row, verify the "Gen Teachers" button appears and is clickable
    6. Confirm Fares no longer has the 3 wrong Pascale Albouy entries
    7. Test the approve flow: click "Approve & Send" on one teacher contract to verify it works with the existing approve workflow
  </how-to-verify>
  <resume-signal>Type "approved" if contracts look correct, or describe any issues with placeholders, missing contracts, or wrong data</resume-signal>
</task>

</tasks>

<verification>
- Workflow responds to POST /generate-teacher-contracts with success JSON
- Each teacher gets isolated contract (no cross-contamination between teachers)
- Pending Contracts DT has new teacher rows with contractType="teacher" and status="Draft"
- Dashboard /pending-contracts shows teacher contracts with cyan badge
- "Gen Teachers" button visible on student Draft rows and triggers generation
- Google Docs have all 16 placeholders correctly replaced
- No duplicate teacher contracts created (upsert matches on studentEmail + teacherEmail)
</verification>

<success_criteria>
- 4 students have teacher contracts generated and visible in dashboard
- Standalone workflow is reusable for future students (just POST with studentEmail)
- Data issues resolved (Hannah newline, Fares duplicates, Raphael email)
- Dashboard has working generate button for admin users
</success_criteria>

<output>
After completion, create `.planning/quick/260411-nyl-build-standalone-teacher-contract-workfl/260411-nyl-SUMMARY.md`
</output>
