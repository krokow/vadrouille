import { format } from 'date-fns'

/** ISO (UTC) → valeur pour <input type="datetime-local"> dans le fuseau du navigateur */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : format(d, "yyyy-MM-dd'T'HH:mm")
}

export function fromLocalInput(v: string | null | undefined): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
