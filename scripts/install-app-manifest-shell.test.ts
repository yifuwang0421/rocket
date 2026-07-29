import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const windowsGitBash = String.raw`C:\Program Files\Git\bin\bash.exe`
const bash = process.platform === 'win32' ? windowsGitBash : 'bash'
const hasBash = process.platform !== 'win32' || existsSync(bash)

function extractManifestParser(): string {
  const source = readFileSync(join(import.meta.dir, 'install-app.sh'), 'utf8')
  const start = source.indexOf('get_entry_from_yaml()')
  const end = source.indexOf('\n# Detect architecture', start)
  if (start < 0 || end < 0) {
    throw new Error('Unable to locate get_entry_from_yaml in install-app.sh')
  }
  return source.slice(start, end)
}

function parseWithBash(yaml: string, arch: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'rocket-installer-shell-manifest-'))
  const scriptPath = join(dir, 'parse.sh')
  const delimiter = '__ROCKET_YAML__'
  const script = [
    '#!/bin/bash',
    'set -e',
    extractManifestParser(),
    `yaml=$(cat <<'${delimiter}'`,
    yaml,
    delimiter,
    ')',
    `get_entry_from_yaml "$yaml" '${arch}'`,
  ].join('\n')

  try {
    writeFileSync(scriptPath, script, 'utf8')
    const result = spawnSync(bash, [scriptPath], { encoding: 'utf8' })
    if (result.status !== 0) {
      throw new Error(result.stderr || `Bash exited with ${result.status}`)
    }
    return result.stdout.trim().split('\t')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe.skipIf(!hasBash)('Unix installer latest.yml parsing', () => {
  it('accepts electron-builder single-arch manifests without an arch field', () => {
    const entry = parseWithBash([
      'version: 0.11.2',
      'files:',
      '  - url: Rocket-x64.AppImage',
      '    sha512: checksum',
      '    size: 253229640',
      'path: Rocket-x64.AppImage',
    ].join('\n'), 'x64')

    expect(entry).toEqual(['Rocket-x64.AppImage', 'checksum'])
  })

  it('prefers an explicit matching architecture in multi-arch manifests', () => {
    const entry = parseWithBash([
      'files:',
      '  - url: Rocket-universal.zip',
      '    sha512: arm-checksum',
      '    arch: arm64',
      '  - url: Rocket-x64.zip',
      '    sha512: x64-checksum',
      '    arch: x64',
    ].join('\n'), 'x64')

    expect(entry).toEqual(['Rocket-x64.zip', 'x64-checksum'])
  })
})
