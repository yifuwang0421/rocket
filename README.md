# Rocket

Rocket 是面向二级市场基本面研究的 AI 原生桌面工作台。它把数据查询、文档阅读、研究笔记、分析产物与 Agent 对话放进同一个 Electron 应用，并以可追溯的本地工作区沉淀研究过程。

当前代码基于 [Craft Agents OSS](https://github.com/craft-ai-agents/craft-agents-oss)（Apache 2.0）演进。原项目的版权与商标说明见 [NOTICE](NOTICE) 和 [TRADEMARK.md](TRADEMARK.md)。

## 当前阶段

- P0 非发布基线：开发环境可用，Rocket 包名、应用名、配置目录、主题和桌面图标已迁移，桌面应用可编译并从源码启动。
- P0 不包含安装器、候选物、签名、在线更新、公开域名或分发验收。完成定义见 [P0 非发布基线](docs/p0-baseline.md)。
- P1 工作台：三栏布局和 Tab 仍是原型，默认关闭；设置 `VITE_ROCKET_RESEARCH_LAYOUT=1` 可用于开发预览。

产品范围和路线图以仓库外层的 `PRD_ResearchWorkbench_v0.1.md` 与本目录的 `AGENTS.md` 为准。

## 技术栈

- Electron 33 + React 18 + TypeScript
- Tailwind CSS 4 + Radix UI + Jotai
- Pi SDK 与 Claude Agent SDK
- Bun workspace monorepo
- 本地配置与研究数据目录：`~/.rocket/`

## 本地开发

要求：

- Bun 1.3.x
- Node.js 20+
- Windows 11、macOS 或 Linux

安装依赖：

```bash
bun install
```

完整构建：

```bash
bun run electron:build
```

构建并启动桌面应用：

```bash
bun run electron:start
```

`electron:start` 会在启动子进程前移除 `ELECTRON_RUN_AS_NODE`，因此在 PowerShell 和类 Unix shell 中使用同一条命令即可。

开发模式：

```bash
bun run electron:dev
```

## 验证

```bash
bun run validate:p0
```

`validate:p0` 只检查源码基线：类型、测试、Lint、i18n 和 Electron 构建，不生成安装包，也不执行发布检查。

更完整的仓库检查：

```bash
bun run typecheck:all
bun run validate:ci
```

## Headless Server

生成 token 并查看启动命令：

```bash
bash scripts/install-server.sh
```

直接启动：

```bash
ROCKET_SERVER_TOKEN=<secret> \
ROCKET_RPC_HOST=127.0.0.1 \
bun run server:start
```

远程连接桌面客户端：

```bash
ROCKET_SERVER_URL=ws://127.0.0.1:9100 \
ROCKET_SERVER_TOKEN=<secret> \
bun run electron:start
```

非本机连接应配置 `ROCKET_RPC_TLS_CERT` 与 `ROCKET_RPC_TLS_KEY` 并使用 `wss://`。

## 目录

```text
apps/
  electron/             Electron 桌面应用
  cli/                  Headless Server 命令行客户端
  webui/                远程 Web 客户端
packages/
  core/                 共享类型
  shared/               Agent、配置、来源与会话逻辑
  server-core/          服务端核心
  server/               Headless Server 入口
  session-mcp-server/   会话 MCP 服务
  session-tools-core/   会话工具
  ui/                   跨端 UI
scripts/                构建、发布与验证脚本
```

## 许可证

Apache License 2.0。详见 [LICENSE](LICENSE)。
