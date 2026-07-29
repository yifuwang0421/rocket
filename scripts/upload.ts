import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

type UploadItem = {
  sourcePath: string
  key: string
  cacheControl: string
  contentType: string
}

type UploadOptions = {
  electron: boolean
  latest: boolean
  script: boolean
  dryRun: boolean
}

const ROOT_DIR = join(import.meta.dir, '..')
const ELECTRON_DIR = join(ROOT_DIR, 'apps', 'electron')

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function parseOptions(): UploadOptions {
  return {
    electron: hasFlag('electron'),
    latest: hasFlag('latest'),
    script: hasFlag('script'),
    dryRun: hasFlag('dry-run'),
  }
}

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith('.yml') || fileName.endsWith('.yaml')) return 'application/yaml'
  if (fileName.endsWith('.json')) return 'application/json'
  if (fileName.endsWith('.sh')) return 'text/x-shellscript; charset=utf-8'
  if (fileName.endsWith('.ps1')) return 'text/plain; charset=utf-8'
  if (fileName.endsWith('.zip')) return 'application/zip'
  if (fileName.endsWith('.dmg')) return 'application/x-apple-diskimage'
  if (fileName.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'
  return 'application/octet-stream'
}

function isReleaseFile(fileName: string): boolean {
  if (fileName.includes('__uninstaller')) return false
  return (
    /^latest(?:-mac|-linux)?\.yml$/.test(fileName)
    || /\.(?:exe|dmg|zip|AppImage|blockmap|zsync)$/.test(fileName)
  )
}

function manifestLast(a: string, b: string): number {
  const aManifest = a.endsWith('.yml')
  const bManifest = b.endsWith('.yml')
  if (aManifest !== bManifest) return aManifest ? 1 : -1
  return a.localeCompare(b)
}

function readVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(join(ELECTRON_DIR, 'package.json'), 'utf8'),
  ) as { version?: string }
  if (!packageJson.version) throw new Error('Electron package version is missing')
  return packageJson.version
}

export function buildUploadPlan(
  options: UploadOptions,
  rootDir = ROOT_DIR,
): UploadItem[] {
  if (!options.electron && !options.script) {
    throw new Error('Select at least one upload target: --electron and/or --script')
  }

  const electronDir = join(rootDir, 'apps', 'electron')
  const releaseDir = join(electronDir, 'release')
  const version = JSON.parse(
    readFileSync(join(electronDir, 'package.json'), 'utf8'),
  ).version as string
  const plan: UploadItem[] = []

  if (options.electron) {
    if (!existsSync(releaseDir)) {
      throw new Error(`Release directory not found: ${releaseDir}`)
    }

    const releaseFiles = readdirSync(releaseDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && isReleaseFile(entry.name))
      .map((entry) => entry.name)
      .sort(manifestLast)

    if (releaseFiles.length === 0) {
      throw new Error(`No Electron release artifacts found in ${releaseDir}`)
    }

    for (const fileName of releaseFiles) {
      const sourcePath = join(releaseDir, fileName)
      plan.push({
        sourcePath,
        key: `electron/${version}/${fileName}`,
        cacheControl: 'public, max-age=31536000, immutable',
        contentType: contentTypeFor(fileName),
      })
    }

    if (options.latest) {
      for (const fileName of releaseFiles) {
        const sourcePath = join(releaseDir, fileName)
        plan.push({
          sourcePath,
          key: `electron/latest/${fileName}`,
          // Latest artifacts reuse stable filenames. Caching a previous binary
          // after publishing a new manifest would produce a checksum mismatch.
          cacheControl: 'no-cache, no-store, must-revalidate',
          contentType: contentTypeFor(fileName),
        })
      }
    }

    const manifestPath = join(rootDir, '.build', 'upload', 'manifest.json')
    if (existsSync(manifestPath)) {
      plan.push({
        sourcePath: manifestPath,
        key: `electron/${version}/manifest.json`,
        cacheControl: 'public, max-age=31536000, immutable',
        contentType: contentTypeFor(manifestPath),
      })
      if (options.latest) {
        plan.push({
          sourcePath: manifestPath,
          key: 'electron/manifest.json',
          cacheControl: 'no-cache, no-store, must-revalidate',
          contentType: contentTypeFor(manifestPath),
        })
      }
    }
  }

  if (options.script) {
    for (const fileName of ['install-app.sh', 'install-app.ps1']) {
      const sourcePath = join(rootDir, 'scripts', fileName)
      if (!existsSync(sourcePath)) {
        throw new Error(`Install script not found: ${sourcePath}`)
      }
      plan.push({
        sourcePath,
        key: fileName,
        cacheControl: 'no-cache, no-store, must-revalidate',
        contentType: contentTypeFor(fileName),
      })
    }
  }

  // `latest.yml` is the public release pointer consumed by both electron-updater
  // and the install scripts. Publish it only after every binary and script it
  // can reference is already available.
  return plan.sort((a, b) => {
    const aLatestManifest = a.key === 'electron/latest/latest.yml'
    const bLatestManifest = b.key === 'electron/latest/latest.yml'
    if (aLatestManifest === bLatestManifest) return 0
    return aLatestManifest ? 1 : -1
  })
}

function createClient(): { client: S3Client; bucket: string } {
  const endpoint = process.env.S3_VERSIONS_BUCKET_ENDPOINT
  const accessKeyId = process.env.S3_VERSIONS_BUCKET_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY
  const bucket = process.env.S3_VERSIONS_BUCKET_NAME || 'versions'

  const missing = [
    ['S3_VERSIONS_BUCKET_ENDPOINT', endpoint],
    ['S3_VERSIONS_BUCKET_ACCESS_KEY_ID', accessKeyId],
    ['S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY', secretAccessKey],
  ].filter(([, value]) => !value).map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`Missing S3 configuration: ${missing.join(', ')}`)
  }

  const endpointUrl = new URL(endpoint!)
  if (endpointUrl.protocol !== 'https:' && endpointUrl.hostname !== 'localhost') {
    throw new Error('S3_VERSIONS_BUCKET_ENDPOINT must use HTTPS')
  }

  return {
    bucket,
    client: new S3Client({
      endpoint: endpointUrl.toString(),
      region: process.env.S3_VERSIONS_BUCKET_REGION || 'auto',
      forcePathStyle: true,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    }),
  }
}

async function uploadItem(client: S3Client, bucket: string, item: UploadItem): Promise<void> {
  const body = readFileSync(item.sourcePath)
  const sha256 = createHash('sha256').update(body).digest('hex')

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: item.key,
    Body: body,
    CacheControl: item.cacheControl,
    ContentType: item.contentType,
    Metadata: { sha256 },
  }))

  const remote = await client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: item.key,
  }))
  if (remote.ContentLength !== body.byteLength) {
    throw new Error(
      `Upload verification failed for ${item.key}: expected ${body.byteLength} bytes, got ${remote.ContentLength}`,
    )
  }
  if (remote.Metadata?.sha256 !== sha256) {
    throw new Error(
      `Upload verification failed for ${item.key}: SHA-256 metadata does not match`,
    )
  }
}

async function main(): Promise<void> {
  const options = parseOptions()
  const plan = buildUploadPlan(options)
  const version = readVersion()

  console.log(`Rocket release upload plan: ${plan.length} object(s), version ${version}`)
  for (const item of plan) {
    console.log(
      `${options.dryRun ? 'DRY-RUN' : 'PLAN'} ${item.key} `
      + `(${statSync(item.sourcePath).size} bytes, ${basename(item.sourcePath)})`,
    )
  }

  if (options.dryRun) return

  const preflight = Bun.spawnSync(
    ['bun', 'run', 'scripts/release-check.ts', '--stage=publish'],
    {
      cwd: ROOT_DIR,
      stdout: 'inherit',
      stderr: 'inherit',
    },
  )
  if (preflight.exitCode !== 0) {
    throw new Error('Release preflight failed; refusing to upload')
  }

  const { client, bucket } = createClient()
  for (const item of plan) {
    console.log(`UPLOAD ${item.key}`)
    await uploadItem(client, bucket, item)
  }
  console.log(`Uploaded and verified ${plan.length} object(s) in bucket ${bucket}`)
}

if (import.meta.main) {
  await main()
}
