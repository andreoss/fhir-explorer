import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DECLARED = /^export (?:async )?(?:function|const|class) ([A-Za-z0-9_]+)|^export type ([A-Za-z0-9_]+)/gm
const IMPORTED = /import\s+(?:type\s+)?\{([^}]+)\}\s+from/g

function filesUnder(where) {
  return readdirSync(where).flatMap((name) => {
    const path = join(where, name)

    if (statSync(path).isDirectory()) {
      return filesUnder(path)
    }

    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

const files = ['src', 'packages'].flatMap(filesUnder)
const asked = new Set()
const reached = new Set()

for (const path of files) {
  const held = readFileSync(path, 'utf8')

  for (const [, names] of held.matchAll(IMPORTED)) {
    for (const one of names.split(',')) {
      asked.add(one.trim().split(/\s+as\s+/)[0].trim())
    }
  }

  for (const [, name] of held.matchAll(/\.([A-Za-z0-9_]+)\b/g)) {
    reached.add(name)
  }
}

const kept = []

for (const path of files) {
  if (path.endsWith('index.ts') || path.includes('.test.')) {
    continue
  }

  const body = readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')

  for (const found of body.matchAll(DECLARED)) {
    const name = found[1] ?? found[2]

    if (name === undefined || asked.has(name) || reached.has(name)) {
      continue
    }

    const times = [...body.matchAll(new RegExp(`\\b${name}\\b`, 'g'))].length

    if (times <= 1) {
      kept.push(`${path}: ${name} is exported and nothing asks for it`)
    }
  }
}

for (const one of kept) {
  process.stdout.write(`${one}\n`)
}

process.exit(kept.length > 0 ? 1 : 0)
