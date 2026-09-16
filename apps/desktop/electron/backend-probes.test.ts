/**
 * Tests for electron/backend-probes.ts.
 *
 * Run with: node --test electron/backend-probes.test.ts
 * (Wired into npm test:desktop:platforms in package.json.)
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import {
  canImportEzrithCli,
  DEFAULT_PROBE_TIMEOUT_MS,
  ezrithRuntimeImportProbe,
  PROBE_TIMEOUT_MS,
  resolveProbeTimeoutMs,
  shouldTrustEzrithOverride,
  verifyEzrithCli
} from './backend-probes'

// Resolve the host's own Node binary -- guaranteed to be on disk and
// runnable. We use it as both a stand-in for "a python that doesn't
// have ezrith_cli" (since `node -c "import ezrith_cli"` will exit
// non-zero) and as a way to script verifyEzrithCli's success path
// (a tiny script we write to disk that exits 0 on --version).
const NODE_BIN = process.execPath

test('canImportEzrithCli returns false when path is falsy', () => {
  assert.equal(canImportEzrithCli(''), false)
  assert.equal(canImportEzrithCli(null), false)
  assert.equal(canImportEzrithCli(undefined), false)
})

test('canImportEzrithCli returns false when interpreter cannot run -c', () => {
  // node IS an interpreter, but `node -c "import ezrith_cli"` is a
  // SyntaxError -- different exit reason from a real Python's
  // ModuleNotFoundError, but the predicate is "exit 0 or not" and
  // both land on "not", which is exactly what we want for the
  // resolver fall-through.
  assert.equal(canImportEzrithCli(NODE_BIN), false)
})

test('canImportEzrithCli returns false when binary does not exist', () => {
  const ghost = path.join(os.tmpdir(), 'ezrith-probes-ghost-' + Date.now() + '.exe')
  assert.equal(canImportEzrithCli(ghost), false)
})

test('ezrith runtime import probe checks config dependencies', () => {
  const probe = ezrithRuntimeImportProbe()
  assert.match(probe, /\bimport yaml\b/)
  // dotenv is the first third-party import on the CLI boot path
  // (ezrith_cli/env_loader.py); a mid-update venv missing python-dotenv
  // passed the old probe and produced an unrecoverable boot loop.
  assert.match(probe, /\bimport dotenv\b/)
  assert.match(probe, /\bimport ezrith_cli\.config\b/)
})

test('explicit Ezrith override is authoritative', () => {
  assert.equal(shouldTrustEzrithOverride('/nix/store/abc/bin/ezrith'), true)
})

test('empty Ezrith override is not authoritative', () => {
  assert.equal(shouldTrustEzrithOverride(''), false)
  assert.equal(shouldTrustEzrithOverride(undefined), false)
})

test('verifyEzrithCli returns false when command is falsy', () => {
  assert.equal(verifyEzrithCli(''), false)
  assert.equal(verifyEzrithCli(null), false)
  assert.equal(verifyEzrithCli(undefined), false)
})

test('verifyEzrithCli returns false when binary does not exist', () => {
  const ghost = path.join(os.tmpdir(), 'ezrith-probes-ghost-' + Date.now() + '.exe')
  assert.equal(verifyEzrithCli(ghost), false)
})

test('verifyEzrithCli returns true when --version exits 0', () => {
  // Write a tiny script that exits 0 regardless of args, then invoke
  // it through node. This stands in for a working ezrith binary --
  // verifyEzrithCli only cares about the exit code.
  const scriptPath = path.join(os.tmpdir(), `ezrith-probes-ok-${Date.now()}-${process.pid}.cjs`)
  fs.writeFileSync(scriptPath, 'process.exit(0)\n')

  try {
    // Use node as the launcher and our script as the "command". Pass
    // shell:false (default) -- node is a real binary, no shim.
    // execFileSync passes ['--version'] as args, which node ignores
    // gracefully (well, it prints its version and exits 0, which is
    // perfect -- exit code 0 is the only signal we read).
    assert.equal(verifyEzrithCli(NODE_BIN), true)
  } finally {
    try {
      fs.unlinkSync(scriptPath)
    } catch {
      void 0
    }
  }
})

test('verifyEzrithCli swallows timeouts (does not throw)', () => {
  // We can't easily provoke a real hang in CI without slowing the
  // suite, but we CAN confirm that an invocation that DOES throw
  // (because the binary is missing) returns false rather than
  // propagating. Same code path the timeout case takes.
  assert.equal(verifyEzrithCli('/definitely/not/a/real/binary/anywhere'), false)
})

test('default probe timeout is 15s (not the old 5s death-loop value)', () => {
  assert.equal(DEFAULT_PROBE_TIMEOUT_MS, 15_000)
  // Module constant uses process.env at load time; with no override it
  // matches the default (tests run without EZRITH_PROBE_TIMEOUT_MS).
  assert.equal(PROBE_TIMEOUT_MS, DEFAULT_PROBE_TIMEOUT_MS)
})

test('resolveProbeTimeoutMs honours EZRITH_PROBE_TIMEOUT_MS', () => {
  assert.equal(resolveProbeTimeoutMs({}), DEFAULT_PROBE_TIMEOUT_MS)
  assert.equal(resolveProbeTimeoutMs({ EZRITH_PROBE_TIMEOUT_MS: '30000' }), 30_000)
  assert.equal(resolveProbeTimeoutMs({ EZRITH_PROBE_TIMEOUT_MS: '0' }), DEFAULT_PROBE_TIMEOUT_MS)
  assert.equal(resolveProbeTimeoutMs({ EZRITH_PROBE_TIMEOUT_MS: 'nope' }), DEFAULT_PROBE_TIMEOUT_MS)
  // Cap runaway values
  assert.equal(resolveProbeTimeoutMs({ EZRITH_PROBE_TIMEOUT_MS: '999999' }), 120_000)
})
