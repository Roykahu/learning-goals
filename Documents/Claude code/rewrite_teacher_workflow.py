"""
Rewrite the standalone teacher contract workflow:
- Add Read Existing Pending Contracts node (to pre-check)
- Modify Split Teachers to filter out teachers already having contracts
- Change Upsert to Insert (after pre-check, duplicates are impossible)
"""
import json
import urllib.request

N8N_URL = "https://learninggoalsformations.app.n8n.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMWIxNzlkZC1kZDRhLTQyYTEtYmFkNi0yOTU0M2ZkM2M3MjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzYxMmRiMTgtNGJlOS00NjY1LWFmYTMtZWU5MGRjYzVhNjk0IiwiaWF0IjoxNzcyNzI1Mjk5fQ.adwzSRIt_GArw1uTBR5r-tl78K3x8N-Rk0VjUMgdVBU"
WORKFLOW_ID = "DkUrvmqy6NhLy6UG"

DT_PENDING = "ab7d375L1CabAJYs"

req = urllib.request.Request(f"{N8N_URL}/api/v1/workflows/{WORKFLOW_ID}")
req.add_header("X-N8N-API-KEY", N8N_API_KEY)
with urllib.request.urlopen(req, timeout=30) as resp:
    wf = json.loads(resp.read().decode('utf-8'))

# --- 1. Add "Read Existing Contracts" node between Read Oral Test Queue and Split Teachers ---
new_node = {
    "parameters": {
        "operation": "get",
        "dataTableId": {
            "__rl": True,
            "value": DT_PENDING,
            "mode": "list",
            "cachedResultName": "Pending Contracts"
        },
        "returnAll": True
    },
    "id": "read-existing-contracts-001",
    "name": "Read Existing Contracts",
    "type": "n8n-nodes-base.dataTable",
    "typeVersion": 1,
    "position": [780, 500],
    "onError": "continueRegularOutput",
    "alwaysOutputData": True
}
# Check if already added
existing_node_names = {n['name'] for n in wf['nodes']}
if 'Read Existing Contracts' not in existing_node_names:
    wf['nodes'].append(new_node)
    print("Added Read Existing Contracts node")

# --- 2. Update Split Teachers code to also filter out existing teachers ---
NEW_SPLIT_CODE = r"""
// Read ALL CRM rows, filter by studentEmail in-memory
const studentEmail = ($('Webhook').first().json.body.studentEmail || '').trim().toLowerCase();
const allCrm = $('Read CRM').all();
const matches = allCrm.filter(it => {
  const e = (it.json['Email Address'] || '').toString().trim().toLowerCase();
  return e === studentEmail;
});
const crm = matches.length > 0 ? matches[matches.length - 1].json : {};

const oralQueueItems = $('Read Oral Test Queue').all();
const oralMatches = oralQueueItems.filter(it => {
  const e = (it.json.studentEmail || '').toString().trim().toLowerCase();
  return e === studentEmail;
});
const oral = oralMatches.length > 0 ? (oralMatches[oralMatches.length - 1].json || {}) : {};

// Read existing teacher contracts for this student -> skip already-generated teachers
const existingContracts = $('Read Existing Contracts').all();
const existingTeacherEmails = new Set();
const existingTeacherNames = new Set();
existingContracts.forEach(it => {
  const c = it.json;
  if ((c.studentEmail || '').toLowerCase().trim() === studentEmail
      && (c.contractType || '').toLowerCase() === 'teacher'
      && (c.status || '').toLowerCase() !== 'cancelled') {
    if (c.teacherEmail) existingTeacherEmails.add(c.teacherEmail.toLowerCase().trim());
    if (c.teacherName) existingTeacherNames.add(c.teacherName.toLowerCase().trim());
  }
});

// Extract placeholders from CRM
const email = crm['Email Address'] || studentEmail;
const fullName = (crm['Prénom et Nom'] || '').toString().replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
const language = crm['Langue souhaitée'] || oral.language || 'Anglais';
const startDate = crm['Date de début de la formation'] || oral.trainingStartDate || '';
const endDate = crm['Date de fin de formation'] || oral.trainingEndDate || '';
const totalHours = crm["Durée de la formation/nombre d'heures souhaitées"] || oral.totalHours || 0;
const teacherName = crm['Le professeurs concernés'] || '';
const tarifHoraire = crm['Tarif horaire \n'] || crm['Tarif horaire'] || crm['Tarif horaire\n'] || '35';
const volumeHoraire = crm['Volume horaire du contrat'] || totalHours || '';
const pourcentage = crm['Pourcentage prévisionnel'] || '100';
const certifieOuNon = crm['<<CERTIFIE_OU_NON_CERTIFIE>> '] || '';

const formatDate = (dateStr) => {
  if (dateStr === null || dateStr === undefined || dateStr === '') return '';
  let date;
  if (dateStr instanceof Date) { date = dateStr; }
  else if (typeof dateStr === 'number') {
    const ms = Math.round((dateStr - 25569) * 86400 * 1000);
    date = new Date(ms);
  } else if (typeof dateStr === 'string') {
    const s = dateStr.trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) date = new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
    else date = new Date(s);
  } else { return ''; }
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const studentData = {
  email,
  fullName,
  language,
  totalHours: Number(totalHours) || 0,
  tarifHoraire: String(tarifHoraire).replace(',', '.').replace(/[^0-9.]/g, '') || '35',
  volumeHoraire: Number(String(volumeHoraire).replace(',', '.').replace(/[^0-9.]/g, '')) || Number(totalHours) || 0,
  pourcentage: Number(String(pourcentage).replace(',', '.').replace(/[^0-9.]/g, '')) || 100,
  certifieOuNon,
  startDateFormatted: formatDate(startDate),
  endDateFormatted: formatDate(endDate),
  teacherName,
};

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

const results = [];
teacherMap.forEach(t => {
  if (teacherName.includes(t.key)) {
    const cleaned = t.dbName.trim();
    // Skip if this teacher already has a contract for this student (by name match)
    if (existingTeacherNames.has(cleaned.toLowerCase())) {
      return;
    }
    results.push({
      json: {
        ...studentData,
        cleanedTeacherName: cleaned,
      }
    });
  }
});

if (results.length === 0) {
  return [{ json: { ...studentData, cleanedTeacherName: null, noTeacherFound: true, reason: 'all teachers already have contracts or no match' } }];
}

return results;
"""

for n in wf['nodes']:
    if n['name'] == 'Split Teachers':
        n['parameters']['jsCode'] = NEW_SPLIT_CODE
        print("Updated Split Teachers code")
        break

# --- 3. Change Upsert to Insert ---
for n in wf['nodes']:
    if n['name'] == 'Upsert Pending Contract':
        n['parameters']['operation'] = 'insert'
        # Remove filter and matchingColumns (not needed for insert)
        if 'filters' in n['parameters']:
            del n['parameters']['filters']
        if 'matchingColumns' in n['parameters'].get('columns', {}):
            n['parameters']['columns']['matchingColumns'] = []
        # Rename
        n['name'] = 'Insert Pending Contract'
        print("Changed Upsert -> Insert")
        break

# --- 4. Update connections ---
# Old: Read Oral Test Queue -> Split Teachers
# New: Read Oral Test Queue -> Read Existing Contracts -> Split Teachers
conn = wf['connections']
# Remove old connection
if 'Read Oral Test Queue' in conn:
    conn['Read Oral Test Queue']['main'] = [[{"node": "Read Existing Contracts", "type": "main", "index": 0}]]
conn['Read Existing Contracts'] = {"main": [[{"node": "Split Teachers", "type": "main", "index": 0}]]}

# Rename Upsert -> Insert in connections
if 'Upsert Pending Contract' in conn:
    conn['Insert Pending Contract'] = conn.pop('Upsert Pending Contract')
# Also update any INCOMING connection to Upsert Pending Contract
for src, c in conn.items():
    for out_group in c.get('main', []):
        for t in out_group:
            if t.get('node') == 'Upsert Pending Contract':
                t['node'] = 'Insert Pending Contract'

print("Updated connections")

# Deploy
clean_wf = {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": wf.get("settings", {"executionOrder": "v1"})
}

body = json.dumps(clean_wf).encode('utf-8')
req = urllib.request.Request(f"{N8N_URL}/api/v1/workflows/{WORKFLOW_ID}", data=body, method='PUT')
req.add_header("X-N8N-API-KEY", N8N_API_KEY)
req.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("PUT OK")
except urllib.error.HTTPError as e:
    print(f"PUT ERROR {e.code}: {e.read().decode('utf-8')[:1000]}")
