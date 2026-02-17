import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

const IMAGE = process.env.EXPLORER_SERVER_IMAGE ?? 'docker.io/hapiproject/hapi:latest'
const RUNTIME = process.env.EXPLORER_CONTAINER ?? 'docker'
const PATIENTS = ['Ada', 'Grace', 'Alan']

async function announcedPort(id) {
  const { stdout } = await run(RUNTIME, ['port', id])
  const found = /:(\d+)\s*$/m.exec(stdout.trim())

  if (found === null) {
    throw new Error(`the container announced no address: ${stdout}`)
  }

  return Number(found[1])
}

async function reachable(url, attempts) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const answer = await fetch(url, { signal: AbortSignal.timeout(3000), headers: { connection: 'close' } })

      if (answer.ok) {
        return true
      }
    } catch {
      /* the server is not up yet */
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  return false
}

async function seed(base) {
  const entry = PATIENTS.flatMap((name, index) => {
    const patient = `patient-${String(index)}`

    return [
      {
        fullUrl: `urn:uuid:${patient}`,
        resource: { resourceType: 'Patient', id: patient, name: [{ family: name, given: ['Test'] }], gender: 'unknown' },
        request: { method: 'PUT', url: `Patient/${patient}` }
      },
      {
        resource: {
          resourceType: 'Observation',
          id: `observation-${String(index)}`,
          status: 'final',
          code: { text: 'a measurement' },
          subject: { reference: `Patient/${patient}` },
          valueQuantity: { value: index + 1, unit: 'kg' }
        },
        request: { method: 'PUT', url: `Observation/observation-${String(index)}` }
      }
    ]
  })

  const answer = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/fhir+json' },
    body: JSON.stringify({ resourceType: 'Bundle', type: 'transaction', entry })
  })

  if (!answer.ok) {
    throw new Error(`seeding was refused with ${String(answer.status)}`)
  }

  await indexed(base)
}

async function indexed(base) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const answer = await fetch(`${base}/Patient?name=${PATIENTS[0]}`, {
      headers: { accept: "application/fhir+json", "cache-control": "no-cache" }
    })
    const bundle = await answer.json()

    if (typeof bundle.total === "number" && bundle.total > 0) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error("the service never answered a search for what was seeded into it")
}

export async function startService() {
  const { stdout } = await run(RUNTIME, ['run', '-d', '--rm', '-p', '127.0.0.1::8080', IMAGE])
  const id = stdout.trim()
  const port = await announcedPort(id)
  const base = `http://127.0.0.1:${String(port)}/fhir`

  if (!(await reachable(`${base}/metadata`, 90))) {
    await run(RUNTIME, ['rm', '-f', id]).catch(() => undefined)
    throw new Error('the service never answered for its capability statement')
  }

  await seed(base)

  return {
    base,
    stop: async () => {
      await run(RUNTIME, ['rm', '-f', id]).catch(() => undefined)
    }
  }
}
