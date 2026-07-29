import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const powershell = readFileSync(join(import.meta.dir, 'install-app.ps1'), 'utf8')
const shell = readFileSync(join(import.meta.dir, 'install-app.sh'), 'utf8')

describe('public installer security gates', () => {
  test('Windows validates canonical metadata and both Authenticode signatures', () => {
    expect(powershell).toContain("'^[A-Za-z0-9+/]{86}==$'")
    expect(powershell).toContain('$expectedFilename = "Rocket-$arch.exe"')
    expect(powershell.match(/Get-AuthenticodeSignature/g)).toHaveLength(2)
    expect(powershell).toContain('$installedSignature.Status -ne "Valid"')
    expect(powershell).toContain('"rocket-install-" + [Guid]::NewGuid()')
    expect(powershell).toContain('$runningProcess.CloseMainWindow()')
    expect(powershell).toContain('Remove-InstallerTemp')
    expect(powershell).toContain('} finally {')
    expect(powershell).not.toContain("Adding 'rocket' command to PATH")
    expect(powershell).not.toContain('[Environment]::SetEnvironmentVariable("Path"')
  })

  test('Unix validates the exact SHA-512 format and canonical artifact name', () => {
    expect(shell).toContain("'^[A-Za-z0-9+/]{86}==$'")
    expect(shell).toContain('expected_filename="Rocket-${arch}.${ext}"')
    expect(shell).toContain('if [ "$filename" != "$expected_filename" ]')
  })
})
