# Windows 内部交付

本文档记录未来需要把 Rocket 分发给内部用户时的独立验收范围。它不属于 P0。

内部交付至少需要单独验证：

1. Windows x64 安装包可以生成。
2. 安装包摘要与实际文件一致。
3. 应用可以安装、首次启动和卸载。
4. 安装过程不修改用户 PATH。
5. 卸载不会删除用户的 `~/.rocket/` 工作区。

相关仓库命令目前包括：

```powershell
bun run build --platform=win32 --arch=x64 --skip-install
bun run release:check:internal
```

只有在确实需要分发时才执行这些步骤。签名、在线更新、公开域名和外部分发应继续作为独立发布工程处理。
