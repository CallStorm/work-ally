# 模型 Provider 配置（业界标准添加方式）

> 状态：已落地（一期）  
> 日期：2026-08-22  
> 决策：租户级 Provider + 加密密钥入库（方案 A）+ Provider/Model 两表

## 目标

Admin 以业界常见方式配置大模型：

1. 添加 **Provider**（预制 MiniMax / Anthropic，Anthropic Messages 兼容）
2. 填写 **API Key**（加密存库）与可改的 **Base URL**
3. **拉取模型列表**，勾选后写入租户可用模型池
4. 工作台从启用模型中选择；**去掉 `auto`**

Runtime（Pi / Mastra）按所选模型所属 Provider 取密钥与 baseUrl，不再依赖全局 `ANTHROPIC_*`（仅作迁移期 fallback）。

## 非目标（一期）

- OpenAI / Azure / Google 等非 Anthropic-messages 协议
- 按用量计费、密钥轮换 UI、多密钥
- Expert / DefaultAgent 的 model_policy
- 容器级网络隔离

## 数据模型

### `LlmProvider`（新表 `llm_providers`）

| 字段 | 说明 |
|---|---|
| id, tenantId | |
| preset | `minimax` \| `anthropic`（决定默认 URL、Pi provider 映射、拉列表策略） |
| name | 展示名，如「公司 MiniMax」 |
| baseUrl | 可改；创建时用预设默认值 |
| apiKeyEnc | AES-GCM（现有 `encryptSecret` + `CREDENTIALS_ENCRYPTION_KEY`） |
| enabled | |
| sortOrder | |
| createdAt, updatedAt | |

唯一约束：无强制「每租户每 preset 仅一条」——允许同 preset 多实例（不同 key/网关）。

### `ModelConfig`（改）

| 变更 | 说明 |
|---|---|
| + `providerId` | FK → LlmProvider，级联删除 |
| `modelId` | Provider 侧模型 ID（如 `MiniMax-M3`、`claude-sonnet-4-20250514`） |
| `displayName` | |
| `enabled`, `sortOrder` | |
| − 逻辑使用 `isAutoCandidate` | 字段可保留默认值，一期 UI/Runtime 不读 |
| @@unique | `[tenantId, providerId, modelId]`（同租户不同 Provider 可同名 modelId） |

### 预制默认值

| preset | 默认 name | 默认 baseUrl | Runtime 映射 |
|---|---|---|---|
| `minimax` | MiniMax | `https://api.minimaxi.com/anthropic` | Pi `minimax` + anthropic-messages |
| `anthropic` | Anthropic | `https://api.anthropic.com` | Pi `anthropic` + anthropic-messages（或等价 anthropic-messages + 官方 base） |

两者协议均为 **Anthropic Messages 兼容**；区别主要是默认 URL 与拉列表兜底目录。

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/llm-providers` | 列表（密钥仅返回 `apiKeySet: boolean`，不回明文） |
| POST | `/admin/llm-providers` | 创建：preset, name?, baseUrl?, apiKey |
| PATCH | `/admin/llm-providers/:id` | 更新 name/baseUrl/apiKey?/enabled/sortOrder |
| DELETE | `/admin/llm-providers/:id` | 删除（级联模型） |
| POST | `/admin/llm-providers/:id/sync-models` | 拉取远端模型列表，返回候选（不自动全量写入） |
| POST | `/admin/llm-providers/:id/models` | body: `{ models: [{ modelId, displayName }] }` 批量 upsert 并启用 |
| GET | `/admin/models` | 现有，扩展返回 `providerId`, providerName, preset |
| PATCH/DELETE | `/admin/models/:id` | 启用切换 / 删除（去掉禁止删 auto） |
| GET | `/models` | 工作台：仅 `enabled` 模型，含 displayName；**不含 auto** |

去掉：注册时种子 `modelId: 'auto'`；`CreateSessionSchema` 的 `modelId` 默认 `'auto'` → 改为必填或默认第一启用模型由前端选。

## 拉模型列表

1. 请求：`GET {baseUrl}/v1/models`（必要时补 `/v1`），Header 按 Anthropic（`x-api-key` / `anthropic-version`）或兼容端点习惯。
2. 解析 `data[].id`（及可选 display_name）。
3. **失败时**：返回该 preset 的**本地预制候选**（可勾选），并带 `source: 'fallback'` + 错误摘要，不阻断配置。
   - MiniMax 预制例：`MiniMax-M3` 等
   - Anthropic 预制例：常用 Claude 模型 ID 短列表

## Admin UX

1. 页改名语义：**模型 / Provider**（路由可仍 `/admin/models`）
2. 「添加 Provider」：选 MiniMax 或 Anthropic → 填 API Key、可改 Base URL → 保存
3. Provider 行：「同步模型」→ 多选 →「添加到可用模型」
4. 下方「可用模型」表：启用 / 停用 / 删除；展示所属 Provider
5. 不再提供手填裸 modelId 的主路径（高级手填可作为次要入口：一期可省略）

## 工作台

- `GET /models` 空则提示去 Admin 配置，**无 auto 兜底**
- 默认选中 `sortOrder` 最小的启用模型
- `POST /sessions`：校验 `modelId` 对应本租户某条 **enabled** ModelConfig（建议 session 存 `modelConfigId` 或 `providerId + modelId`；一期可继续存 `modelId` 字符串，但解析时必须能唯一绑定到一条启用配置——若冲突则要求前端传 `modelConfigId`）

**一期决议**：Session 增加可选 `modelConfigId`；前端传 `modelConfigId`；兼容旧 `modelId` 仅当租户内唯一匹配。新建会话必须带 `modelConfigId`。

## Runtime

1. 由 `modelConfigId`（或解析结果）加载 ModelConfig + Provider
2. 解密 apiKey；用 Provider.baseUrl + preset 构造 Pi `models.json` / Mastra `createAnthropic`
3. Env `ANTHROPIC_*`：**仅当**租户无任何 Provider 时 fallback（开发便利）；有 Provider 则以库为准
4. 去掉对字面量 `auto` 的特殊解析

## 迁移

1. Prisma migration：建 `llm_providers`；`model_configs` 加 `provider_id`（nullable 过渡）
2. 数据脚本/启动逻辑：删除或禁用 `modelId === 'auto'` 行
3. 已有裸 ModelConfig：无 provider 时 Runtime 仍可读 env（过渡）；Admin 提示「请绑定 Provider」——一期也可在迁移时若 env 有 key 则自动建一条 MiniMax Provider 并挂上现有模型

**一期迁移偏好**：若 `ANTHROPIC_API_KEY` 存在，为每个已有 ModelConfig 租户 upsert 一条 `minimax` Provider（用 env key/url），并把现有非 auto 模型挂上；然后删 auto。

## 安全

- API 响应永不返回明文 key
- 更新 key 时空字符串表示不改
- 仅 owner/admin 可管理 Provider

## 验收

- [ ] Admin 可添加 MiniMax / Anthropic Provider 并保存密钥
- [ ] 同步模型（真拉或 fallback）后勾选写入可用列表
- [ ] 工作台无 auto；可选已启用模型并发起会话
- [ ] 会话 Runtime 使用该 Provider 的 key/baseUrl（改 Provider key 后新会话生效）
- [ ] 删除 Provider 级联删除其模型配置
