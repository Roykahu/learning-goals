"""
Build standalone teacher contract workflow JSON for n8n.
Webhook POST /generate-teacher-contracts with {studentEmail}
-> reads CRM + Oral Test Queue, splits teachers, loops through each,
   generates contract doc and upserts to Pending Contracts DT.
"""
import json
import os
import urllib.request
import urllib.error

# ============ CONFIG ============
N8N_URL = "https://learninggoalsformations.app.n8n.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMWIxNzlkZC1kZDRhLTQyYTEtYmFkNi0yOTU0M2ZkM2M3MjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzYxMmRiMTgtNGJlOS00NjY1LWFmYTMtZWU5MGRjYzVhNjk0IiwiaWF0IjoxNzcyNzI1Mjk5fQ.adwzSRIt_GArw1uTBR5r-tl78K3x8N-Rk0VjUMgdVBU"

CRED_SHEETS = "iqB69W5BJDamQkKG"
CRED_DRIVE = "ddziMFrcb3ADiTuG"
CRED_DOCS = "2hdoXcE8Mfr07xZt"
CRED_GMAIL = "L9LfPs5b5L94iJ5b"

CRM_SHEET_ID = "16t8R4NxPqECmpawN0AogN719FPMiXGLWS9qH-so34gA"
CRM_TAB_GID = 288302101  # "Form Responses 1"
CONTRACT_TEMPLATE_ID = "1Bm2KxOoiY1cY1m0Rktr3ovqVWy7JIEzXx0KXuGYZ2TI"
OUTPUT_FOLDER_ID = "1KqdTi7p__WCDdTV5oJfU7L5itjZ9ksC0"

DT_TEACHER = "FcvkzNqw3ghOOF99"
DT_PENDING_CONTRACTS = "ab7d375L1CabAJYs"
DT_ORAL_TEST_QUEUE = "4vsQNiZCwFdDM1KB"

# ============ DT PENDING CONTRACTS SCHEMA ============
PENDING_CONTRACTS_SCHEMA = [
    {"id": "studentName", "displayName": "studentName", "type": "string"},
    {"id": "studentEmail", "displayName": "studentEmail", "type": "string"},
    {"id": "teacherName", "displayName": "teacherName", "type": "string"},
    {"id": "teacherEmail", "displayName": "teacherEmail", "type": "string"},
    {"id": "contractType", "displayName": "contractType", "type": "string"},
    {"id": "contractDocId", "displayName": "contractDocId", "type": "string"},
    {"id": "contractDocUrl", "displayName": "contractDocUrl", "type": "string"},
    {"id": "conventionDocId", "displayName": "conventionDocId", "type": "string"},
    {"id": "conventionDocUrl", "displayName": "conventionDocUrl", "type": "string"},
    {"id": "convocationDocId", "displayName": "convocationDocId", "type": "string"},
    {"id": "convocationDocUrl", "displayName": "convocationDocUrl", "type": "string"},
    {"id": "programmeDocId", "displayName": "programmeDocId", "type": "string"},
    {"id": "programmeDocUrl", "displayName": "programmeDocUrl", "type": "string"},
    {"id": "examGuideDocId", "displayName": "examGuideDocId", "type": "string"},
    {"id": "studentFolderId", "displayName": "studentFolderId", "type": "string"},
    {"id": "status", "displayName": "status", "type": "string"},
    {"id": "generatedAt", "displayName": "generatedAt", "type": "string"},
    {"id": "language", "displayName": "language", "type": "string"},
    {"id": "totalHours", "displayName": "totalHours", "type": "number"},
    {"id": "paymentAmount", "displayName": "paymentAmount", "type": "number"},
    {"id": "oralTestLink", "displayName": "oralTestLink", "type": "string"},
    {"id": "languageTestLink", "displayName": "languageTestLink", "type": "string"},
    {"id": "emailData", "displayName": "emailData", "type": "string"},
]
for field in PENDING_CONTRACTS_SCHEMA:
    field.update({"required": False, "defaultMatch": False, "display": True, "readOnly": False, "removed": False})


# ============ CODE NODE: PARSE CRM + SPLIT TEACHERS ============
PARSE_AND_SPLIT_CODE = r"""
// Read student email from webhook body
const body = $('Webhook').first().json.body || $('Webhook').first().json;
const studentEmail = (body.studentEmail || '').trim().toLowerCase();

if (!studentEmail) {
  throw new Error('studentEmail required in POST body');
}

// Find the CRM row matching the email (most recent row wins for duplicates)
const allRows = $('Read CRM').all();
const matches = allRows.filter(r => {
  const email = (r.json['Email Address'] || '').toLowerCase().trim();
  return email === studentEmail;
});

if (matches.length === 0) {
  throw new Error(`No CRM row found for ${studentEmail}`);
}
// Use last match (most recent submission)
const match = matches[matches.length - 1];

const row = match.json;
const fullName = (row['Prénom et Nom'] || '').trim();
const language = (row['Langue souhaitée'] || 'Anglais').trim();
const totalHoursRaw = row["Durée de la formation/nombre d'heures souhaitées"];
const totalHours = Number(totalHoursRaw) || 0;
const rawTeacherData = row['Le professeurs concernés'] || '';

// Tarif has weird column name with newline — check all variants
const tarifHoraire = Number(row['Tarif horaire \n'] || row['Tarif horaire'] || row['Tarif horaire\n'] || 35);
const volumeHoraire = Number(row['Volume horaire du contrat'] || totalHours);
const pourcentage = Number(row['Pourcentage prévisionnel'] || 100);
const certifieOuNon = row['<<CERTIFIE_OU_NON_CERTIFIE>> '] || '';

// Start/end dates — format to DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'number') {
    const ms = Math.round((dateStr - 25569) * 86400 * 1000);
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  }
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[1].padStart(2,'0') + '/' + m[2].padStart(2,'0') + '/' + m[3];
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
}

const startDateRaw = formatDate(row['Date de début de la formation']);
const endDateRaw = formatDate(row['Date de fin de formation']);

// Teacher mapping (from existing onboarding workflow, trimmed for safety)
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
teacherMap.forEach(teacher => {
  if (rawTeacherData.includes(teacher.key)) {
    results.push({
      json: {
        studentEmail,
        studentName: fullName,
        language,
        totalHours,
        tarifHoraire,
        volumeHoraire,
        pourcentage,
        certifieOuNon,
        startDateRaw,
        endDateRaw,
        rawTeacherData,
        cleanedTeacherName: teacher.dbName.trim()
      }
    });
  }
});

if (results.length === 0) {
  throw new Error(`No matching teachers found in "${rawTeacherData}" for ${studentEmail}`);
}

return results;
"""

# ============ CODE NODE: PREPARE CONTRACT DATA (inside loop) ============
PREPARE_DATA_CODE = r"""
// Inside loop — one teacher item at a time
const item = $input.first().json;  // from Lookup Teacher
const studentItem = $('Split Teachers For Loop').first().json;

// The Lookup Teacher output contains the teacher's DT row
// (first row of the DT filter result)
const teacher = item;

// Today DD/MM/YYYY
const now = new Date();
const today = String(now.getDate()).padStart(2, '0') + '/' +
              String(now.getMonth() + 1).padStart(2, '0') + '/' +
              now.getFullYear();

// Oral test data (may or may not exist)
let startDateFormatted = studentItem.startDateRaw || '';
let endDateFormatted = studentItem.endDateRaw || '';
try {
  const otItems = $('Read Oral Test Queue').all();
  const otMatch = otItems.find(o => (o.json.studentEmail || '').toLowerCase() === studentItem.studentEmail.toLowerCase());
  if (otMatch) {
    startDateFormatted = otMatch.json.trainingStartDate || startDateFormatted;
    endDateFormatted = otMatch.json.trainingEndDate || endDateFormatted;
  }
} catch (e) {
  // OT lookup optional — keep CRM values
}

// Helpers
const safe = (s) => (s || '').replace(/[^a-zA-Z\u00C0-\u017F0-9]/g, '_');

// Dynamic Montant
const tarifHoraire = Number(studentItem.tarifHoraire) || 35;
const volumeHoraire = Number(studentItem.volumeHoraire) || Number(studentItem.totalHours) || 0;
const pourcentage = Number(studentItem.pourcentage) || 100;
const payment = (tarifHoraire * volumeHoraire).toFixed(2);

// First email only
const teacherEmail = ((teacher.Email || '').split(';')[0] || '').trim();

// Full address
const teacherAddress = [teacher.Address, teacher.City_and_Postal_Code, teacher.Country]
  .filter(Boolean).join(', ');

const teacherName = (teacher.Name || studentItem.cleanedTeacherName || '').trim();

const contractFileName = `Contrat_Enseignant_${safe(teacherName)}_${safe(studentItem.studentName)}_${today.replace(/\//g, '-')}`;

return [{
  json: {
    teacherName,
    teacherEmail,
    teacherAddress,
    teacherNDA: teacher.NDA || 'N/A',
    teacherSIRET: teacher.SIRET_SIREN_Notes || '',
    teacherCertified: teacher.CERTIFIE_OU_NON_CERTIFIE || studentItem.certifieOuNon || '',
    studentName: studentItem.studentName,
    studentEmail: studentItem.studentEmail,
    language: studentItem.language,
    totalHours: Number(studentItem.totalHours) || 0,
    tarifHoraire,
    volumeHoraire,
    pourcentage,
    payment,
    todayDate: today,
    contractFileName,
    startDateFormatted,
    endDateFormatted
  }
}];
"""

# ============ CODE NODE: PREPARE PENDING CONTRACT DT ROW ============
PREPARE_PENDING_CODE = r"""
const teacherData = $('Prepare Contract Data').first().json;
const contractDocId = $('Copy Template').first().json.id;
const contractDocUrl = 'https://docs.google.com/document/d/' + contractDocId + '/edit';

// Student folder ID not looked up in this workflow; existing student row in Pending Contracts DT may already have it
const folderId = '';

const emailData = JSON.stringify({
  teacherName: teacherData.teacherName,
  studentName: teacherData.studentName,
  language: teacherData.language,
  totalHours: teacherData.totalHours,
  payment: teacherData.payment
});

return [{
  json: {
    studentName: teacherData.studentName,
    studentEmail: teacherData.studentEmail || '',
    teacherName: teacherData.teacherName,
    teacherEmail: teacherData.teacherEmail,
    contractType: 'teacher',
    contractDocId: contractDocId,
    contractDocUrl: contractDocUrl,
    conventionDocId: '',
    conventionDocUrl: '',
    convocationDocId: '',
    convocationDocUrl: '',
    programmeDocId: '',
    programmeDocUrl: '',
    examGuideDocId: '',
    studentFolderId: folderId,
    status: 'Draft',
    generatedAt: new Date().toISOString(),
    language: teacherData.language || '',
    totalHours: Number(teacherData.totalHours) || 0,
    paymentAmount: Number(teacherData.payment) || 0,
    oralTestLink: '',
    languageTestLink: '',
    emailData: emailData
  }
}];
"""

# ============ CODE NODE: SUMMARY FOR RESPONSE ============
SUMMARY_CODE = r"""
const items = $('Upsert Pending Contract').all();
const contracts = items.map(i => ({
  teacher: i.json.teacherName || '',
  docUrl: i.json.contractDocUrl || ''
}));
return [{
  json: {
    success: true,
    count: contracts.length,
    contracts
  }
}];
"""

# ============ BUILD NODES ============
def build_workflow():
    nodes = []

    # 1. Webhook
    nodes.append({
        "parameters": {
            "httpMethod": "POST",
            "path": "generate-teacher-contracts",
            "responseMode": "lastNode",
            "options": {}
        },
        "id": "wh-01",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [240, 400],
        "webhookId": "generate-teacher-contracts"
    })

    # 2. Read CRM (read all rows, code node will filter)
    nodes.append({
        "parameters": {
            "documentId": {
                "__rl": True,
                "value": f"https://docs.google.com/spreadsheets/d/{CRM_SHEET_ID}",
                "mode": "url"
            },
            "sheetName": {
                "__rl": True,
                "value": CRM_TAB_GID,
                "mode": "list",
                "cachedResultName": "Form Responses 1"
            },
            "options": {}
        },
        "id": "read-crm-01",
        "name": "Read CRM",
        "type": "n8n-nodes-base.googleSheets",
        "typeVersion": 4.5,
        "position": [460, 400],
        "credentials": {
            "googleSheetsOAuth2Api": {
                "id": CRED_SHEETS,
                "name": "Google Sheets account"
            }
        }
    })

    # 3. Read Oral Test Queue
    nodes.append({
        "parameters": {
            "operation": "get",
            "dataTableId": {
                "__rl": True,
                "value": DT_ORAL_TEST_QUEUE,
                "mode": "list",
                "cachedResultName": "Pending OT Queue"
            },
            "returnAll": True
        },
        "id": "read-ot-01",
        "name": "Read Oral Test Queue",
        "type": "n8n-nodes-base.dataTable",
        "typeVersion": 1,
        "position": [680, 400],
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    })

    # 4. Split Teachers (Code)
    nodes.append({
        "parameters": {"jsCode": PARSE_AND_SPLIT_CODE},
        "id": "split-01",
        "name": "Split Teachers For Loop",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [900, 400]
    })

    # 5. Loop Over Items (splitInBatches batch=1)
    nodes.append({
        "parameters": {
            "batchSize": 1,
            "options": {}
        },
        "id": "loop-01",
        "name": "Loop Over Teachers",
        "type": "n8n-nodes-base.splitInBatches",
        "typeVersion": 3,
        "position": [1120, 400]
    })

    # 6. Lookup Teacher in Teacher DT
    nodes.append({
        "parameters": {
            "operation": "get",
            "dataTableId": {
                "__rl": True,
                "value": DT_TEACHER,
                "mode": "list",
                "cachedResultName": "Teachers Data"
            },
            "filters": {
                "conditions": [
                    {
                        "keyName": "Name",
                        "keyValue": "={{ $json.cleanedTeacherName }}"
                    }
                ]
            }
        },
        "id": "lookup-01",
        "name": "Lookup Teacher",
        "type": "n8n-nodes-base.dataTable",
        "typeVersion": 1,
        "position": [1340, 300],
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    })

    # 7. Prepare Contract Data
    nodes.append({
        "parameters": {"jsCode": PREPARE_DATA_CODE},
        "id": "prep-01",
        "name": "Prepare Contract Data",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1560, 300]
    })

    # 8. Copy Template
    nodes.append({
        "parameters": {
            "operation": "copy",
            "fileId": {
                "__rl": True,
                "value": CONTRACT_TEMPLATE_ID,
                "mode": "id"
            },
            "name": "={{ $json.contractFileName }}",
            "sameFolder": False,
            "driveId": {
                "__rl": True,
                "mode": "list",
                "value": "My Drive"
            },
            "folderId": {
                "__rl": True,
                "value": OUTPUT_FOLDER_ID,
                "mode": "id"
            },
            "options": {}
        },
        "id": "copy-01",
        "name": "Copy Template",
        "type": "n8n-nodes-base.googleDrive",
        "typeVersion": 3,
        "position": [1780, 300],
        "credentials": {
            "googleDriveOAuth2Api": {
                "id": CRED_DRIVE,
                "name": "Google Drive"
            }
        },
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    })

    # 9. Fill Placeholders (Google Docs)
    nodes.append({
        "parameters": {
            "operation": "update",
            "documentURL": "={{ $('Copy Template').first().json.id }}",
            "actionsUi": {
                "actionFields": [
                    {"action": "replaceAll", "text": "<<Nom du sous-traitant>>", "replaceText": "={{ $('Prepare Contract Data').first().json.teacherName }}"},
                    {"action": "replaceAll", "text": "<<adresse>>", "replaceText": "={{ $('Prepare Contract Data').first().json.teacherAddress }}"},
                    {"action": "replaceAll", "text": "<<langue>>", "replaceText": "={{ $('Prepare Contract Data').first().json.language }}"},
                    {"action": "replaceAll", "text": "<<nom de stagiaire>>", "replaceText": "={{ $('Prepare Contract Data').first().json.studentName }}"},
                    {"action": "replaceAll", "text": "<<MONTANT>>", "replaceText": "={{ String($('Prepare Contract Data').first().json.payment) }}"},
                    {"action": "replaceAll", "text": "<<date>>", "replaceText": "={{ $('Prepare Contract Data').first().json.todayDate }}"},
                    {"action": "replaceAll", "text": "<<Nom de formateur>>", "replaceText": "={{ $('Prepare Contract Data').first().json.teacherName }}"},
                    {"action": "replaceAll", "text": "<<NUMERO_NDA>>", "replaceText": "={{ String($('Prepare Contract Data').first().json.teacherNDA) }}"},
                    {"action": "replaceAll", "text": "<<SIRET_FORMATEUR>>", "replaceText": "={{ $('Prepare Contract Data').first().json.teacherSIRET }}"},
                    {"action": "replaceAll", "text": "<<CERTIFIE_OU_NON_CERTIFIE>>", "replaceText": "={{ $('Prepare Contract Data').first().json.teacherCertified }}"},
                    {"action": "replaceAll", "text": "<<heures>>", "replaceText": "={{ String($('Prepare Contract Data').first().json.volumeHoraire) }}"},
                    {"action": "replaceAll", "text": "<<lieu>>", "replaceText": "={{ $('Prepare Contract Data').first().json.teacherAddress }}"},
                    {"action": "replaceAll", "text": "<<date_debut>>", "replaceText": "={{ $('Prepare Contract Data').first().json.startDateFormatted }}"},
                    {"action": "replaceAll", "text": "<<date_fin>>", "replaceText": "={{ $('Prepare Contract Data').first().json.endDateFormatted }}"},
                    {"action": "replaceAll", "text": "<<Durée>>", "replaceText": "={{ String($('Prepare Contract Data').first().json.totalHours) }}"},
                    {"action": "replaceAll", "text": "<<PERCENTAGE>>", "replaceText": "={{ String($('Prepare Contract Data').first().json.pourcentage) }}"}
                ]
            }
        },
        "id": "fill-01",
        "name": "Fill Placeholders",
        "type": "n8n-nodes-base.googleDocs",
        "typeVersion": 2,
        "position": [2000, 300],
        "credentials": {
            "googleDocsOAuth2Api": {
                "id": CRED_DOCS,
                "name": "Google Docs"
            }
        },
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    })

    # 10. Prepare Pending Contract (Code)
    nodes.append({
        "parameters": {"jsCode": PREPARE_PENDING_CODE},
        "id": "prep-pend-01",
        "name": "Prepare Pending Contract",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [2220, 300]
    })

    # 11. Upsert Pending Contract
    upsert_columns = {col["id"]: "={{ $json." + col["id"] + " }}" for col in PENDING_CONTRACTS_SCHEMA}
    nodes.append({
        "parameters": {
            "operation": "upsert",
            "dataTableId": {
                "__rl": True,
                "value": DT_PENDING_CONTRACTS,
                "mode": "list",
                "cachedResultName": "Pending Contracts"
            },
            "filters": {
                "conditions": [
                    {"keyName": "studentEmail", "keyValue": "={{ $json.studentEmail }}"},
                    {"keyName": "teacherEmail", "keyValue": "={{ $json.teacherEmail }}"}
                ]
            },
            "columns": {
                "mappingMode": "defineBelow",
                "value": upsert_columns,
                "matchingColumns": [],
                "schema": PENDING_CONTRACTS_SCHEMA,
                "attemptToConvertTypes": False,
                "convertFieldsToString": False
            },
            "options": {}
        },
        "id": "upsert-01",
        "name": "Upsert Pending Contract",
        "type": "n8n-nodes-base.dataTable",
        "typeVersion": 1,
        "position": [2440, 300],
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    })

    # 12. Summary (after loop completes, outputs single item)
    nodes.append({
        "parameters": {"jsCode": SUMMARY_CODE},
        "id": "summary-01",
        "name": "Build Summary",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1340, 500]
    })

    # 13. Respond to Webhook
    nodes.append({
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ $json }}",
            "options": {}
        },
        "id": "respond-01",
        "name": "Respond to Webhook",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.1,
        "position": [1560, 500]
    })

    # ============ CONNECTIONS ============
    # Flow:
    # Webhook -> Read CRM -> Read Oral Test Queue -> Split Teachers -> Loop (main output 0 = done, output 1 = loop body)
    # Loop output 0 (done) -> Build Summary -> Respond to Webhook
    # Loop output 1 (iteration) -> Lookup Teacher -> Prepare Data -> Copy Template -> Fill Placeholders -> Prepare Pending -> Upsert -> back to Loop
    connections = {
        "Webhook": {"main": [[{"node": "Read CRM", "type": "main", "index": 0}]]},
        "Read CRM": {"main": [[{"node": "Read Oral Test Queue", "type": "main", "index": 0}]]},
        "Read Oral Test Queue": {"main": [[{"node": "Split Teachers For Loop", "type": "main", "index": 0}]]},
        "Split Teachers For Loop": {"main": [[{"node": "Loop Over Teachers", "type": "main", "index": 0}]]},
        "Loop Over Teachers": {
            "main": [
                # output 0 = done
                [{"node": "Build Summary", "type": "main", "index": 0}],
                # output 1 = loop body
                [{"node": "Lookup Teacher", "type": "main", "index": 0}]
            ]
        },
        "Lookup Teacher": {"main": [[{"node": "Prepare Contract Data", "type": "main", "index": 0}]]},
        "Prepare Contract Data": {"main": [[{"node": "Copy Template", "type": "main", "index": 0}]]},
        "Copy Template": {"main": [[{"node": "Fill Placeholders", "type": "main", "index": 0}]]},
        "Fill Placeholders": {"main": [[{"node": "Prepare Pending Contract", "type": "main", "index": 0}]]},
        "Prepare Pending Contract": {"main": [[{"node": "Upsert Pending Contract", "type": "main", "index": 0}]]},
        "Upsert Pending Contract": {"main": [[{"node": "Loop Over Teachers", "type": "main", "index": 0}]]},
        "Build Summary": {"main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]}
    }

    workflow = {
        "name": "Standalone Teacher Contract Generator",
        "nodes": nodes,
        "connections": connections,
        "settings": {
            "executionOrder": "v1",
            "saveDataSuccessExecution": "all",
            "saveDataErrorExecution": "all",
            "timezone": "Europe/Paris"
        }
    }
    return workflow


def api_request(method, path, body=None):
    url = f"{N8N_URL}{path}"
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-N8N-API-KEY", N8N_API_KEY)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode('utf-8')}


def main():
    import sys
    deploy = '--deploy' in sys.argv
    wf = build_workflow()
    # Save local backup
    with open("standalone_teacher_contract_workflow.json", "w", encoding='utf-8') as f:
        json.dump(wf, f, indent=2, ensure_ascii=False)
    print(f"Local backup saved: standalone_teacher_contract_workflow.json")
    print(f"Node count: {len(wf['nodes'])}")

    if not deploy:
        print("Skipping deploy (pass --deploy to deploy)")
        return

    # Deploy
    print("Deploying to n8n...")
    status, resp = api_request("POST", "/api/v1/workflows", wf)
    if status not in (200, 201):
        print(f"ERROR deploying: {status}")
        print(json.dumps(resp, indent=2)[:2000])
        return
    workflow_id = resp.get("id")
    print(f"Workflow created: {workflow_id}")

    # Activate
    status, resp = api_request("POST", f"/api/v1/workflows/{workflow_id}/activate", {})
    if status not in (200, 201):
        print(f"ERROR activating: {status}")
        print(json.dumps(resp, indent=2)[:2000])
        return
    print(f"Workflow activated")

    # Construct webhook URL
    webhook_url = f"{N8N_URL}/webhook/generate-teacher-contracts"
    print(f"Webhook URL: {webhook_url}")
    print(f"Workflow ID: {workflow_id}")


if __name__ == "__main__":
    main()
