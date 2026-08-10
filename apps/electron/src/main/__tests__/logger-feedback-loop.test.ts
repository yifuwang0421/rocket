import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const mainDir = join(import.meta.dir, '..')

describe('main/renderer logging boundary', () => {
  it('does not send main-process log records back to renderers', () => {
    const loggerSource = readFileSync(join(mainDir, 'logger.ts'), 'utf8')

    expect(loggerSource).toContain('const ipcTransport = log.transports.ipc')
    expect(loggerSource).toContain('if (ipcTransport) ipcTransport.level = false')
  })

  it('does not mirror the main window console into the main logger', () => {
    const windowManagerSource = readFileSync(join(mainDir, 'window-manager.ts'), 'utf8')

    expect(windowManagerSource).not.toMatch(/webContents\.on\(['"]console-message['"]/)
  })

  it('breaks recursive logging when the development console pipe closes', () => {
    const mainSource = readFileSync(join(mainDir, 'index.ts'), 'utf8')

    expect(mainSource).toContain("code === 'EPIPE'")
    expect(mainSource).toContain('log.transports.console.level = false')
    expect(mainSource).toContain('if (handlingUncaughtException) return')
  })
})
