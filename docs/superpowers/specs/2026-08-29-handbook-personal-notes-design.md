# 手册：个人工作知识笔记

> 状态：**已批准，待写实现计划**  
> 日期：2026-08-29  
> 定位：工作台内置 App；与闪签（日程任务）、组织知识库（Dify/RAGFlow）并列、互不替代  
> 原则：先做人用的独立好用 App；数据与 API 结构化预留，**第一版不做**对话内检索/引用

## 目标

为企业内员工提供 **个人工作手册**：沉淀操作流程、SOP、排障备忘、常用命令说明等偏工作内容；用时靠 **分类树 + 全局搜索** 快速找回。

- 显示名：**手册**
- slug：`handbook`
- 路由：`/workbench/apps/handbook`
- API 前缀：`/api/apps/handbook`
- 编辑格式：**Markdown**
- 数据隔离：`(tenantId, userId)`，默认不共享

## 已拍板决策

| 议题 | 结论 |
|---|---|
| 产品形态 | 工作台 App（方案 1），与闪签同级注册 |
| 使用者 | 企业内员工个人，不做协作 |
| 内容重心 | 工作流程 / SOP / 操作备忘，非日记、非日程 |
| 组织方式 | 左侧分类树 + 顶部全局搜索（分类最多 2 层） |
| 正文 | Markdown（编辑为主，可切换简易预览） |
| 与闪签 | 不重叠：无日期强制、无待办完成态、无日历、无提醒调度 |
| 与组织知识库 | 不替代：组织库继续第三方 RAG；手册是自建个人笔记 |
| AI 引用 | 第一版不做；预留稳定 CRUD/搜索契约与 Markdown 存储 |
| 不做（v1） | 分享、协作、双向链接、标签体系、附件重管理、富文本、版本历史、模板库、与闪签互链、分块索引/embedding、对话挂载 |

## 产品定位

**写得下流程、找得到流程。**  
比聊天更稳（结构、可重复打开、可改）；比组织知识库更轻（个人、即时、无第三方库配置）。

### 典型场景

- 运维：发布前检查步骤、某服务重启顺序、常见报错处理
- 支撑：账号开通步骤、客户环境差异备忘
- 个人：本岗位反复用到的操作说明

### 成功标准（人用）

能在约 1 分钟内新建一篇流程笔记；需要时靠分类或搜索在数秒内打开对应笔记。

## 边界

| 能力 | 管什么 | 不管什么 |
|---|---|---|
| **闪签** | 日程、待办、提醒、时间轴 | 长文流程、可检索知识正文 |
| **组织知识库** | Dify/RAGFlow 等、组织级检索 | 个人随手写的流程文档 |
| **手册** | 个人分类、Markdown 笔记、库内搜索 | 协作发布、对话自动召回（v1） |

## 信息架构

```text
┌─────────────────────────────────────────────────────────────────┐
│  手册                          [ 搜索标题/正文… ]                 │
├──────────────┬────────────────────┬─────────────────────────────┤
│ 分类树        │ 笔记列表            │ 标题                         │
│ · 全部        │ 标题 · 更新时间      │ ─────────────────────────── │
│ · 未分类      │ + 新建              │ Markdown 编辑 | 预览         │
│ · 用户分类…   │                    │                             │
│   （≤2 层）   │                    │                             │
└──────────────┴────────────────────┴─────────────────────────────┘
```

- 包在现有 `WorkbenchShell` 内
- 管理端：`/admin/apps/handbook`（启用 / 可见性 / ACL），沿用 AppRegistry

### 分类

- 系统节点：`全部`、`未分类`（不可删）
- 用户分类：自建、重命名、排序；`parentId` 可选，**最多 2 层**
- 删除分类：若仍有子分类则拒绝；笔记迁到「未分类」（或等价 `categoryId = null`）
- 禁止分类环引用

### 笔记

| 字段 | v1 |
|---|---|
| 标题 | 必填（可给默认「无标题」再编辑） |
| 正文 | Markdown 字符串 |
| 分类 | 可空 = 未分类 |
| 置顶 | 可选 |
| 创建/更新时间 | 系统维护 |

列表：当前分类过滤；「全部」跨分类。  
搜索：`q` 匹配标题 + 正文；可跨分类；点选结果打开笔记并带上分类上下文。  
保存：防抖自动保存（与闪签详情抽屉同类体验）。  
删除：需确认。

### 空状态

无笔记时：简短说明用途 +「新建第一篇」；可提供一篇可删示例（如「示例：发布前检查」）。

## 数据模型（示意）

```text
HandbookCategory
  id, tenantId, userId, name, parentId?, sortOrder, createdAt, updatedAt

HandbookNote
  id, tenantId, userId, categoryId?, title, bodyMd, pinned, createdAt, updatedAt
```

- 索引：`(tenantId, userId)`；按需 `(tenantId, userId, categoryId)`、更新时间
- 搜索：第一版可用 MySQL `LIKE` 或 `FULLTEXT`；正文长度设合理上限（建议数十 KB 量级）
- 不引入独立 `packages/apps/*`；与闪签一样内联在 `apps/web` + `apps/api`，常量/Zod 放 `@work-ally/shared`

## API（示意）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/apps/handbook/categories` | 列表 / 创建 |
| PATCH/DELETE | `/apps/handbook/categories/:id` | 更新 / 删除 |
| GET | `/apps/handbook/notes?categoryId=&q=` | 列表或搜索 |
| POST | `/apps/handbook/notes` | 创建 |
| GET/PATCH/DELETE | `/apps/handbook/notes/:id` | 读 / 更新 / 删除 |

- JWT + `HandbookAppGuard`（AppRegistry 启用与 ACL）
- 所有查询强制 `tenantId + userId` 隔离

## 权限

- 仅本人读写；无分享、无跨用户读
- App 未启用或无 ACL → 与闪签一致拒绝；工作台应用列表不展示或不可进入

## AI 引用预留（明确不实现于本版）

本版交付独立可用的手册 App。后续若要在对话中引用，预期路径为：

1. 稳定资源 ID + 只读查询（按 id / 搜索）
2. Markdown 正文直接作为模型上下文或个人知识源适配器输入
3. **不**在本版做分块、embedding、挂载 `knowledge_retrieve`

规格约束：API 字段命名稳定；存储保持 `bodyMd`，避免以后格式迁移。

## 错误与边界

| 情况 | 行为 |
|---|---|
| 无权限 / App 关闭 | 拒绝，与闪签一致 |
| 分类环引用 / 超 2 层 | 拒绝并提示 |
| 删除仍有子分类的分类 | 拒绝并提示 |
| 搜索空串 | 回落为当前分类（或全部）列表 |
| 正文超上限 | 拒绝保存并提示（不静默截断） |

## 测试关注点

- 用户 A 看不到用户 B 的分类与笔记
- 分类创建 / 重命名 / 移动笔记 / 删除分类后笔记归未分类
- 搜索命中标题与正文
- AppRegistry 关闭后入口不可用
- Markdown 往返保存不丢内容

## 实现落点（与现有模式对齐）

| 层 | 预期路径 |
|---|---|
| Web 页 | `apps/web/src/app/workbench/apps/handbook/page.tsx` |
| UI | `apps/web/src/components/handbook/*` |
| Admin | `apps/web/src/app/admin/apps/handbook/` |
| API | `apps/api/src/modules/apps/handbook/*` |
| Shared | `HANDBOOK_SLUG`、Zod schemas in `@work-ally/shared` |
| Registry | `AppRegistryService.ensureHandbook()`（或通用 ensure 扩展） |

## 开放命名

显示名「手册」、slug `handbook` 已拍板；若上线前文案要改，只改显示名，**slug 与 API 前缀保持 `handbook`**。
