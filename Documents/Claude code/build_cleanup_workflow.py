"""
One-shot cleanup workflow: webhook POST /cleanup-teacher-contracts with {studentEmail}
Deletes all teacher-type Pending Contract rows for that student (except ones already Sent/Signed).
"""
import json
import urllib.request

N8N_URL = "https://learninggoalsformations.app.n8n.cloud"
N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzMWIxNzlkZC1kZDRhLTQyYTEtYmFkNi0yOTU0M2ZkM2M3MjAiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzYxMmRiMTgtNGJlOS00NjY1LWFmYTMtZWU5MGRjYzVhNjk0IiwiaWF0IjoxNzcyNzI1Mjk5fQ.adwzSRIt_GArw1uTBR5r-tl78K3x8N-Rk0VjUMgdVBU"
DT_PENDING = "ab7d375L1CabAJYs"

FILTER_CODE = r"""
const studentEmail = ($('Webhook').first().json.body.studentEmail || '').trim().toLowerCase();
const teacherFilter = ($('Webhook').first().json.body.teacherName || '').trim().toLowerCase();
if (!studentEmail) throw new Error('studentEmail required');

const allContracts = $input.all();
const toDelete = allContracts.filter(it => {
  const c = it.json;
  const matchesStudent = (c.studentEmail || '').toLowerCase().trim() === studentEmail;
  const isTeacher = (c.contractType || '').toLowerCase() === 'teacher';
  const isDraftOrEmpty = !['sent','signed','awaiting signature'].includes((c.status || '').toLowerCase());
  let matchesTeacher = true;
  if (teacherFilter) {
    matchesTeacher = (c.teacherName || '').toLowerCase().includes(teacherFilter);
  }
  return matchesStudent && isTeacher && isDraftOrEmpty && matchesTeacher;
});

return toDelete.map(it => ({ json: { rowId: it.json.id || it.json.rowId || it.json.row_number, ...it.json } }));
"""

SUMMARY_CODE = r"""
const deleted = $input.all();
return [{
  json: {
    success: true,
    deletedCount: deleted.length,
    deletedRows: deleted.map(d => ({
      id: d.json.id,
      teacher: d.json.teacherName,
      status: d.json.status
    }))
  }
}];
"""

nodes = [
    {
        "parameters": {
            "httpMethod": "POST",
            "path": "cleanup-teacher-contracts",
            "responseMode": "responseNode",
            "options": {}
        },
        "id": "wh-01",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 2,
        "position": [240, 400],
        "webhookId": "cleanup-teacher-contracts"
    },
    {
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
        "id": "read-01",
        "name": "Read All Contracts",
        "type": "n8n-nodes-base.dataTable",
        "typeVersion": 1,
        "position": [460, 400]
    },
    {
        "parameters": {"jsCode": FILTER_CODE},
        "id": "filter-01",
        "name": "Filter Rows to Delete",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [680, 400]
    },
    {
        "parameters": {
            "operation": "delete",
            "dataTableId": {
                "__rl": True,
                "value": DT_PENDING,
                "mode": "list",
                "cachedResultName": "Pending Contracts"
            },
            "filters": {
                "conditions": [
                    {"keyName": "id", "keyValue": "={{ $json.id }}"}
                ]
            }
        },
        "id": "delete-01",
        "name": "Delete Row",
        "type": "n8n-nodes-base.dataTable",
        "typeVersion": 1,
        "position": [900, 400],
        "onError": "continueRegularOutput",
        "alwaysOutputData": True
    },
    {
        "parameters": {"jsCode": SUMMARY_CODE},
        "id": "summary-01",
        "name": "Build Summary",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [1120, 400]
    },
    {
        "parameters": {
            "respondWith": "json",
            "responseBody": "={{ $json }}",
            "options": {}
        },
        "id": "respond-01",
        "name": "Respond",
        "type": "n8n-nodes-base.respondToWebhook",
        "typeVersion": 1.1,
        "position": [1340, 400]
    }
]

connections = {
    "Webhook": {"main": [[{"node": "Read All Contracts", "type": "main", "index": 0}]]},
    "Read All Contracts": {"main": [[{"node": "Filter Rows to Delete", "type": "main", "index": 0}]]},
    "Filter Rows to Delete": {"main": [[{"node": "Delete Row", "type": "main", "index": 0}]]},
    "Delete Row": {"main": [[{"node": "Build Summary", "type": "main", "index": 0}]]},
    "Build Summary": {"main": [[{"node": "Respond", "type": "main", "index": 0}]]}
}

wf = {
    "name": "Cleanup Teacher Contracts (one-shot)",
    "nodes": nodes,
    "connections": connections,
    "settings": {"executionOrder": "v1"}
}

with open("cleanup_workflow.json", "w", encoding='utf-8') as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)

body = json.dumps(wf).encode('utf-8')
req = urllib.request.Request(f"{N8N_URL}/api/v1/workflows", data=body, method='POST')
req.add_header("X-N8N-API-KEY", N8N_API_KEY)
req.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        r = json.loads(resp.read().decode('utf-8'))
        wid = r['id']
        print(f"Created workflow: {wid}")

    # Activate
    req = urllib.request.Request(f"{N8N_URL}/api/v1/workflows/{wid}/activate", method='POST')
    req.add_header("X-N8N-API-KEY", N8N_API_KEY)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, data=b'{}', timeout=30) as resp:
        r = json.loads(resp.read().decode('utf-8'))
        print(f"Active: {r.get('active')}")
    print(f"Webhook: {N8N_URL}/webhook/cleanup-teacher-contracts")
except urllib.error.HTTPError as e:
    print(f"ERROR {e.code}: {e.read().decode('utf-8')[:1000]}")
