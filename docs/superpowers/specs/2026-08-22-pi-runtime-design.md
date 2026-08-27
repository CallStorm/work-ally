# Pi Agent Runtime（方案一 · 一期）

> 状态：已落地（一期）  
> 日期：2026-08-22

## 目标

用 `@mariozechner/pi-coding-agent` SDK 替换 Mastra，作为 WorkAlly 云端 Agent Runtime，对齐 Claude Code / Pi 的技能 progressive disclosure。

## 决策

- **嵌入方式**：Nest 同进程 `createAgentSession`（非 RPC）；Pi 为 ESM，经 `Function` 动态 `import`
- **工具**：**不禁用** bash / write / edit / read；不传自定义 `tools`，由 Pi 按 `cwd` 绑定默认 coding tools（技能可跑脚本）
- **隔离**：每个 AgentRun 使用独立 `cwd`：`.data/runs/{tenantId}/{runId}`
- **技能包**：上传 zip 解压到 `.data/skills/{tenantId}/{slug}/`，保留 SKILL.md 及引用文件
- **加载**：Pi 仅注入 name+description；正文与 references 由模型按需 read
- **模型**：通过 Pi `models.json` + `AuthStorage.setRuntimeApiKey` 接 MiniMax Anthropic 兼容端点
- **事件**：Pi session.subscribe → 现有 SSE（thinking / tool_* / message_delta / …）
- **回退**：Pi 抛错时回退 Mastra；`RUNTIME_PROVIDER=pi|mastra|mock`

## 非目标（一期）

- 容器级强沙箱 / seccomp
- 完整 MCP 挂载
- 去掉 Mastra（保留 `RUNTIME_PROVIDER=mastra` 回退）

## 风险

bash 在沙箱 cwd 内仍可能通过绝对路径访问宿主机；后续需 OS 级隔离。一期先落地能力，文档中明示风险。
