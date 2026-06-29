import { describe, expect, it } from 'vitest'
import { capabilityOf } from '@lib/conformance'
import { askingFor, questionsFor } from './inbound'

const capability = capabilityOf({
  resourceType: 'CapabilityStatement',
  rest: [
    {
      mode: 'server',
      resource: [
        {
          type: 'Observation',
          interaction: [{ code: 'search-type' }],
          searchParam: [
            { name: 'subject', type: 'reference' },
            { name: 'code', type: 'token' }
          ]
        },
        {
          type: 'Encounter',
          interaction: [{ code: 'read' }],
          searchParam: [{ name: 'patient', type: 'reference' }]
        }
      ]
    }
  ]
})

describe('asking what points here', () => {
  it('asks only through parameters that carry a reference', () => {
    expect(questionsFor(capability, 'Patient/p1')).toEqual([{ type: 'Observation', parameter: 'subject' }])
  })

  it('asks only of types the server will search', () => {
    expect(questionsFor(capability, 'Patient/p1').map((question) => question.type)).not.toContain('Encounter')
  })

  it('asks nothing of a server that declares nothing', () => {
    expect(questionsFor({ types: [] }, 'Patient/p1')).toHaveLength(0)
  })
})

describe('who could point here', () => {
  it('names each type that can be searched by a reference, with its parameters', () => {
    expect(askingFor(capability)).toEqual([{ type: 'Observation', parameters: ['subject'] }])
  })

  it('names nobody where nothing can be searched that way', () => {
    expect(askingFor({ types: [] })).toHaveLength(0)
  })
})
