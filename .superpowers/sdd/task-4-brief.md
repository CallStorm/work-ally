### Task 4: ModelsService 鈥?multi-turn completion with modelConfigId

**Files:**
- Modify: `apps/api/src/modules/models/models.service.ts`
- Modify: `models.module.ts` 鈥?`exports: [ModelsService]`
- Modify: `apps.module.ts` 鈥?`imports: [ModelsModule]`

**Interfaces:**
- Produces:

```ts
async completeChatMessages(input: {
  tenantId: string;
  modelConfigId?: string | null;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
}): Promise<string>
```

- Prefer `resolveCredentials({ tenantId, modelConfigId })`锛涜嫢鏃?config 鍒?`resolveFirstAvailableCredentials`锛涗粛鏃犲垯 BadRequest銆岃鍏堝湪绠＄悊绔负绗旇閰嶇疆妯″瀷鎴栨坊鍔犲彲鐢ㄦā鍨嬨€?

- [ ] **Step 1: Implement** 鈥?澶嶇敤鐜版湁 `completeChat` 鐨?fetch `/v1/messages` 閫昏緫锛宍messages` 鏁扮粍浼犲叆锛沗system` 鐙珛瀛楁

- [ ] **Step 2: tsc**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(api): support multi-turn chat completion with modelConfigId"
```

---
