### Task 3: Registry + API rename handbook 鈫?notes

**Files:**
- Modify: `app-registry.service.ts`锛坋nsureNotes锛氳嫢鏈?handbook 鍒?update slug/name/description锛?
- Rename/move: `handbook-app.guard.ts` 鈫?`notes-app.guard.ts`
- Move dir: `apps/api/src/modules/apps/handbook/` 鈫?`notes/`锛沜ontroller `@Controller('apps/notes')`
- Modify: `admin-apps.controller.ts`銆乣auth.service.ts`銆乣apps.module.ts`
- Optional: 鐭湡淇濈暀 `@Controller('apps/handbook')` 绌哄３ redirect鈥斺€?*鏈増涓嶅仛 API 鍙屾寕**锛屽彧鍋?Web 椤?redirect

**Interfaces:**
- `getNotesForUser` / `updateNotes` / `NOTES_DEFAULT`
- Guard 鏂囨锛歚鏃犳潈浣跨敤绗旇搴旂敤`

- [ ] **Step 1: ensureNotes**

```ts
export const NOTES_DEFAULT = {
  slug: NOTES_SLUG,
  name: '绗旇',
  description: '涓汉宸ヤ綔绗旇锛氬垎绫汇€佸瘜鏂囨湰銆佹悳绱笌 AI 鏀圭',
};

async ensureNotes(tenantId: string, ownerUserId: string) {
  const asNotes = await this.prisma.appRegistry.findUnique({
    where: { tenantId_slug: { tenantId, slug: NOTES_SLUG } },
  });
  if (asNotes) {
    if (asNotes.name !== NOTES_DEFAULT.name || !asNotes.description.includes('AI')) {
      return this.prisma.appRegistry.update({
        where: { id: asNotes.id },
        data: {
          name: NOTES_DEFAULT.name,
          description: NOTES_DEFAULT.description,
        },
      });
    }
    return asNotes;
  }
  const legacy = await this.prisma.appRegistry.findUnique({
    where: { tenantId_slug: { tenantId, slug: 'handbook' } },
  });
  if (legacy) {
    return this.prisma.appRegistry.update({
      where: { id: legacy.id },
      data: {
        slug: NOTES_SLUG,
        name: NOTES_DEFAULT.name,
        description: NOTES_DEFAULT.description,
      },
    });
  }
  return this.prisma.appRegistry.create({
    data: {
      tenantId,
      slug: NOTES_SLUG,
      name: NOTES_DEFAULT.name,
      description: NOTES_DEFAULT.description,
      ownerUserId,
      visibility: 'tenant',
      enabled: true,
    },
  });
}
```

`listForUser` / admin锛氳皟鐢?`ensureNotes` 鏇夸唬 `ensureHandbook`銆?

- [ ] **Step 2: Move services/controller to `notes/`锛屽墠缂€ `apps/notes`**

鍐呴儴浠嶇敤 `prisma.handbookCategory` / `handbookNote`銆?

- [ ] **Step 3: Admin patch 璁?`NOTES_SLUG`锛沘uth seed 鐢?notes**

- [ ] **Step 4: tsc api**

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(api): rename handbook app surface to notes"
```

---
