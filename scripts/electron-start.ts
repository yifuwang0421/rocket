/**
 * Start the packaged Electron development app on every supported platform.
 *
 * Bun can inherit ELECTRON_RUN_AS_NODE in some environments. Passing that
 * variable to Electron turns the executable into a plain Node process, so
 * always remove it in the child environment.
 */
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const electronPath = require('electron') as string
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const appPath = join(repoRoot, 'apps', 'electron')
const childEnv = { ...process.env }

delete childEnv.ELECTRON_RUN_AS_NODE

const electron = Bun.spawn([electronPath, appPath], {
  cwd: repoRoot,
  env: childEnv,
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})

process.exitCode = await electron.exited
