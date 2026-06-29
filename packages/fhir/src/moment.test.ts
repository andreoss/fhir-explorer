import { describe, expect, it } from 'vitest'
import { momentOf } from './moment'

describe('a value that is a moment in time', () => {
  it('reads a day as a day, with no time of its own', () => {
    const moment = momentOf('1979-12-10')

    expect(moment?.timed).toBe(false)
    expect(moment?.at.toISOString()).toBe('1979-12-10T00:00:00.000Z')
  })

  it('reads a stamp with a time, however many figures the seconds carry', () => {
    expect(momentOf('2026-09-25T06:05:39.151397463Z')?.timed).toBe(true)
    expect(momentOf('2026-09-25T06:05:39Z')?.timed).toBe(true)
    expect(momentOf('2026-09-25T06:05+02:00')?.timed).toBe(true)
  })

  it('leaves alone what only looks like one', () => {
    for (const said of ['29463-7', '1979', '1979-12', 'final', '', 'Patient/1979-12-10']) {
      expect({ said, moment: momentOf(said) }).toEqual({ said, moment: undefined })
    }
  })

  it('leaves alone what is not said at all', () => {
    expect(momentOf(undefined)).toBeUndefined()
    expect(momentOf(3)).toBeUndefined()
  })
})
