import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { permissionsConfigCache } from '../permissions-config.ts'

const originalConfigDir = process.env.ROCKET_CONFIG_DIR

function writeDefaultPermissions(configDir: string) {
  const permissionsDir = join(configDir, 'permissions')
  mkdirSync(permissionsDir, { recursive: true })
  writeFileSync(
    join(permissionsDir, 'default.json'),
    JSON.stringify(
      {
        version: '2026-03-07',
        allowedBashPatterns: [
          { pattern: '^rocket\\s+label\\s+list\\b', comment: 'rocket label read-only operations' },
          { pattern: '^rg\\b', comment: 'Ripgrep search' },
        ],
        allowedMcpPatterns: [],
        allowedApiEndpoints: [],
        allowedWritePaths: [],
        blockedCommandHints: [],
      },
      null,
      2,
    ),
  )
}

beforeEach(() => {
  permissionsConfigCache.clear()
})

afterEach(() => {
  permissionsConfigCache.clear()
  delete process.env.ROCKET_FEATURE_ROCKET_AGENTS_CLI

  if (originalConfigDir === undefined) delete process.env.ROCKET_CONFIG_DIR
  else process.env.ROCKET_CONFIG_DIR = originalConfigDir

})

describe('permissions config Rocket CLI contract', () => {
  it('does not compile removed config-CLI patterns even with a stale environment override', () => {
    const tempConfigDir = mkdtempSync(join(tmpdir(), 'rocket-permissions-'))
    try {
      process.env.ROCKET_CONFIG_DIR = tempConfigDir
      process.env.ROCKET_FEATURE_ROCKET_AGENTS_CLI = '1'
      writeDefaultPermissions(tempConfigDir)

      const merged = permissionsConfigCache.getMergedConfig({
        workspaceRootPath: '/tmp/workspace',
        activeSourceSlugs: [],
      })

      const sources = merged.readOnlyBashPatterns.map(p => p.source)
      expect(sources.some(source => source.startsWith('^rocket\\s'))).toBe(false)
      expect(sources).toContain('^rg\\b')
    } finally {
      rmSync(tempConfigDir, { recursive: true, force: true })
    }
  })
})
