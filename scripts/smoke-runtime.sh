#!/usr/bin/env bash
set -euo pipefail
API="${API_BASE:-http://127.0.0.1:3001/api}"
EMAIL="runtime-smoke-$(date +%s)@example.com"
PASS="pass123456"

echo "== health =="
curl -sf "$API/health" | tee /tmp/wa-health.json
echo

echo "== register =="
REG=$(curl -sf -X POST "$API/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Runtime Smoke\",\"tenantName\":\"Smoke Corp\"}")
echo "$REG" | tee /tmp/wa-reg.json
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/wa-reg.json','utf8')).accessToken)")
GROUP=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/wa-reg.json','utf8')).defaultGroupId)")

echo "== create session (wait) =="
SESS=$(curl -sf -X POST "$API/sessions" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d "{\"groupId\":\"$GROUP\",\"modelId\":\"auto\",\"content\":\"帮我列三个提升周报效率的方法\",\"wait\":true}")
echo "$SESS" | tee /tmp/wa-sess.json
SID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/wa-sess.json','utf8')).sessionId)")
RID=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/wa-sess.json','utf8')).runId)")

echo "== run =="
curl -sf -H "authorization: Bearer $TOKEN" "$API/runs/$RID" | tee /tmp/wa-run.json
echo

echo "== session messages =="
curl -sf -H "authorization: Bearer $TOKEN" "$API/sessions/$SID" | tee /tmp/wa-session.json
echo

node <<'NODE'
const session = JSON.parse(require('fs').readFileSync('/tmp/wa-session.json','utf8'));
const run = JSON.parse(require('fs').readFileSync('/tmp/wa-run.json','utf8'));
const assistant = session.messages.find((m) => m.role === 'assistant');
if (run.state !== 'succeeded') {
  console.error('FAIL: run state', run.state);
  process.exit(1);
}
if (!assistant?.content?.includes('mock runtime') && !assistant?.content) {
  console.error('FAIL: missing assistant message');
  process.exit(1);
}
console.log('OK: runtime smoke passed');
console.log('assistant preview:', assistant.content.slice(0, 160).replace(/\n/g, ' '));
NODE
