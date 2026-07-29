import { resolve, relative } from 'node:path'
import { existsSync } from 'node:fs'

const ROOT = resolve(import.meta.dir, '..')
const fromArg = process.argv.find(arg => arg.startsWith('--from='))?.slice('--from='.length)
const normalizedFrom = fromArg?.replace(/\\/g, '/')

async function run(args: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn([process.execPath, ...args], {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    windowsHide: true,
  })
  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`${relative(ROOT, cwd) || '.'}: bun ${args.join(' ')} exited with ${exitCode}`)
  }
}

async function listTrackedTests(pathspecs: string[]): Promise<string[]> {
  const listProc = Bun.spawn(['git', 'ls-files', '--cached', '--others', '--exclude-standard', ...pathspecs], {
    cwd: ROOT,
    stdout: 'pipe',
    stderr: 'inherit',
    windowsHide: true,
  })
  const listedFiles = await new Response(listProc.stdout).text()
  if (await listProc.exited !== 0) {
    throw new Error(`Unable to enumerate tests: ${pathspecs.join(', ')}`)
  }
  return listedFiles
    .split(/\r?\n/)
    .filter(Boolean)
    .map(file => resolve(ROOT, file))
    // `git ls-files --cached` includes tracked paths deleted in the working
    // tree. Those are not runnable, while untracked replacement tests are.
    .filter(file => existsSync(file))
    .sort()
}

const allStandardFiles = await listTrackedTests([
  '*.test.ts',
  '*.test.tsx',
  '*.spec.ts',
  '*.spec.tsx',
])
const standardFiles = normalizedFrom
  ? allStandardFiles.filter(file => relative(ROOT, file).replace(/\\/g, '/') >= normalizedFrom)
  : allStandardFiles

for (const file of standardFiles) {
  const displayPath = relative(ROOT, file)
  console.log(`\n[test] ${displayPath}`)
  // Cold Windows runners can spend more than Bun's default timeout resolving
  // a renderer or handler dependency graph in beforeAll. Keep a bounded
  // workspace default while allowing individual heavy tests to opt into more.
  await run(['test', '--timeout', '30000', file], ROOT)
}

const allIsolatedFiles = await listTrackedTests(['*.isolated.ts'])
const isolatedFiles = normalizedFrom && standardFiles.length === 0
  ? allIsolatedFiles.filter(file => relative(ROOT, file).replace(/\\/g, '/') >= normalizedFrom)
  : allIsolatedFiles

for (const file of isolatedFiles) {
  const displayPath = relative(ROOT, file)
  console.log(`\n[test:isolated] ${displayPath}`)
  await run(['test', '--timeout', '30000', file], ROOT)
}

console.log(`\n[test] Passed ${standardFiles.length} standard files and ${isolatedFiles.length} isolated files.`)
