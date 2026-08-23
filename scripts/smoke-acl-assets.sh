#!/usr/bin/env bash
set -euo pipefail
API="${API_BASE:-http://127.0.0.1:3001/api}"
PHONE="138$(date +%s | tail -c 9)"

REG=$(curl -sf -X POST "$API/auth/register" -H 'content-type: application/json' \
  -d "{\"phone\":\"$PHONE\",\"password\":\"pass123456\",\"name\":\"Acl Admin\",\"tenantName\":\"Acl Corp\"}")
TOKEN=$(echo "$REG" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).accessToken))")
AUTH="authorization: Bearer $TOKEN"

echo "== create skill =="
SKILL=$(curl -sf -X POST "$API/skills" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"周报助手","slug":"weekly-report","descriptionShort":"写周报","bodyMd":"# 周报\n按要点输出","visibility":"private"}')
SID=$(echo "$SKILL" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")
echo "$SID"

echo "== create expert =="
EXP=$(curl -sf -X POST "$API/experts" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"name\":\"行政专家\",\"personaMd\":\"你是行政助手\",\"suggestedPrompts\":[\"帮我写请假说明\"],\"skillIds\":[\"$SID\"],\"visibility\":\"private\"}")
EID=$(echo "$EXP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")

echo "== create connector =="
CONN=$(curl -sf -X POST "$API/connectors" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Demo MCP","transport":"sse","endpointUrl":"https://example.com/sse","credentials":"secret-token","visibility":"private"}')
CID=$(echo "$CONN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).id))")

echo "== share expert to tenant =="
curl -sf -X PUT "$API/resources/experts/$EID/acl" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"visibility":"tenant","entries":[]}' >/tmp/acl.json
cat /tmp/acl.json; echo

echo "== lists =="
curl -sf -H "$AUTH" "$API/skills" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('skills', JSON.parse(d).length))"
curl -sf -H "$AUTH" "$API/experts" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('experts', JSON.parse(d).length))"
curl -sf -H "$AUTH" "$API/connectors" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d); if(j[0].credentialsEnc) process.exit(2); console.log('connectors', j.length)})"
curl -sf -H "$AUTH" "$API/default-agent" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('defaultAgent', !!JSON.parse(d).id))"
curl -sf -H "$AUTH" "$API/models" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('models', JSON.parse(d).length))"

echo "OK: acl/assets smoke passed"
