# P0 非发布基线

Rocket P0 的目标是建立一个可继续开发的内部源码基线，不承担安装或发布职责。

## 范围

P0 只需要证明：

1. 开发环境具备 Git、Bun 和代码编辑器，可以安装依赖并运行项目。
2. 仓库已从 Craft Agents OSS fork，产品包名和主要运行时标识迁移为 Rocket。
3. 桌面应用显示 Rocket 名称、图标和深蓝主题，不再暴露旧产品品牌。
4. 主进程、预加载、渲染器和资源可以构建，Windows 桌面窗口可以从源码启动。

## 不在 P0 范围内

- Electron 安装包与卸载流程
- GitHub Actions 安装包构建
- 代码签名与 SmartScreen 信誉
- 公网下载地址、对象存储和在线更新
- 面向内部或外部用户的分发验收

相关能力可以保留在仓库中，但不能作为 P0 完成条件。需要分发时，使用
[Windows 内部交付](windows-internal-delivery.md) 单独验收。

## 源码门禁

```powershell
bun run validate:p0
```

该命令依次执行：

- 全 workspace TypeScript 检查
- 隔离 `ROCKET_CONFIG_DIR` 的全量 Bun 测试
- ESLint
- i18n key 一致性与排序检查
- Electron 主进程、预加载、渲染器和资源构建

最后还应在 Windows 上执行一次：

```powershell
bun run electron:start
```

人工确认窗口出现、应用名和图标为 Rocket，并且默认经典界面可以创建 Agent 会话。

## P1 原型边界

三栏研究工作台仍处于 P1 原型阶段，P0 默认不启用。开发预览时可设置：

```powershell
$env:VITE_ROCKET_RESEARCH_LAYOUT = '1'
bun run electron:start
```

在右侧 Agent、真实导航数据和中间文件视图完成前，不得把该原型设为默认界面。
