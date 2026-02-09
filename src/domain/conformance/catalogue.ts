import type { Call, Client } from '../transport/client'
import { entriesOf } from '../transport/paging'
import type { Result } from '../transport/outcome'
import { ok } from '../transport/outcome'
import type { ServerCapability } from './capability'
import { capabilityOf } from './capability'
import type { TypeDefinition } from './definition'
import { definitionOf } from './definition'

export type Catalogue = {
  capability: (call?: Call) => Promise<Result<ServerCapability>>
  definition: (type: string, call?: Call) => Promise<Result<TypeDefinition>>
  undescribed: () => readonly string[]
}

export function createCatalogue(client: Client): Catalogue {
  let statement: ServerCapability | undefined
  const definitions = new Map<string, TypeDefinition>()
  const missing = new Set<string>()

  async function read(type: string, call: Call | undefined): Promise<TypeDefinition | undefined> {
    const direct = await client.read('StructureDefinition', type, call)

    if (direct.ok && direct.value.resource.resourceType === 'StructureDefinition') {
      return definitionOf(direct.value.resource)
    }

    const found = await client.search(
      'StructureDefinition',
      [
        ['type', type],
        ['_count', '1']
      ],
      call
    )

    if (!found.ok) {
      return undefined
    }

    const first = entriesOf(found.value.resource)[0]

    return first === undefined ? undefined : definitionOf(first)
  }

  return {
    capability: async (call) => {
      if (statement !== undefined) {
        return ok(statement)
      }

      const answer = await client.fetch({ method: 'GET', url: `${client.base}/metadata`, ...(call ?? {}) })

      if (!answer.ok) {
        return answer
      }

      statement = capabilityOf(answer.value.resource)

      return ok(statement)
    },

    definition: async (type, call) => {
      const kept = definitions.get(type)

      if (kept !== undefined) {
        return ok(kept)
      }

      const found = await read(type, call)

      if (found === undefined) {
        missing.add(type)
      }

      const described: TypeDefinition = found ?? { type, complete: false, elements: [] }

      definitions.set(type, described)

      return ok(described)
    },

    undescribed: () => [...missing]
  }
}
