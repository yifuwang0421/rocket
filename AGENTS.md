# Rocket — AI-Native Investment Research Workbench

> **目前状态**: v0.2 · P0 完成（非发布基线）· P1-0 至 P1-9 已实现并通过自动化验收（三栏布局默认启用）
> **基础项目**: Forked from [Craft Agents OSS](https://github.com/craft-ai-agents/craft-agents-oss) (Apache 2.0)
> **桌面壳**: Electron 33.3.1 · **引擎**: Pi SDK (多供应商模型) + Claude Agent SDK

---

## 1. 项目概述

Rocket 是一个 AI 原生的投研工作台桌面应用，专为二级市场基本面研究者设计。它将数据查询、财务分析、文档阅读、笔记写作、AI 对话整合到一个三栏式桌面应用窗口中。

### 1.1 核心差异

| 对比项 | 传统方案 | Rocket |
|---|---|---|
| 信息聚合 | 分散在多个应用 | **一个桌面应用整合** |
| 数据获取 | 手动查询、导出 | **Agent 按需调取，自动结构化** |
| 分析产出 | 手动做表、截图、粘贴 | **Agent 辅助分析，结果可直接保存** |
| 知识沉淀 | 笔记和文件散落各处 | **Workspace 资料与笔记统一检索** |
| 分析框架 | 靠个人经验记忆 | **可复用的 Skills（分析模板）** |

### 1.2 技术栈

| 层级 | 技术选型 |
|---|---|
| 桌面壳 | **Electron 33.3.1** (Windows 主目标) |
| 前端框架 | **React 18** + TypeScript |
| 样式 | **Tailwind CSS 4 + Radix UI** |
| 状态管理 | **Jotai** (原子化状态) |
| 编辑器 | **TipTap (ProseMirror)** |
| 布局 | **react-resizable-panels** (shadcn/ui 封装) |
| Agent 引擎 | **Pi SDK** (多供应商: DeepSeek / Claude / GPT) |
| 存储 | **JSON / JSONL**（本地文件，配置与会话） |
| 图表 | **ECharts** (计划中) |
| 包管理 | **Bun 1.3.x** |

---

## 2. 项目结构

```
rocket/
├── apps/
│   └── electron/                    ← Electron 桌面应用主目录
│       ├── src/
│       │   ├── main/                ← 主进程 (Node.js)
│       │   │   ├── index.ts         ← 应用入口 + 初始化
│       │   │   ├── window-manager.ts ← 窗口管理 (含预加载路径)
│       │   │   ├── browser-pane-manager.ts ← 浏览器面板管理
│       │   │   ├── auto-update.ts   ← 自动更新
│       │   │   ├── handlers/        ← RPC/IPC 处理器
│       │   │   └── shims/           ← 环境兼容 shims
│       │   ├── renderer/            ← 渲染进程 (React)
│       │   │   ├── App.tsx          ← React 应用根组件
│       │   │   ├── main.tsx         ← React 入口
│       │   │   ├── atoms/           ← Jotai 状态原子
│       │   │   │   ├── workspace-tabs.ts  ← (新) Tab 状态管理
│       │   │   │   ├── panel-stack.ts     ← 面板栈管理
│       │   │   │   └── sessions.ts        ← 会话管理
│       │   │   ├── components/
│       │   │   │   ├── app-shell/   ← 布局组件
│       │   │   │   │   ├── AppShell.tsx     ← 主布局容器
│       │   │   │   │   ├── ThreePanelLayout.tsx ← (新) 三栏布局
│       │   │   │   │   ├── ResearchSidebar.tsx ← (新) 左侧导航
│       │   │   │   │   ├── WorkspaceTabs.tsx  ← (新) 中间工作区
│       │   │   │   │   ├── WorkspaceTabBar.tsx ← (新) Tab 标签栏
│       │   │   │   │   ├── ChatPanel.tsx      ← (新) 右侧对话
│       │   │   │   │   ├── TopBar.tsx         ← 顶部栏
│       │   │   │   │   ├── LeftSidebar.tsx    ← 原左侧栏
│       │   │   │   │   ├── MainContentPanel.tsx ← 主内容路由
│       │   │   │   │   ├── PanelStackContainer.tsx ← 原面板容器
│       │   │   │   │   └── ...
│       │   │   │   ├── ui/          ← 通用 UI 组件
│       │   │   │   │   ├── resizable.tsx   ← react-resizable-panels 封装
│       │   │   │   │   ├── tabs.tsx        ← Radix Tabs 封装
│       │   │   │   │   └── ... (按钮、输入框、弹窗等)
│       │   │   │   └── ...
│       │   │   ├── contexts/        ← React Context
│       │   │   ├── hooks/           ← 自定义 Hooks
│       │   │   └── pages/           ← 路由页面
│       │   └── ...
│       ├── dist/                    ← 构建输出
│       │   ├── main.cjs             ← 打包的主进程
│       │   ├── bootstrap-preload.cjs ← 预加载脚本
│       │   └── renderer/            ← 渲染器构建输出
│       ├── electron-builder.yml     ← Electron 打包配置
│       └── package.json             ← 包配置
│
├── packages/
│   ├── shared/          ← 共享逻辑 (Agent/配置/数据源/工具)
│   │   ├── src/agent/   ← Agent 引擎 (ClaudeAgent, PiAgent)
│   │   ├── src/config/  ← 配置管理 (LLM 连接、模型)
│   │   ├── src/sources/ ← 数据源管理 (MCP, API, local)
│   │   ├── src/credentials/ ← 凭证加密存储
│   │   └── src/sessions/← 会话管理
│   ├── server-core/     ← 服务器核心逻辑
│   ├── server/          ← 后端服务
│   ├── pi-agent-server/ ← Pi SDK 子进程服务
│   ├── session-mcp-server/ ← MCP 会话服务器
│   ├── session-tools-core/ ← 会话工具核心
│   ├── ui/              ← 跨平台 UI 组件 (web/electron)
│   ├── messaging-gateway/ ← 消息网关 (Telegram/WhatsApp)
│   └── core/            ← 核心类型定义
│
├── scripts/             ← 构建脚本
│   ├── electron-build-main.ts     ← 主进程构建
│   ├── electron-build-preload.ts  ← 预加载脚本构建
│   └── electron-build-renderer.ts ← 渲染器构建 (Vite)
│
└── package.json         ← 根 package.json (workspace 配置)
```

---

## 3. 已完成工作 (P0)

### 3.1 品牌改名 (Craft Agents → Rocket)

| 替换项 | 原值 | 新值 |
|---|---|---|
| 包名 | `@craft-agent/*` | `@rocket/*` |
| 应用名 | Craft Agents | Rocket |
| 应用 ID | `com.lukilabs.craft-agent` | `com.rocket.research` |
| 包描述 | "Claude Code-like agent for Craft documents" | "Rocket — AI-native investment research workbench" |
| Logo | Craft 图标 | 火箭 SVG 图标 (占位) |

所有改名已验证编译通过，应用可正常启动。

### 3.2 Windows 兼容性修复

| 问题 | 原因 | 修复 |
|---|---|---|
| `require("electron")` 返回路径字符串 | Bun 设置了 `ELECTRON_RUN_AS_NODE` 环境变量 | 启动时用 `env -u ELECTRON_RUN_AS_NODE` |
| ESM 模块 `require()` 失败 | esbuild 将 `@anthropic-ai/claude-agent-sdk` 打包为 CJS | 改用 `bun build` 编译主进程，原生处理 ESM |
| Sentry 崩溃 | 静态 import 在模块初始化时访问 `electron.app` | 改为动态 `import()` |
| electron-updater 崩溃 | 同上 | 改为动态 `import()` |
| 渲染器路径错误 | bun build 保留源码 `__dirname` | 增加 `RENDERER_ROOT` 自动检测 dist 路径 |
| 预加载脚本路径错误 | 同上 | 修正为 `../../dist/` 相对路径 |

### 3.3 三栏投研工作台 (P1)

三栏可伸缩布局已接入真实 Agent 会话、Workspace 文件目录、Markdown 编辑保存、PDF/HTML/Word/Excel 只读预览、可重建全文检索、版本锁定的 Agent 文件上下文，以及文件夹化的公司/行业研究范围管理。三栏布局默认启用；在构建环境设置 `VITE_ROCKET_RESEARCH_LAYOUT=0` 可临时回退经典布局。

```
┌──────────┬──────────────────────────────┬──────────┐
│  左栏    │         中栏                  │  右栏    │
│  导航    │  Tab 标签栏                   │  Agent   │
│          │  ┌──────────────────────┐    │  对话    │
│  工作区  │  │  内容区              │    │  会话历史│
│  Skills  │  │  · 投研概览          │    │  Agent   │
│  数据源  │  │  · 资料目录          │    │  对话    │
│  笔记    │  │  · Markdown 编辑器   │    │          │
│  设置    │  │  · 文档阅读与检索    │    │          │
│  定时任务│  └──────────────────────┘    │          │
│          │                              │          │
└────────────────────────────────────────────────────┘

← 可拖拽 →                          ← 可拖拽 →
```

**使用技术**: `react-resizable-panels` (已有依赖)
- `ResizablePanelGroup` + `ResizablePanel` + `ResizableHandle`
- 三面板可拖拽调节
- minSize / maxSize 约束
- withHandle 拖拽把手

---

## 4. 开发路线图

### Phase P1: 本地投研工作台闭环（已完成实现）

P1 的唯一规范来源是 [`docs/p1-implementation-plan.md`](docs/p1-implementation-plan.md)，验收证据见 [`docs/p1-acceptance-report.md`](docs/p1-acceptance-report.md)。三栏布局默认启用，经典布局回退开关保留一个发布周期。

| 编号 | 任务 | 状态 |
|---|---|---|
| P1-0 | 冻结规格、修正路线图、移除原型假数据、建立验收清单 | ✅ 已完成 |
| P1-1 | Workspace 级中栏模式、研究 Tab 合约、持久化与恢复 | ✅ 已完成 |
| P1-2 | 最终左栏导航及 Skills/Sources/Automations/Settings 复用 | ✅ 已完成（自动化验证） |
| P1-3 | 当前 Workspace 会话与右栏历史抽屉 | ✅ 已完成（自动化验证） |
| P1-4 | 资料目录、Markdown 导入、编辑和显式保存 | ✅ 已完成（自动化验证） |
| P1-5 | PDF/HTML/DOCX/XLSX 只读预览 | ✅ 已完成（自动化验证） |
| P1-6 | Workspace 全文索引和搜索 | ✅ 已完成（自动化验证） |
| P1-7 | Agent 资源上下文、安全写入和冲突处理 | ✅ 已完成（自动化验证） |
| P1-8 | 文件夹化的公司和行业研究范围管理 | ✅ 已完成（自动化验证） |
| P1-9 | 统一状态、错误恢复、可访问性和完整验收 | ✅ 实现完成，自动化验收通过；Windows 人工回归待补 |

P1 明确不包含实时行情、K 线、OCR、独立知识库、应用级全局搜索、非 scheduled 自动化和底部状态栏。

### Phase P2: 数据驱动的投研能力

| 编号 | 任务 | 优先级 |
|---|---|---|
| P2-1 | 接入 AKShare 数据 Source | P0 |
| P2-2 | 接入 yfinance 数据 Source | P0 |
| P2-3 | K 线、行情与财务数据视图 | P0 |
| P2-4 | 实现财务比率分析 Skill | P0 |
| P2-5 | 实现同业对比 Skill | P0 |
| P2-6 | DCF 估值和行业扫描 Skill | P1 |

### Phase P3: 高级研究能力

| 编号 | 任务 | 优先级 |
|---|---|---|
| P3-1 | 公司与行业结构化研究模板 | P0 |
| P3-2 | 财务模型和图表联动 | P0 |
| P3-3 | OCR 与更多文档格式 | P1 |
| P3-4 | 跨 Workspace 研究聚合 | P1 |

### Phase P4: 打磨与扩展

| 编号 | 任务 | 优先级 |
|---|---|---|
| P4-1 | 自动化晨间简报 | P1 |
| P4-2 | 更多 Skills | P1 |
| P4-3 | MCP Server 扩展 | P2 |
| P4-4 | 性能优化、Bug 修复 | 持续 |

---

## 5. 关键注意事项

### 5.1 构建与启动

```bash
# 完整编译 (主进程 + 预加载 + 渲染器 + 资源)
bun run electron:build

# 仅编译主进程
bun run scripts/electron-build-main.ts

# 仅编译预加载脚本
bun run scripts/electron-build-preload.ts

# 仅编译渲染器 (Vite)
bun run scripts/electron-build-renderer.ts

# 构建并启动；脚本会自动清除 ELECTRON_RUN_AS_NODE
bun run electron:start
```

### 5.2 `ELECTRON_RUN_AS_NODE` 环境变量

**这是最重要的已知坑。**

Bun 在 Windows 上设置了 `ELECTRON_RUN_AS_NODE` 环境变量，导致 Electron 以纯 Node.js 模式运行（`process.type` 为 `undefined`，`require("electron")` 不工作）。

**修复**: 启动时使用 `env -u ELECTRON_RUN_AS_NODE` (Linux/Mac) 或 `$env:ELECTRON_RUN_AS_NODE = $null` (Windows PowerShell) 清除此变量。

`package.json` 中的 `electron:start` 脚本已修复:
```json
"electron:start": "bun run electron:build && env -u ELECTRON_RUN_AS_NODE electron apps/electron"
```

### 5.3 bun build vs esbuild

主进程使用 **`bun build`** 而非 `esbuild`，原因:

| 对比项 | esbuild | bun build |
|---|---|---|
| CJS 输出 | 好用 | 好用 |
| ESM 模块支持 | 对 ESM-only 包需要 external + Node 22+ | **原生支持** |
| `__dirname` | 保持源码路径 | 保持源码路径 (需要手动处理) |
| `--alias` 支持 | 支持 | **不支持** |
| 编译速度 | 快 | 快 |

**重要**: `bun build` 的 `__dirname` 是源码路径 (如 `apps/electron/src/main/`)，不是输出路径 (`dist/`)。所有用到 `__dirname` 解析资源路径的地方需要:

```typescript
// ❌ 错误: 会指向 src/main/renderer/
join(__dirname, 'renderer/')

// ✅ 正确: 使用 RENDERER_ROOT 自动检测
import { RENDERER_ROOT } from './window-manager'
```

`window-manager.ts` 中的 `RENDERER_ROOT` 和预加载路径已经处理了这个问题。

### 5.4 Electron 33 兼容性

项目使用 **Electron 33.3.1**。比它更新的版本 (37+) 在 Windows 11 上有 `process.type` 为 `undefined` 的兼容性问题。

| Electron 版本 | 状态 | 说明 |
|---|---|---|
| 33.3.1 | ✅ 可用 | 需要 `env -u ELECTRON_RUN_AS_NODE` |
| 38.x | ❌ 不可用 | 即使清除环境变量也不工作 |
| 39.x | ❌ 不可用 | 同上 |

如果未来需要升级 Electron，必须先在 Windows 11 上完整测试 `require("electron")` 和 `process.type`。

### 5.5 设计风格

所有 UI 组件应遵循 Rocket 的现有设计体系:
- **组件库**: shadcn/ui 标准组件 (`@/components/ui/*`)
- **图标**: `lucide-react` (已安装)
- **颜色**: Tailwind CSS 变量 (`bg-background`, `text-foreground`, `border-border` 等)
- **字号**: `text-xs` (11-12px), `text-sm` (13-14px), `text-base`
- **圆角**: `rounded-[6px]`, `rounded-[8px]`, `rounded-lg`
- **动画**: `motion/react` (framer-motion)
- **字体**: Inter (UI), JetBrains Mono (代码)

### 5.6 CORS / CSP

由于 Electron 使用 `file://` 协议加载渲染器，CSP (Content Security Policy) 需要放宽以支持从本地文件加载脚本:

```
default-src 'self' file:;
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http://localhost:8097 file:;
```

已在 `apps/electron/src/renderer/index.html` 中配置。

---

## 6. 数据源架构

```
Agent 对话层 (Pi SDK / Claude SDK)
    │
    ├──→ Sources 层 (Rocket 内置)
    │      ├── AKShare Source (A/港股 — 免费)
    │      ├── yfinance Source (美股 — 免费)
    │      └── MCP Source (第三方数据 — 待实现)
    │
    └──→ MCP 协议层 (标准化)
           ├── MCP Server: 财务数据
           ├── MCP Server: 新闻舆情
           └── MCP Server: 行业数据库
```

| 市场 | 数据源 | 费用 | 优先级 |
|---|---|---|---|
| A 股 | AKShare | 免费 | P0 |
| 港股 | AKShare / Yahoo Finance | 免费 | P0 |
| 美股 | yfinance | 免费 | P0 |
| 美股 | Financial Modeling Prep (Free Tier) | 免费 | P1 |
| 全球 | MCP 协议 | 视服务而定 | P2 |

---

## 7. 模型策略 (Pi SDK 多供应商)

| 模型 | 用途 | 接入方式 |
|---|---|---|
| **DeepSeek** (推理主力) | 日常投研分析、数据调用 | Pi SDK 统一接口 |
| Claude | 写作、长报告生成 | Pi SDK / Claude SDK |
| GPT | 备选 | Pi SDK 统一接口 |

---

## 8. 常见问题

### Q: 应用启动后窗口空白然后关闭？
检查 `ELECTRON_RUN_AS_NODE` 是否清除。

### Q: 编译报错 "Cannot find module '@rocket/shared/...'"
运行 `bun install` 重新链接 workspace 包。

### Q: 渲染器空白或有 JS 错误
1. 检查 CSP 是否允许 `file:` 协议 (见 index.html)
2. 检查预加载脚本是否正确编译 (`dist/bootstrap-preload.cjs`)
3. 检查主工作区文件路径是否正确 (见 `RENDERER_ROOT`)

### Q: Windows 上 `rm -f` 不工作
PowerShell 用 `Remove-Item <path> -Force`，Git Bash 用 `rm -f <path>`。

---

## 9. 交付清单

### 已交付

- [x] PRD 文档 (PRD_ResearchWorkbench_v0.1.md)
- [x] Fork 改名完成 (@rocket/* 包名)
- [x] 主进程 + 预加载 + 渲染器编译通过
- [x] Windows 11 桌面应用正常启动
- [x] 三栏可伸缩布局（P1-1，默认启用）
- [x] Workspace 级 Tab 状态管理与恢复
- [x] 所有 Windows 兼容性修复

### 待交付 (P1)

- [x] Workspace 级中栏模式、研究 Tab 和恢复机制 (P1-1)
- [x] 最终左侧导航及管理页复用 (P1-2)
- [x] 当前 Workspace 会话和历史抽屉 (P1-3)
- [x] 资料目录和 Markdown 编辑保存 (P1-4)
- [x] PDF/HTML/Word/Excel 只读预览 (P1-5)
- [x] Workspace 全文索引和搜索 (P1-6)
- [x] Agent 上下文、安全写入和冲突处理 (P1-7)
- [x] 公司和行业研究管理 (P1-8)
- [x] 统一状态、错误恢复和 `validate:p1` (P1-9；Windows 人工回归待补)

---

## 10. 核心文件索引

| 文件路径 | 作用 |
|---|---|
| `apps/electron/src/main/index.ts` | 主进程入口，初始化所有系统 |
| `apps/electron/src/main/window-manager.ts` | 窗口管理，含 RENDERER_ROOT, 预加载路径 |
| `apps/electron/src/renderer/App.tsx` | 渲染进程入口，Provider 树 |
| `apps/electron/src/renderer/main.tsx` | React 入口 |
| `apps/electron/src/renderer/components/app-shell/AppShell.tsx` | 主布局 (含三栏切换) |
| `apps/electron/src/renderer/components/app-shell/ThreePanelLayout.tsx` | 三栏布局容器 |
| `apps/electron/src/renderer/components/app-shell/ResearchSidebar.tsx` | 左侧导航 |
| `apps/electron/src/renderer/components/app-shell/WorkspaceTabs.tsx` | 中间 Tab 工作区 |
| `apps/electron/src/renderer/components/app-shell/WorkspaceTabBar.tsx` | Tab 标签栏 |
| `apps/electron/src/renderer/components/app-shell/ChatPanel.tsx` | 右侧对话面板 |
| `apps/electron/src/renderer/atoms/workspace-tabs.ts` | Tab 状态管理 |
| `apps/electron/src/renderer/components/ui/resizable.tsx` | react-resizable-panels 封装 |
| `apps/electron/src/renderer/components/ui/tabs.tsx` | Radix Tabs 封装 |
| `apps/electron/src/renderer/index.html` | 渲染器 HTML (含 CSP) |
| `apps/electron/electron-builder.yml` | Electron 打包配置 |
| `scripts/electron-build-main.ts` | 主进程构建脚本 |
| `package.json` | 根 package.json (workspaces, scripts) |
| `packages/shared/src/agent/` | Agent 引擎代码 |
| `packages/shared/src/config/` | 配置管理 |
