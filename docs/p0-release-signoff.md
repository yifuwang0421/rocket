# P0 内部交付签收清单

本文档定义 Rocket P0 的内部交付契约与签收证据。P0 的交付对象仅为内部团队，
不在此阶段新增产品大功能，也不要求公开发行。

## 范围冻结

P0 必须证明：

1. Rocket 品牌、配置目录、包名、CLI 和文档契约一致。
2. 主进程、预加载、渲染器和随包资源能够构建。
3. 测试、类型检查、Lint、i18n 和文档工具门禁通过。
4. 能生成 Windows x64 安装包及配套校验文件。
5. 内部用户能完成安装、首次启动、版本确认和卸载。
6. 安装与卸载不修改用户 PATH，不误删用户的 `.rocket` 工作区。

以下事项不属于 P0 阻塞项：

- 公网域名或公开下载地址；
- S3/R2 对象存储；
- 公开安装脚本；
- 在线自动更新；
- 面向外部用户的 Authenticode 信任与 SmartScreen 信誉。

代码签名和公开发布能力可以保留或继续完善，但在需要外部分发前再单独签收。

## 完成定义

只有以下条件全部满足，才可将内部 P0 标记为已签收：

1. `bun run validate:ci` 全部通过。
2. `bun run release:check:internal` 全部通过。
3. Windows 内部候选物至少包含：
   - `Rocket-x64.exe`
   - `Rocket-x64.exe.blockmap`
   - `latest.yml`
   - `SHA256SUMS.txt`（CI 内部交付物）
4. SHA-256 记录与实际安装包一致。
5. 在内部 Windows 用户环境完成安装、首次启动、版本确认和卸载。
6. 安装过程不创建名为 `rocket` 的桌面启动别名，也不修改用户 PATH；
   `rocket` 名称保留给正式终端客户端。
7. 卸载后应用安装目录已移除，用户 `.rocket` 工作区仍保留。

内部未签名安装包可能触发 Windows“未知发布者”提示。这是当前内部交付模式下的已知限制，
不能将该候选物转发给外部用户或宣称为公开发行版本。

## 构建与校验

本地生成 Windows x64 候选物：

```powershell
bun run build --platform=win32 --arch=x64 --skip-install
bun run release:check:internal
```

计算 SHA-256：

```powershell
Get-FileHash apps/electron/release/Rocket-x64.exe -Algorithm SHA256
```

CI 入口是 GitHub Actions 的 `Build Windows Internal` 手动工作流。
输入版本必须与 `apps/electron/package.json` 完全一致。工作流会：

1. 安装锁定依赖；
2. 执行 P0 质量门禁；
3. 构建 Windows x64 安装包；
4. 执行内部候选物检查；
5. 生成 `SHA256SUMS.txt`；
6. 上传名为 `Rocket-Windows-Internal-<version>` 的私有 Actions Artifact。

该工作流不需要签名证书、对象存储凭据或公网域名。

## 内部 Windows 验收

从 GitHub Actions 下载 `Rocket-Windows-Internal-<version>`，解压后先校验：

```powershell
$expected = (Get-Content .\SHA256SUMS.txt).Split(' ')[0].Trim()
$actual = (Get-FileHash .\Rocket-x64.exe -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) {
    throw "Rocket-x64.exe SHA-256 mismatch"
}
```

随后完成并记录：

1. 运行 `Rocket-x64.exe` 并完成当前用户安装。
2. 从开始菜单或桌面快捷方式启动 Rocket。
3. 确认应用名称、图标和版本正确。
4. 确认首次启动成功，用户配置和工作区写入 `~/.rocket/`。
5. 确认用户 PATH 未增加 Rocket 桌面安装目录。
6. 从 Windows“已安装的应用”卸载 Rocket。
7. 确认 `%LOCALAPPDATA%\Programs\Rocket` 已移除。
8. 确认 `~/.rocket/` 未被误删。

如内部环境需要静默安装，可使用 NSIS 的 `/S` 参数；首次人工验收仍应至少执行一次可见安装，
确认安装界面、应用名和快捷方式均符合预期。

## 公开发行后续项

以下能力保留在代码中，但降级为 P1 或首次外部分发前的发布工程工作：

- 安装器和 `Rocket.exe` 使用同一可信证书签名；
- 自动更新 `publisherName` 与证书主体匹配；
- S3/R2 上传和远端摘要验证；
- 稳定 HTTPS 下载域名；
- `release:check:online` 全部通过；
- 干净外部 Windows 环境通过公开安装脚本安装和更新。

公开发行必须重新启用上述门禁，不能直接复用未签名的内部候选物。

## 2026-07-29 仓库内证据

- 发布脚本专项测试：30/30 通过。
- PowerShell 安装脚本语法检查和 `bun run typecheck:release` 通过。
- 完整仓库质量门禁中的 TypeScript 检查和 Bun 测试已经通过；Windows 高负载下偶发的
  transfer TTL 测试已修复并连续通过 5 次。
- 本地候选物目录已在重新构建前清理，旧安装包及其摘要不再作为当前签收证据。
- 新的 GitHub Actions 内部构建、SHA-256 以及安装和卸载结果是本次 P0 最终签收依据。
