import { createHash } from 'node:crypto'
import { promises as dns } from 'node:dns'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

type Stage = 'candidate' | 'publish' | 'online'
type Check = { name: string; ok: boolean; detail: string }
type WindowsSignature = {
  status: string
  subject: string
  commonName: string
  thumbprint: string
}

const ROOT_DIR = join(import.meta.dir, '..')
const RELEASE_DIR = join(ROOT_DIR, 'apps', 'electron', 'release')
const PACKAGE_JSON = join(ROOT_DIR, 'apps', 'electron', 'package.json')
const BASE_URL = process.env.ROCKET_RELEASE_BASE_URL || 'https://agents.rocket.app/electron'

function stage(): Stage {
  const raw = process.argv.find((arg) => arg.startsWith('--stage='))?.slice(8) || 'candidate'
  if (raw === 'candidate' || raw === 'publish' || raw === 'online') return raw
  throw new Error(`Unknown release-check stage: ${raw}`)
}

function yamlValue(yaml: string, key: string): string | undefined {
  return yaml.match(new RegExp(`^\\s*${key}:\\s*'?([^'\\r\\n]+)`, 'm'))?.[1]?.trim()
}

export function yamlStringList(yaml: string, key: string): string[] {
  const line = yaml.match(new RegExp(`^${key}:[ \\t]*([^\\r\\n]*)`, 'm'))
  if (!line) return []
  const inline = line[1]?.trim()
  if (inline) {
    if (inline.startsWith('[') && inline.endsWith(']')) {
      return inline.slice(1, -1)
        .split(',')
        .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    }
    return [inline.replace(/^['"]|['"]$/g, '')]
  }

  const rest = yaml.slice((line.index || 0) + line[0].length)
  const values: string[] = []
  for (const valueLine of rest.split(/\r?\n/).slice(1)) {
    const item = valueLine.match(/^\s+-\s*(.+?)\s*$/)?.[1]
    if (!item) break
    values.push(item.replace(/^['"]|['"]$/g, ''))
  }
  return values
}

export function signatureSubjectMatchesPublisher(
  subject: string,
  publisher: string,
  commonName = '',
): boolean {
  const normalizedPublisher = publisher.trim().toLowerCase()
  if (!normalizedPublisher) return false
  const normalizedSubject = subject.trim().toLowerCase()
  if (normalizedSubject === normalizedPublisher) return true
  if (commonName.trim().toLowerCase() === normalizedPublisher) return true
  const parsedCommonName = subject.match(/(?:^|,\s*)CN=([^,]+)/i)?.[1]?.trim().toLowerCase()
  return parsedCommonName === normalizedPublisher
}

function sha512Base64(path: string): string {
  return createHash('sha512').update(readFileSync(path)).digest('base64')
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false
  }
  const [a, b, c] = octets
  if (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224
  ) {
    return false
  }
  return true
}

export function isPublicReleaseAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPublicIpv4(address)
  if (family !== 6) return false

  const normalized = address.toLowerCase()
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  if (mappedIpv4) return isPublicIpv4(mappedIpv4)
  return !(
    normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^f[ef][89ab]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:')
  )
}

export async function sha512ResponseBody(
  response: Response,
): Promise<{ sha512: string; size: number }> {
  if (!response.body) throw new Error('response body is missing')
  const hash = createHash('sha512')
  const reader = response.body.getReader()
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    hash.update(value)
    size += value.byteLength
  }
  return { sha512: hash.digest('base64'), size }
}

function windowsSignature(path: string): WindowsSignature {
  if (process.platform !== 'win32') {
    return {
      status: 'UnverifiedOnThisPlatform',
      subject: '',
      commonName: '',
      thumbprint: '',
    }
  }
  const escaped = path.replace(/'/g, "''")
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command',
      `$signature = Get-AuthenticodeSignature -LiteralPath '${escaped}'; `
      + `[pscustomobject]@{ Status = $signature.Status.ToString(); `
      + `Subject = $signature.SignerCertificate.Subject; `
      + `CommonName = if ($signature.SignerCertificate) { `
      + `$signature.SignerCertificate.GetNameInfo([System.Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false) `
      + `} else { $null }; `
      + `Thumbprint = $signature.SignerCertificate.Thumbprint } `
      + `| ConvertTo-Json -Compress`],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    return { status: 'CheckFailed', subject: '', commonName: '', thumbprint: '' }
  }
  try {
    const parsed = JSON.parse(result.stdout.trim()) as {
      Status?: string
      Subject?: string | null
      CommonName?: string | null
      Thumbprint?: string | null
    }
    return {
      status: parsed.Status || 'CheckFailed',
      subject: parsed.Subject || '',
      commonName: parsed.CommonName || '',
      thumbprint: parsed.Thumbprint || '',
    }
  } catch {
    return { status: 'CheckFailed', subject: '', commonName: '', thumbprint: '' }
  }
}

function localChecks(targetStage: Stage): Check[] {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: string }
  const installer = join(RELEASE_DIR, 'Rocket-x64.exe')
  const blockmap = `${installer}.blockmap`
  const latest = join(RELEASE_DIR, 'latest.yml')
  const appRoot = join(RELEASE_DIR, 'win-unpacked', 'resources', 'app')
  const appExecutable = join(RELEASE_DIR, 'win-unpacked', 'Rocket.exe')
  const appUpdateConfig = join(RELEASE_DIR, 'win-unpacked', 'resources', 'app-update.yml')
  const checks: Check[] = []

  const versionCheck = spawnSync(
    'bun',
    ['scripts/check-version.ts'],
    { cwd: ROOT_DIR, encoding: 'utf8' },
  )
  checks.push({
    name: 'workspace versions',
    ok: versionCheck.status === 0,
    detail: versionCheck.status === 0
      ? versionCheck.stdout.trim().split(/\r?\n/).at(-1) || 'consistent'
      : versionCheck.stderr.trim() || 'version check failed',
  })
  checks.push({
    name: 'version',
    ok: Boolean(pkg.version),
    detail: pkg.version || 'missing apps/electron package version',
  })
  checks.push({
    name: 'windows installer',
    ok: existsSync(installer),
    detail: existsSync(installer) ? `${statSync(installer).size} bytes` : installer,
  })
  checks.push({
    name: 'Windows blockmap',
    ok: existsSync(blockmap),
    detail: blockmap,
  })
  checks.push({
    name: 'latest.yml',
    ok: existsSync(latest),
    detail: latest,
  })
  checks.push({
    name: 'packaged application root',
    ok: existsSync(appRoot),
    detail: appRoot,
  })
  checks.push({
    name: 'packaged Rocket executable',
    ok: existsSync(appExecutable),
    detail: appExecutable,
  })
  checks.push({
    name: 'packaged auto-update configuration',
    ok: existsSync(appUpdateConfig),
    detail: appUpdateConfig,
  })

  if (existsSync(installer) && existsSync(latest)) {
    const yaml = readFileSync(latest, 'utf8')
    const expectedHash = yamlValue(yaml, 'sha512')
    const expectedSize = Number(yamlValue(yaml, 'size'))
    const actualSize = statSync(installer).size
    checks.push({
      name: 'manifest version',
      ok: yamlValue(yaml, 'version') === pkg.version,
      detail: `${yamlValue(yaml, 'version')} == ${pkg.version}`,
    })
    checks.push({
      name: 'manifest artifact path',
      ok: yamlValue(yaml, 'path') === 'Rocket-x64.exe',
      detail: yamlValue(yaml, 'path') || 'path missing',
    })
    checks.push({
      name: 'manifest sha512',
      ok: expectedHash === sha512Base64(installer),
      detail: expectedHash ? 'matches installer' : 'sha512 missing',
    })
    checks.push({
      name: 'manifest size',
      ok: expectedSize === actualSize,
      detail: `${expectedSize} == ${actualSize}`,
    })
  }

  if (existsSync(appRoot)) {
    const craftNamed: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/craft/i.test(entry.name)) craftNamed.push(path)
      }
    }
    walk(appRoot)
    checks.push({
      name: 'packaged source excluded',
      ok: !existsSync(join(appRoot, 'src')),
      detail: join(appRoot, 'src'),
    })
    checks.push({
      name: 'legacy named assets excluded',
      ok: craftNamed.length === 0,
      detail: craftNamed.length === 0 ? '0 craft-named files' : craftNamed.join(', '),
    })
    checks.push({
      name: 'Rocket CLI documentation',
      ok: existsSync(join(appRoot, 'dist', 'resources', 'docs', 'rocket-cli.md')),
      detail: 'dist/resources/docs/rocket-cli.md',
    })
  }

  if (targetStage === 'publish' || targetStage === 'online') {
    const missingSignature: WindowsSignature = {
      status: 'Missing',
      subject: '',
      commonName: '',
      thumbprint: '',
    }
    const installerSignature = existsSync(installer) ? windowsSignature(installer) : missingSignature
    checks.push({
      name: 'installer Authenticode signature',
      ok: installerSignature.status === 'Valid' && Boolean(installerSignature.thumbprint),
      detail: installerSignature.subject || installerSignature.status,
    })
    const appSignature = existsSync(appExecutable) ? windowsSignature(appExecutable) : missingSignature
    checks.push({
      name: 'application Authenticode signature',
      ok: appSignature.status === 'Valid' && Boolean(appSignature.thumbprint),
      detail: appSignature.subject || appSignature.status,
    })
    checks.push({
      name: 'Authenticode signer identity',
      ok: Boolean(installerSignature.thumbprint)
        && installerSignature.thumbprint === appSignature.thumbprint,
      detail: installerSignature.thumbprint && appSignature.thumbprint
        ? `${installerSignature.thumbprint} == ${appSignature.thumbprint}`
        : 'signer thumbprint unavailable',
    })
    const publisherNames = existsSync(appUpdateConfig)
      ? yamlStringList(readFileSync(appUpdateConfig, 'utf8'), 'publisherName')
      : []
    checks.push({
      name: 'auto-update publisher identity',
      ok: publisherNames.length > 0
        && publisherNames.some((publisher) => (
          signatureSubjectMatchesPublisher(
            installerSignature.subject,
            publisher,
            installerSignature.commonName,
          )
        )),
      detail: publisherNames.length > 0
        ? `${publisherNames.join(' | ')} matches ${installerSignature.subject || 'unsigned installer'}`
        : 'publisherName missing from app-update.yml',
    })
  }

  if (targetStage === 'publish') {
    const required = [
      'S3_VERSIONS_BUCKET_ENDPOINT',
      'S3_VERSIONS_BUCKET_ACCESS_KEY_ID',
      'S3_VERSIONS_BUCKET_SECRET_ACCESS_KEY',
    ]
    const missing = required.filter((name) => !process.env[name])
    checks.push({
      name: 'S3 publishing configuration',
      ok: missing.length === 0,
      detail: missing.length === 0 ? 'configured' : `missing ${missing.join(', ')}`,
    })
  }

  return checks
}

async function onlineChecks(): Promise<Check[]> {
  const checks: Check[] = []
  const url = new URL(BASE_URL)
  const localPackage = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: string }
  const localManifestPath = join(RELEASE_DIR, 'latest.yml')
  const localManifest = existsSync(localManifestPath)
    ? readFileSync(localManifestPath, 'utf8')
    : ''
  try {
    const addresses = await dns.lookup(url.hostname, { all: true })
    const publicAddresses = addresses.filter((item) => isPublicReleaseAddress(item.address))
    checks.push({
      name: 'release DNS',
      ok: publicAddresses.length > 0,
      detail: publicAddresses.length > 0
        ? publicAddresses.map((item) => item.address).join(', ')
        : `no public address (${addresses.map((item) => item.address).join(', ') || 'no records'})`,
    })
    if (publicAddresses.length === 0) return checks
  } catch (error) {
    checks.push({ name: 'release DNS', ok: false, detail: String(error) })
    return checks
  }

  try {
    const manifestResponse = await fetch(`${BASE_URL}/latest/latest.yml`, {
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    })
    checks.push({
      name: 'online latest.yml',
      ok: manifestResponse.ok,
      detail: `HTTP ${manifestResponse.status}`,
    })
    if (manifestResponse.ok) {
      const yaml = await manifestResponse.text()
      checks.push({
        name: 'online manifest version',
        ok: yamlValue(yaml, 'version') === localPackage.version,
        detail: `${yamlValue(yaml, 'version')} == ${localPackage.version}`,
      })
      checks.push({
        name: 'online manifest checksum',
        ok: yamlValue(yaml, 'sha512') === yamlValue(localManifest, 'sha512'),
        detail: 'remote sha512 matches local signed candidate',
      })
      checks.push({
        name: 'online manifest content',
        ok: yaml === localManifest,
        detail: 'remote latest.yml exactly matches local signed candidate manifest',
      })
      const artifact = yaml.match(/^\s*-\s*url:\s*(\S+)/m)?.[1]
        || yamlValue(yaml, 'path')
      if (artifact) {
        const artifactResponse = await fetch(`${BASE_URL}/latest/${artifact}`, {
          signal: AbortSignal.timeout(600_000),
          cache: 'no-store',
        })
        checks.push({
          name: 'online installer response',
          ok: artifactResponse.ok,
          detail: `HTTP ${artifactResponse.status}`,
        })
        if (artifactResponse.ok) {
          const downloaded = await sha512ResponseBody(artifactResponse)
          const expectedSize = Number(yamlValue(yaml, 'size'))
          const contentLength = artifactResponse.headers.get('content-length')
          checks.push({
            name: 'online installer size',
            ok: downloaded.size === expectedSize
              && (contentLength === null || Number(contentLength) === expectedSize),
            detail: `${downloaded.size} bytes downloaded, ${expectedSize} expected`,
          })
          checks.push({
            name: 'online installer checksum',
            ok: downloaded.sha512 === yamlValue(yaml, 'sha512'),
            detail: 'downloaded installer sha512 matches published manifest',
          })
        }
      }
    }
  } catch (error) {
    checks.push({ name: 'online release', ok: false, detail: String(error) })
  }

  for (const script of ['install-app.ps1', 'install-app.sh']) {
    try {
      const response = await fetch(new URL(`/${script}`, BASE_URL).toString(), {
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      })
      const remoteContent = response.ok ? await response.text() : ''
      const localContent = readFileSync(join(ROOT_DIR, 'scripts', script), 'utf8')
      checks.push({
        name: `online ${script}`,
        ok: response.ok && remoteContent === localContent,
        detail: response.ok
          ? `HTTP ${response.status}, content ${remoteContent === localContent ? 'matches' : 'differs'}`
          : `HTTP ${response.status}`,
      })
    } catch (error) {
      checks.push({ name: `online ${script}`, ok: false, detail: String(error) })
    }
  }
  return checks
}

async function main(): Promise<void> {
  const targetStage = stage()
  const checks = localChecks(targetStage)
  if (targetStage === 'online') checks.push(...await onlineChecks())

  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`)
  }

  const failures = checks.filter((check) => !check.ok)
  console.log(`Release check (${targetStage}): ${checks.length - failures.length}/${checks.length} passed`)
  if (failures.length > 0) process.exit(1)
}

if (import.meta.main) {
  await main()
}
