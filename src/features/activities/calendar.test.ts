import { describe, expect, it } from 'vitest'
import { packLanes } from './CalendarView'

describe('couloirs du calendrier', () => {
  it('les réservations qui se chevauchent vont dans des couloirs différents', () => {
    const r = packLanes([{ id: 'hotel', start: 0, end: 4 }, { id: 'voiture', start: 1, end: 2 }, { id: 'resto', start: 3, end: 3 }, { id: 'hotel2', start: 5, end: 6 }])
    const lane = Object.fromEntries(r.map((x) => [x.id, x.lane]))
    expect(lane).toEqual({ hotel: 0, voiture: 1, resto: 1, hotel2: 0 })
  })
})
