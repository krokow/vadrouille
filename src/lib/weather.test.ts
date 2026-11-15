import { describe, expect, it } from 'vitest'
import { relativeDayLabel, upcomingDays, type Forecast } from './weather'

describe('météo', () => {
  it('libellés relatifs à la date locale de la destination', () => {
    expect(relativeDayLabel('2026-11-15', '2026-11-15')).toBe("Aujourd'hui")
    expect(relativeDayLabel('2026-11-16', '2026-11-15')).toBe('Demain')
    expect(relativeDayLabel('2026-12-01', '2026-11-30')).toBe('Demain')
    expect(relativeDayLabel('2026-11-17', '2026-11-15')).toBeNull()
  })
  it('écarte les jours passés (cache de la veille)', () => {
    const f = { localToday: '2026-11-15', days: [{ date: '2026-11-14' }, { date: '2026-11-15' }, { date: '2026-11-16' }] } as Forecast
    expect(upcomingDays(f).map((d) => d.date)).toEqual(['2026-11-15', '2026-11-16'])
  })
})
