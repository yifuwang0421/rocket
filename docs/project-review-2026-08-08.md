# Rocket 项目审查报告

> 生成日期：2026-08-08  
> 项目版本：v0.11.2  
> 审查范围：全 monorepo（`rocket/base/`）

---

## 一、项目当前进展

**Rocket** 是一款面向二级市场基本面研究的 AI 原生桌面工作台，基于 **Electron + React + TypeScript + Bun monorepo** 构建。

当前处于 **P0 基线已关闭、P1 工作台实现中** 的阶段。

| 维度 | 状态 |
|---|---|
| 品牌与仓库 | ✅ 已完成（从 Craft Agents 更名为 Rocket）|
| CI/CD | ✅ 已完成（PR 验证 + Windows 发布流水线）|
| 类型安全 | ✅ 全 workspace 通过 |
| Electron 构建 | ✅ 成功产出 |
| Lint | ✅ 0 错误 |
| 核心测试 | ⚠️ 大部分通过，1 个稳定失败 |
| Server 构建 | ❌ 不支持 Windows（仅 darwin/linux）|

**关键里程碑**：

- `0cc692c` — 完成 Rocket 品牌重塑、Windows 发布管道搭建、P0 签入门控
- `7b4df55` — 关闭 P0 非发布基线

---

## 二、前序完成部分的问题与优化建议

### 🔴 P0 — 高优先级

| 问题 | 位置 | 说明 | 建议 |
|---|---|---|---|
| **SessionManager.ts 超大文件** | `packages/server-core/src/sessions/SessionManager.ts`（9010 行）| 单文件承担会话生命周期、消息发送、自动重试、运行时刷新、任务标签、权限模式等过多职责，是项目最大的技术债务 | 拆分为多个子模块，如 `SessionLifecycle.ts`、`MessageSender.ts`、`RetryManager.ts`、`RuntimeRefresher.ts`、`TaskTagManager.ts`、`PermissionMode.ts` |
| **SVG XSS 风险** | `apps/electron/src/renderer/lib/icon-cache.ts:709-717` | `sanitizeSvgForInline` 使用正则过滤 `<script>`、`on*` 事件处理器和 `javascript:`，易被绕过（如空格拆分 `scr ipt`、HTML entities、CDATA 等）| 改用 DOMPurify 进行 SVG 消毒，或禁用 SVG 内联脚本执行 |
| **innerHTML 注入风险** | `apps/electron/src/renderer/components/ui/rich-text-input.tsx:610, 694, 713` | 直接对 contenteditable div 设置 `innerHTML`，虽然内容来自受控的 TipTap 编辑器，但若插件或粘贴路径被污染仍有注入风险 | 确保所有赋值路径都经过 TipTap 的 Schema 验证，或增加一次输出消毒 |
| **deep-link-routing 测试稳定失败** | `apps/electron/src/main/logger.ts:44` | 测试环境中 `log.transports.ipc` 为 `undefined`，导致测试加载 logger 模块时直接抛错 | 添加防御性判断：`log.transports.ipc && (log.transports.ipc.level = false)` |

### 🟡 P1 — 中优先级

| 问题 | 位置 | 说明 | 建议 |
|---|---|---|---|
| **transport/CLI 大量 `any` 类型** | `apps/electron/src/transport/routed-client.ts:23,47,95,125,148`、<br>`apps/cli/src/index.ts`、<br>`packages/server-core/src/transport/types.ts` | RPC 客户端/服务器回调签名全用 `(...args: any[]) => any`，丧失类型安全 | 逐步替换为具体泛型或 `unknown`，结合 zod/schema 做运行时验证 |
| **react-hooks/exhaustive-deps 禁用** | `ThemeContext.tsx:155`、<br>`ChatPage.tsx:210`、<br>`useSessionMenuActions.ts:96`、<br>`rich-text-input.tsx:715`、<br>`WhatsAppConnectDialog.tsx:50,59` | 多处 `eslint-disable-next-line react-hooks/exhaustive-deps` | 逐一分析依赖数组，补充正确的依赖项，避免 React 闭包陈旧导致 UI 状态不同步 |
| **CLI 忙等待轮询** | `apps/cli/src/index.ts:457-458`、<br>`916-917`、<br>`1486-1487`、<br>`1529-1530` | 使用 `while (!finished && Date.now() < deadline) { await new Promise(r => setTimeout(r, 100)) }` 进行轮询 | 改为基于事件/回调的机制（如 EventEmitter、WebSocket、或 Server-Sent Events）|
| **无并发限制的 Promise.all** | `packages/server-core/src/handlers/rpc/files.ts:524`、<br>`automations.ts:272` | 批量操作时使用 `Promise.all(files.map(...))` 或 `Promise.all(connections.map(...))` | 引入 `p-limit` 或 `async-pool` 限制并发数，防止文件描述符或连接数耗尽 |
| **超大正则 / 字符串处理性能** | `packages/shared/src/unified-network-interceptor.ts`（2265 行）| 在请求拦截器中对每个 SSE chunk 进行多次正则替换和 JSON 序列化/反序列化 | 高并发场景下可能成为 CPU 瓶颈，考虑流式处理优化或缓存编译后的正则 |

### 🟢 P2 — 低优先级

| 问题 | 位置 | 说明 | 建议 |
|---|---|---|---|
| **遗留 TODO** | `packages/shared/src/workspaces/storage.ts:129`、<br>`packages/shared/src/config/validators.ts:120`、<br>`packages/server-core/src/sessions/SessionManager.ts:1065` | 旧版 `think` 规范化代码和时区验证待清理 | 确认旧数据已过期后移除兼容代码；时区验证可对接 IANA 列表 |
| **Model discovery 未实现** | `packages/shared/src/agent/backend/factory.ts:432` | 部分 provider 缺少 `fetchModels` 实现 | 补充未实现 provider 的模型发现逻辑，或降级为返回空列表而非抛硬错误 |
| **@sentry/electron 版本偏旧** | `package.json` | v7.7.0（2023年中）| 升级到 v8 系列，获取更好的 Electron 兼容性和安全修复 |
| **空 catch 吞噬异常** | `apps/electron/resources/bridge-mcp-server/index.js`、<br>`packages/server-core/src/handlers/rpc/files.ts:489` | `catch (_) {}` 和 `catch (_2) {}` 静默忽略异常 | 至少记录 warn 级别日志，便于排查问题 |
| **Promise.race 超时未取消底层操作** | `packages/server-core/src/transport/server.ts:663` | 超时后仅返回错误，未中止底层 RPC 调用 | 引入 AbortController 或类似的取消机制 |
| **未使用的 onboarding 代码** | `apps/electron/src/main/onboarding.ts:67` | 注释明确说明 "Currently unused in renderer" | 如短期内不启用，考虑移除以减少维护负担 |
| **运行时代码中的 debug 日志** | `packages/shared/src/agent/claude-agent.ts` | 大量 `debug('[SESSION_DEBUG] ...')` 和 `console.error` | 虽受 `ROCKET_DEBUG` 控制，但生产构建中仍可能执行字符串拼接，确认是否可被 tree-shake |

---

## 三、安全专项

| 风险项 | 严重程度 | 说明 |
|---|---|---|
| SVG 内联脚本绕过 | 🟡 中 | 正则消毒不可靠，存在 XSS 绕过空间 |
| innerHTML 赋值 | 🟡 中 | TipTap 内容理论上受控，但插件/粘贴路径存在污染可能 |
| `new Function` in bundled JS | 🟢 低 | `bridge-mcp-server/index.js` 中来自 AJV 的代码生成，内容可信，风险可控 |
| 依赖 CVE | 🟢 低 | 未发现公开严重 CVE，主要依赖版本较新 |

---

## 四、构建与测试矩阵

| 检查项 | 命令 | 结果 |
|---|---|---|
| TypeScript 类型检查 | `bun run typecheck:all` | ✅ 13 个 workspace 全部通过 |
| Electron 完整构建 | `bun run electron:build` | ✅ 成功（main/preload/renderer/resources）|
| Server 构建 | `bun run server:build` | ❌ 不支持 `win32` 平台 |
| Lint | `bun run lint` | ✅ 0 错误，131 条警告 |
| i18n 校验 | `bun run i18n:parity` / `i18n:sorted` | ✅ 通过（6 语言，1640 键）|
| CLI 测试 | `bun test` (cli workspace) | ✅ 77 个测试通过 |
| Electron 内部测试 | `bun test` (electron workspace) | ✅ 158 个测试通过 |
| Doc-tool 测试 | `bun run test:doc-tools` | ✅ 19 个测试通过 |
| deep-link-routing 测试 | `bun test` | ❌ 稳定失败（logger.ts:44 `log.transports.ipc` 为 undefined）|

---

## 五、总体评估

| 评分维度 | 评分 | 说明 |
|---|---|---|
| 架构设计 | ⭐⭐⭐⭐ | Monorepo 分层清晰，Electron + Server 双模式设计合理 |
| 代码质量 | ⭐⭐⭐ | 类型安全整体较好，但存在超大文件和 `any` 滥用 |
| 测试覆盖 | ⭐⭐⭐ | 核心路径有测试，但有稳定失败和环境兼容性问题 |
| 安全 | ⭐⭐⭐ | XSS 和注入风险需要关注 |
| 构建/发布 | ⭐⭐⭐⭐⭐ | CI/CD 完善，Windows 发布流水线已就绪 |
| 文档 | ⭐⭐⭐⭐ | P0/P1 计划、CLI 文档、交付说明齐全 |

---

## 六、下一步行动建议（按优先级排序）

1. **拆分 `SessionManager.ts`** — 9010 行的单体文件是最大技术债务，影响可维护性和多人协作
2. **修复 SVG 消毒与 innerHTML 安全隐患** — 防止潜在的 XSS 攻击面
3. **修复 `deep-link-routing.test.ts` 稳定失败** — 加防御性判断即可解决
4. **清理 `react-hooks/exhaustive-deps` 禁用项** — 补充正确依赖数组，避免闭包陈旧 bug
5. **transport/CLI 类型安全升级** — 将 `any` 逐步替换为具体类型或 `unknown`
6. **移除/完成遗留 TODO** — 旧版 `think` 规范化等兼容代码确认过期后清理
7. **升级 `@sentry/electron` 到 v8** — 获取最新安全修复和 Electron 兼容性
8. **继续推进 P1 工作台功能** — 参考 `docs/p1-implementation-plan.md`
