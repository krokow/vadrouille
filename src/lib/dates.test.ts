import { describe, expect, it } from 'vitest'
import { compareByUrgency, countdownLabel, deadlineLabel, deadlineUrgency, shiftDay, tripDays, tripPhase } from './dates'
import { fmtDay, fmtDateRange, fmtMoney, fmtTime } from './format'

const today = new Date(2025, 4, 10) // 10 mai 2025

describe('phases du voyage', () => {
  it('à venir, en cours, passé, sans date', () => {
    expect(tripPhase('2025-05-12', '2025-05-20', today)).toBe('upcoming')
    expect(tripPhase('2025-05-08', '2025-05-12', today)).toBe('ongoing')
    expect(tripPhase('2025-05-10', null, today)).toBe('ongoing')
    expect(tripPhase('2025-04-01', '2025-04-05', today)).toBe('past')
    expect(tripPhase(null, null, today)).toBe('undated')
  })
  it('compte à rebours', () => {
    expect(countdownLabel('2025-05-12', '2025-05-20', today)).toBe('J-2')
    expect(countdownLabel('2025-05-11', '2025-05-20', today)).toBe('Demain !')
    expect(countdownLabel('2025-05-08', '2025-05-12', today)).toBe('Jour 3 / 5')
    expect(countdownLabel('2025-04-01', '2025-04-05', today)).toBe('Terminé')
  })
  it('liste des jours', () => {
    expect(tripDays('2025-05-30', '2025-06-02')).toEqual(['2025-05-30', '2025-05-31', '2025-06-01', '2025-06-02'])
    expect(tripDays(null, null)).toEqual([])
    expect(tripDays('2025-05-30', '2025-05-01')).toEqual(['2025-05-30'])
  })
  it('décalage de date (duplication de voyage)', () => {
    expect(shiftDay('2025-02-27', 3)).toBe('2025-03-02')
    expect(shiftDay(null, 3)).toBeNull()
  })
})

describe('urgence des deadlines', () => {
  it('classe les dates limites', () => {
    expect(deadlineUrgency('2025-05-09', today)).toBe('overdue')
    expect(deadlineUrgency('2025-05-10', today)).toBe('soon')
    expect(deadlineUrgency('2025-05-17', today)).toBe('soon')
    expect(deadlineUrgency('2025-05-18', today)).toBe('later')
    expect(deadlineUrgency(null, today)).toBe('none')
  })
  it('libellés', () => {
    expect(deadlineLabel('2025-05-10', today)).toBe("Aujourd'hui !")
    expect(deadlineLabel('2025-05-11', today)).toBe('Demain')
    expect(deadlineLabel('2025-05-09', today)).toBe('Dépassée depuis hier')
    expect(deadlineLabel('2025-05-05', today)).toBe('Dépassée de 5 jours')
    expect(deadlineLabel('2025-05-20', today)).toBe('Dans 10 jours')
  })
  it('tri : dépassées, puis proches, puis lointaines, puis sans date', () => {
    const list = [null, '2025-06-30', '2025-05-12', '2025-05-01', '2025-05-11']
    expect([...list].sort((a, b) => compareByUrgency(a, b, today))).toEqual([
      '2025-05-01', '2025-05-11', '2025-05-12', '2025-06-30', null,
    ])
  })
})

describe('formats français', () => {
  it('dates', () => {
    expect(fmtDay('2025-05-12')).toBe('lun. 12 mai')
    expect(fmtDateRange('2025-05-12', '2025-05-20')).toBe('12 – 20 mai 2025')
    expect(fmtDateRange(null, null)).toBe('Dates à définir')
    expect(fmtTime('09:05:00')).toBe('9h05')
  })
  it('montants', () => {
    expect(fmtMoney(1234.5, 'EUR').replace(/\s/g, ' ')).toBe('1 234,50 €')
  })
})
