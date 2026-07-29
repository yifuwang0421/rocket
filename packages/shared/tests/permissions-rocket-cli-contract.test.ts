import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type AllowedBashEntry = { pattern: string; comment?: string }

describe('permissions Rocket CLI contract', () => {
  it('does not allow unimplemented configuration subcommands', () => {
    const permissionsPath = resolve(import.meta.dir, '../../../apps/electron/resources/permissions/default.json')
    const permissions = JSON.parse(readFileSync(permissionsPath, 'utf-8')) as {
      allowedBashPatterns?: AllowedBashEntry[]
    }

    const unsupported = (permissions.allowedBashPatterns ?? [])
      .filter(entry => typeof entry.pattern === 'string' && entry.pattern.startsWith('^rocket\\s'))

    expect(unsupported).toEqual([])
  })
})
