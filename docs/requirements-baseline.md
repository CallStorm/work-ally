# WorkAlly 需求基线总册

> 状态：**已冻结**（需求讨论定稿）  
> 范围：产品定位、组织权限、信息架构（A）、领域对象与 API 草图（B）、Agent 内核原则  
> 用途：研发排期与设计的唯一需求依据；变更需显式修订本册

---

## 1. 产品一句话

面向企业全员办公的 **云端 SaaS Agent 平台**：以组织统一授权的连接器、可复用技能、单专家组合、第三方知识库接入为核心，让不同部门组在隔离空间内提升日常办公效率。

MVP 交付形态为 **聊天结论**；核心竞争力是 **出色的 Agent Runtime**（类 Claude Code 的多步执行能力），专家 / 技能 / 连接器 / 知识库是 Runtime 的配置与能力扩展层。

---

## 2. 已拍板决策一览

| 议题 | 结论 |
|---|---|
| 租户结构 | 多租户：公司 = Tenant；其下多个组（研发/产品/行政…）；人可属多组 |
| 目标用户 | 全员办公 |
| 运行时 | 纯云端 SaaS（无桌面、无本地 stdio MCP） |
| 专家形态 | MVP 仅单专家；不做专家团 |
| 连接器授权 | 组织统一授权；Member 不见密钥 |
| 知识库 | 接入第三方（Dify / RAGFlow），不自建重 RAG |
| 交付物 | MVP 仅聊天结论 |
| 默认 Agent | 每租户唯一；未选专家时使用 |
| 模型列表 | Admin 配置；工作台右下角选择 |
| Agent 内核 | 一等能力；Expert 与 DefaultAgent 共用同一 Runtime |

---

## 3. 概念模型

| 概念 | 含义 | 不是 |
|---|---|---|
| Connector / MCP | 能干什么（远程工具） | 不是业务流程本身 |
| Skill | 怎么干（SOP，按需加载） | 不是外部 API |
| Expert | 谁来干 = 配置包（人设+技能+连接器+知识+推荐提示词） | 不是独立弱聊天机器人 |
| DefaultAgent | 未选专家时的租户级默认配置包 | 不是第二套 Runtime |
| Knowledge | 查什么（第三方检索） | 不是系统提示词 |
| Agent Runtime | 多步规划→工具/检索→观察→迭代→结论 | 不是单轮问答 |

组合关系：

```text
连接器 (MCP)     → 工具与外部系统
技能 (Skill)     → 场景化 SOP（SKILL.md，按需加载）
知识库           → 第三方 RAG 检索（Dify / RAGFlow）
专家 / 默认Agent → Runtime 配置包
Agent Runtime    → 真正把任务跑完的内核
工作区 Group     → 协作与会话上下文边界
ACL              → 资源对谁可见/可用
```

---

## 4. 组织与权限（精简 RBAC + 资源 ACL）

### 4.1 结构

```text
Tenant（公司）
├─ Users + Membership（role）
├─ Groups（组）+ GroupMembers
└─ Resources + ACL
```

### 4.2 角色（固定 3 个）

| 角色 | 职责 |
|---|---|
| Owner | 最高权限；含 Admin 全部能力；所有权/计费等 |
| Admin | 成员与组、组织凭据、全部资产与 ACL、模型与默认 Agent |
| Member | 使用已分享资源；发起会话 |

不做：Group Admin、Viewer、自定义角色（MVP）。

### 4.3 资源 ACL

适用：Connector / Skill / Expert / KnowledgeBinding

```text
visibility: private | restricted | tenant
acl_entries: [{ principal_type: group|user, principal_id }]  # 仅 restricted
```

判定：

```text
can_use(user, resource) =
  role in (owner, admin)
  OR user == resource.owner_user_id
  OR visibility == tenant
  OR (visibility == restricted AND (user in acl.users OR user in acl.groups))
```

MVP：**可见 = 可用**。Admin/Owner 可覆盖任意 ACL。连接器凭据仅组织侧配置。

### 4.4 权限矩阵（摘要）

| 能力 | Owner | Admin | Member |
|---|---|---|---|
| 管成员/组 | ✅ | ✅ | ❌ |
| 配组织 MCP/知识库凭据 | ✅ | ✅ | ❌ |
| 管模型列表 / 默认 Agent | ✅ | ✅ | ❌ |
| 改任意资源 ACL | ✅ | ✅ | ❌ |
| 使用已分享资源 / 开聊 | ✅ | ✅ | ✅ |

Expert 绑定校验：配置可写同租户资源；**运行时实际注入** = 配置 ∩ 用户 `can_use`。

---

## 5. 信息架构（A）

### 5.1 双表面

| 表面 | 用户 | 目的 |
|---|---|---|
| 工作台 | 全员 | 选组、选专家/默认 Agent、对话、拿结论 |
| 管理后台 | Owner / Admin | 人组、凭据、资产、ACL、默认 Agent、模型 |

### 5.2 工作台导航

- 左侧：专家｜技能｜连接器｜知识库｜最近会话  
- 顶栏：当前组切换；Admin 可切换管理后台  
- 个人设置：资料、默认组、退出  

### 5.3 首页（核心交互）

参考 WorkBuddy 式启动台，仅日常办公（无「代码开发」Tab）：

- 上方：专家快捷条（按当前用户使用顺序/频次排序）  
- 聊天框：
  - **左下角**：已选专家 Tag，可点 × 清除 → 回退默认 Agent  
  - **未选专家**：无 Tag，走租户 DefaultAgent  
  - **选中专家后**：底部出现该专家推荐提示词  
  - **`+` 面板**：添加文件｜专家｜技能｜连接器｜知识库（可开关并多选已授权库）  
  - **不要「模式」项**  
  - **右下角**：模型选择（Admin 配置列表，可含 Auto）+ 发送  
- 发送 → 进入对话页（带齐专家/默认 Agent、context、附件、模型、输入）

### 5.4 对话页

- 左：当前组会话列表  
- 中：消息流（聊天结论）  
- 可继续用 `+` 调整知识库等  
- 右（可折叠）：KnowledgeHit 引用、ToolCall 摘要  
- 无独立产物中心  

### 5.5 管理后台页面

| 页 | 职责 |
|---|---|
| 概览 | 规模与快捷入口 |
| 成员与组 | 邀请、角色、组进出 |
| 连接器 | 远程 MCP、组织凭据、启停、分享 |
| 技能 | CRUD、启停、分享 |
| 专家 | 人设、推荐提示词、绑定、分享 |
| 知识库接入 | Dify/RAGFlow、数据集、分享 |
| 默认 Agent | 全公司唯一配置包 |
| 模型配置 | 可用模型列表 |
| 分享面板 | 内嵌组件，不单开权限大盘 |
| 审计 | P1 |

### 5.6 主用户流

1. 员工办公：切组 →（可选专家）→ `+` 配文件/技能/连接器/知识 → 选模型 → 发送 → 结论  
2. Admin 开通连接器并 ACL 分享  
3. Admin 发布专家（技能/知识可选前置）并分享  
4. 邀请成员进组  
5. 收紧 ACL 后立即不可见/不可用（历史会话可看；失权资源不可再调用）

### 5.7 MVP 页面优先级

- **Must**：登录选租户、首页、对话页、四类资产列表、成员与组、连接器/技能/专家/知识库管理、默认 Agent、模型配置、分享面板  
- **Should**：专家详情、会话列表、引用/工具侧栏、概览  
- **Later**：审计、技能 zip 导入、复杂运营数据  

### 5.8 明确非目标（页面/能力）

专家团编排、产物库/导出中心、个人 MCP 凭据、自定义角色、独立权限中心、模式切换/代码开发 Tab、桌面端/本地 stdio、Group Admin/Viewer。

---

## 6. Agent 内核原则

1. **Runtime 为一等需求**：页面与资产完整性不能替代「能把任务跑完」。  
2. Expert 与 DefaultAgent **共用同一 Runtime**，差异仅在配置包。  
3. MVP「出色」定义：会 **多步** 调用 MCP + 知识库，完成办公问答/结论（非编码版 Claude Code）。  
4. 必备能力：plan → tool/retrieve → observe → 迭代 → 结论；Skill 按需加载；基础失败重试；危险写操作可确认。  
5. 验收标准：典型办公任务能否靠工具+知识多步完成，而不只是页面是否齐全。

---

## 7. 领域对象（B）

### 7.1 总览

```text
组织域: Tenant / User / Membership / Group / GroupMember
资产域: Connector / Skill / Expert / KnowledgeBinding / DefaultAgent / ModelConfig
会话域: Session / SessionContext / Message / Attachment
运行时域: AgentRun / ToolCall / KnowledgeHit
```

### 7.2 组织对象（摘要）

- **Membership.role**：`owner | admin | member`  
- **Group**：租户内业务组；Session 必带 `group_id`  
- 一人多组  

### 7.3 资产公共字段

`id, tenant_id, name, description, owner_user_id, visibility, acl_entries[], status, timestamps`

| 对象 | 关键字段 |
|---|---|
| Connector | transport(`sse`/`streamable_http`), endpoint_url, auth_type, credentials_ref, health_status |
| Skill | slug, description_short, body_md, version |
| KnowledgeBinding | provider(`dify`/`ragflow`), base_url, credentials_ref, external_dataset_ids[], display_name |
| Expert | avatar_url, persona_md, suggested_prompts[], skill_ids[], connector_ids[], knowledge_ids[], model_policy |
| DefaultAgent | tenant_id(unique), persona_md?, suggested_prompts[], skill_ids[], connector_ids[], knowledge_ids[] |
| ModelConfig | model_id, display_name, is_auto_candidate, enabled, sort_order |

### 7.4 会话与运行时

| 对象 | 要点 |
|---|---|
| Session | group_id, expert_id(nullable), model_id, created_by |
| SessionContext | skill_ids, connector_ids, knowledge_enabled, knowledge_ids, attachment_ids |
| Message | role(user/assistant/system), content |
| AgentRun | 每次用户发言一次；state: queued/running/succeeded/failed/cancelled |
| ToolCall / KnowledgeHit | 可观测，供侧栏；脱敏摘要 |

---

## 8. API 草图（B）

约定：REST + JSON；Bearer Token；租户由 token 或 `X-Tenant-Id` 确定。列表默认按 `can_use` 过滤（admin 可看全部）。密钥字段不对 Member 返回。

### 8.1 组织

- Auth：`POST /auth/login|logout`，`GET /me`  
- Tenant：`GET/POST /tenants`，`GET/PATCH /tenants/:id`  
- Members：invite / patch role·status / delete  
- Groups：CRUD + members 进出  
- ACL：`GET/PUT /resources/:type/:id/acl`  
  `type ∈ connectors|skills|experts|knowledge`

### 8.2 资产

- Connectors / Skills / Knowledge / Experts：标准 CRUD（写操作按角色）  
- `POST /connectors/:id/test`  
- `GET /experts?sort=recent_used`；`POST /experts/:id/touch`（或开聊隐式）  
- `GET/PUT /default-agent`  
- `GET /models`；`/admin/models` CRUD  

### 8.3 会话与 Runtime

- `POST /attachments`  
- `GET /sessions?group_id=`  
- `POST /sessions`（首页发送：content + expert_id? + model_id + context + attachments）  
  → 创建 Session + user Message + AgentRun，返回 session_id  
- `POST /sessions/:id/messages`（后续回合）  
- `PATCH /sessions/:id`（context / title / archive）  
- 流式：`GET /runs/:id/events`（SSE/WS）：thinking / tool_call / tool_result / knowledge_hit / message_delta / message_done / error  
- `POST /runs/:id/cancel`  
- `GET /runs/:id/tool-calls|knowledge-hits`  

### 8.4 Runtime 服务端步骤

1. 解析配置包（Expert 或 DefaultAgent）  
2. 合并 SessionContext，按 `can_use` 过滤  
3. Skill 描述扫描 → 按需加载正文  
4. 挂载允许的 MCP tools + knowledge retrieve  
5. 多步循环直至结论或失败  
6. 持久化 Message + ToolCall + KnowledgeHit  

---

## 9. 关键不变量

1. 每租户至少一个 owner；角色仅三种  
2. Session 必须带 group_id  
3. ACL 三值；restricted 必须有 entries；列表必须过滤  
4. 凭据仅 admin 可配，响应不对 Member 明文  
5. 每租户唯一 DefaultAgent；`expert_id == null` 走默认  
6. 绑定资源同租户；运行注入取配置 ∩ can_use  
7. 每次用户发言 → 一次 AgentRun；助手产出为文本结论  
8. 模型必须来自租户启用 ModelConfig  
9. Expert/DefaultAgent 共用 Runtime；仅远程 MCP  
10. 无专家团、无个人 MCP 凭据、无本地 stdio、无自定义角色表  

---

## 10. 成功标准（MVP）

- 开租户、建多组、分人、三角色可用  
- Admin 能配远程 MCP、Dify/RAGFlow、模型列表、默认 Agent，员工无需配密钥  
- 能创建专家（人设、推荐提示词、绑定）并 ACL 到组或人  
- 员工首页可选专家或走默认 Agent，用 `+` 挂知识库/文件等，发送后进入多步 Agent 对话并得到结论  
- 组间与 ACL 隔离生效；侧栏可看到工具/知识引用摘要  

---

## 11. 修订记录

| 日期 | 说明 |
|---|---|
| 2026-08-21 | 初版冻结：需求讨论 A+B + 权限 + Agent 内核 + 首页交互定稿汇总 |
