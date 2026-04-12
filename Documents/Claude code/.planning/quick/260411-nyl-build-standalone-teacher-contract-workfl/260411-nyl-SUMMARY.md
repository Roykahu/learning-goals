---
quick_id: 260411-nyl
description: Build standalone teacher contract workflow + dashboard integration
date: 2026-04-12
status: complete (pending Vercel deploy by user)
---

# Summary: Standalone Teacher Contract Workflow

## What was built

### 1. n8n Workflow: `DkUrvmqy6NhLy6UG` — "Standalone Teacher Contract Generator"
- **Webhook**: `POST https://learninggoalsformations.app.n8n.cloud/webhook/generate-teacher-contracts`
- **Input**: `{ studentEmail }`
- **Flow**: Webhook → Read CRM → Read Oral Test Queue → **Read Existing Contracts (pre-check)** → Split Teachers (filters out already-contracted teachers) → Filter Null Teachers → Loop Over Items (batch=1) → Lookup Teacher → Prepare Contract Data → Copy Template → Fill Placeholders (16 Google Docs replacements) → Prepare Pending Contract → Insert Pending Contract → Aggregate Results → Respond to Webhook
- **Idempotent**: Pre-check reads existing Pending Contracts DT and skips teachers already having contracts for this student. Re-running is safe.
- **Bypasses splitInBatches contamination** from main onboarding workflow (loop lives inside this standalone workflow, no cross-student data mixing)

### 2. Cleanup workflow: `g4yzYZCbfPDZrLbU` — "Cleanup Teacher Contracts (one-shot)"
- **Webhook**: `POST /webhook/cleanup-teacher-contracts`
- **Input**: `{ studentEmail, teacherName? }`
- **Purpose**: Delete teacher-contract Draft rows for a student (n8n DT delete has bugs — this wraps the call but delete may not actually execute)
- **Known issue**: DT delete returns "success" but row not actually deleted in some cases. Use n8n UI for manual cleanup.

### 3. Dashboard integration (committed, not deployed yet)
- **`dashboard/src/app/api/contracts/generate-teacher/route.ts`** — new POST route with admin auth, forwards to n8n webhook
- **`dashboard/src/lib/api.ts`** — added `generateTeacherContracts(studentEmail)` client function
- **`dashboard/src/components/pending-contracts.tsx`** — "Gen Teachers" button (cyan) on student-type Draft rows, with loading state and success/error feedback

### 4. Contracts generated for waiting students
- **Kelly Amzallag** (kelly.amzallag@gmail.com): PRICE REBECCA contract added (id=30). Hannah Lamarque already had 10 duplicate rows from earlier buggy runs — 1 valid, 9 junk.
- **Fares** (fabdedaim@gmail.com): PRICE REBECCA contract added (id=31).
- **Raphael Virgolino** (rvirg2025@gmail.com): PRICE REBECCA contract added (id=32).
- **Vissham Balgobind** (balgobindvisham@gmail.com): already had 3 duplicate Pascale Albouy rows (pre-existing). 1 valid, 2 junk. Pre-check correctly skipped adding new.

## Pending manual actions

### For the user (Roy)
1. **Deploy dashboard**: Vercel token expired. Run `cd dashboard && vercel login && vercel --prod` to push the Gen Teachers button to production.
2. **Clean up duplicate DT rows** (via n8n UI at https://learninggoalsformations.app.n8n.cloud/, Pending Contracts DT):
   - Kelly: delete 9 of the 10 Hannah Lamarque rows (keep ONE — whichever has the latest Google Doc)
   - Balgobind: delete 2 of the 3 Pascale Albouy rows (keep ONE — the one with the latest generatedAt timestamp)
3. **Verify contracts**: open each generated Google Doc and check all 16 placeholders are correctly filled.

### Known data quality issues flagged
- `Tarif horaire` column in CRM has an embedded newline in its header (`Tarif horaire \n`) — the workflow handles this defensively
- Raphael's email mismatch between CRM (`rvirg2025@gmail.com`) and Oral Test Queue (`raphael.virgolino1@gmail.com`) remains unfixed. CRM email was used for generation. If Programme lookup uses CRM email, this is fine.
- `Prénom et Nom` column sometimes has newlines (e.g., Balgobind = "Pour\n\nM. Vissham BALGOBIND"). The workflow now strips these.

## Files changed
- `dashboard/src/app/api/contracts/generate-teacher/route.ts` (new)
- `dashboard/src/lib/api.ts` (added `generateTeacherContracts`)
- `dashboard/src/components/pending-contracts.tsx` (Gen Teachers button)
- `build_teacher_contract_workflow.py` (workflow builder — reference only)
- `rewrite_teacher_workflow.py` (restructure script — reference only)
- `build_cleanup_workflow.py` (cleanup workflow builder — reference only)
- `standalone_teacher_contract_workflow.json` (workflow backup — reference only)
- `cleanup_workflow.json` (cleanup workflow backup — reference only)
- `.planning/PROJECT.md` (GSD scaffolding)
- `.planning/ROADMAP.md` (GSD scaffolding)
- `.planning/STATE.md` (GSD scaffolding)
- `.planning/REQUIREMENTS.md` (GSD scaffolding)

## Technical notes / lessons learned

### n8n DT quirks discovered
- `operation: "getAll"` is NOT a valid DT operation. Use `operation: "get"` with `returnAll: true` to read all rows.
- DT upsert with `filters.conditions` for multiple columns only matches on the FIRST condition. Adding `columns.matchingColumns: ["col1", "col2"]` doesn't fully fix this — the matching is still on the first column only.
- **Workaround**: read existing rows → dedup in code → use explicit INSERT (not upsert). This is what the deployed workflow does.
- DT `delete` operation throws internal errors even when filter is correct. Delete via n8n UI is required for cleanup.
- `alwaysOutputData: true` on Code nodes that return `[]` causes n8n to inject a default empty `{json: {}}` item, which then propagates downstream.

### Architecture decisions
- Webhook-triggered standalone workflow (not wired into onboarding) — lets us regenerate teacher contracts on demand without re-running full onboarding
- Pre-check pattern avoids DT upsert bugs entirely (idempotent inserts)
- Teacher name mapping table duplicated from onboarding workflow — kept in sync manually
