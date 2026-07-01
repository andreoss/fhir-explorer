import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'

const LONGEST = 320
const LONGEST_TEST = 400
const IMPORT = /(?:from|import\()\s*'([^']+)'/g

function filesUnder(where) {
  return readdirSync(where).flatMap((name) => {
    const path = join(where, name)

    if (statSync(path).isDirectory()) {
      return filesUnder(path)
    }

    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

function packageOf(path) {
  const found = /^packages\/([^/]+)\//.exec(path)

  return found?.[1]
}

function wrongIn(path) {
  const held = readFileSync(path, 'utf8')
  const from = path.split('/').slice(0, -1).join('/')
  const inside = packageOf(path)
  const wrong = []

  for (const [, said] of held.matchAll(IMPORT)) {
    if (!said.startsWith('.')) {
      continue
    }

    const target = posix.normalize(posix.join(from, said))
    const reached = packageOf(target)

    if (reached !== inside) {
      wrong.push(
        reached === undefined
          ? `${path}: climbs out of its package to ${said}`
          : `${path}: reaches inside ${reached} by a path, not by its name`
      )
    }
  }

  return wrong
}

function tooLongIn(path) {
  const most = path.includes('.test.') ? LONGEST_TEST : LONGEST
  const lines = readFileSync(path, 'utf8').split('\n').length

  return lines > most ? [`${path}: ${String(lines)} lines, longer than ${String(most)}`] : []
}

const wrong = ['src', 'packages'].flatMap(filesUnder).flatMap((path) => [...wrongIn(path), ...tooLongIn(path)])

for (const one of wrong) {
  process.stdout.write(`${one}\n`)
}

process.exit(wrong.length > 0 ? 1 : 0)
