# Learning Goals — n8n Automation Platform

## Vision
Automate administrative workflows for Learning Goals, a French language training school run by Lily Riou. Save 10+ hours/week, reduce Qualiopi certification audit stress, enable scaling to 100+ students.

## Architecture
3-layer system: Directives (SOPs) → Orchestration (n8n + AI) → Execution (n8n cloud + Google Workspace)

## Stack
- **Workflows:** n8n Cloud (54 active workflows)
- **Dashboard:** Next.js 15 on Vercel (15+ pages, dark theme, warm blue #2563eb)
- **Data:** n8n Data Tables (11 tables), Google Sheets (CRM, tracking, schedule)
- **Integrations:** Google Workspace (Drive, Docs, Sheets, Gmail), SignNow (e-signatures), OpenAI/Gemini (AI content)

## Key Resources
- n8n Cloud: https://learninggoalsformations.app.n8n.cloud/
- Dashboard: https://dashboard-psi-five-93.vercel.app
- CRM Sheet: `16t8R4NxPqECmpawN0AogN719FPMiXGLWS9qH-so34gA`

## Current State (V2 Complete)
Dashboard fully operational with 6 compliance/communication sections. Core automations: student onboarding, oral test processing, fiche monitoring, contract generation, invoice tracking, feedback reminders, veille Qualiopi.

## Principles
- Code nodes over IF nodes (IF breaks when deployed via n8n API)
- DT-aware filters for deduplication
- French-language emails for all student/teacher communication
- All workflows must have error handling (onError + alwaysOutputData)
