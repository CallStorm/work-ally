# Task 8 Smoke — Notes rename + AI

Branch: `feat/handbook`  
Date: 2026-08-30

| # | 步骤 | 期望 | 状态 | 证据 |
|---|---|---|---|---|
| 1 | 应用列表见「笔记」 | slug `notes` | **PASS** | `app-registry.service.ts` `NOTES_DEFAULT.name='笔记'`, slug `NOTES_SLUG='notes'`; `workbench/apps/page.tsx` `isNotes = app.slug === 'notes'`, meta「分类 · Markdown · 搜索 · AI」 |
| 2 | `/workbench/apps/handbook` 跳转 `/notes` | 200 redirect | **PASS** | `apps/web/src/app/workbench/apps/handbook/page.tsx` → `redirect('/workbench/apps/notes')` |
| 3 | CRUD 分类笔记 | 同前 | **PASS** | `notes-app.tsx` category/note create/update/delete + autosave; API `@Controller('apps/notes')` |
| 4 | AI 优化排版 | 返回 `draftMd`，可应用 | **PENDING** | 需已登录浏览器 + 可用模型；静态：`notes-ai-panel.tsx` format action + `onApply(draftMd)` 已接线 |
| 5 | 还原 | 回应用前 | **PENDING** | 需 Task 4 手验；静态：`notes-app.tsx` `handleApplyAi`/`handleRestoreAi` + `previousBodyMd` 一层快照 |
| 6 | 换笔记 | 对话不串 | **PASS** | `notes-ai-panel.tsx` `noteIdRef` 忽略过期 POST；`key={noteId}`；`notes-app.tsx` 切换 `selectedNoteId` 时 `setPreviousBodyMd(null)`；DB `@@unique([tenantId, userId, noteId])` |
| 7 | 无模型（可临时关） | 可读错误 | **PASS** | `models.service.ts` BadRequest「请先在管理端为笔记配置模型或添加可用模型」；admin 页新增模型下拉 + fallback 文案 |

## Static verification

```bash
cd apps/web && npx tsc --noEmit
```

**Result:** pass (exit 0)

## Live follow-up (PENDING)

- [ ] #4 format/enrich → assistant `draftMd` →「应用到笔记」
- [ ] #5「还原」恢复应用前正文
