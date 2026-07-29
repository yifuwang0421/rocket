import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

interface PackageManifest {
  name?: string
  version?: string
}

const rootDir = join(import.meta.dir, '..')

async function readManifest(path: string): Promise<PackageManifest> {
  return await Bun.file(path).json() as PackageManifest
}

const rootManifestPath = join(rootDir, 'package.json')
const rootManifest = await readManifest(rootManifestPath)
const expectedVersion = rootManifest.version

if (!expectedVersion) {
  throw new Error('Root package.json is missing a version')
}

const manifestPaths = ['apps', 'packages'].flatMap((workspaceDir) => {
  const absoluteWorkspaceDir = join(rootDir, workspaceDir)
  return readdirSync(absoluteWorkspaceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(absoluteWorkspaceDir, entry.name, 'package.json'))
    .filter((path) => Bun.file(path).size > 0)
})

const mismatches: string[] = []
for (const manifestPath of manifestPaths) {
  const manifest = await readManifest(manifestPath)
  if (manifest.version !== expectedVersion) {
    mismatches.push(
      `${relative(rootDir, manifestPath)}: ${manifest.version ?? '<missing>'} (expected ${expectedVersion})`,
    )
  }
}

if (mismatches.length > 0) {
  throw new Error(`Workspace version mismatch:\n${mismatches.join('\n')}`)
}

console.log(`Version check OK: ${expectedVersion} (${manifestPaths.length + 1} manifests)`)
