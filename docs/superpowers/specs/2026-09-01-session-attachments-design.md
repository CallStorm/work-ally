# 会话用户附件上传

> 状态：**实现中（待手验）** — 代码已合入 `feat/session-attachments`；手验清单见 `.superpowers/sdd/session-attachments-smoke.md`。MiniMax vision E2E blocked（Task 0 spike）。  
> 日期：2026-09-01  
> 关联：`docs/requirements-baseline.md` §8.3 / 附件与 MinIO；`docs/superpowers/specs/2026-08-23-session-resource-panel-design.md`（附件 ≠ 产物）

## 目标

用户在**首页新建任务**与**会话追问**两处可通过 `+` →「文件」上传附件；发消息时带上 `attachmentIds`。Run 前装配：文本进模型上下文、办公原件进会话工作区、图片在模型开启视觉时走多模态。

## 已拍板决策

| 议题 | 结论 |
|---|---|
| 一期能力 | 上传 + 文本可读 + 办公抽文本；图片多模态（可配置） |
| 视觉开关 | `ModelConfig.supportsVision`（Admin）；开则组 image parts，关则仅文件名/路径提示 |
| 上传入口 | 首页 composer + 会话追问，两处都有 |
| 进 Agent 方式 | 文本/图片走上下文；`pdf`/`docx`/`xlsx` 原件再拷入工作区供工具读 |
| 限额 | 每条消息最多 **5** 个；单文件 ≤ **20MB**；合计 ≤ **50MB** |
| 办公格式 | `pdf` + `docx` + `xlsx` |
| 文本格式 | `md` / `txt` / `json` / `csv` |
| 图片格式 | `png` / `jpg` / `jpeg` / `webp` / `gif` |
| 架构 | **薄上传 + Run 时装配**（方案 1） |
| 与产物边界 | 附件不进入资源侧栏「交付物」；`uploads/` 不自动晋升 `SessionArtifact` |

## 非目标（本期）

- 独立附件库 / 跨会话附件浏览页
- pptx 抽文本、扫描版 PDF OCR
- 粘贴截图为必须能力（拖拽可顺手加）
- 附件混入会话产物列表
- 已绑定消息的附件删除（防历史空洞）

## 架构概览

```text
选文件 → POST /attachments → MinIO + Attachment 行 → 芯片 ids
                ↓
POST /sessions | /sessions/:id/messages（attachmentIds）
                ↓
Runtime 装配（AttachmentAssemblyService）
  ├─ 文本类 / 办公抽文本 → 拼进 user 上下文（缓存 extractedText）
  ├─ pdf/docx/xlsx 原件 → session/uploads/
  └─ 图片 → uploads/；supportsVision 则多模态 image parts
                ↓
Pi / Runtime 执行
```

## 数据模型

### Attachment（扩展现表）

现有字段保留：`id, tenantId, uploaderId, filename, mime, size, storageKey, createdAt`。

新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| `extractedText` | `String? @db.LongText` | Run 装配后缓存；可空表示未抽或失败 |

`storageKey` 约定：`tenants/{tenantId}/attachments/{attachmentId}/{filename}`。

### ModelConfig

新增：`supportsVision Boolean @default(false)`，Admin 可改。

## 存储

- 新增薄 `ObjectStorageService`（MinIO S3 API：put / get / delete）；env 已有 `MINIO_*`
- 工作区拷贝：`.data/sessions/{tenantId}/{sessionId}/uploads/{safeFilename}`
- Artifact 排除：`uploads/` 前缀（或等价规则）不自动晋升

## API

均需 JWT；租户隔离。

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/attachments` | `multipart` 字段 `file`；类型 + 单文件 ≤20MB；返回 `{ id, filename, mime, size }` |
| `GET` | `/attachments/:id` | 元数据；一期仅 **uploader 本人** |
| `GET` | `/attachments/:id/content` | 下载/预览原件；鉴权同上 |
| `DELETE` | `/attachments/:id` | 未出现在任何 `Message.attachmentIds` 时可删；已绑定 → **403** |
| `PATCH` | `/admin/models/:id` | 现有 body 增加 `supportsVision?: boolean` |

发消息沿用：

- `POST /sessions`、`POST /sessions/:id/messages` 的 `attachmentIds[]`
- 额外校验：归属当前用户+租户、≤5 个、合计 ≤50MB
- 一期允许同用户复用尚未删除的附件 id

错误：

- 类型不支持 / 超限 → `400` + 明确文案
- MinIO 失败 → `502`；避免孤儿对象（失败时尽量清理）

实现模式对齐现有 `skills` 上传：`FileInterceptor` + 前端 `FormData` / `apiFetch`。

## Runtime 装配

触发：`RuntimeService` 在调 Pi 前，对本条 user message 的 `attachmentIds` 装配（建议 `AttachmentAssemblyService`）。

步骤：

1. 校验归属与限额  
2. **文本类**：读 MinIO → UTF-8（每文件抽取结果截断，建议 100KB）→ 写 `extractedText`  
3. **pdf / docx / xlsx**：抽文本（失败则上下文注明）+ 原件拷入 `uploads/`  
4. **图片**：拷入 `uploads/`；若 `supportsVision` 则组多模态 image  

字符串层上下文（所有模型）示例：

```text
（用户原文或默认「请结合附件回答」）

---
[附件: report.pdf]
（抽取文本或「已保存到 uploads/report.pdf」）
---
[附件: photo.png] → uploads/photo.png
```

### 多模态与 Pi

当前 Pi 入口为 `session.prompt(string)`。实现计划须含 **spike**：

1. 若 Pi / anthropic-messages 支持 image content blocks → 用户消息用 `text` + `image` parts（从 MinIO 取字节）  
2. 若暂不支持 → 阻塞项：图仍进 `uploads/` + 提示模型查看路径；Admin 标明视觉依赖 Runtime 能力；再定补丁（例如 vision 专用 provider 调用）

产品目标仍是 **真正多模态**，不以「仅路径提示」为最终验收。

### 抽文本库（实现期）

| 格式 | 建议 |
|---|---|
| pdf | `pdf-parse` 一类 |
| docx | `mammoth` |
| xlsx | SheetJS / `xlsx`，读前 N 行 |

单附件抽取失败不阻断 Run。

## 前端

### 共用

- `AttachmentChips` + 隐藏 `input[type=file][multiple]` + `accept` 白名单  
- 芯片：名、大小、上传中/失败、移除  
- 前端同步校验个数 / 单文件 / 合计  

### 首页

- `ComposerAddons`：`+` →「文件」去掉「即将推出」，触发选文件  
- 芯片展示在输入区附近  
- `POST /sessions` **顶层**传 `attachmentIds`（修正今日把空数组塞进 `context` 的占位）  
- 允许仅附件无正文：发送时若正文为空，自动填「请结合附件回答」  

### 会话追问

- 输入条增加 `+` / 回形针，同上  
- `POST .../messages` 带 `attachmentIds`  
- 历史用户气泡下只读芯片；点击 → `GET /attachments/:id/content`  

### Admin

- 模型编辑增加「支持视觉」→ `supportsVision`  

### UI 非目标

- 附件不进右侧「会话文件」交付物列表  
- 粘贴截图非必须  

## 安全

- 路径与文件名净化（防 `..` / 绝对路径）  
- `uploads/` 与 workspace 路径校验同现有 workspace 服务  
- 内容接口鉴权：一期仅 uploader；后续若组内共享会话再放宽  

## 验收标准

1. 首页与会话追问均可上传白名单文件，芯片可移除  
2. 超限（个数 / 20MB / 50MB）前后端均拒绝并提示  
3. 文本/办公附件出现在模型上下文（或抽取失败说明）；`pdf/docx/xlsx` 出现在 `session/.../uploads/`  
4. `supportsVision=true` 时图片以多模态方式交给模型（spike 通过后）；`false` 时仅路径/文件名提示  
5. `uploads/` 文件不出现在产物/交付物自动晋升列表  
6. 历史消息可看到附件芯片并下载  
7. Admin 可切换模型「支持视觉」  

## 风险

| 风险 | 缓解 |
|---|---|
| Pi 暂不支持 image parts | 实现计划首任务 spike；失败则显式阻塞，不假装完成多模态 |
| 大 PDF 抽文本慢/占内存 | 截断 + 超时；失败降级为仅工作区文件 |
| MinIO 未启动 | 上传返回明确 502；dev-setup 已含 MinIO |
| 文件名冲突 | `uploads/` 内重名加短后缀 / attachmentId 前缀 |
