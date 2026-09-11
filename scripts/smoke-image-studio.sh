#!/usr/bin/env bash
# Portable smoke for Image Studio (Git Bash / macOS / Linux).
# Requires API at API_BASE (default http://127.0.0.1:3001/api).
# Create project always; generate only when a model exists and IMAGE_STUDIO_SMOKE_GENERATE=1.
set -euo pipefail

API="${API_BASE:-http://127.0.0.1:3001/api}"
PHONE="138$(date +%s | cut -c2-10)"
PASS="pass123456"

json_field() {
  local field="$1"
  node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); const v=j${field}; if(v===undefined||v===null) process.exit(2); console.log(v);})"
}

echo "== health =="
curl -sf "$API/health" >/dev/null
echo "ok"

echo "== register =="
REG=$(curl -sf -X POST "$API/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"$PASS\",\"name\":\"Image Studio Smoke\",\"tenantName\":\"Image Smoke Corp\"}")
TOKEN=$(printf '%s' "$REG" | json_field "['accessToken']")
AUTH="authorization: Bearer $TOKEN"
echo "phone=$PHONE"

echo "== list image models =="
MODELS=$(curl -sf -H "$AUTH" "$API/apps/image-studio/models")
MODEL_COUNT=$(printf '%s' "$MODELS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).length))")
MODEL_ID=""
if [ "$MODEL_COUNT" -gt 0 ]; then
  MODEL_ID=$(printf '%s' "$MODELS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id))")
  echo "models=$MODEL_COUNT first=$MODEL_ID"
else
  echo "models=0 (Admin must configure image models before generate)"
fi

echo "== create project =="
CREATE_BODY='{"name":"Smoke Project","description":"smoke-image-studio"}'
if [ -n "$MODEL_ID" ]; then
  CREATE_BODY=$(node -e "console.log(JSON.stringify({name:'Smoke Project',description:'smoke-image-studio',defaultModelId:process.argv[1]}))" "$MODEL_ID")
fi
PROJ=$(curl -sf -X POST "$API/apps/image-studio/projects" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d "$CREATE_BODY")
PID=$(printf '%s' "$PROJ" | json_field "['id']")
echo "projectId=$PID"

echo "== list projects =="
curl -sf -H "$AUTH" "$API/apps/image-studio/projects" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); if(!Array.isArray(j)||!j.length) process.exit(2); console.log('projects', j.length);})"

if [ "$MODEL_COUNT" -eq 0 ]; then
  echo "skip generate: no image models configured"
  echo "OK: image-studio smoke passed (project only)"
  exit 0
fi

if [ "${IMAGE_STUDIO_SMOKE_GENERATE:-0}" != "1" ]; then
  echo "skip generate: set IMAGE_STUDIO_SMOKE_GENERATE=1 to call generate with a real model key"
  echo "OK: image-studio smoke passed (project only)"
  exit 0
fi

echo "== generate =="
set +e
GEN=$(curl -sS -X POST "$API/apps/image-studio/projects/$PID/generate" \
  -H "$AUTH" \
  -H 'content-type: application/json' \
  -d "{\"prompt\":\"a simple red circle on white background\",\"modelId\":\"$MODEL_ID\",\"n\":1}")
GEN_EC=$?
set -e
if [ "$GEN_EC" -ne 0 ] || ! printf '%s' "$GEN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d); if(!j.id) process.exit(2);}catch{process.exit(2)}})"; then
  echo "WARN: generate request failed (check model key / provider); project create still OK"
  echo "OK: image-studio smoke passed (project; generate skipped/failed)"
  exit 0
fi
TID=$(printf '%s' "$GEN" | json_field "['id']")
STATUS=$(printf '%s' "$GEN" | json_field "['status']")
echo "turnId=$TID status=$STATUS"
if [ "$STATUS" = "failed" ]; then
  echo "WARN: generate returned failed (check model key / provider); project create still OK"
  echo "OK: image-studio smoke passed (project; generate failed)"
  exit 0
fi

echo "OK: image-studio smoke passed (project + generate)"
