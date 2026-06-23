import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'

const AREAS = ['auth', 'conformance', 'fhir', 'form', 'graph', 'transport']
const IMPORT = /from '([^']+)'/g

function filesUnder(where) {
  return readdirSync(where).flatMap((name) => {
    const path = join(where, name)

    if (statSync(path).isDirectory()) {
      return filesUnder(path)
    }

    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : []
  })
}

function wrongIn(path) {
  const held = readFileSync(path, 'utf8')
  const from = path.split('/').slice(0, -1).join('/')
  const inside = AREAS.find((area) => path.startsWith(`src/domain/${area}/`))
  const wrong = []

  for (const [, said] of held.matchAll(IMPORT)) {
    if (!said.startsWith('.')) {
      continue
    }

    const target = posix.normalize(posix.join(from, said))

    if (path.startsWith('src/domain/') && (target.startsWith('src/shell') || target.startsWith('src/i18n'))) {
      wrong.push(`${path}: a library reaches up to ${said}`)

      continue
    }

    const area = AREAS.find((one) => target.startsWith(`src/domain/${one}/`))

    if (area !== undefined && area !== inside) {
      wrong.push(`${path}: reaches past the entry of ${area} to ${said}`)
    }
  }

  return wrong
}

const wrong = filesUnder('src').flatMap(wrongIn)

for (const one of wrong) {
  process.stdout.write(`${one}\n`)
}

process.exit(wrong.length > 0 ? 1 : 0)
