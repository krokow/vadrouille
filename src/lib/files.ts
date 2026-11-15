import { useQuery } from '@tanstack/react-query'
import { backend, type Bucket } from './backend'
import { uid } from './ids'

/** URL d'un fichier (signée 1 h pour le bucket privé), mise en cache 50 min */
export function useFileUrl(path: string | null | undefined, bucket: Bucket = 'trip-files') {
  return useQuery({
    queryKey: ['file', bucket, path],
    queryFn: () => backend.fileUrl(bucket, path!),
    enabled: !!path && !/^(https?:|data:)/.test(path),
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    // les URLs signées expirent : on ne les persiste pas hors ligne de façon fiable
    meta: { persist: false },
  })
}

export function resolvedUrl(path: string | null | undefined, signed: string | undefined): string | undefined {
  if (!path) return undefined
  if (/^(https?:|data:)/.test(path)) return path
  return signed
}

const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-80)

export async function uploadTripFile(tripId: string, file: File, folder = 'files'): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Fichier trop lourd (10 Mo maximum)')
  const path = `${tripId}/${folder}/${uid()}-${safeName(file.name)}`
  await backend.upload('trip-files', path, file)
  return path
}

/** Réduit une image (couverture, avatar, photo) avant envoi : économise le quota Storage gratuit */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}
