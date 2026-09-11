# 图工作室（Image Studio）MVP

> 状态：**设计已定稿，待实现**  
> 日期：2026-09-11  
> 定位：工作台内置 App；参考 [Layerive](https://github.com/newljs/Layerive) 的项目库 + 对话生图工作流，深集成进 work-ally  
> 原则：管理员配模型与密钥；普通用户只用；每人只看自己的项目数据

## 目标

为企业用户提供 **个人图像创作工作台**：按项目沉淀提示词、生成结果与简单版本链；支持文生图与基于当前图的图生图。

- 显示名：**图工作室**
- slug：`image-studio`
- 用户路由：`/workbench/apps/image-studio`
- 管理路由：`/admin/apps/image-studio`
- API 前缀：`/api/apps/image-studio`；管理：`/api/admin/apps/image-studio`
- 数据隔离：`(tenantId, userId)`，MVP **不共享、不协作**

## 已拍板决策

| 议题 | 结论 |
|---|---|
| 第一期范围 | **MVP（A）**：项目库 + 文生图/图生图 + 回合/版本历史；不做局部改图等高级编辑 |
| 模型治理 | **方案 C**：租户级图像模型独立配置，入口在 Admin → 应用 · 图工作室；与聊天 LLM 配置分离 |
| 实现方式 | **深集成移植 Layerive（裁剪）**：UI/交互迁入 web + Nest API；SQLite→MySQL，本地文件→MinIO |
| 用户选模型 | **可切换（B）**：管理员配置多个启用模型；用户在工作台从列表选择；不可见 Key/敏感 Base 配置细节按安全策略裁剪 |
| 产品形态 | 与闪签/笔记同级的 AppRegistry 内置应用 |
| 上游参考 | Layerive LGPL-3.0；移植时保留必要版权与许可证声明 |

## 成功标准

1. 管理员能为租户添加至少一个 OpenAI-compatible 图像模型、测试通过并设为默认。
2. 普通用户打开图工作室后，可新建项目、文生图得到候选图、选中其一继续图生图，历史回合可回看。
3. 用户 A 的项目与图片对同租户用户 B **不可见**（API 与 UI 均隔离）。
4. 应用可通过 Admin 禁用；禁用后用户无法进入。

## 架构

```text
┌──────────────┐     JWT      ┌─────────────────────────────┐
│ Web          │─────────────▶│ Nest AppsModule             │
│ image-studio │              │ Guard + Controllers         │
│ (Layerive UI │              │ ImageStudio* services       │
│  裁剪移植)    │◀── assets ───│ ObjectStorage (MinIO)       │
└──────────────┘              │ Image provider adapters     │
                              └────────────┬────────────────┘
                                           │
                              ┌────────────▼────────────────┐
                              │ MySQL: AppRegistry,         │
                              │ ImageStudioModel / Project /│
                              │ Turn / Asset                │
                              └─────────────────────────────┘
```

- 不启动独立 Layerive 进程；不 iframe。
- 鉴权、租户、ACL 全部走 work-ally 现有模式。

## 应用注册与权限

- Soft-seed：`AppRegistryService.ensureImageStudio`；新租户注册时创建 registry 行（对齐 stickies/notes）。
- 默认：`enabled: true`，`visibility: tenant`。
- 用户列表：`GET /api/apps` → `enabled` + ACL `apps`。
- 管理：启用/可见性/ACL；模型 CRUD 见下节。
- **打开应用 ≠ 共享数据**：ACL 只控制能否使用应用；项目数据始终按 owner `(tenantId, userId)` 过滤。

## 数据模型

### `ImageStudioModel`（租户级，管理员）

| 字段 | 说明 |
|---|---|
| id, tenantId | 主键与租户 |
| name | 显示名 |
| provider | 枚举字符串：首期以 `openai_compatible` 为主；预留 `gemini` 等 |
| baseUrl | 上游 Base URL |
| apiKeyEnc | `encryptSecret` 加密存储 |
| modelName | 上游模型名 |
| capabilities | JSON，至少含 `textToImage` / `imageToImage` |
| defaultParams | JSON（如 size、quality、n 上限等） |
| enabled | 是否对用户可选 |
| isDefault | 同租户至多一个默认（写入时清除其它） |
| createdAt, updatedAt | |

### `ImageStudioProject`（用户级）

| 字段 | 说明 |
|---|---|
| id, tenantId, userId | 归属 |
| name, description | |
| coverObjectKey, currentAssetId | 封面与当前工作图 |
| defaultModelId | 创建时/用户选择的默认图像模型（可空则回落到租户默认） |
| starred, deletedAt | 收藏与软删 |
| workspaceState | JSON，未完成 UI 状态（可选） |
| createdAt, updatedAt | |

### `ImageStudioTurn`（用户级，经 Project 归属）

| 字段 | 说明 |
|---|---|
| id, projectId | |
| parentTurnId | 可选；形成简单版本链 |
| prompt | |
| modelId | 实际调用的模型 |
| sourceAssetId | 图生图时的输入图；文生图为空 |
| status | `pending` \| `running` \| `done` \| `failed` |
| errorMessage | 失败信息 |
| createdAt, updatedAt | |

### `ImageStudioAsset`

| 字段 | 说明 |
|---|---|
| id, projectId | 必有；鉴权经项目归属 |
| turnId | 可空；生成结果必填，用户上传参考图时可空 |
| objectKey | MinIO key |
| width, height, mimeType | 可选元数据 |
| selected | 是否为当前选用图（项目维度由 `currentAssetId` 为准；回合内候选用本字段标记） |

**查询约定**：凡用户 API，先 `findProject({ id, tenantId, userId })`，再操作子资源；禁止仅按 id 跨用户读取。

**上传参考图**：`POST .../upload` 创建 `turnId = null` 的 Asset，供后续 `generate.sourceAssetId` 使用。

## 模型配置与调用

### 管理员

- UI：`/admin/apps/image-studio`
- CRUD 模型、测试连接、设默认、启用开关
- 应用 registry：启用、可见性（ACL 沿用 `/api/resources/apps/:id/acl`）
- API Key 仅写入时提交；列表/详情默认不返回明文；更新可「保留原 Key」

### 普通用户

- `GET /api/apps/image-studio/models`：仅 `enabled` 模型的安全字段（id、name、provider、capabilities、isDefault）；**不含** apiKey、**不含**完整可滥用的密钥材料
- 工作台可切换模型；发送时带 `modelId`；缺省用项目 `defaultModelId` → 租户 `isDefault` 模型

### 生成流水线

1. `ImageStudioAppGuard` + JWT
2. 校验项目归属
3. 校验 `modelId` 属于本租户且 `enabled`
4. 创建 `Turn(pending/running)` → provider adapter 调用 → 图片写入 MinIO → 创建 `Asset` → `Turn(done)`；异常 → `failed` + `errorMessage`
5. 前端短轮询 `GET /turns/:id` 直至终态（MVP 不做 SSE）

### Provider（MVP）

- **必须**：OpenAI-compatible Images API（`/images/generations`、`/images/edits` 或网关等价路径，以适配层封装）
- **可选第二**：Gemini 原生图像 API（时间允许再做）
- SenseNova / Grok：仅留 provider 枚举扩展点，MVP 不实现

## API 一览

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET/POST | `/api/apps/image-studio/projects` | 用户 | 列表（排除软删）/ 创建 |
| GET/PATCH/DELETE | `/api/apps/image-studio/projects/:id` | 用户 | 详情 / 更新 / 软删 |
| GET | `/api/apps/image-studio/projects/:id/turns` | 用户 | 回合列表（含 assets） |
| POST | `/api/apps/image-studio/projects/:id/generate` | 用户 | body: `prompt`, `modelId?`, `sourceAssetId?`, `n?`（1–4） |
| GET | `/api/apps/image-studio/turns/:id` | 用户 | 状态轮询 |
| POST | `/api/apps/image-studio/projects/:id/assets/:assetId/select` | 用户 | 选中候选为当前图 |
| POST | `/api/apps/image-studio/projects/:id/upload` | 用户 | multipart 上传参考图 |
| GET | `/api/apps/image-studio/models` | 用户 | 已启用模型（安全字段） |
| GET/POST/PATCH/DELETE | `/api/admin/apps/image-studio/models` | 管理员 | 模型管理 |
| POST | `/api/admin/apps/image-studio/models/:id/test` | 管理员 | 连接测试 |
| POST | `/api/admin/apps/image-studio/models/:id/default` | 管理员 | 设默认 |
| GET/PATCH | `/api/admin/apps/image-studio` | 管理员 | registry |

图片展示：复用现有 ObjectStorage 签名 URL 或经鉴权的下载代理（与附件策略一致，实现计划中选定一种）。

## UI（移植 Layerive 并裁剪）

### 用户

1. **项目库**：卡片、搜索、收藏、新建、软删、改名（对齐 Layerive 首页精简版）
2. **工作台**：当前图画布 + 对话回合流 + 顶栏模型选择 + 发送区；支持文生图与「基于当前图继续」
3. **多候选**：一次最多 4 张，点选设为当前图并写入 `selected`

包在现有 `WorkbenchShell` 内；目录建议：`apps/web/src/components/image-studio/*`，页面 `workbench/apps/image-studio/page.tsx`。

### 管理

- 模型表单与列表、测试、默认、启用
- 应用启用/可见性（与笔记管理页同级信息架构）
- Admin 导航增加「应用 · 图工作室」

## 明确不做（MVP 外）

- 局部改图、扩图、图内文字编辑、去水印、资产提取、增强专用流
- Vision 模型配置与识别缓存
- 完整可缩放版本树画布、双图对比滑杆
- 提示词画廊、项目 ZIP 导入导出、全量备份
- 用户自配 API Key、跨用户共享项目
- 暗色主题专项、Electron/桌面壳

## 实现落点（文件级指引）

对齐现有应用 playbook：

1. `packages/shared`：`IMAGE_STUDIO_SLUG`、Zod schemas  
2. Prisma models + migration  
3. `app-registry.service` soft-seed + `auth.service` 新租户种子  
4. `modules/apps/image-studio/*`（guard、controllers、services、provider adapters）  
5. `apps.module.ts` 注册  
6. Web 用户页 + Admin 页 + 应用目录卡片  
7. 许可证：在移植文件头或 `NOTICE` 中保留 Layerive / LGPL 要求的声明  

## 测试要点

- 管理员：创建模型 → test → setDefault → 用户列表可见  
- 用户：注册/登录 → 打开应用 → 建项目 → generate → 轮询 done → 选中 → 再图生图  
- 隔离：用户 B 用 A 的 projectId 访问应 404  
- 禁用应用：用户侧不可用  
- 无默认模型时 generate 返回明确错误（非空转）

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Layerive 体量大，移植失控 | 严格按 MVP 裁剪；高级编辑代码不迁或迁入后禁用入口 |
| 各家 Images API 差异 | 只保证 openai_compatible；其它 provider 后置 |
| 生成耗时长 | Turn 异步状态 + 轮询；前端可取消仅停等 UI，服务端可后续再加 abort |
| LGPL 合规 | 保留版权声明；若以库形式链接需满足 LGPL；优先「移植改编源码进本仓库」并注明来源 |
