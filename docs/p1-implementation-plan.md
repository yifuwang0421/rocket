# Rocket P1 实施方案

> 状态：实现完成，自动化验收通过；Windows 人工回归待补  
> 更新日期：2026-08-09  
> 基线：P0 非发布基线；三栏研究布局默认启用，`VITE_ROCKET_RESEARCH_LAYOUT=0` 保留一个回退周期

当前进度：P1-0 至 P1-9 已完成实现。右栏已接入当前 Workspace 的真实 Agent 会话、历史浮层和资源上下文；中栏已完成 notes/documents 文件浏览、原子导入、Markdown 编辑与显式保存、PDF/HTML/DOCX/XLSX 只读预览、可重建全文检索，以及文件夹化的公司/行业研究范围管理。Agent 仅收到资源路径和元数据，并可在明确指令下管理研究范围或通过版本锁定写入 Markdown。`bun run validate:p1` 已通过；受当前验收环境的 Windows 用户目录权限和桌面控制通道故障影响，可见窗口的切换与重启人工回归仍待补充，详见 [`p1-acceptance-report.md`](p1-acceptance-report.md)。

## 1. 阶段目标

P1 将三栏原型转化为默认启用、可实际使用的本地投研工作台。用户应能在一个 Workspace 中管理研究范围、浏览资料、编辑 Markdown、检索文档，并让右侧 Agent 在明确的资源上下文中安全读取和写入文件。

P1 的完成标准是：用户切换 Workspace 或重启 Rocket 后，能够恢复已打开的研究 Tab、Tab 顺序、活动 Tab 和文件阅读位置，并继续编辑、搜索和对话，不丢失内容，也不会被 Agent 静默覆盖。

## 2. 产品边界

### 2.1 纳入 P1

- 三栏布局正式集成；
- 左侧研究导航；
- 投研概览、研究 Tab 和 Workspace 级现场恢复；
- 资料目录及外部文件复制导入；
- Markdown 编辑、显式保存和版本冲突保护；
- HTML、DOCX、XLSX、PDF 只读预览；
- Workspace 全文索引与搜索；
- 公司和行业研究范围管理；
- Agent 资源上下文、按需读取及 Markdown 安全写入；
- 当前 Workspace 的历史 Agent 会话浮层；
- Skills、数据源、scheduled 定时任务和设置管理；
- 统一的加载、空状态、错误和恢复行为。

### 2.2 不纳入 P1

- K 线、实时行情、行业涨跌、资金流向和实时估值；
- AKShare/yfinance 的实际行情查询；
- OCR；
- HTML、Word、Excel 编辑；
- 独立知识库和应用级全局搜索；
- 本地文件夹类型数据源；
- 非 scheduled 自动化；
- 底部状态栏；
- 任何模拟行情或虚构投研数据。

## 3. 信息架构

### 3.1 左栏

- 新建会话；
- 工作区；
  - 公司；
  - 行业；
  - 笔记；
- Skills；
- 数据源；
  - MCP；
  - API；
- 定时任务；
- 设置，固定在底部。

顶部 Workspace 选择器继续负责整个环境和数据边界；左栏“工作区”仅代表当前 Workspace 的投研主视图。

AKShare 和 yfinance 不作为左栏导航项；它们显示在中栏 API 数据源页面中，供用户查看配置与连接状态。

### 3.2 中栏

中栏只有两种模式：

- `research`：投研概览、资料目录、公司、行业、笔记和文件使用 Tab；
- `standalone`：Skills、数据源、定时任务和设置占据中栏，隐藏 TabBar。

进入独立管理页不会关闭研究 Tab。管理页返回时恢复此前活动研究 Tab；点击左栏“工作区”始终打开投研概览。独立管理页不在应用重启后恢复。

### 3.3 P1-2 管理页实现约束

- Skills 页面复用现有列表、详情、新建、编辑和删除能力，并增加 Workspace Skill 的启用/停用；停用后 Agent 不再加载或调用该 Skill；
- 数据源左栏只保留 MCP 与 API 两级入口，二者复用现有数据源配置和连接状态；
- API 详情页集中展示 AKShare/yfinance 的配置与连接状态，已配置项可直接进入对应数据源详情；
- 定时任务只展示 `scheduled` 类型，并复用既有详情、历史和操作能力；
- 设置复用原有导航和各设置页面；
- 以上页面均属于 `standalone` 中栏模式，不创建研究 Tab，也不覆盖研究 Tab 现场。

### 3.4 右栏

右栏始终是当前 Workspace 的 Agent 对话。历史会话图标打开右栏内部抽屉，支持搜索和切换当前 Workspace 的历史会话。新建会话直接创建空白会话并聚焦输入框；从未发送消息的空白会话离开后自动删除。

## 4. 核心状态契约

- `MiddleViewMode`：`research` 或 `standalone`；
- `ResearchTab`：类型、稳定 ID、标题、资源引用和可关闭状态；
- `ResourceRef`：Workspace ID、相对路径或结构化资源 ID、类型和元数据；
- `ReadingState`：滚动位置以及 PDF 页码、缩放等；
- `AgentContextRef`：只包含资源引用与元数据，不包含正文；
- `DocumentRevision`：版本号或内容哈希、修改者和修改时间；
- `WatchlistItem`、`SectorItem`：Workspace 级研究范围数据；
- `IndexRecord`：可从源文件完全重建的派生数据。

所有文件路径必须解析并验证位于当前 Workspace 内。Renderer 不获得任意路径写权限。

## 5. 研究 Tab 规则

- 投研概览固定、不可关闭；
- 公司、行业、笔记列表和资料目录为单例、可关闭 Tab；
- 笔记、文件、公司和行业详情按稳定资源 ID 去重；
- 每个 Workspace 独立保存 Tab、顺序、活动 Tab 和阅读位置；
- 文件丢失时保留错误 Tab，提供重新定位或关闭；
- 切换 Workspace 前保存旧状态，再恢复新状态。

## 6. 文件与笔记规则

- Markdown 可编辑，编辑后立即显示“保存”按钮，不自动保存；
- HTML、DOCX、XLSX、PDF 只读预览和检索；
- PDF 不做 OCR；扫描 PDF 仍可预览，但提示无可搜索文本；
- 拖到笔记页面的 Markdown 导入 `notes/`；
- 拖到普通资料区域的文件导入 `documents/`；
- 外部文件必须先原子复制进当前 Workspace，成功后才索引和打开；
- Workspace 文件默认都是数据源，但排除版本库、依赖、构建产物、缓存、临时文件、隐藏配置、凭证、不支持及超限文件；
- 全文索引是 Workspace 级、可完全重建的派生数据。

## 7. Agent 读写与冲突规则

- 激活笔记或文件 Tab 时自动设置 Agent 上下文；
- 输入框上方显示可移除的上下文标识；
- 只向 Agent 传递 Workspace ID、资源路径、类型和元数据；
- 正文由 Agent 在执行时按需读取；
- 未保存内容不会传给 Agent；发送时提供“保存并发送”“使用已保存版本”“取消”；
- 用户存在未保存修改时，Agent 不得写入同一文件；
- Agent 写入前校验基础版本，版本变化时不得覆盖，必须进入差异处理；
- Agent 可按明确指令创建或追加 Markdown；覆盖和删除需要确认并记录版本；
- Agent 写入成功后刷新编辑器和全文索引。

## 8. 公司与行业

P1 将两者定位为带研究属性的真实 Workspace 文件夹，而非行情看板。结构化字段是文件夹的标签与进度侧车数据，文件夹中的文件才是研究资料事实源。

- 公司目录沿用兼容存储根路径 `documents/自选股/`；新增时必须通过证券名称或代码搜索选择结果，名称、代码和市场由证券主数据自动填入；
- 新公司默认创建“公告、模型、研报、纪要、其他”五个子文件夹；
- 行业目录沿用兼容存储根路径 `documents/行业板块/`，P1 不预设子文件夹；
- 公司和行业条目的叶子目录分别使用“公司名（代码）”与“行业名”，不附加内部 ID 或随机后缀；schema v2 的旧目录会在读取时迁移并保留全部文件；
- 详情页以紧凑标签属性摘要置顶，主体为真实文件浏览器；文件夹可单击进入并通过返回键或面包屑导航，可在当前目录新建文件夹和 Markdown 文件，导入/拖入也默认写入当前目录；任意普通文件可保存，P1 已支持的格式继续复用编辑、预览、检索与 Agent 上下文能力；
- 公司展示分组、研究状态、标签、关注逻辑和最近研究时间；行业展示关注等级、研究状态、行业逻辑、关联公司和最近研究时间；
- 用户和 Agent 可按明确指令增改。移除标签需要确认，但默认保留对应文件夹及其中全部文件。

## 9. 状态与错误原则

- 不出现空白页面、无限转圈或静默失败；
- 加载局部化，中栏加载不阻塞左右栏；
- 长任务显示阶段、进度和取消入口；
- 错误说明发生了什么、影响范围和恢复操作；
- 保存失败保留编辑缓冲区；
- 索引失败不影响目录浏览和直接打开；
- 导入失败清理临时副本；
- 任何错误都不得丢失未保存 Markdown、Tab 状态、阅读位置或未发送的对话草稿。

## 10. 实施切片

| 切片 | 交付内容 | 完成信号 |
|---|---|---|
| P1-0 | 冻结规格、更新路线图、清除原型假数据、建立验收清单 | 文档、代码和验收口径一致 |
| P1-1 | Workspace 级中栏模式、研究 Tab 合约、持久化与最小路由切片 | Workspace 切换和重启可恢复研究 Tab |
| P1-2 | 最终左栏导航及 Skills/Sources/Automations/Settings 复用 | 管理入口连接真实能力；会话行为留给 P1-3 |
| P1-3 | 当前 Workspace 会话与右栏历史抽屉 | 新建、切换及空白会话清理可用 |
| P1-4 | 资料目录、Markdown 导入、编辑、显式保存 | 完成“导入—编辑—保存—重启恢复”闭环 |
| P1-5 | PDF/HTML/DOCX/XLSX 只读预览 | 五种 P1 格式稳定打开 |
| P1-6 | 全文索引和笔记/资料搜索 | 索引可删除后重建且结果可定位 |
| P1-7 | Agent 上下文、安全写入、版本冲突处理 | Agent 无法静默覆盖用户内容 |
| P1-8 | 公司和行业研究管理 | 展示真实研究范围，不展示模拟行情 |
| P1-9 | 空状态、错误、可访问性和完整验收 | `validate:p1` 与 Windows 桌面回归通过 |

## 11. 验收与质量门禁

至少覆盖以下自动化测试：

- Workspace 状态隔离与 schema 迁移；
- Tab 去重、关闭、排序、恢复和丢失资源；
- 阅读位置恢复；
- Workspace 路径越界与符号链接防护；
- Markdown 原子保存与失败恢复；
- 外部导入中断、重名和清理；
- PDF/HTML/DOCX/XLSX 预览格式、大小和路径安全；
- HTML 沙箱与内容安全策略；
- PDF 页码、缩放和文档滚动位置恢复；
- 索引增删改、重建和排除规则；
- Agent 上下文不携带正文；
- 未保存或版本变化时 Agent 写入被阻止；
- 空白会话自动删除；
- scheduled 自动化过滤及数据源状态映射。

最终门禁顺序：

1. 目标单元测试与组件测试；
2. `bun run typecheck:all`；
3. `bun run lint`；
4. `bun run test`；
5. `bun run electron:build`；
6. Windows 桌面端完整人工回归；
7. 新增并通过 `bun run validate:p1`。

## 12. 发布与回退

三栏布局现为默认行为。`VITE_ROCKET_RESEARCH_LAYOUT=0`、`false` 或 `classic` 可在构建时回退到经典布局；未设置、空值或 `1` 均启用三栏布局。回退开关至少保留一个发布周期，且不得删除 Workspace 文件、研究范围侧车或本地 Tab 状态。

## 13. P1-1 架构简报

### Context and constraints

Rocket 是既有 Electron/React/Jotai 单体桌面应用。P1-1 不引入新服务或数据库，只建立 Workspace 级前端状态边界；经典布局必须继续可用。

### Repo shape

- `atoms/workspace-tabs.ts`：持久化契约、校验和纯状态转换；
- `hooks/useWorkspaceResearchState.ts`：Jotai atom family、本地加载和保存；
- `components/app-shell/*`：只消费控制器并渲染，不直接读写持久化；
- `lib/local-storage.ts`：集中登记存储键。

### Backend module contracts

P1-1 不新增后端或 IPC 合约。文件权限、索引与 Agent 写入分别在后续切片中通过主进程或既有 RPC 边界实现。

### Frontend boundaries

`ThreePanelLayout` 为当前 Workspace 创建唯一研究控制器，并向左栏和中栏传递。纯转换函数负责所有 Tab 不变量；独立管理页是运行时状态，不写入恢复快照。

### Testing strategy

纯状态测试覆盖默认值、损坏快照归一化、Tab 去重、关闭回退、固定概览、顺序、阅读状态和管理页不恢复。质量门禁包含 Electron 类型检查、定向 ESLint 和生产 Renderer 构建。

### Rollout and rollback plan

三栏布局继续受 `VITE_ROCKET_RESEARCH_LAYOUT` 控制。关闭开关即可回退到经典布局；P1-1 新增的 Workspace 本地状态不会改变服务端或 Workspace 文件。

### Open risks and follow-ups

- 仍需 Windows 桌面端验证实际 Workspace 切换和应用重启；
- 多窗口同时编辑同一 Workspace 状态尚未定义，P1 默认最后写入者生效；
- PDF/HTML/DOCX/XLSX 已接入真实 Viewer；仍需 Windows 桌面端验证大文件、复杂 Office 文档和重启后的阅读位置。

## 14. P1-3/P1-4 架构简报

### Context and constraints

P1-3/P1-4 在既有 Electron/React/Jotai 架构内增加真实会话和 Workspace 文件闭环。经典布局、既有会话存储与 Agent 执行链不能被复制或替换；Renderer 不获得任意路径写权限。

### Repo shape

- `ChatPanel.tsx`、`useResearchSessionActions.ts`：复用现有 ChatPage、会话 atoms 和 NavigationContext；
- `ResearchFilesWorkspace.tsx`、`MarkdownResearchEditor.tsx`：中栏文件列表、拖拽导入、编辑缓冲和显式保存；
- `workspace-research-files.ts`：Workspace 文件路径、原子导入、原子保存和版本校验；
- protocol、RPC handler、Electron channel map：只暴露 Workspace 相对路径文件能力。

### Backend module contracts

文件 RPC 提供 list、read Markdown、create Markdown、import 和 save 五个正交操作。Handler 仅验证 Workspace 身份并转交服务；服务统一约束 `notes/`、`documents/`、扩展名、大小、符号链接和路径越界。

### Request context and middleware policy

每个请求同时校验 RPC 上下文 Workspace 与显式 `workspaceId`。读取和保存只接受 Workspace 相对路径；外部绝对路径只允许来自用户文件选择或系统拖拽的导入操作，且导入成功后不再引用原路径。

### Frontend boundaries

右栏会话切换继续通过现有路由同步全局选中状态，历史浮层只筛选当前 Workspace 且排除隐藏会话。Markdown 正文由中栏编辑器持有；Tab 只持久化资源路径和元数据，未保存缓冲区单独按 Workspace/路径保存。

### Testing strategy

单元测试覆盖会话 Workspace 过滤、空白会话判定、路径越界、原子保存、版本冲突、导入重名、格式限制、隐藏文件和临时文件清理；门禁继续包含 IPC 清单、类型检查、定向 lint 与生产构建。

### Rollout and rollback plan

全部能力仍由 `VITE_ROCKET_RESEARCH_LAYOUT` 包裹。关闭开关即可回退经典布局；新增 `notes/`、`documents/` 是普通 Workspace 文件，回退后仍可由文件系统访问，不存在专有数据锁定。

### Open risks and follow-ups

- Windows 桌面端拖拽、文件选择、会话聚焦和重启恢复仍需人工验收；
- 远程客户端无法直接把本机路径交给远端 Server，跨设备上传不属于 P1-4；
- Agent 文件上下文与 Agent 写入冲突策略已由 P1-7 完成；
- PDF/HTML/DOCX/XLSX 导入已可用，内容预览由 P1-5 完成。

## 15. P1-5 架构简报

### Context and constraints

P1-5 在既有 Workspace 文件和研究 Tab 合约上补齐只读阅读闭环。HTML、DOCX、XLSX 和 PDF 不可编辑；PDF 不做 OCR；预览错误必须局部化，且不能清除 Tab 或已保存的阅读位置。Renderer 不接收绝对路径，也不直接解析 Office 压缩包。

### Repo shape

- `ResearchDocumentViewer.tsx`：中栏统一阅读器，负责加载、错误恢复、PDF 分页缩放、疑似扫描件提示和阅读位置采集；
- `research-document-preview.ts`：PDF 状态归一化与 HTML 安全文档构造的纯函数；
- `workspace-research-files.ts`：真实路径校验、格式/大小限制、PDF/HTML 读取和 Office 转换；
- protocol、RPC handler、Electron channel map：提供单一的 `readWorkspacePreview` 判别联合 DTO。

### Backend module contracts

`readWorkspacePreview(workspaceId, relativePath)` 只接受当前 Workspace 下 `notes/` 或 `documents/` 的相对路径。服务在解析真实路径后仅允许 PDF、HTML、DOCX、XLSX：PDF 返回 `Uint8Array`，HTML 返回 UTF-8 文本，Office 使用 MarkItDown 在服务端转为 Markdown。源文件上限为 100 MB，HTML 和转换结果的文本上限为 10 MB；转换失败使用独立错误码，不降级为任意文件读取。

### Request context and middleware policy

RPC 同时校验连接上下文 Workspace 和显式 `workspaceId`。候选路径、父目录和最终文件均做真实路径包含性检查，阻止目录穿越和符号链接逃逸。HTML 进入无脚本 iframe，并注入禁止网络、表单、插件、子框架和基础 URL 的 CSP。

### Frontend boundaries

Tab 继续只保存 Workspace 相对路径和元数据。阅读器按判别 DTO 选择视图：PDF 使用 pdf.js 单页渲染并保存页码、缩放、滚动位置；HTML 使用沙箱 `srcDoc`；Word/Excel 呈现语义化 Markdown，只读且允许宽表横向滚动。扫描 PDF 仅通过抽样文字层提示“可能无可检索文字”，不触发 OCR。

### Testing strategy

服务测试覆盖 HTML/PDF 负载、Office 服务端转换、格式拒绝和路径越界；纯函数测试覆盖 PDF 页码/缩放归一化及 HTML CSP 注入；协议清单防止遗漏传输映射。质量门禁包括 Electron 类型检查、定向 lint、Renderer 生产构建，以及代表性 PDF 的渲染检查。

### Rollout and rollback plan

阅读器随三栏布局继续受 `VITE_ROCKET_RESEARCH_LAYOUT` 控制。关闭开关可回退经典布局；预览不改写源文件，也不产生专有持久数据。新增阅读状态字段已属于既有可选 `ReadingState`，旧快照无需迁移。

### Open risks and follow-ups

- Office 预览追求可读和可检索的语义结构，不保证与原应用逐像素一致；复杂公式、嵌入对象和宏可能无法转换；
- PDF 二进制仍受单次 100 MB 限制，超大文档的分块/流式加载留待后续；
- Workspace 切换、应用重启、缩放和滚动恢复已有自动化覆盖，仍需补充本轮可见窗口人工回归；
- P1-6 建立索引时应复用服务端转换边界，但不得把预览负载当作唯一索引存储。

## 16. P1-6 / P1-7 架构简报

### Context and constraints

全文索引是可删除、可重建的 Workspace 派生数据，不得成为源文件的事实来源。Agent 上下文只传递路径、类型、时间、大小和 SHA-256 版本；正文必须按需读取。Markdown 可版本化写入，PDF、HTML、Word、Excel 在 P1 保持只读。

### Repo shape

- `packages/server-core/src/services/workspace-research-index.ts`：索引扫描、增量刷新、检索和重建。
- `packages/server-core/src/services/workspace-research-files.ts`：受控路径、正文提取和上下文元数据。
- `packages/shared/src/agent/core/pre-tool-use.ts`：Claude 与 Pi 共用的写入版本守卫。
- Renderer 的研究文件、Markdown 编辑器和聊天输入分别负责搜索、冲突可见性和上下文交互。

### Backend module contracts

索引缓存固定为 `.rocket/cache/research-index-v1.json`，通过大小和修改时间增量刷新，单文件失败局部化。搜索结果只返回定位和摘要。`WorkspaceAgentContextRef` 不含正文；服务端发送前重新解析真实路径并校验版本，拒绝跨 Workspace、重复或过期引用。

### Request context and middleware policy

活动研究 Tab 自动附加到当前会话，移除仅作用于该会话和 Tab。未保存 Markdown 必须选择保存并发送、使用已保存版本或取消。服务端提示 Agent 用 `Read` 按需读取；共用 PreToolUse 管线阻止 Bash 绕过、只读格式写入和版本过期写入，现有权限模式继续叠加生效。

### Frontend boundaries

笔记与资料页面共用 Workspace 全文搜索，但结果保持 area 标识并复用研究 Tab 打开流程。编辑器状态是瞬态控制面，不进入 Workspace 持久化快照。Agent 成功写入时，干净编辑器重载最新版本；存在用户缓冲区时保留内容并显示冲突。

### Testing strategy

服务测试覆盖索引相关性、增量刷新、删除、缓存重建、上下文无正文和版本元数据。共用工具守卫测试覆盖只读写入、Bash 绕过和过期/缺失文件。IPC 清单、Server/Electron/Shared 类型检查与 Renderer 构建作为合并门槛。

### Rollout and rollback plan

三栏布局继续沿用现有特性开关。回滚 P1-6 可删除缓存并隐藏搜索入口，不影响源文件；回滚 P1-7 可停止附加上下文，服务端在无上下文时保持原 Agent 行为。索引 schema 升级通过版本文件名并行演进。

### Open risks and follow-ups

- 大型 Workspace 的首轮 Office/PDF 转换性能和真实 Agent 写入后的端到端冲突体验继续作为发布前人工回归项目。

## 17. P1-8 架构简报

### Context and constraints

P1-8 把公司和行业定义为 Workspace 内带标签属性的真实研究文件夹，不接入行情看板、涨跌幅、估值或任何模拟市场数据。行情数据可以作为普通研究文件保存在目录中。用户与 Agent 都能增改标签；移除必须经过显式确认且默认保留文件。研究详情继续复用既有 Workspace Tab 合约，并以稳定资源 ID 去重和恢复。

### Repo shape

- `packages/server-core/src/services/workspace-research-scope.ts`：标签规范化、目录创建与列举、版本校验、原子持久化与引用清理。
- `packages/server-core/src/services/stock-search.ts`：证券搜索 provider、第三方响应校验与统一建议 DTO。
- `packages/server-core/src/handlers/rpc/research-scope.ts`：Workspace 身份校验和最小 CRUD RPC。
- `packages/session-tools-core/src/handlers/manage-research-scope.ts`：Agent 侧统一研究范围工具及参数约束。
- `apps/electron/src/renderer/components/app-shell/ResearchScopeWorkspace.tsx`：列表、编辑、删除确认、详情和概览。
- shared protocol、Electron channel map 与会话回调注册表只承担跨进程类型和传输映射。

### Backend module contracts

研究属性侧车固定为 Workspace 内可审阅的 `research/scope.json`，schema 版本为 3；每个条目保存稳定 `folderPath`，真实文件位于兼容存储根路径 `documents/自选股/` 或 `documents/行业板块/`。v1 标签数据会无损迁移并补建目录，v2 带内部后缀的叶子目录会原位改名。文件内容的 SHA-256 作为乐观并发 revision，不另存隐藏数据库。新公司原子创建条目并初始化五个默认子目录；行业只创建根目录。删除公司时同步移除行业中的关联 ID，但保留研究文件夹。

### Request context and middleware policy

RPC 同时校验连接上下文和显式 `workspaceId`，再由 Workspace store 解析根目录。服务拒绝目录穿越、符号链接、非普通文件/目录、超限或损坏 JSON，并在 revision 过期时返回冲突而不是覆盖。证券建议由服务端 provider 查询并把外部响应校验、收敛为名称/代码/市场三字段。Agent 仅通过会话级 `manage_research_scope` 回调访问当前 Workspace；remove 必须提供 `confirm: true`，变更后向 Renderer 广播 revision 事件。

### Frontend boundaries

列表和详情只消费协议 DTO，不直接读写 Workspace 文件。新增公司使用带防抖、加载、空结果与错误状态的证券搜索建议框；用户必须选择建议项，代码和市场不可手填。公司与行业列表是单例研究 Tab；公司与行业详情分别使用 `research:company:<id>` 和 `research:industry:<id>` 稳定资源 ID。详情页把标签属性压缩在头部，剩余空间交给按当前目录展示的文件浏览器；目录行、返回键和面包屑均可键盘操作，可新建当前目录下的文件夹或 Markdown 文件，导入与拖入目标也始终是当前目录，并复用现有 Workspace 资源上下文打开可支持格式。概览只汇总真实条目数量，不生成行情卡片。

### Testing strategy

服务测试覆盖空 Workspace、v1/v2→v3 迁移、无后缀目录命名、默认目录、目录列举、当前目录创建、任意格式导入、证券响应校验、原子增改、乐观并发、损坏源文件保护、删除和跨实体引用清理；Agent 工具测试覆盖读取、增改和删除确认；协议注册、Electron IPC 清单、Claude/Pi 工具一致性、类型检查与 Renderer 构建已纳入 `validate:p1`。Windows 桌面端实际搜索、拖入、文件打开与重启恢复仍需补充可见窗口人工回归。

### Rollout and rollback plan

界面继续受 `VITE_ROCKET_RESEARCH_LAYOUT` 控制，但默认启用三栏布局；构建时设置为 `0`、`false` 或 `classic` 可回到经典布局。回滚界面不会删除 `research/scope.json` 或 `documents/` 下的研究文件夹；schema v3 保留既有字段，重新启用时仍可加载。若回滚服务版本，需保留 v3 读取兼容层或先执行显式降级迁移，不能直接用只识别旧 schema 的服务读取。

### Open risks and follow-ups

- 当前只支持单机乐观并发，不提供多设备合并或协同编辑；
- 证券搜索当前依赖服务端外部建议 provider；无网络或 provider 异常时禁止手填代码/市场，需重试，后续应接入可配置的证券主数据源与缓存；
- 大规模公司/行业列表的虚拟滚动与批量操作不在 P1-8 范围；
- Workspace 切换、应用重启、详情 Tab 恢复、Agent 变更刷新和删除确认已有自动化覆盖，仍需补充本轮可见窗口人工回归。

## 18. P1-9 收尾说明

P1-9 补齐了研究工作台的局部加载、空状态、错误提示与重试行为；研究布局增加顶层错误边界，文件、检索、阅读器和研究范围页面的失败不会清除未保存编辑或 Workspace Tab 状态。研究 Tab 采用语义化 tab/tabpanel 合约，支持方向键、Home/End、Delete/Backspace 与可见焦点。

根脚本新增 `validate:p1`，按类型检查、lint、i18n、全量测试和 Electron 生产构建的顺序执行。三栏布局改为默认启用，并通过纯函数回归测试锁定 `0`、`false`、`classic` 三种经典布局回退值。最终自动化证据、非阻断警告和待补人工项目统一记录在 [`p1-acceptance-report.md`](p1-acceptance-report.md)。
