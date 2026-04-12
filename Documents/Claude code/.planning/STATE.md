# Learning Goals — Project State

## Current Phase
Phase 1: Standalone Teacher Contract Workflow

## Session Context
Continuing from session 2026-04-11. Onboarding workflow (Ec1G5smZxBAkjc5N) fixed with 5 root causes resolved. Teacher contract path still broken due to splitInBatches data contamination.

## Ready to Send (from dashboard /pending-contracts)
- Kelly Amzallag — student contract Draft
- Raphael Virgolino — student contract Draft
- Vissham Balgobind — student contract Draft

## Students Needing Teacher Contracts
- Kelly (kelly.amzallag@gmail.com): PRICE REBECCA + Hannah Lamarque
- Fares (fabdedaim@gmail.com): PRICE REBECCA
- Raphael (rvirg2025@gmail.com): check CRM
- Balgobind (balgobindvisham@gmail.com): Pascale Albouy

## Known Data Issues
- Hannah Lamarque: trailing `\n` in Name field in Teacher DT
- Fares: 3 duplicate teacher contracts for Pascale Albouy (wrong teacher) in Pending Contracts DT
- Raphael: email mismatch (CRM `rvirg2025@gmail.com` vs Oral Test Queue `raphael.virgolino1@gmail.com`)

## Blockers/Concerns
- n8n Data Tables API not accessible via REST (must use DT nodes inside workflows)
- IF nodes break when deployed via API (use Code nodes instead)
