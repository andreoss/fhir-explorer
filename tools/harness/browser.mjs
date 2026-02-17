import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const IMAGE = process.env['EXPLORER_BROWSER_IMAGE'] ?? 'mcr.microsoft.com/playwright:v1.63.0-noble'
const RUNTIME = process.env['EXPLORER_CONTAINER'] ?? 'docker'

export async function startBrowser() {
  const { stdout } = await run(RUNTIME, [
    'run',
    '-d',
    '--rm',
    '--network=host',
    '--init',
    IMAGE,
    '/bin/sh',
    '-c',
    'npx -y playwright@1.63.0 run-server --port 0 --host 127.0.0.1'
  ])

  const id = stdout.trim()
  const stop = async () => {
    await run(RUNTIME, ['rm', '-f', id]).catch(() => undefined)
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const logs = await run(RUNTIME, ['logs', id]).catch(() => ({ stdout: '', stderr: '' }))
    const said = `${logs.stdout}${logs.stderr}`
    const found = /ws:\/\/\S+/.exec(said)

    if (found !== null) {
      return { endpoint: found[0], stop }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  await stop()

  throw new Error('the browser never announced where to connect to it')
}

export async function withBrowser(command, args) {
  const browser = process.env['EXPLORER_BROWSER_WS'] === undefined ? await startBrowser() : undefined
  const endpoint = browser?.endpoint ?? process.env['EXPLORER_BROWSER_WS']

  const code = await new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, PW_TEST_CONNECT_WS_ENDPOINT: endpoint }
    })

    child.on('exit', (status) => {
      resolve(status ?? 1)
    })
  })

  await browser?.stop()

  return code
}
