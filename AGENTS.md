# Rocket — AI-Native Investment Research Workbench

> **目前状态**: v0.2 · P0 完成（非发布基线）· P1-1 原型开发中（三栏布局默认关闭）
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
| 知识沉淀 | 笔记和文件散落各处 | **统一知识库 + 可搜索** |
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

### 3.3 三栏布局原型 (P1-1)

已完成三栏可伸缩布局的初步原型，但真实数据、文件视图和 Agent 对话尚未接入。
P0 默认使用稳定的经典布局；只有在构建环境设置
`VITE_ROCKET_RESEARCH_LAYOUT=1` 时才启用该原型。

```
┌──────────┬──────────────────────────────┬──────────┐
│  左栏    │         中栏                  │  右栏    │
│  导航    │  Tab 标签栏                   │  Agent   │
│          │  ┌──────────────────────┐    │  对话    │
│  搜索框  │  │  内容区              │    │          │
│  自选股  │  │  · Home 首页         │    │  Bot 图标│
│  行业    │  │  · 文件阅览器 (P1-3) │    │  占位文字 │
│  工具    │  │  · 笔记编辑器 (P1-3) │    │          │
│  笔记    │  │  · 图表 (P2)        │    │          │
│  数据源  │  └──────────────────────┘    │          │
│          │                              │          │
├──────────┴──────────────────────────────┴──────────┤
│                  状态栏 (待实现)                     │
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

### Phase P1: 布局改造 + 核心视图 (当前)

| 编号 | 任务 | 状态 | 负责人 |
|---|---|---|---|
| P1-1 | 三栏可伸缩布局 | 🚧 原型 | 默认关闭，待真实数据与 Agent 集成 |
| P1-2 | 左栏导航树（自选股/行业/工具/笔记） | 📋 待开始 | |
| P1-3 | 中栏 Tab 系统 + 文件阅览器 (MD/PDF/DOCX/XLSX) | 📋 待开始 | |
| P1-4 | K 线图表组件 (ECharts) | 📋 待开始 | |
| P1-5 | 自选股/关注列表 | 📋 待开始 | |
| P1-6 | 右栏 Agent 对话集成 | 📋 待开始 | |
| P1-7 | 底部状态栏 | 📋 待开始 | |

#### P1-2 详细规划 — 左栏导航树

**目标**: 将 ResearchSidebar 中的占位数据替换为真实数据源

**需要的工作**:
1. 连接自选股数据源 (从配置/存储读取用户关注的公司列表)
2. 行业/公司动态获取 (从 AKShare/yfinance 等数据源读取)
3. 导航树可拖拽排序 (复用已有的 `sortable-list.tsx`)
4. 右键上下文菜单 (复用已有的 `SidebarMenu.tsx`)
5. 搜索功能接入后端搜索

**关键文件**:
- `components/app-shell/ResearchSidebar.tsx` — 主组件
- `atoms/workspace-tabs.ts` — 用于打开公司页面到主工作区
- `hooks/useProjects.ts`, `hooks/useLabels.ts` — 复用已有的 hooks

**技术要点**:
- 使用现有 `Collapsible` 组件实现树展开/折叠
- 使用现有 `SortableList` 实现拖拽排序
- 点击导航项 → `openTabAtom` 在主工作区打开对应的 tab

#### P1-3 详细规划 — 文件阅览器 + Tab 系统

**目标**: 主工作区可以打开并显示 Markdown/PDF/Word/Excel 文件

**已有基础** (不需额外安装):

| 格式 | 渲染方案 | 是否已有 |
|---|---|---|
| Markdown | `react-markdown` + shiki 高亮 | ✅ 项目已有 |
| PDF | PDF.js (pdf.worker.min.mjs 已打包) | ✅ 项目已有 |
| Word (.docx) | 通过 markitdown Python 脚本转为 markdown | ✅ 资源脚本已有 |
| Excel (.xlsx) | 通过 xlsx-tool Python 脚本解析 | ✅ 资源脚本已有 |
| HTML | iframe 沙盒渲染 | ✅ 基础能力 |

**关键文件**:
- `components/app-shell/WorkspaceTabs.tsx` — 主组件 (需要扩展)
- `components/app-shell/WorkspaceTabBar.tsx` — Tab 标签栏
- `atoms/workspace-tabs.ts` — Tab 状态管理

**技术要点**:
- Tab 状态已通过 Jotai atom 管理 (`openTabsAtom`)
- 文件打开统一接口: `openTabAtom` dispatch → 自动选择渲染器
- 文件类型检测: 根据扩展名 `.md / .pdf / .docx / .xlsx` 选择渲染组件
- 文件内容读取: 通过 `window.electronAPI` 或 IPC 读取本地文件

### Phase P2: 投研能力

| 编号 | 任务 | 优先级 |
|---|---|---|
| P2-1 | 接入 AKShare 数据 Source | P0 |
| P2-2 | 接入 yfinance 数据 Source | P0 |
| P2-3 | 实现财务比率分析 Skill | P0 |
| P2-4 | 实现同业对比 Skill | P0 |
| P2-5 | DCF 估值 Skill | P1 |
| P2-6 | 行业扫描 Skill | P1 |

### Phase P3: 知识库

| 编号 | 任务 | 优先级 |
|---|---|---|
| P3-1 | TipTap 编辑器集成到中栏 | P0 |
| P3-2 | 知识库结构（行业/公司/笔记） | P0 |
| P3-3 | Agent 可读写知识库 | P1 |
| P3-4 | 全文搜索 | P1 |

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
- [x] 三栏可伸缩布局原型（P1-1，默认关闭）
- [x] Tab 状态管理原型
- [x] 所有 Windows 兼容性修复

### 待交付 (P1)

- [ ] 左侧导航真实数据 (P1-2)
- [ ] 文件阅览器 (Markdown/PDF/Word/Excel) (P1-3)
- [ ] K 线图表组件 (P1-4)
- [ ] 自选股列表 (P1-5)
- [ ] Agent 对话集成 (P1-6)
- [ ] 底部状态栏 (P1-7)

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
