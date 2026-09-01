# 会话用户附件 — 手验清单

> **Spec:** `docs/superpowers/specs/2026-09-01-session-attachments-design.md`  
> **Plan:** `docs/superpowers/plans/2026-09-01-session-attachments.md`  
> **Branch:** `feat/session-attachments`  
> **前置:** API + Web 已启动；MinIO 可用；登录有效 JWT

## 阻塞项（Task 0 Spike）

- [x] **MiniMax vision E2E blocked** — `MiniMax-M3` @ `api.minimaxi.com/anthropic` 对 image blocks 返回 HTTP 400；text-only 正常。Pi 多模态 API 已确认（`session.prompt(text, { images })`），但当前 provider 不支持 vision。实现侧已走 Pi image path + `writeModelsJson` `input: ['text','image']`（`supportsVision` 时），MiniMax 降级为 uploads 路径提示。待 provider 支持 vision 后再验「模型能描述 png」；需 follow-up issue。

## 手验项

- [ ] POST `/attachments` — 上传 txt + png + pdf，返回 `{ id, filename, mime, size }`
- [ ] 首页仅附件建会话 — 无正文，自动「请结合附件回答」；助手能引用 txt 内容
- [ ] 追问再传 pdf — 会话内 `+` 上传 pdf 并发送
- [ ] `uploads/` 有 pdf；产物侧栏无 uploads — 工作区 `session/.../uploads/` 可见 pdf；右侧交付物列表不含 uploads
- [ ] **supportsVision 开：png 问题模型能描述** — **blocked**（见上；验路径提示 + uploads 拷贝即可）
- [ ] supportsVision 关：仅路径提示 — Admin 关「支持视觉」后，png 附件上下文仅文件名/路径
- [ ] 超 5 个 / 20MB / 50MB 拒绝 — 前后端均 400 + 明确文案
- [ ] 历史消息芯片可下载 — 用户气泡下只读芯片；点击 → `GET /attachments/:id/content`

## 手验完成后

- [ ] 本清单全部可验项勾选
- [ ] 将 spec 状态改为 **已实现**（注明手验日期）
- [ ] vision blocked 项保留说明或 link follow-up issue
