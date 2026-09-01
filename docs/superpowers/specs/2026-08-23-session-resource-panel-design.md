# 会话资源侧栏（工作空间文件 + 会话产物）

> 状态：**已实现**（2026-08-31 手验通过；UI 以交付物优先列表落地，见下方「落地差异」）  
> 日期：2026-08-23  
> 关联：`docs/requirements-baseline.md` §5.4、§5.8；`docs/superpowers/specs/2026-08-22-pi-runtime-design.md`

## 目标

在对话页右侧增加可折叠资源侧栏，让用户可以：

1. 浏览当前会话的 **工作空间文件**（Agent 沙箱实时文件）
2. 查看 **会话产物**（自动晋升索引；侧栏以交付物优先展示，可预览/下载）

对齐 CodeBuddy 式交互：顶栏侧栏切换 → 文件列表 → 点击预览/下载。

## 落地差异（相对初稿）

| 初稿 | 现状 |
|---|---|
| 下拉切换「工作空间文件 / 会话产物」两视图 | **统一「会话文件」列表**：交付物（pptx/docx/xlsx/pdf/html/md/图片等）置顶，「其他文件」其次；`session_artifacts` 仍作索引 |
| 目录树 + 文件夹展开 | **扁平文件列表**（递归扫描后展平） |
| bash 创建仅 P2 扫描 | **已落地**：`run_finished` 前 `scanWorkspaceAndPromote`；`GET /artifacts` 也会 reconcile |
| SSE 断线无恢复说明 | SSE 对 502/503 重试；断线后 `refreshSession` + 调 artifacts 对齐；离开页可恢复近 2h 内 running/queued run |

手验（2026-08-31）：会话 `cmth1iggn000gquj0p97d3c62` — tree/artifacts 含 `xian_trip_plan.pptx`；workspace/artifact 下载 37441 bytes；删 artifact 行后 GET 可重建；植入 `smoke-new.pptx` 可晋升；UI 侧栏可见 pptx 与「下载」。

## 已拍板决策

| 议题 | 结论 |
|---|---|
| 产物晋升策略 | **方案 1 扩展**：`write` / `edit` 即时晋升；run 结束 / 列表查询时扫描工作区补齐 bash 等间接创建文件 |
| 沙箱作用域 | **会话级** cwd：`.data/sessions/{tenantId}/{sessionId}/`（多轮对话共享工作空间） |
| 产物中心 | **不做**独立产物库页面；仅在对话侧栏内展示（符合 §5.8 非目标） |
| 右栏演进 | 一期为「会话文件」交付物优先列表；后续与 KnowledgeHit / ToolCall 合并为 Tab（§5.4） |
| 用户附件 | 本期不实现上传；`Attachment` 模型保持独立，不与产物混用 |

## 概念定义

| 概念 | 含义 | 存储 |
|---|---|---|
| **工作空间文件** | 当前会话 Agent 可读写的沙箱目录内全部文件 | 文件系统（不入库） |
| **会话产物** | 工作区非隐藏文件的自动索引（含 write/edit 与 bash 扫描） | `session_artifacts` 表 + 文件系统 |
| **用户附件** | 用户通过 `+` 上传的输入文件（后续） | `attachments` 表 |

```text
用户消息 → AgentRun → write/edit/bash → 工作空间文件
                                      ↓（即时 + run 结束扫描 + GET reconcile）
                                   会话产物（索引 + SSE 通知）
                                      ↓
                                   侧栏「会话文件」（交付物优先）
```

**工作空间文件 vs 会话产物：**

- 工作空间文件 = 沙箱内实时文件（含中间脚本、JSON、缓存等）
- 会话产物 = 可下载交付物的 **索引**（同 path upsert，带来源 run）
- 侧栏当前把两者合成一个列表，用扩展名区分「交付物 / 其他文件」

## UI 设计

### 布局

```text
┌─────────────┬──────────────────────────┬──────────────────┐
│  左侧导航    │      对话消息流           │  右侧资源面板     │
│  (已有)     │      (已有)              │  (新增, 可折叠)   │
└─────────────┴──────────────────────────┴──────────────────┘
```

- **入口**：`session-chat.tsx` 顶栏右侧，侧栏切换图标
- **默认宽度**：约 300px；可放大至约 50vw（上限 520px）
- **持久化**：`localStorage` 记忆开/关（`workally.resourcePanel.open`）
- **响应式**：与对话区并排；窄屏下仍为右侧栏（未做 overlay）

### 面板结构（落地）

```text
┌─────────────────────────────────────┐
│ 会话文件 (N)          ↗放大  ⊟关闭  │
│ 交付物优先 · 可预览或下载             │
├─────────────────────────────────────┤
│ 交付物                               │
│   P  xian_trip_plan.pptx  · 36.6 KB │
│ 其他文件                             │
│   { } fix_keys.py         · 968 B   │
│   {}  plan.json           · …       │
│                                     │
│  (空态: "Agent 生成文件后将显示在这里") │
├─────────────────────────────────────┤
│ 预览区：文件名 · 大小 · [下载]        │
└─────────────────────────────────────┘
```

### 交互

| 操作 | 行为 |
|---|---|
| 单击文件行 | 底部预览区加载内容；二进制（如 pptx）显示元信息 + 下载 |
| 下载 | 预览区「下载」/「下载文件」→ `GET .../workspace/download` |
| Agent 写入 / run 结束 | SSE `artifact_*` / `workspace_file_changed` / `run_finished` 触发刷新 |
| 空态 | 「Agent 生成文件后将显示在这里」 |

### 预览能力（一期）

| MIME / 扩展名 | 预览方式 |
|---|---|
| `.md` `.txt` | Markdown / 纯文本渲染 |
| `.html` | sandbox iframe 预览 |
| 代码文件（`.ts` `.js` `.py` `.json` …） | 语法高亮 |
| 图片（`.png` `.jpg` `.gif` `.webp`） | 图片预览 |
| `.xlsx` `.docx` `.pdf` 等 | 仅下载，显示文件元信息 |

### 顶栏按钮

| 按钮 | 行为 |
|---|---|
| ☰ | 折叠为窄条（仅图标列） |
| ↗ 全屏 | 侧栏扩展至 50% 视口宽 |
| ⊟ | 关闭侧栏 |

## 数据模型

### Prisma 新增

```prisma
enum ArtifactSource {
  auto
}

model SessionArtifact {
  id         String         @id @default(cuid())
  sessionId  String         @map("session_id")
  runId      String         @map("run_id")
  path       String         // 工作空间内相对路径，如 output/report.md
  filename   String         // 末段文件名
  mimeType   String?        @map("mime_type")
  sizeBytes  Int            @default(0) @map("size_bytes")
  source     ArtifactSource @default(auto)
  createdAt  DateTime       @default(now()) @map("created_at")
  updatedAt  DateTime       @updatedAt @map("updated_at")

  session Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  run     AgentRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([sessionId, path])
  @@index([sessionId, createdAt])
  @@map("session_artifacts")
}
```

`Session` 增加 `artifacts SessionArtifact[]`；`AgentRun` 增加 `artifacts SessionArtifact[]`。

### 文件系统布局变更

```text
Before: .data/runs/{tenantId}/{runId}/
After:  .data/sessions/{tenantId}/{sessionId}/
```

`RuntimePathsService` 新增 `sessionWorkspaceDir(tenantId, sessionId)`；`runSandboxDir` 保留但标记 deprecated，Pi runner 改用 session 路径。

## 自动晋升规则

当 Pi runtime 完成 `write` 或 `edit` 工具调用后：

1. 从 `tool_result` 解析目标文件相对路径
2. 校验路径在 session workspace 内（防目录穿越）
3. 读取文件 stat（size、mtime）
4. 推断 mime（扩展名映射）
5. `upsert` `SessionArtifact`（同 path 更新 `updatedAt` / `sizeBytes`）
6. 推送 SSE `artifact_created` 或 `artifact_updated`

**排除规则（不晋升、不出现在产物列表，但仍可在工作空间树中看到）：**

- 以 `.` 开头的隐藏文件/目录（如 `.pi-agent/`）
- `node_modules/` 目录下文件
- 零字节文件

**bash 间接创建的文件：** run 成功结束前 `scanWorkspaceAndPromote`；`GET /sessions/:id/artifacts` 也会全量 reconcile（补漏、支持刷新后恢复）。

## API 设计

所有端点需 JWT 鉴权，并校验当前用户对 session 所属 group 的访问权（复用 `SessionsService` 现有权限逻辑）。

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/sessions/:id/workspace/tree` | 递归文件树 `{ name, path, type, size, mtime }[]` |
| `GET` | `/sessions/:id/workspace/files?path=` | 读取文件内容；`Accept` 决定 inline 或 attachment |
| `GET` | `/sessions/:id/artifacts` | 产物列表（分页可选，默认全量） |
| `GET` | `/sessions/:id/artifacts/:artifactId/content` | 产物内容（预览用） |

**SSE 新增事件类型：**

```ts
type WorkspaceEvent =
  | { type: 'artifact_created'; data: { artifactId; path; filename; mimeType; sizeBytes } }
  | { type: 'artifact_updated'; data: { artifactId; path; sizeBytes } }
  | { type: 'workspace_file_changed'; data: { path; action: 'created' | 'modified' | 'deleted' } };
```

`workspace_file_changed` 用于刷新文件树；`artifact_*` 用于刷新产物列表。

### 响应示例

**GET /sessions/:id/workspace/tree**

```json
{
  "root": ".",
  "entries": [
    { "name": "output", "path": "output", "type": "directory", "children": [
      { "name": "识字启蒙工作台.html", "path": "output/识字启蒙工作台.html", "type": "file", "size": 12480, "mtime": "2026-08-23T11:30:00Z" }
    ]},
    { "name": "报告.md", "path": "报告.md", "type": "file", "size": 2048, "mtime": "2026-08-23T11:28:00Z" }
  ]
}
```

## 后端模块

```
apps/api/src/modules/workspace/
  workspace.module.ts
  workspace.controller.ts
  workspace.service.ts       # 文件树扫描、内容读取、路径校验
  artifact.service.ts        # 产物 upsert、列表查询
  mime.util.ts               # 扩展名 → mime
```

**Runtime 改造：**

- `runtime-paths.service.ts`：新增 `sessionWorkspaceDir`
- `pi-runner.service.ts`：`cwd` 改为 `sessionWorkspaceDir(tenantId, sessionId)`；`write`/`edit` tool_result 后调用 `ArtifactService.upsertFromToolResult`
- `runtime.controller.ts`（SSE）：转发 workspace 事件

## 前端组件

```
apps/web/src/components/
  session-resource-panel.tsx           # 侧栏容器 + 开/关状态
  session-resource-panel/
    panel-header.tsx
    view-selector.tsx                  # 工作空间文件 / 会话产物
    file-tree.tsx
    artifact-list.tsx
    file-preview.tsx
  session-chat.tsx                     # 集成 toggle 按钮 + 布局
```

**数据获取：**

- 侧栏打开时 `GET /workspace/tree` + `GET /artifacts`
- 订阅当前 run SSE，监听 `artifact_*` / `workspace_file_changed` 增量刷新
- run 结束后 fallback 全量 refresh

**类型（`apps/web/src/lib/types.ts`）：**

```ts
type WorkspaceEntry = {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  mtime?: string;
  children?: WorkspaceEntry[];
};

type SessionArtifact = {
  id: string;
  path: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number;
  runId: string;
  createdAt: string;
  updatedAt: string;
};
```

## 用户流程

### 流程 1：Agent 生成文件（主路径）

```text
用户发送任务
  → POST /sessions/:id/messages
  → Pi 在 session workspace 执行 write
  → artifact_created SSE
  → 侧栏角标 +1，产物列表顶部出现新文件
  → 用户点击侧栏按钮 → 预览文件
```

### 流程 2：多轮续写

```text
第一轮：write 报告.md
第二轮：edit 报告.md（追加章节）
  → artifact_updated SSE
  → 产物列表中同 path 条目更新 updatedAt
  → 工作空间树中文件保持，预览显示最新内容
```

### 流程 3：浏览工作空间

```text
用户打开侧栏 → 选择「工作空间文件」
  → 展开目录树 → 点击文件 → 预览
  → 可下载任意工作空间文件（不仅限于产物）
```

## 分期交付

| 阶段 | 范围 | 优先级 | 状态 |
|---|---|---|---|
| **P0** | 会话级 cwd + workspace tree/download API + 侧栏 + 下载 | Must | **已落地**（扁平列表） |
| **P1** | 产物自动晋升 + artifacts API + md/html/代码/图片预览 | Must | **已落地** |
| **P2** | SSE 刷新 + run 结束扫描（bash）+ 断线 refresh/reconcile | Should | **已落地** |
| **P3** | 与 KnowledgeHit / ToolCall 合并为统一右栏 Tab | Should | 待做 |
| **Later** | xlsx 预览、产物跨会话引用、TTL 清理策略 | Later | 待做 |

## 非目标（本期）

- 独立产物库 / 导出中心页面
- 用户手动标记/取消产物（已选自动晋升，不提供手动操作）
- 用户文件上传（`+` 添加文件，另开任务）
- 产物版本历史 / diff
- 跨组分享产物
- 在线编辑工作空间文件

## 安全

- 所有文件 API 校验 `path` 不含 `..`，且 resolve 后落在 session workspace 内
- 下载/预览接口复用 session 权限校验
- `.html` 预览使用 sandbox iframe（`sandbox=""`，禁脚本）
- session workspace 目录权限 `0700`

## 风险

| 风险 | 缓解 |
|---|---|
| 会话级 cwd 改造影响现有 per-run 沙箱数据 | 迁移脚本：首次访问时从最近 run 目录 copy（若 session workspace 为空） |
| bash 创建的文件不出现在产物列表 | 已用 run 结束扫描 + GET artifacts reconcile 缓解 |
| 大文件预览阻塞 UI | 预览限制 2MB；超出仅提供下载 |
| 磁盘无限增长 | Later：30 天 TTL + 管理员清理策略 |

## 验收标准

1. 对话页顶栏右侧可打开/关闭资源侧栏 — **通过**
2. 侧栏以交付物优先列出会话文件（不再要求双视图下拉）— **通过**
3. Agent `write` / bash 生成文件后，列表与 artifacts 索引出现该文件 — **通过**（含 pptx）
4. 点击文件可预览 md/html/代码/图片；pptx 等二进制可下载 — **通过**
5. 多轮对话中，工作空间文件在轮次间保持可用 — **通过**
6. 无 session 权限的用户无法访问 workspace / artifacts API — （鉴权守卫保留；本次未做负例手验）
7. SSE 断线或 API 重启后 refresh/reconcile 可恢复文件列表 — **通过**（代码路径 + artifacts reconcile 手验）
