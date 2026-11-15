import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function groupBy<T, K extends string | number>(list: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>
  for (const item of list) (out[key(item)] ??= []).push(item)
  return out
}

export function indexBy<T extends { id: string }>(list: T[] | undefined): Record<string, T> {
  const out: Record<string, T> = {}
  for (const item of list ?? []) out[item.id] = item
  return out
}

export function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : undefined
  } catch {
    return undefined
  }
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
