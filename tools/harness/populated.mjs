const CITIES = [
  'London', 'Manchester', 'Leeds', 'Bristol', 'Glasgow', 'Cardiff', 'Belfast', 'Sheffield',
  'Liverpool', 'Newcastle', 'Nottingham', 'Southampton', 'Oxford', 'Cambridge', 'York', 'Bath'
]

const KINDS = ['Clinic', 'Surgery', 'Health Centre', 'Hospital', 'Practice', 'Infirmary']

const FAMILIES = [
  'Abara', 'Baptiste', 'Chen', 'Dlamini', 'Eriksson', 'Ferreira', 'Gagnon', 'Haddad',
  'Ivanova', 'Jansen', 'Kowalski', 'Lindqvist', 'Mwangi', 'Nakamura', 'Oyelaran', 'Petrov',
  'Quraishi', 'Rossi', 'Silva', 'Tanaka', 'Ueda', 'Varga', 'Wójcik', 'Xu', 'Yilmaz', 'Zhang'
]

const GIVEN = [
  'Aiko', 'Bruno', 'Cora', 'Dario', 'Elif', 'Farid', 'Greta', 'Hugo', 'Ines', 'Jonas',
  'Kaisa', 'Liam', 'Mira', 'Noor', 'Otto', 'Priya', 'Quinn', 'Rosa', 'Sven', 'Tomas'
]

const MEASURES = [
  { code: '29463-7', display: 'Body weight', unit: 'kg', low: 48, span: 52 },
  { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]', low: 98, span: 58 },
  { code: '8867-4', display: 'Heart rate', unit: '/min', low: 52, span: 46 }
]

function pick(held, at) {
  return held[at % held.length]
}

function sitesFor(many) {
  return Array.from({ length: many }, (unused, at) => ({
    resourceType: 'Organization',
    active: true,
    name: `${pick(CITIES, at)} ${pick(KINDS, Math.floor(at / CITIES.length))} ${String(at + 1)}`,
    telecom: [{ system: 'phone', value: `+44 20 7946 ${String(1000 + at).slice(-4)}` }],
    address: [{ city: pick(CITIES, at), country: 'GB' }]
  }))
}

function peopleFor(many, sites, doctors) {
  return Array.from({ length: many }, (unused, at) => ({
    resourceType: 'Patient',
    active: at % 17 !== 0,
    name: [{ family: pick(FAMILIES, at), given: [pick(GIVEN, Math.floor(at / 7))] }],
    gender: at % 2 === 0 ? 'female' : 'male',
    birthDate: `19${String(40 + (at % 60)).padStart(2, '0')}-${String((at % 12) + 1).padStart(2, '0')}-${String((at % 28) + 1).padStart(2, '0')}`,
    address: [{ city: pick(CITIES, at + 3), country: 'GB' }],
    managingOrganization: { reference: pick(sites, at), display: undefined },
    generalPractitioner: [{ reference: pick(doctors, at) }]
  }))
}

async function post(base, token, resource) {
  const answer = await fetch(`${base}/${resource.resourceType}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/fhir+json',
      accept: 'application/fhir+json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(resource),
    signal: AbortSignal.timeout(30_000)
  })

  if (!answer.ok) {
    throw new Error(`${resource.resourceType} was refused with ${String(answer.status)}`)
  }

  const held = await answer.json()

  return `${held.resourceType}/${held.id}`
}

async function all(base, token, resources, at) {
  const made = new Array(resources.length)
  let next = 0

  async function worker() {
    for (;;) {
      const mine = next
      next += 1

      if (mine >= resources.length) {
        return
      }

      made[mine] = await post(base, token, resources[mine])
    }
  }

  await Promise.all(Array.from({ length: Math.min(at, resources.length) }, worker))

  return made
}

export async function populate(base, token, said = () => undefined) {
  const sites = Number(process.env.EXPLORER_SITES ?? '200')
  const patients = Number(process.env.EXPLORER_PATIENTS ?? '2000')
  const doctors = Number(process.env.EXPLORER_DOCTORS ?? '60')
  const at = Number(process.env.EXPLORER_AT_ONCE ?? '24')

  said(`making ${String(sites)} sites`)
  const madeSites = await all(base, token, sitesFor(sites), at)

  said(`making ${String(doctors)} practitioners`)
  const madeDoctors = await all(
    base,
    token,
    Array.from({ length: doctors }, (unused, one) => ({
      resourceType: 'Practitioner',
      active: true,
      name: [{ family: pick(FAMILIES, one + 5), given: [pick(GIVEN, one + 2)], prefix: ['Dr'] }],
      gender: one % 2 === 0 ? 'male' : 'female'
    })),
    at
  )

  said(`making ${String(patients)} patients`)
  const madePeople = await all(base, token, peopleFor(patients, madeSites, madeDoctors), at)

  const visited = madePeople.filter((unused, one) => one % 10 === 0)

  said(`making ${String(visited.length)} encounters`)
  const madeVisits = await all(
    base,
    token,
    visited.map((person, one) => ({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
      subject: { reference: person },
      serviceProvider: { reference: pick(madeSites, one) },
      period: { start: `2026-0${String((one % 9) + 1)}-12T09:00:00Z` }
    })),
    at
  )

  const readings = visited.flatMap((person, one) =>
    MEASURES.map((measure, which) => ({
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
      subject: { reference: person },
      encounter: { reference: madeVisits[one] },
      effectiveDateTime: `2026-0${String((one % 9) + 1)}-12T09:1${String(which)}:00Z`,
      valueQuantity: {
        value: measure.low + ((one * 7 + which * 11) % measure.span),
        unit: measure.unit,
        system: 'http://unitsofmeasure.org',
        code: measure.unit
      }
    }))
  )

  said(`making ${String(readings.length)} observations`)
  await all(base, token, readings, at)

  return {
    sites: madeSites.length,
    doctors: madeDoctors.length,
    patients: madePeople.length,
    encounters: madeVisits.length,
    observations: readings.length
  }
}
