import { describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  isPublicReleaseAddress,
  sha512ResponseBody,
  signatureSubjectMatchesPublisher,
  yamlStringList,
} from './release-check'

describe('release DNS acceptance', () => {
  test.each([
    '8.8.8.8',
    '1.1.1.1',
    '2606:4700:4700::1111',
  ])('accepts public address %s', (address) => {
    expect(isPublicReleaseAddress(address)).toBe(true)
  })

  test.each([
    '127.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '192.0.2.1',
    '198.18.0.74',
    '198.51.100.1',
    '203.0.113.1',
    '::1',
    'fdfe:dcba:9876::47',
    'fe80::1',
    '2001:db8::1',
    '::ffff:192.168.1.1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicReleaseAddress(address)).toBe(false)
  })
})

describe('online artifact verification', () => {
  test('streams the response body into an exact size and SHA-512 digest', async () => {
    const body = new TextEncoder().encode('signed Rocket artifact')
    const response = new Response(body)

    expect(await sha512ResponseBody(response)).toEqual({
      sha512: createHash('sha512').update(body).digest('base64'),
      size: body.byteLength,
    })
  })
})

describe('Windows update publisher verification', () => {
  test('parses publisherName emitted as a YAML list', () => {
    expect(yamlStringList([
      'provider: generic',
      'publisherName:',
      '  - "Rocket Research, Inc."',
      'updaterCacheDirName: rocket-updater',
    ].join('\n'), 'publisherName')).toEqual(['Rocket Research, Inc.'])
  })

  test('matches a publisher common name against the certificate subject', () => {
    expect(signatureSubjectMatchesPublisher(
      'CN="Rocket Research, Inc.", O="Rocket Research, Inc.", C=US',
      'Rocket Research, Inc.',
      'Rocket Research, Inc.',
    )).toBe(true)
  })
})
