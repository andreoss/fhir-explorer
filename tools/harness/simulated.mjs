const PEOPLE = [
  { key: 'ada', family: 'Lovelace', given: 'Ada', gender: 'female', birthDate: '1979-12-10', city: 'London' },
  { key: 'grace', family: 'Hopper', given: 'Grace', gender: 'female', birthDate: '1966-12-09', city: 'New York' },
  { key: 'alan', family: 'Turing', given: 'Alan', gender: 'male', birthDate: '1982-06-23', city: 'Wilmslow' },
  { key: 'katherine', family: 'Johnson', given: 'Katherine', gender: 'female', birthDate: '1958-08-26', city: 'Hampton' },
  { key: 'edsger', family: 'Dijkstra', given: 'Edsger', gender: 'male', birthDate: '1970-05-11', city: 'Rotterdam' }
]

const MEASURES = [
  { code: '29463-7', display: 'Body weight', unit: 'kg', low: 54, span: 42 },
  { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]', low: 104, span: 44 },
  { code: '8867-4', display: 'Heart rate', unit: '/min', low: 56, span: 38 }
]

const CONDITIONS = [
  { code: '38341003', display: 'Hypertension' },
  { code: '73211009', display: 'Diabetes mellitus' },
  { code: '195967001', display: 'Asthma' }
]

export function planned() {
  const steps = [
    {
      key: 'clinic',
      make: () => ({
        resourceType: 'Organization',
        name: 'A teaching clinic',
        telecom: [{ system: 'phone', value: '+44 20 7946 0000' }],
        address: [{ city: 'London', country: 'GB' }]
      })
    },
    {
      key: 'reed',
      make: () => ({
        resourceType: 'Practitioner',
        name: [{ family: 'Reed', given: ['Nell'], prefix: ['Dr'] }],
        gender: 'female'
      })
    },
    {
      key: 'okafor',
      make: () => ({
        resourceType: 'Practitioner',
        name: [{ family: 'Okafor', given: ['Chidi'], prefix: ['Dr'] }],
        gender: 'male'
      })
    }
  ]

  PEOPLE.forEach((person, index) => {
    const doctor = index % 2 === 0 ? 'reed' : 'okafor'
    const month = `0${String((index % 9) + 1)}`

    steps.push({
      key: person.key,
      make: (at) => ({
        resourceType: 'Patient',
        active: true,
        name: [{ family: person.family, given: [person.given] }],
        gender: person.gender,
        birthDate: person.birthDate,
        address: [{ city: person.city, country: 'GB' }],
        telecom: [{ system: 'email', value: `${person.key}@example.org` }],
        managingOrganization: { reference: at('clinic'), display: 'A teaching clinic' },
        generalPractitioner: [{ reference: at(doctor) }]
      })
    })

    steps.push({
      key: `visit-${person.key}`,
      make: (at) => ({
        resourceType: 'Encounter',
        status: 'finished',
        class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
        subject: { reference: at(person.key), display: `${person.given} ${person.family}` },
        participant: [{ individual: { reference: at(doctor) } }],
        serviceProvider: { reference: at('clinic') },
        period: { start: `2026-${month}-12T09:00:00Z`, end: `2026-${month}-12T09:40:00Z` }
      })
    })

    MEASURES.forEach((measure, at) => {
      steps.push({
        key: `${measure.code}-${person.key}`,
        make: (found) => ({
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital signs'
                }
              ]
            }
          ],
          code: { coding: [{ system: 'http://loinc.org', code: measure.code, display: measure.display }] },
          subject: { reference: found(person.key), display: `${person.given} ${person.family}` },
          encounter: { reference: found(`visit-${person.key}`) },
          performer: [{ reference: found(doctor) }],
          effectiveDateTime: `2026-${month}-12T09:1${String(at)}:00Z`,
          valueQuantity: {
            value: measure.low + ((index * 7 + at * 11) % measure.span),
            unit: measure.unit,
            system: 'http://unitsofmeasure.org',
            code: measure.unit
          }
        })
      })
    })

    const condition = CONDITIONS[index % CONDITIONS.length]

    steps.push({
      key: `condition-${person.key}`,
      make: (at) => ({
        resourceType: 'Condition',
        clinicalStatus: {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active', display: 'Active' }
          ]
        },
        code: { coding: [{ system: 'http://snomed.info/sct', code: condition.code, display: condition.display }] },
        subject: { reference: at(person.key), display: `${person.given} ${person.family}` },
        encounter: { reference: at(`visit-${person.key}`) },
        recordedDate: `2026-${month}-12`
      })
    })
  })

  return steps
}

export async function seed(base, token) {
  const made = new Map()
  const at = (key) => {
    const held = made.get(key)

    if (held === undefined) {
      throw new Error(`nothing was made for ${key}`)
    }

    return held
  }

  for (const step of planned()) {
    const resource = step.make(at)
    const answer = await fetch(`${base}/${resource.resourceType}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/fhir+json',
        accept: 'application/fhir+json',
        authorization: `Bearer ${token}`,
        connection: 'close'
      },
      body: JSON.stringify(resource),
      signal: AbortSignal.timeout(15_000)
    })

    if (!answer.ok) {
      throw new Error(`${resource.resourceType} was refused with ${String(answer.status)}`)
    }

    const held = await answer.json()

    made.set(step.key, `${held.resourceType}/${held.id}`)
  }

  return made
}
