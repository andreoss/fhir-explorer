const PLACES = [
  { city: 'London', postal: 'NW1 4AB' },
  { city: 'Manchester', postal: 'M14 5SZ' },
  { city: 'Leeds', postal: 'LS2 9JT' },
  { city: 'Bristol', postal: 'BS8 1TH' },
  { city: 'Glasgow', postal: 'G12 8QQ' },
  { city: 'Cardiff', postal: 'CF14 4XW' },
  { city: 'Belfast', postal: 'BT9 7AB' },
  { city: 'Sheffield', postal: 'S10 2JF' },
  { city: 'Liverpool', postal: 'L7 8XP' },
  { city: 'Newcastle', postal: 'NE1 4LP' },
  { city: 'Nottingham', postal: 'NG7 2UH' },
  { city: 'Southampton', postal: 'SO16 6YD' },
  { city: 'Oxford', postal: 'OX3 9DU' },
  { city: 'Cambridge', postal: 'CB2 0QQ' },
  { city: 'York', postal: 'YO31 8HE' },
  { city: 'Bath', postal: 'BA1 3NG' }
]

const KINDS = ['Medical Centre', 'Surgery', 'Health Centre', 'Community Clinic', 'Family Practice']

const WOMEN = [
  'Amara', 'Beatriz', 'Chiara', 'Dilnoza', 'Eleni', 'Fatima', 'Grete', 'Hannah', 'Imani', 'Juno',
  'Kavya', 'Lucia', 'Mariam', 'Nadia', 'Olena', 'Priya', 'Rania', 'Saoirse', 'Thandi', 'Yuki'
]

const MEN = [
  'Adem', 'Bruno', 'Caleb', 'Dmitri', 'Eitan', 'Farid', 'Gustav', 'Hamza', 'Ibrahim', 'Jonas',
  'Kwame', 'Lars', 'Mateo', 'Nikolai', 'Omar', 'Pavel', 'Rashid', 'Samuel', 'Tomas', 'Viktor'
]

const FAMILIES = [
  'Abara', 'Baptiste', 'Chen', 'Dlamini', 'Eriksson', 'Ferreira', 'Gagnon', 'Haddad',
  'Ivanova', 'Jansen', 'Kowalski', 'Lindqvist', 'Mwangi', 'Nakamura', 'Oyelaran', 'Petrov',
  'Quraishi', 'Rossi', 'Silva', 'Tanaka', 'Ueda', 'Varga', 'Wójcik', 'Xu', 'Yilmaz', 'Zhang'
]

const SPECIALTIES = [
  { code: '419772000', display: 'General practice' },
  { code: '408443003', display: 'General medical practice' },
  { code: '394814009', display: 'General practice (specialty)' },
  { code: '394580004', display: 'Clinical genetics' },
  { code: '394821009', display: 'Paediatrics' }
]

const MEASURES = [
  { code: '29463-7', display: 'Body weight', unit: 'kg', low: 52, span: 45, decimals: 1 },
  { code: '8302-2', display: 'Body height', unit: 'cm', low: 152, span: 44, decimals: 0 },
  { code: '8480-6', display: 'Systolic blood pressure', unit: 'mm[Hg]', low: 104, span: 46, decimals: 0 },
  { code: '8462-4', display: 'Diastolic blood pressure', unit: 'mm[Hg]', low: 64, span: 28, decimals: 0 },
  { code: '8867-4', display: 'Heart rate', unit: '/min', low: 54, span: 42, decimals: 0 },
  { code: '2708-6', display: 'Oxygen saturation', unit: '%', low: 94, span: 6, decimals: 0 }
]

const CONDITIONS = [
  { code: '38341003', display: 'Hypertension' },
  { code: '73211009', display: 'Diabetes mellitus' },
  { code: '195967001', display: 'Asthma' },
  { code: '13644009', display: 'Hypercholesterolaemia' },
  { code: '396275006', display: 'Osteoarthritis' }
]

function pick(held, at) {
  return held[at % held.length]
}

function figure(measure, at) {
  const raw = measure.low + ((at * 7 + measure.code.length * 11) % measure.span)

  return measure.decimals === 0 ? raw : Math.round(raw * 10) / 10
}

function born(at) {
  const year = 1938 + (at % 68)
  const month = String((at % 12) + 1).padStart(2, '0')
  const day = String((at % 27) + 1).padStart(2, '0')

  return `${String(year)}-${month}-${day}`
}

function sitesFor(many) {
  return Array.from({ length: many }, (unused, at) => {
    const place = pick(PLACES, at)

    return {
      resourceType: 'Organization',
      active: true,
      name: `${place.city} ${pick(KINDS, Math.floor(at / PLACES.length))}`,
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: 'prov',
              display: 'Healthcare Provider'
            }
          ]
        }
      ],
      telecom: [
        { system: 'phone', value: `+44 20 7946 ${String(1000 + at).slice(-4)}` },
        { system: 'email', value: `reception.${String(at + 1)}@example.org` }
      ],
      address: [{ line: [`${String((at % 80) + 1)} Bridge Street`], city: place.city, postalCode: place.postal, country: 'GB' }]
    }
  })
}

function doctorsFor(many) {
  return Array.from({ length: many }, (unused, at) => {
    const woman = at % 2 === 0
    const given = woman ? pick(WOMEN, at) : pick(MEN, at)

    return {
      resourceType: 'Practitioner',
      active: true,
      name: [{ family: pick(FAMILIES, at + 5), given: [given], prefix: ['Dr'] }],
      gender: woman ? 'female' : 'male',
      telecom: [{ system: 'email', value: `${given.toLowerCase()}.${pick(FAMILIES, at + 5).toLowerCase()}@example.org` }],
      qualification: [
        {
          code: {
            coding: [{ system: 'http://snomed.info/sct', ...pick(SPECIALTIES, at) }]
          }
        }
      ]
    }
  })
}

function peopleFor(many, sites, siteNames, doctors, doctorNames) {
  return Array.from({ length: many }, (unused, at) => {
    const woman = at % 2 === 0
    const turn = at + Math.floor(at / 7)
    const given = woman ? pick(WOMEN, turn) : pick(MEN, turn)
    const family = pick(FAMILIES, at)
    const place = pick(PLACES, at + 3)

    return {
      resourceType: 'Patient',
      active: at % 23 !== 0,
      name: [{ use: 'official', family, given: [given] }],
      gender: woman ? 'female' : 'male',
      birthDate: born(at),
      telecom: [
        { system: 'phone', value: `+44 7700 ${String(900000 + at).slice(-6)}`, use: 'mobile' },
        { system: 'email', value: `${given.toLowerCase()}.${family.toLowerCase()}@example.org` }
      ],
      address: [
        { line: [`${String((at % 120) + 1)} Elm Road`], city: place.city, postalCode: place.postal, country: 'GB' }
      ],
      managingOrganization: { reference: pick(sites, at), display: pick(siteNames, at) },
      generalPractitioner: [{ reference: pick(doctors, at), display: pick(doctorNames, at) }]
    }
  })
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

function saidOf(resource) {
  if (resource.resourceType === 'Organization') {
    return resource.name
  }

  const name = resource.name?.[0]

  return `${(name?.prefix ?? []).join(' ')} ${(name?.given ?? []).join(' ')} ${String(name?.family)}`.trim()
}

export async function populate(base, token, said = () => undefined) {
  const sites = Number(process.env.EXPLORER_SITES ?? '200')
  const patients = Number(process.env.EXPLORER_PATIENTS ?? '2000')
  const doctors = Number(process.env.EXPLORER_DOCTORS ?? '60')
  const at = Number(process.env.EXPLORER_AT_ONCE ?? '24')

  const plannedSites = sitesFor(sites)
  const plannedDoctors = doctorsFor(doctors)

  said(`making ${String(sites)} sites`)
  const madeSites = await all(base, token, plannedSites, at)

  said(`making ${String(doctors)} practitioners`)
  const madeDoctors = await all(base, token, plannedDoctors, at)

  const siteNames = plannedSites.map(saidOf)
  const doctorNames = plannedDoctors.map(saidOf)

  said(`making ${String(patients)} patients`)
  const plannedPeople = peopleFor(patients, madeSites, siteNames, madeDoctors, doctorNames)
  const madePeople = await all(base, token, plannedPeople, at)

  const seen = madePeople.flatMap((person, one) => (one % 4 === 0 ? [{ person, one }] : []))

  said(`making ${String(seen.length)} encounters`)
  const madeVisits = await all(
    base,
    token,
    seen.map(({ person, one }) => ({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
      type: [
        {
          coding: [{ system: 'http://snomed.info/sct', code: '162673000', display: 'General examination of patient' }]
        }
      ],
      subject: { reference: person, display: saidOf(plannedPeople[one]) },
      serviceProvider: { reference: pick(madeSites, one), display: pick(siteNames, one) },
      participant: [{ individual: { reference: pick(madeDoctors, one), display: pick(doctorNames, one) } }],
      period: {
        start: `2026-0${String((one % 9) + 1)}-12T09:00:00Z`,
        end: `2026-0${String((one % 9) + 1)}-12T09:25:00Z`
      }
    })),
    at
  )

  const visitSaid = seen.map(({ one }) => `General examination, 12 Jul 2026, visit ${String(one + 1)}`)

  const readings = seen.flatMap(({ person, one }, which) =>
    MEASURES.map((measure, index) => ({
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
      code: { coding: [{ system: 'http://loinc.org', code: measure.code, display: measure.display }], text: measure.display },
      subject: { reference: person, display: saidOf(plannedPeople[one]) },
      encounter: { reference: madeVisits[which], display: visitSaid[which] },
      performer: [{ reference: pick(madeDoctors, one), display: pick(doctorNames, one) }],
      effectiveDateTime: `2026-0${String((one % 9) + 1)}-12T09:1${String(index)}:00Z`,
      valueQuantity: {
        value: figure(measure, one + index),
        unit: measure.unit,
        system: 'http://unitsofmeasure.org',
        code: measure.unit
      }
    }))
  )

  said(`making ${String(readings.length)} observations`)
  await all(base, token, readings, at)

  const diagnoses = seen.flatMap(({ person, one }, which) =>
    one % 3 === 0
      ? [
          {
            resourceType: 'Condition',
            clinicalStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                  code: 'active',
                  display: 'Active'
                }
              ]
            },
            verificationStatus: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                  code: 'confirmed',
                  display: 'Confirmed'
                }
              ]
            },
            code: { coding: [{ system: 'http://snomed.info/sct', ...pick(CONDITIONS, one) }], text: pick(CONDITIONS, one).display },
            subject: { reference: person, display: saidOf(plannedPeople[one]) },
            encounter: { reference: madeVisits[which], display: visitSaid[which] },
            recordedDate: `2026-0${String((one % 9) + 1)}-12`
          }
        ]
      : []
  )

  said(`making ${String(diagnoses.length)} conditions`)
  await all(base, token, diagnoses, at)

  return {
    sites: madeSites.length,
    doctors: madeDoctors.length,
    patients: madePeople.length,
    encounters: madeVisits.length,
    observations: readings.length,
    conditions: diagnoses.length
  }
}
