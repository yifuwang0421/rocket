# P0 发布签收清单

本文档只定义 P0 发布契约与签收证据。P0 不在此阶段新增产品大功能。

## 完成定义

只有以下条件全部满足，才可将 P0 标记为已签收：

1. `bun run release:check:candidate` 全部通过。
2. Windows 安装器和解包后的 `Rocket.exe` 均具有有效 Authenticode 签名。
   两者须由同一证书签名，且 `app-update.yml` 的 `publisherName` 必须匹配签名证书主体，确保自动更新不会跳过发布者验证。
3. `bun run release:check` 全部通过，发布凭据仅由 CI Secret 提供。
4. 版本化产物、`electron/latest/`、`latest.yml` 和两个安装脚本已上传并经远端长度与 SHA-256 元数据校验。
5. `agents.rocket.app` 解析到公网发布端点，HTTPS 证书有效。
6. `bun run release:check:online` 全部通过，远端版本、SHA-512、文件大小和安装脚本与已签名候选物一致。
7. 在未安装 Rocket 的干净 Windows 用户环境中，通过公开安装脚本完成安装、首次启动、版本确认、更新检查与卸载。
8. 桌面安装脚本不创建名为 `rocket` 的桌面启动别名，也不修改用户 PATH；`rocket` 名称保留给正式终端客户端。

## 代码侧发布入口

候选物检查：

```powershell
bun run release:check:candidate
```

只预览上传对象，不访问对象存储：

```powershell
bun run release:upload:dry-run
```

本地发布前检查：

```powershell
bun run release:check
```

公开端点检查：

```powershell
bun run release:check:online
```

CI 发布入口是 GitHub Actions 的 `Release Windows` 手动工作流。输入版本必须与 `apps/electron/package.json` 完全一致；工作流会依次构建、签名、执行发布前检查、上传并重试公开端点检查。

## 外部发布配置

GitHub Actions Secrets：

- `WINDOWS_CSC_LINK`
- `WINDOWS_CSC_KEY_PASSWORD`
- `S3_VERSIONS_BUCKET_ENDPOINT`
- `S3_VERSIONS_BUCKET_ACCESS_KEY_ID`
- `S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY`

GitHub Actions Variables（可选，有默认值）：

- `S3_VERSIONS_BUCKET_NAME`，默认 `versions`
- `S3_VERSIONS_BUCKET_REGION`，默认 `auto`

域名与存储须共同提供以下 HTTPS 路径：

- `/electron/latest/latest.yml`
- `/electron/latest/Rocket-x64.exe`
- `/electron/latest/Rocket-x64.exe.blockmap`
- `/install-app.ps1`
- `/install-app.sh`

## 干净 Windows 在线验收

在新的普通用户 PowerShell 会话中执行：

```powershell
irm https://agents.rocket.app/install-app.ps1 | iex
```

验收记录至少应包含：

- 安装脚本退出码和安装器下载来源；
- 安装后的 Rocket 版本；
- 安装器及已安装 `Rocket.exe` 的 Authenticode 状态；
- 首次启动成功且配置目录为 `.rocket`；
- 更新检查请求命中 `https://agents.rocket.app/electron/latest`；
- 安装脚本退出后不残留临时安装目录，也不修改用户 PATH；
- 卸载完成，且未误删用户工作区。

## 当前签收边界

代码侧候选物、上传实现、发布前门禁和在线校验逻辑已经具备。没有有效签名证书、对象存储凭据、公网域名/HTTPS 端点以及可投递的 Rocket GitHub 仓库时，只能证明“候选物可发布”，不能证明“P0 已公开发布并签收”。

### 2026-07-28 仓库内验收快照

- `bun run release:check:candidate`：15/15 通过。
- Windows 候选物：`apps/electron/release/Rocket-x64.exe`，251,457,444 字节，
  SHA-256 `94DC4603A08314BDF58FBAC9A32B67CCE4454F53E4D22C77E8656AFEA8FE027F`。
- 发布脚本专项测试：30/30 通过；PowerShell 安装脚本语法检查通过；
  `bun run typecheck:release` 通过；`git diff --check` 无空白错误。
- `bun run release:check`：15/20 通过。未通过项仅为安装器签名、应用签名、
  两者签名者一致性、自动更新发布者身份和 S3 发布配置。
- `bun run release:check:online`：15/20 通过。未通过项仅为上述四项签名/发布者身份检查，
  以及 `agents.rocket.app` 尚未解析到真实公网地址。

因此，仓库内 P0 修复与候选物质量门禁已经完成；P0 最终签收仍须由发布负责人补齐外部配置，
运行 `Release Windows` 工作流，并在干净 Windows 环境完成安装、启动、更新和卸载验收。
