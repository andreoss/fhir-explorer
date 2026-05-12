import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const LIMIT = 500 * 1024
const BUILT = 'dist'

async function assetsWithin(where) {
  const held = await readdir(where, { withFileTypes: true })
  const found = []

  for (const one of held) {
    const path = join(where, one.name)

    if (one.isDirectory()) {
      found.push(...(await assetsWithin(path)))

      continue
    }

    const { size } = await stat(path)

    found.push({ path, size })
  }

  return found
}

async function built() {
  try {
    return await assetsWithin(BUILT)
  } catch {
    process.stdout.write(`nothing built at ${BUILT}\n`)
    process.exit(1)
  }
}

const found = await built()
const over = found.filter((one) => one.size > LIMIT)

for (const one of over) {
  process.stdout.write(`asset over ${String(LIMIT)} bytes: ${one.path} is ${String(one.size)}\n`)
}

process.exit(over.length > 0 ? 1 : 0)
