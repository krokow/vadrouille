import { backend } from './backend'
import { urlBase64ToUint8Array, VAPID_PUBLIC_KEY, setNotifyPref } from './notify'

const ACTIVE = 'vadrouille-push-active'
export const pushAvailable = () =>
  backend.mode === 'supabase' && !!VAPID_PUBLIC_KEY && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
export const pushActiveHere = () => {
  try { return localStorage.getItem(ACTIVE) === '1' } catch { return false }
}

/** Demande l'autorisation et, si le Web Push est configuré, abonne cet appareil */
export async function enableNotifications(userId: string): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  setNotifyPref(true)
  if (pushAvailable()) {
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }))
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    await backend.remove('push_subscriptions', { endpoint: json.endpoint }).catch(() => undefined)
    await backend.insert('push_subscriptions', { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200) })
    localStorage.setItem(ACTIVE, '1')
  }
  return 'granted'
}

export async function disableNotifications() {
  setNotifyPref(false)
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      await backend.remove('push_subscriptions', { endpoint: sub.endpoint }).catch(() => undefined)
      await sub.unsubscribe()
    }
  } finally {
    localStorage.removeItem(ACTIVE)
  }
}
