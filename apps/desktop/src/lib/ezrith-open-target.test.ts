import { describe, expect, it } from 'vitest'

import {
  normalizeEzrithOpenString,
  pathFromEzrithDeepLink,
  pathFromOpenDeepLink,
  resolveEzrithOpenPath
} from './ezrith-open-target'

describe('normalizeEzrithOpenString', () => {
  it('accepts hash-router paths and strips a leading hash', () => {
    expect(normalizeEzrithOpenString('/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeEzrithOpenString('#/index-network/intent/1')).toBe('/index-network/intent/1')
  })

  it('maps plugin-scoped ezrith:// deep links to the same path', () => {
    expect(normalizeEzrithOpenString('ezrith://index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeEzrithOpenString('ezrith://index-network/intent/1?focus=true')).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('maps ezrith://open/… deep links by stripping the open host', () => {
    expect(normalizeEzrithOpenString('ezrith://open/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeEzrithOpenString('ezrith://open/settings/plugins')).toBe('/settings/plugins')
  })

  it('rejects reserved ezrith kinds and unsafe paths', () => {
    expect(normalizeEzrithOpenString('ezrith://blueprint/morning-brief')).toBeNull()
    expect(normalizeEzrithOpenString('ezrith://plugin/install')).toBeNull()
    expect(normalizeEzrithOpenString('https://example.com/x')).toBeNull()
    expect(normalizeEzrithOpenString('/../etc/passwd')).toBeNull()
    expect(normalizeEzrithOpenString('index-network')).toBeNull()
  })
})

describe('resolveEzrithOpenPath', () => {
  it('merges structured path + params', () => {
    expect(resolveEzrithOpenPath({ path: '/index-network/intent/1', params: { focus: 'true' } })).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('resolves href the same as a bare string', () => {
    expect(resolveEzrithOpenPath({ href: 'ezrith://index-network/intent/1' })).toBe('/index-network/intent/1')
  })
})

describe('pathFromEzrithDeepLink', () => {
  it('builds the navigate path from a plugin-scoped deep-link payload', () => {
    expect(pathFromEzrithDeepLink('index-network', 'intent/1')).toBe('/index-network/intent/1')
  })

  it('builds the navigate path from ezrith://open/… payloads', () => {
    expect(pathFromOpenDeepLink('index-network/intent/1')).toBe('/index-network/intent/1')
    expect(pathFromEzrithDeepLink('open', 'agent/42')).toBe('/agent/42')
  })

  it('ignores reserved kinds', () => {
    expect(pathFromEzrithDeepLink('blueprint', 'morning-brief')).toBeNull()
    expect(pathFromEzrithDeepLink('plugin', 'install')).toBeNull()
  })
})
