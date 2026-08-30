### Task 5: Notes AI service + routes

**Files:**
- Create: `apps/api/src/modules/apps/notes/notes-ai.service.ts`
- Modify: `notes.controller.ts`锛堟垨 handbook 杩佸悗鐨?controller锛?

**Interfaces:**
- `listMessages(user, noteId)`
- `postMessage(user, noteId, input: CreateNotesAiMessageInput)` 鈫?`{ messages: [...], assistant: { content, draftMd } }`
- Helpers: `truncateBody(bodyMd)`, `parseDraftMd(text)`, `buildSystem(action)`, `ensureThread`

**System prompts (verbatim):**

format:
`浣犳槸绗旇鎺掔増鍔╂墜銆傚彧鏍规嵁鐢ㄦ埛鎻愪緵鐨勬爣棰樹笌姝ｆ枃鏁寸悊缁撴瀯锛堟爣棰樺眰绾с€佸垪琛ㄣ€佸垎娈碉級锛屼笉瑕佺紪閫犳湭鍑虹幇鐨勪簨瀹炪€傚繀椤诲湪鍥炲鏈熬缁欏嚭瀹屾暣 Markdown 姝ｆ枃锛屾斁鍦ㄥ敮涓€鐨?md 鍥存爮涓細浠ヤ笁鍙嶅紩鍙?md 寮€濮嬨€佷笁鍙嶅紩鍙风粨鏉熴€俙

enrich:
`浣犳槸 SOP/宸ヤ綔娴佺▼鍐欎綔鍔╂墜銆傚湪涓嶇紪閫犲叿浣撶幆澧冪粏鑺傜殑鍓嶆彁涓嬶紝琛ュ叏姝ラ銆佹敞鎰忛」涓庨獙鏀堕」锛涗笉纭畾澶勬爣娉ㄣ€屽緟纭銆嶃€傚繀椤诲湪鍥炲鏈熬缁欏嚭瀹屾暣 Markdown 姝ｆ枃锛屾斁鍦ㄥ敮涓€鐨?md 鍥存爮涓€俙

custom: 鍚屼笂閫氱敤绾︽潫 + 鐢ㄦ埛 prompt銆?

**parseDraftMd:** 鍙栨渶鍚庝竴涓?` ```md ` 鈥?` ``` ` 鍐呮枃鏈紱鑻ユ棤鍒欏皾璇曚换鎰?` ``` ` 鍥存爮锛涗粛鏃犲垯 `draftMd=null`銆?

**History:** 鏈€杩?8 鏉?user/assistant锛堜笉鍚?system 琛屽叆搴撲篃鍙紱system 姣忔鐜版嫾锛夈€?

**body truncate:** `bodyMd.length > 12000` 鈫?`bodyMd.slice(0, 12000) + '\n\n鈥?宸叉埅鏂?'`

- [ ] **Step 1: Implement service** 鈥?鏍￠獙 note 褰掑睘锛涘啓 user message锛涜皟 completeChatMessages锛涘啓 assistant锛坈ontent 鍏ㄦ枃 + draftMd锛夛紱杩斿洖

- [ ] **Step 2: Routes**

```ts
@Get('notes/:id/ai/messages')
@Post('notes/:id/ai/messages')
```

鏈増 **涓嶅仛** cancel 娴佸紡锛堜竴娆℃€ц繑鍥烇紝YAGNI锛夛紱鑻ヨ€楁椂杩囬暱鍙悗缁姞銆?

- [ ] **Step 3: 鎵嬮獙** 鈥?鏈夋ā鍨嬫椂 format锛涙棤妯″瀷 400

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): notes AI thread messages for format and enrich"
```

---
