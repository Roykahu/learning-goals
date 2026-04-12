# Learning Goals — Requirements

## Phase 1: Standalone Teacher Contract Workflow

### Must Have
- Webhook endpoint POST `/generate-teacher-contracts` accepting `{ studentEmail }`
- Read student data from CRM Sheet + Oral Test Queue DT
- Split teacher names using existing mapping table (13 known teacher aliases)
- Loop through teachers one at a time (batch=1, no cross-contamination)
- For each teacher: lookup in Teacher DT, copy contract template, fill 16 placeholders, share doc
- Upsert each teacher contract to Pending Contracts DT with contractType="teacher", status="Draft"
- Return summary of generated contracts
- Dashboard button to trigger generation per student
- Dashboard API route with admin auth

### Should Have
- Error handling on all nodes (onError + alwaysOutputData)
- Data cleanup: Hannah newline fix, Fares duplicate deletion, Raphael email alignment

### Contract Template Placeholders (all 16)
`<<Nom du sous-traitant>>`, `<<adresse>>`, `<<langue>>`, `<<nom de stagiaire>>`, `<<MONTANT>>`, `<<date>>`, `<<Nom de formateur>>`, `<<NUMERO_NDA>>`, `<<SIRET_FORMATEUR>>`, `<<CERTIFIE_OU_NON_CERTIFIE>>`, `<<heures>>`, `<<lieu>>`, `<<date_debut>>`, `<<date_fin>>`, `<<Durée>>`, `<<PERCENTAGE>>`

### Credentials
- Google Drive: `ddziMFrcb3ADiTuG`
- Google Docs: `2hdoXcE8Mfr07xZt`
- Google Sheets: `iqB69W5BJDamQkKG`
- Gmail: `L9LfPs5b5L94iJ5b`

### Key IDs
- Contract Template: `1Bm2KxOoiY1cY1m0Rktr3ovqVWy7JIEzXx0KXuGYZ2TI`
- Contract Output Folder: `1KqdTi7p__WCDdTV5oJfU7L5itjZ9ksC0`
- Teacher DT: `FcvkzNqw3ghOOF99`
- Pending Contracts DT: `ab7d375L1CabAJYs`
- Oral Test Queue DT: `4vsQNiZCwFdDM1KB`
- CRM Sheet: `16t8R4NxPqECmpawN0AogN719FPMiXGLWS9qH-so34gA`
