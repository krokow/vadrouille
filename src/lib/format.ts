import { format, formatDistanceToNowStrict, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'

export const LOCALE = 'fr-FR'

export function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null
  if (d instanceof Date) return d
  // "2025-05-12" doit être interprété en date locale, pas en UTC
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseISO(d) : new Date(d)
  return isValid(parsed) ? parsed : null
}

/** « lun. 12 mai » */
export function fmtDay(d: string | Date | null | undefined): string {
  const date = toDate(d)
  return date ? format(date, 'EEE d MMM', { locale: fr }) : ''
}

/** « lundi 12 mai » */
export function fmtDayLong(d: string | Date | null | undefined): string {
  const date = toDate(d)
  return date ? format(date, 'EEEE d MMMM', { locale: fr }) : ''
}

export function fmtDateRange(start: string | null, end: string | null): string {
  if (!start) return 'Dates à définir'
  const s = toDate(start)!
  const e = toDate(end)
  if (!e || start === end) return format(s, 'd MMM yyyy', { locale: fr })
  const sameYear = s.getFullYear() === e.getFullYear()
  const sameMonth = sameYear && s.getMonth() === e.getMonth()
  if (sameMonth) return `${format(s, 'd', { locale: fr })} – ${format(e, 'd MMM yyyy', { locale: fr })}`
  if (sameYear) return `${format(s, 'd MMM', { locale: fr })} – ${format(e, 'd MMM yyyy', { locale: fr })}`
  return `${format(s, 'd MMM yyyy', { locale: fr })} – ${format(e, 'd MMM yyyy', { locale: fr })}`
}

export function fmtTime(t: string | null | undefined): string {
  if (!t) return ''
  // "14:30:00" -> "14h30"
  const m = /^(\d{2}):(\d{2})/.exec(t)
  if (m) return `${Number(m[1])}h${m[2]}`
  const d = toDate(t)
  return d ? format(d, "H'h'mm") : ''
}

export function fmtDateTime(iso: string | null | undefined): string {
  const d = toDate(iso)
  return d ? format(d, "EEE d MMM 'à' H'h'mm", { locale: fr }) : ''
}

export function fmtAgo(iso: string | null | undefined): string {
  const d = toDate(iso)
  if (!d) return ''
  const diff = Date.now() - d.getTime()
  if (diff < 45_000) return "à l'instant"
  return `il y a ${formatDistanceToNowStrict(d, { locale: fr })}`
}

const moneyCache = new Map<string, Intl.NumberFormat>()
export function fmtMoney(amount: number | null | undefined, currency = 'EUR', opts?: { compact?: boolean }): string {
  if (amount == null || Number.isNaN(amount)) return '—'
  const key = `${currency}-${opts?.compact ? 'c' : ''}`
  let f = moneyCache.get(key)
  if (!f) {
    try {
      f = new Intl.NumberFormat(LOCALE, {
        style: 'currency', currency,
        maximumFractionDigits: opts?.compact ? 0 : 2,
        minimumFractionDigits: opts?.compact ? 0 : undefined,
      })
    } catch {
      f = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })
    }
    moneyCache.set(key, f)
  }
  return f.format(amount)
}

/** Date ISO "yyyy-MM-dd" locale */
export function isoDay(d: Date = new Date()): string {
  return format(d, 'yyyy-MM-dd')
}
