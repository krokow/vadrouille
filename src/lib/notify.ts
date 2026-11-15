/** Notifications système (via le service worker quand il est actif) */
export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window

const PREF = 'vadrouille-notify'
export const notifyEnabled = () => {
  try {
    return notifySupported() && Notification.permission === 'granted' && localStorage.getItem(PREF) !== 'off'
  } catch {
    return false
  }
}
export function setNotifyPref(on: boolean) {
  try { localStorage.setItem(PREF, on ? 'on' : 'off') } catch { /* ignore */ }
}

export async function showSystemNotification(title: string, body: string, opts: { url?: string; tag?: string } = {}) {
  if (!notifyEnabled()) return false
  const options: NotificationOptions = {
    body, tag: opts.tag, icon: `${import.meta.env.BASE_URL}pwa-192.png`, badge: `${import.meta.env.BASE_URL}pwa-192.png`,
    data: { url: opts.url ?? import.meta.env.BASE_URL },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, options)
    else new Notification(title, options)
    return true
  } catch {
    return false
  }
}

/** Convertit une clé VAPID publique (base64url) pour pushManager.subscribe */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || ''

const ENTITY: Record<string, string> = {
  activities: 'l’activité', bookings: 'la réservation', expenses: 'la dépense', trip_members: 'le participant', settlements: 'un remboursement',
  comments: 'un commentaire', places: 'le lieu', checklist_items: 'un préparatif', journal_entries: 'une note du journal', options: 'l’option', budgets: 'le budget',
}
const VERB = { insert: 'a ajouté', update: 'a modifié', delete: 'a supprimé' } as const

/** « Camille a ajouté la dépense « Taxi » » */
export function describeChange(actor: string, action: 'insert' | 'update' | 'delete', entity: string, title?: string): string {
  return `${actor} ${VERB[action]} ${ENTITY[entity] ?? 'un élément'}${title ? ` « ${title} »` : ''}`
}
