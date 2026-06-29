import { describe, expect, it } from 'vitest'
import { createClient } from '@lib/transport'
import { json, stubHttp } from '@lib/stub'
import { createCatalogue } from './catalogue'

const base = 'https://example.org/fhir'

const statement = {
  resourceType: 'CapabilityStatement',
  fhirVersion: '5.0.0',
  rest: [{ mode: 'server', resource: [{ type: 'Patient', interaction: [{ code: 'read' }] }] }]
}

const structure = {
  resourceType: 'StructureDefinition',
  type: 'Patient',
  snapshot: { element: [{ path: 'Patient' }, { path: 'Patient.name', min: 0, max: '*' }] }
}

describe('catalogue', () => {
  it('asks the server what it can do', async () => {
    const stub = stubHttp([json(200, statement)])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    const result = await catalogue.capability()

    expect(result.ok && result.value.fhirVersion).toBe('5.0.0')
    expect(stub.requests[0]?.url).toBe(`${base}/metadata`)
  })

  it('asks once and remembers the answer', async () => {
    const stub = stubHttp([json(200, statement)])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    await catalogue.capability()
    await catalogue.capability()

    expect(stub.requests).toHaveLength(1)
  })

  it('carries a refusal of the statement to the caller', async () => {
    const stub = stubHttp([json(404, { resourceType: 'OperationOutcome' })])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    const result = await catalogue.capability()

    expect(result.ok).toBe(false)
  })

  it('reads the definition of a type by its name', async () => {
    const stub = stubHttp([json(200, structure)])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    const result = await catalogue.definition('Patient')

    expect(result.ok && result.value.complete).toBe(true)
    expect(stub.requests[0]?.url).toBe(`${base}/StructureDefinition/Patient`)
  })

  it('searches for a definition a server does not name that way', async () => {
    const stub = stubHttp([
      json(404, { resourceType: 'OperationOutcome' }),
      json(200, { resourceType: 'Bundle', entry: [{ resource: structure }] })
    ])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    const result = await catalogue.definition('Patient')

    expect(result.ok && result.value.elements).toHaveLength(1)
    expect(stub.requests[1]?.url).toBe(`${base}/StructureDefinition?type=Patient&_count=1`)
  })

  it('says which type it could not describe rather than guessing', async () => {
    const stub = stubHttp([
      json(404, { resourceType: 'OperationOutcome' }),
      json(200, { resourceType: 'Bundle' })
    ])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    const result = await catalogue.definition('Patient')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.type).toBe('Patient')
    expect(result.value.complete).toBe(false)
    expect(result.value.elements).toHaveLength(0)
    expect(catalogue.undescribed()).toEqual(['Patient'])
  })

  it('remembers a definition it already read', async () => {
    const stub = stubHttp([json(200, structure)])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    await catalogue.definition('Patient')
    await catalogue.definition('Patient')

    expect(stub.requests).toHaveLength(1)
  })

  it('keeps searching when a read answered something else', async () => {
    const stub = stubHttp([
      json(200, { resourceType: 'Bundle' }),
      json(200, { resourceType: 'Bundle', entry: [{ resource: structure }] })
    ])
    const catalogue = createCatalogue(createClient({ base, http: stub.http }))

    const result = await catalogue.definition('Patient')

    expect(result.ok && result.value.type).toBe('Patient')
  })
})
