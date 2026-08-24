# 会话资源侧栏（工作空间文件 + 会话产物）

> 状态：**待实现**  
> 日期：2026-08-23  
> 关联：`docs/requirements-baseline.md` §5.4、§5.8；`docs/superpowers/specs/2026-08-22-pi-runtime-design.md`

## 目标

在对话页右侧增加可折叠资源侧栏，让用户可以：

1. 浏览当前会话的 **工作空间文件**（Agent 沙箱实时文件树）
2. 查看 **会话产物**（Agent 写入文件的自动晋升列表，可预览/下载）

对齐 CodeBuddy 式交互：顶栏侧栏切换按钮 → 下拉切换视图 → 文件树/产物列表 → 点击预览。

## 已拍板决策

| 议题 | 结论 |
|---|---|
| 产物晋升策略 | **方案 1**：Agent 通过 `write` / `edit` 写入/修改的文件 **全部自动成为会话产物**，无需用户手动标记 |
| 沙箱作用域 | **会话级** cwd：`.data/sessions/{tenantId}/{sessionId}/`（多轮对话共享工作空间） |
| 产物中心 | **不做**独立产物库页面；仅在对话侧栏内展示（符合 §5.8 非目标） |
| 右栏演进 | 一期先上「工作空间文件 + 会话产物」；后续与 KnowledgeHit / ToolCall 合并为 Tab（§5.4） |
| 用户附件 | 本期不实现上传；`Attachment` 模型保持独立，不与产物混用 |

## 概念定义

| 概念 | 含义 | 存储 |
|---|---|---|
| **工作空间文件** | 当前会话 Agent 可读写的沙箱目录内全部文件 | 文件系统（不入库） |
| **会话产物** | Agent `write` / `edit` 触及的文件，自动索引 | `session_artifacts` 表 + 文件系统 |
| **用户附件** | 用户通过 `+` 上传的输入文件（后续） | `attachments` 表 |

```text
用户消息 → AgentRun → write/edit → 工作空间文件
                                      ↓（自动晋升）
                                   会话产物（索引 + SSE 通知）
```

**工作空间文件 vs 会话产物：**

- 工作空间文件 = 完整实时目录树（含 Agent 中间文件、脚本、缓存目录等）
- 会话产物 = Agent 写入/修改过的文件的 **扁平索引视图**（按时间倒序，带来源 run）

两者内容有重叠，但视图目的不同：工作空间用于「看 Agent 在干什么」，产物用于「拿交付物」。

## UI 设计

### 布局

```text
┌─────────────┬──────────────────────────┬──────────────────┐
│  左侧导航    │      对话消息流           │  右侧资源面板     │
│  (已有)     │      (已有)              │  (新增, 可折叠)   │
└─────────────┴──────────────────────────┴──────────────────┘
```

- **入口**：`session-chat.tsx` 顶栏右侧，侧栏切换图标（参考 CodeBuddy）
- **默认宽度**：280px，可拖拽至 400px
- **持久化**：`localStorage` 记忆开/关状态与上次选中视图
- **响应式**：宽度 < 900px 时侧栏以 overlay 形式覆盖，而非挤压对话区

### 面板结构

```text
┌─────────────────────────────────────┐
│ ☰          ↗ 全屏        ⊟ 关闭     │
├─────────────────────────────────────┤
│ [ 工作空间文件 ▾ ]                   │
├─────────────────────────────────────┤
│ 📁 output/                          │
│   📄 识字启蒙工作台.html    ● 新     │
│ 📄 报告.md                          │
│                                     │
│  (空态: "Agent 执行后将在此显示文件")  │
└─────────────────────────────────────┘
```

**视图下拉选项：**

| 视图 | 展示形式 | 排序 |
|---|---|---|
| 工作空间文件 | 目录树（可展开/折叠） | 文件夹优先，字母序 |
| 会话产物 | 扁平列表（含相对路径） | `createdAt` 倒序 |

### 交互

| 操作 | 工作空间文件 | 会话产物 |
|---|---|---|
| 单击 | 侧栏下半部预览 / overlay 预览 | 同左 |
| 下载 | 右键或 `⋯` 菜单 | 同左 |
| Agent 写入时 | 树节点高亮 + 「新」角标 | 列表顶部插入 + 侧栏按钮角标 |
| 空态 | 提示文案 + 灰色占位图标 | 「暂无产物，Agent 生成文件后将自动出现」 |

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

**bash 间接创建的文件：** 一期不自动扫描；仅 `write` / `edit` 显式触及的路径晋升。后续可加 run 结束时的目录 diff 扫描（P2）。

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

| 阶段 | 范围 | 优先级 |
|---|---|---|
| **P0** | 会话级 cwd 改造 + workspace tree API + 侧栏 UI 骨架 + 文件树 + 下载 | Must |
| **P1** | 产物自动晋升 + artifacts API + 产物列表 + md/html/代码预览 | Must |
| **P2** | SSE 实时刷新 + 侧栏角标 + run 结束目录 diff（补 bash 创建） | Should |
| **P3** | 与 KnowledgeHit / ToolCall 合并为统一右栏 Tab | Should |
| **Later** | xlsx 预览、产物跨会话引用、TTL 清理策略 | Later |

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
| bash 创建的文件不出现在产物列表 | P2 加 run 结束扫描；一期文档说明限制 |
| 大文件预览阻塞 UI | 预览限制 2MB；超出仅提供下载 |
| 磁盘无限增长 | Later：30 天 TTL + 管理员清理策略 |

## 验收标准

1. 对话页顶栏右侧可打开/关闭资源侧栏
2. 侧栏下拉可切换「工作空间文件」与「会话产物」
3. Agent `write` 文件后，产物列表自动出现该文件（无需用户操作）
4. 点击文件可预览 md/html/代码/图片，其他类型可下载
5. 多轮对话中，工作空间文件在轮次间保持可用
6. 无 session 权限的用户无法访问 workspace / artifacts API
