# Agent 执行时间线（Claude Code / Pi 风格）

> 状态：已落地  
> 日期：2026-08-24

## 决策

采用方案 **B**：助手回合内用**扁平时间线**展示 Thinking / Tool，最终 Markdown 回答单独常显。

## 交互

- 每步一行：状态点 + 类型徽章（Thinking / Bash / Read / Write / MCP）+ 摘要
- 详情默认折叠；运行中仅最新一步自动展开
- 完成后步骤列表仍可见（不整块收进「已完成」）
- 顶栏：`N 步 · Ns` + 全部展开/收起
- 去掉正文「执行过程」二次折叠与 `splitAssistantContent` 启发式

## 实现

- `apps/web/src/lib/run-trace.ts` → `buildRunTimeline` / `AgentStep`
- `apps/web/src/components/run-trace-panel.tsx` → 时间线 UI
- `apps/web/src/components/session-chat.tsx` → AssistantTurn 简化
