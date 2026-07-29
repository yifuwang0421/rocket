import { resolve } from 'node:path'
import {
  buildElectronApp,
  buildMcpServers,
  buildWhatsAppWorker,
  cleanBuildArtifacts,
  copyInterceptor,
  copyInterceptorBundle,
  copyPiAgentServer,
  copyRipgrep,
  copySDK,
  copySessionServer,
  createManifest,
  downloadBun,
  downloadUv,
  installDependencies,
  loadEnvFile,
  uploadToS3,
  verifyMcpServersExist,
  verifySDKCopy,
  type Arch,
  type BuildConfig,
  type Platform,
} from './build/common'
import { packageDarwin } from './build/darwin'
import { packageLinux } from './build/linux'
import { packageWindows } from './build/win32'

function readFlag(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function resolvePlatform(): Platform {
  const requested = readFlag('platform') ?? process.platform
  if (requested === 'darwin' || requested === 'win32' || requested === 'linux') {
    return requested
  }
  throw new Error(`Unsupported build platform: ${requested}`)
}

function resolveArch(): Arch {
  const requested = readFlag('arch') ?? process.arch
  if (requested === 'x64' || requested === 'arm64') {
    return requested
  }
  throw new Error(`Unsupported build architecture: ${requested}`)
}

const rootDir = resolve(import.meta.dir, '..')
const config: BuildConfig = {
  platform: resolvePlatform(),
  arch: resolveArch(),
  upload: hasFlag('upload'),
  uploadLatest: hasFlag('latest'),
  uploadScript: hasFlag('script'),
  rootDir,
  electronDir: resolve(rootDir, 'apps/electron'),
}

console.log(`Building Rocket for ${config.platform}-${config.arch}`)

await loadEnvFile(config)
cleanBuildArtifacts(config)
if (hasFlag('skip-install')) {
  console.log('Skipping dependency installation; using the existing node_modules tree')
} else {
  await installDependencies(config)
}
await downloadBun(config)
await downloadUv(config)

buildMcpServers(config)
buildWhatsAppWorker(config)
copySDK(config)
verifySDKCopy(config)
copyRipgrep(config)
copyInterceptor(config)
copySessionServer(config)
copyPiAgentServer(config)
verifyMcpServersExist(config)

await buildElectronApp(config)
copyInterceptorBundle(config)

const artifactPath = config.platform === 'win32'
  ? await packageWindows(config)
  : config.platform === 'darwin'
    ? await packageDarwin(config)
    : await packageLinux(config)

if (config.upload) {
  await createManifest(config)
  await uploadToS3(config)
}

console.log(`Rocket artifact ready: ${artifactPath}`)
