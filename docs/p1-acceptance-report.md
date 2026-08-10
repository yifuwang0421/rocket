# Rocket P1 验收报告

> 日期：2026-08-09  
> 结论：P1-0 至 P1-9 实现完成，自动化验收通过；Windows 可见窗口人工回归待补

## 验收范围

- Workspace 级三栏布局、研究 Tab、顺序与阅读位置恢复；
- 左侧研究导航、独立管理页和右侧 Workspace 会话历史；
- 资料/笔记导入、Markdown 显式保存、版本冲突与 Agent 安全写入；
- HTML、Word、Excel、PDF 只读预览和可重建全文索引；
- 文件夹化的公司/行业研究范围、证券建议和目录操作；
- P1-9 的加载、空状态、错误恢复、键盘操作与经典布局回退。

## 自动化结果

最终执行 `bun run validate:p1`，退出码为 0：

| 门禁 | 结果 |
|---|---|
| 全 workspace TypeScript 类型检查 | 通过 |
| Electron、shared、ui lint | 通过；存在既有非阻断 React Hook warnings |
| i18n parity / sorted | 通过 |
| 全量测试 | 383 个标准测试文件、5 个隔离测试文件通过；1 个既有开发态条件性测试跳过 |
| Electron main / preload / renderer / resources / assets 生产构建 | 通过 |
| Git whitespace 检查 | 通过；仅有仓库既有 LF/CRLF 提示 |

定向回归同时覆盖默认布局解析、Tab 状态迁移与恢复、文档阅读状态、Workspace 文件与索引、研究范围目录、IPC/路由穷尽性、Agent 工具一致性、日志反馈环和 Windows `Path`/`PATH` 兼容。

## 默认布局与回退

- 未设置 `VITE_ROCKET_RESEARCH_LAYOUT` 时默认进入三栏研究界面；
- 设置为 `0`、`false` 或 `classic` 后重新构建，可回退经典布局；
- 回退只改变界面入口，不删除 Workspace 文件、`research/scope.json`、索引缓存或本地 Tab 状态；
- 回退开关至少保留一个发布周期。

## Windows 人工回归状态

本轮尝试从生产构建启动 Electron 时，受控沙箱无法写入 Rocket 的 Windows 用户目录；切换到桌面控制通道并按规范重置重试后，窗口枚举仍返回 `EnumWindows failed: 0x80070003`。因此未能在本轮完成可见窗口的点击、Workspace 切换和重启恢复人工回归。

发布前仍需在普通 Windows 桌面会话执行：

1. 默认启动确认三栏布局、左侧导航、中栏 Tab 和右侧 Agent 同时可见；
2. 打开多个研究 Tab，调整顺序和 PDF 页码/滚动位置，切换 Workspace 后返回验证恢复；
3. 重启 Rocket，验证活动 Tab、顺序、阅读位置和会话历史恢复；
4. 验证 Markdown 未保存保护、保存后 Agent 读取、版本冲突与错误重试；
5. 以 `VITE_ROCKET_RESEARCH_LAYOUT=0` 重新构建并确认经典布局回退。

在以上人工项目完成前，不把本报告表述为 Windows 桌面发布验收完成。
