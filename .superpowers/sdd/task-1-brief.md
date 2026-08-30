### Task 1: Shared 鈥?NOTES_SLUG + AI schemas

**Files:**
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `NOTES_SLUG = 'notes'`锛沗HANDBOOK_SLUG` 淇濈暀 `= 'notes'` 鎴?deprecated `= NOTES_SLUG`锛堣鍒掗€夊畾锛?*浜岃€呯殕涓?`'notes'`**锛岄伩鍏嶆棫 import 宕╋級
- Produces: `NotesAiActionSchema`, `CreateNotesAiMessageSchema`, types

- [ ] **Step 1: Add exports**

```ts
export const NOTES_SLUG = 'notes';
/** @deprecated use NOTES_SLUG */
export const HANDBOOK_SLUG = NOTES_SLUG;

export const NotesAiActionSchema = z.enum(['format', 'enrich', 'custom']);
export type NotesAiAction = z.infer<typeof NotesAiActionSchema>;

export const CreateNotesAiMessageSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  action: NotesAiActionSchema.optional().default('custom'),
  /** Current editor markdown snapshot from client */
  bodyMd: z.string().max(50000),
  title: z.string().trim().max(191).optional().default(''),
});
export type CreateNotesAiMessageInput = z.infer<typeof CreateNotesAiMessageSchema>;
```

淇濈暀鏃㈡湁 `CreateHandbookCategorySchema` 绛夊懡鍚嶆湰鐗堝彲涓嶆敼锛堝唴閮ㄤ粛鍙敤锛夛紝鎴栧悓姝ュ埆鍚?`CreateNotesCategorySchema = CreateHandbookCategorySchema`鈥斺€?*鏈换鍔″彧鍔?NOTES_SLUG + AI schema**锛屽垎绫?绗旇 Zod 鏀瑰悕鏀惧埌 Task 3 椤烘墜鍋氥€?

- [ ] **Step 2: tsc shared**

Run: `pnpm --filter @work-ally/shared exec tsc --noEmit`  
Expected: pass

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "feat(shared): add NOTES_SLUG and notes AI message schemas"
```

---
