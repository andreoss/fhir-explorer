import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const ALLOWED = new Set([
  'MIT',

  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'BlueOak-1.0.0',
  'Python-2.0',
  'Unlicense',
  'WTFPL',
  'MPL-2.0',
  'GPL-3.0-only',
  'LGPL-3.0-or-later'
])

function said(licence) {
  return licence
    .replaceAll('(', '')
    .replaceAll(')', '')
    .split(/\s+OR\s+|\s+AND\s+/)
    .map((one) => one.trim())
}

async function licences() {
  const { stdout } = await run('pnpm', ['licenses', 'list', '--json', '--prod', '--dev'], {
    maxBuffer: 32 * 1024 * 1024
  })
  const held = JSON.parse(stdout)
  const refused = []

  for (const [licence, packages] of Object.entries(held)) {
    const names = said(licence)

    if (names.some((one) => ALLOWED.has(one))) {
      continue
    }

    refused.push({ licence, packages: packages.map((one) => one.name) })
  }

  return refused
}

async function advisories() {
  try {
    await run('pnpm', ['audit', '--audit-level', 'high', '--prod'], { maxBuffer: 32 * 1024 * 1024 })

    return []
  } catch (cause) {
    return [cause.stdout ?? String(cause)]
  }
}

const refused = await licences()
const found = await advisories()

for (const one of refused) {
  process.stdout.write(`licence not allowed: ${one.licence} (${one.packages.join(', ')})\n`)
}

for (const one of found) {
  process.stdout.write(`${one}\n`)
}

process.exit(refused.length > 0 || found.length > 0 ? 1 : 0)
