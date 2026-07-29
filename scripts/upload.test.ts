import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildUploadPlan } from './upload'

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'rocket-upload-plan-'))
  mkdirSync(join(root, 'apps', 'electron', 'release'), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })
  mkdirSync(join(root, '.build', 'upload'), { recursive: true })
  writeFileSync(
    join(root, 'apps', 'electron', 'package.json'),
    JSON.stringify({ version: '1.2.3' }),
  )
  writeFileSync(join(root, 'apps', 'electron', 'release', 'Rocket-x64.exe'), 'exe')
  writeFileSync(join(root, 'apps', 'electron', 'release', 'Rocket-x64.exe.blockmap'), 'map')
  writeFileSync(join(root, 'apps', 'electron', 'release', 'latest.yml'), 'manifest')
  writeFileSync(join(root, 'apps', 'electron', 'release', 'builder-debug.yml'), 'debug')
  writeFileSync(join(root, '.build', 'upload', 'manifest.json'), '{"version":"1.2.3"}')
  writeFileSync(join(root, 'scripts', 'install-app.sh'), '#!/bin/bash')
  writeFileSync(join(root, 'scripts', 'install-app.ps1'), '# powershell')
  return root
}

describe('release upload plan', () => {
  it('uploads immutable versioned artifacts and publishes latest manifest last', () => {
    const root = fixture()
    try {
      const plan = buildUploadPlan({
        electron: true,
        latest: true,
        script: false,
        dryRun: true,
      }, root)
      const keys = plan.map((item) => item.key)

      expect(keys).toContain('electron/1.2.3/Rocket-x64.exe')
      expect(keys).toContain('electron/latest/Rocket-x64.exe')
      expect(keys).toContain('electron/latest/latest.yml')
      expect(keys).not.toContain('electron/1.2.3/builder-debug.yml')
      expect(keys.indexOf('electron/latest/latest.yml')).toBeGreaterThan(
        keys.indexOf('electron/latest/Rocket-x64.exe'),
      )
      expect(plan.find((item) => item.key === 'electron/1.2.3/Rocket-x64.exe')?.cacheControl)
        .toContain('immutable')
      expect(plan.find((item) => item.key === 'electron/latest/Rocket-x64.exe')?.cacheControl)
        .toContain('no-store')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('publishes both platform install scripts with no-cache headers', () => {
    const root = fixture()
    try {
      const plan = buildUploadPlan({
        electron: false,
        latest: false,
        script: true,
        dryRun: true,
      }, root)

      expect(plan.map((item) => item.key)).toEqual(['install-app.sh', 'install-app.ps1'])
      expect(plan.every((item) => item.cacheControl.includes('no-cache'))).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('publishes the mutable latest manifest only after binaries and install scripts', () => {
    const root = fixture()
    try {
      const plan = buildUploadPlan({
        electron: true,
        latest: true,
        script: true,
        dryRun: true,
      }, root)
      const keys = plan.map((item) => item.key)

      expect(keys.at(-1)).toBe('electron/latest/latest.yml')
      expect(keys.indexOf('install-app.ps1')).toBeLessThan(
        keys.indexOf('electron/latest/latest.yml'),
      )
      expect(keys.indexOf('electron/latest/Rocket-x64.exe')).toBeLessThan(
        keys.indexOf('electron/latest/latest.yml'),
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
