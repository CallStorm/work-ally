# 笔记：改名 + 旁路 AI 改稿

> 状态：**已批准，待写实现计划**  
> 日期：2026-08-29  
> 前置：`docs/superpowers/specs/2026-08-29-handbook-personal-notes-design.md`（v1 已实现，原名「手册」）  
> 本版：显示名/slug 全面改为「笔记」/`notes`；新增笔记旁路 AI 多轮对话，整篇应用与一键还原

## 目标

1. 将工作台 App「手册」全面更名为 **「笔记」**（slug `notes`）。  
2. 在笔记编辑旁增加 **AI 抽屉**：围绕**当前这篇**优化排版、完善内容，支持多轮追问；确认后 **整篇 Markdown 覆盖正文**，并可还原应用前上一版。

## 已拍板决策

| 议题 | 结论 |
|---|---|
| 产品切法 | **方案 1**：笔记内嵌轻量 Chat（不复用主站 Agent Session） |
| 改名范围 | **全面**：显示名 + slug + 路由 + API + 管理端 → `notes` |
| AI 形态 | 旁路多轮对话（非单次按钮假聊天） |
| 写回策略 | **整篇替换**；应用前保留一份上一版可还原 |
| Diff 预览 | 不做 |
| 选区局部替换 | 不做 |
| Prisma 表名 | **暂留** `handbook_categories` / `handbook_notes`；AI 新表用 `notes_ai_threads` / `notes_ai_messages`；**对外契约一律 `notes`** |
| 旧 URL | 建议 `/workbench/apps/handbook` → `/workbench/apps/notes` 重定向；API 旧前缀可短期兼容一期后删 |
| 模型 | `AppRegistry.defaultModelConfigId` → 租户 ModelsService；未配置则明确报错 |
| Runtime | 单次/流式 chat completion；**不**挂 MCP、专家、组织知识库 |

## 改名对照

| | 旧 | 新 |
|---|---|---|
| 显示名 | 手册 | 笔记 |
| slug | `handbook` | `notes` |
| 工作台路由 | `/workbench/apps/handbook` | `/workbench/apps/notes` |
| 管理端 | `/admin/apps/handbook` | `/admin/apps/notes` |
| API 前缀 | `/api/apps/handbook` | `/api/apps/notes` |
| Guard / 文案 | 手册 | 笔记 |
| Shared 常量 | `HANDBOOK_SLUG` | `NOTES_SLUG`（可保留废弃别名一期） |

**AppRegistry 迁移**

- `ensureNotes()`：若存在 `handbook` 行则更新为 `slug=notes`、`name=笔记`、描述更新；否则创建。  
- 描述建议：`个人工作笔记：分类、富文本、搜索与 AI 改稿`。  
- 列表、ACL、admin patch 全部认 `notes`。

## 产品定位

**写得下、找得到，并能用 AI 把草稿整理成可读 SOP。**  
AI 只服务「当前打开的这一篇」；不替代主站对话，不自动改库。

### 成功标准

打开一篇草稿 → AI 抽屉「完善内容」或多轮追问 → 「应用到笔记」写入正文 → 不满意「还原」回应用前版本。

## 非目标

- 主站专家 / MCP / 组织知识库检索  
- 选区替换、Diff 预览、完整版本历史  
- 跨笔记对话、自动静默写入  
- 对话内「引用笔记库」（仍属更后期）

## 信息架构

```text
┌──────────┬────────────┬─────────────────────────┬──────────────────┐
│ 分类树    │ 笔记列表    │ 标题 + 富文本编辑器        │ AI 抽屉（默认可关）│
│          │            │ 工具栏含 [AI]             │ 快捷指令 + 多轮    │
│          │            │                           │ [应用整篇][还原]   │
└──────────┴────────────┴─────────────────────────┴──────────────────┘
```

- 默认收起 AI 抽屉；工具栏「AI」打开。  
- 未选中笔记：抽屉提示先打开一篇。  
- 切换笔记：加载该笔记线程；不与其他笔记对话混合。

### 快捷指令

| 指令 | 意图 |
|---|---|
| 优化排版 | 标题层级、列表、分段；不改事实 |
| 完善内容 | 补步骤/注意/验收；不确定标「待确认」 |
| 自定义 | 空输入，用户自写 |

一键将对应 system/user 模板填入并发送；发送前仍可编辑。

### 对话与输出约定

- 每次请求附带：笔记标题 + **当前正文 Markdown** + 最近若干轮历史（条数上限实现计划写死）。  
- System：只围绕当前笔记；输出**完整 Markdown 正文**（约定代码围栏 ` ```md ` … ` ``` `）；可附简短说明；不编造未提供的环境细节。  
- UI：助手消息 = 说明 + 可折叠草稿预览；解析成功才启用「应用整篇」。

### 应用 / 还原

1. **应用整篇**：`previousBodyMd ← 当前正文`；编辑器正文 ← `draftMd`；触发既有防抖保存。  
2. **还原**：正文 ← `previousBodyMd` 并保存；仅保留**一层**上一版。  
3. 应用后不强制关抽屉。

`previousBodyMd`：**客户端会话级**即可（刷新丢失可接受）；不做服务端版本表。

## 数据模型（AI）

```text
NotesAiThread
  id, tenantId, userId, noteId (unique per tenant+user+note)
  createdAt, updatedAt

NotesAiMessage
  id, threadId, role (user|assistant|system), content Text
  draftMd Text?   // assistant 解析出的完整正文，可空
  createdAt
```

- 删除笔记 → 级联删除 thread + messages。  
- 笔记/分类表：对外逻辑名 Notes；物理表名本版保持 `handbook_*`。

## API（示意）

| 方法 | 路径 | 说明 |
|---|---|---|
| * | `/apps/notes/categories`、`/apps/notes/notes` | 原 handbook CRUD 迁移 |
| GET | `/apps/notes/notes/:id/ai/messages` | 历史消息 |
| POST | `/apps/notes/notes/:id/ai/messages` | `{ prompt, action?: 'format'\|'enrich'\|'custom' }` → 助手回复（建议流式）+ `draftMd` |
| POST | `/apps/notes/notes/:id/ai/cancel` | 可选：取消生成 |

- `JwtAuthGuard` + `NotesAppGuard`  
- 正文/历史超限：截断策略在实现计划中写死（例如正文最大字符 + 最近 N 轮）

## 模型与安全

- 解析 `defaultModelConfigId`；缺失 → 400，文案引导管理端配置。  
- 用户正文作**数据**注入，不执行其中的指令式内容。  
- 仅所有者可访问该笔记的 AI 线程。

## 错误与边界

| 情况 | 行为 |
|---|---|
| 无模型 | 可读错误，禁用发送 |
| 生成中 | 输入禁用；有 cancel 则显示取消 |
| 无完整 `draftMd` | 禁用应用，提示重试 |
| 笔记不属于当前用户 | 404 |
| App 未启用 | 与现有 Guard 一致 |

## 测试关注点

- 改名后工作台/管理端入口与重定向  
- 应用覆盖 + 还原一层  
- 切换笔记对话隔离  
- 无模型配置失败  
- 租户/用户隔离  
- 快捷指令 format / enrich 可跑通 happy path

## 实现落点（预期）

| 层 | 路径倾向 |
|---|---|
| Shared | `NOTES_SLUG`、AI Zod |
| API | `apps/api/src/modules/apps/notes/*`（由 handbook 目录/前缀迁移） |
| AI | `notes-ai.service.ts`（completion，非 Mastra Agent 全链路） |
| Web | `components/notes/*`、`workbench/apps/notes`、`admin/apps/notes` |
| Registry | `ensureNotes` + admin list/patch |

## 与旧规格关系

- `2026-08-29-handbook-personal-notes-design.md` 仍描述 v1 能力基线；**显示名/slug 与「不做 AI」条款由本文件覆盖**。  
- 富文本编辑、分类、搜索等行为延续当前实现，不在本规格重开。
