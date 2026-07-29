import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

function extractManifestParser(): string {
  const source = readFileSync(join(import.meta.dir, 'install-app.ps1'), 'utf8')
  const start = source.indexOf('function Get-YamlEntryForArch')
  const end = source.indexOf('\n$entry = Get-YamlEntryForArch', start)
  if (start < 0 || end < 0) {
    throw new Error('Unable to locate Get-YamlEntryForArch in install-app.ps1')
  }
  return source.slice(start, end)
}

function parseWithPowerShell(yaml: string, arch: string): Record<string, unknown> {
  const dir = mkdtempSync(join(tmpdir(), 'rocket-installer-manifest-'))
  const scriptPath = join(dir, 'parse.ps1')
  const escapedYaml = yaml.replace(/'/g, "''")
  const script = [
    extractManifestParser(),
    `$yaml = @'`,
    escapedYaml,
    `'@`,
    `$result = Get-YamlEntryForArch -yaml $yaml -targetArch '${arch}'`,
    `if (-not $result) { exit 2 }`,
    `$result | ConvertTo-Json -Compress`,
  ].join('\r\n')

  try {
    writeFileSync(scriptPath, script, 'utf8')
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { encoding: 'utf8' },
    )
    if (result.status !== 0) {
      throw new Error(result.stderr || `PowerShell exited with ${result.status}`)
    }
    return JSON.parse(result.stdout.trim()) as Record<string, unknown>
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe.skipIf(!isWindows)('Windows installer latest.yml parsing', () => {
  it('accepts electron-builder single-arch manifests without an arch field', () => {
    const entry = parseWithPowerShell([
      'version: 0.11.2',
      'files:',
      '  - url: Rocket-x64.exe',
      '    sha512: checksum',
      '    size: 253229640',
      'path: Rocket-x64.exe',
    ].join('\n'), 'x64')

    expect(entry).toEqual({
      url: 'Rocket-x64.exe',
      sha512: 'checksum',
      size: 253229640,
    })
  })

  it('prefers an explicit matching architecture in multi-arch manifests', () => {
    const entry = parseWithPowerShell([
      'files:',
      '  - url: Rocket-arm64.exe',
      '    sha512: arm-checksum',
      '    size: 10',
      '    arch: arm64',
      '  - url: Rocket-x64.exe',
      '    sha512: x64-checksum',
      '    size: 20',
      '    arch: x64',
    ].join('\n'), 'x64')

    expect(entry).toEqual({
      url: 'Rocket-x64.exe',
      sha512: 'x64-checksum',
      size: 20,
    })
  })
})
