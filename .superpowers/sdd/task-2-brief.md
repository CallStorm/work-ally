### Task 2: Prisma 鈥?NotesAiThread / NotesAiMessage

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260829230000_notes_ai/migration.sql`

**Interfaces:**
- Produces: models linked to Tenant锛沗noteId` 鎸囧悜 `HandbookNote.id`锛堢墿鐞嗚〃浠?handbook_notes锛?

- [ ] **Step 1: schema**

鍦?Tenant 澧炲姞 `notesAiThreads NotesAiThread[]`銆傛柊澧烇細

```prisma
model NotesAiThread {
  id        String   @id @default(cuid())
  tenantId  String   @map("tenant_id")
  userId    String   @map("user_id")
  noteId    String   @map("note_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant   Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  note     HandbookNote      @relation(fields: [noteId], references: [id], onDelete: Cascade)
  messages NotesAiMessage[]

  @@unique([tenantId, userId, noteId])
  @@index([tenantId, userId])
  @@map("notes_ai_threads")
}

model NotesAiMessage {
  id        String   @id @default(cuid())
  threadId  String   @map("thread_id")
  role      String   // user | assistant | system
  content   String   @db.Text
  draftMd   String?  @map("draft_md") @db.LongText
  createdAt DateTime @default(now()) @map("created_at")

  thread NotesAiThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@index([threadId, createdAt])
  @@map("notes_ai_messages")
}
```

鍦?`HandbookNote` 涓婂鍔?`aiThreads NotesAiThread[]`銆?

- [ ] **Step 2: migration SQL** 鈥?CREATE 涓よ〃 + FK锛坣ote cascade銆乼enant cascade锛?

- [ ] **Step 3: migrate deploy + generate**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(api): add notes AI thread and message tables"
```

---
