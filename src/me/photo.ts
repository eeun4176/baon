/*
 * photo.ts — Profile photo helpers.
 *   imageToDataUrl()       shrinks any picture to a 256×256 JPEG (center crop) so it's small
 *                          enough to keep encrypted in the vault and shows offline
 *   useGooglePhotoSync()   when online and signed in, copies the sign-in email (shown on
 *                          Me → Profile) and the Google photo (again if it changed) — unless
 *                          the student picked or removed a photo
 * Only the photo is downloaded from Google; nothing is ever uploaded.
 */
import { useEffect, useRef } from 'react'
import { useSession } from '../session.ts'

const SIZE = 256

/** Center-crops and shrinks an image to a 256×256 JPEG data URL. Throws if the browser can't read it. */
export async function imageToDataUrl(image: Blob): Promise<string> {
  const bitmap = await createImageBitmap(image)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#e8efff' // behind transparent PNGs
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Asks Google for a 256 px version instead of the default 96 px (".../photo=s96-c"). */
export function googlePhotoAtSize(url: string): string {
  return url.replace(/=s\d+(-c)?$/, `=s${SIZE}-c`)
}

/** Downloads the Google photo as a small JPEG; null if Google is unreachable or the image unreadable. */
async function googlePhoto(url: string): Promise<string | null> {
  try {
    const response = await fetch(googlePhotoAtSize(url))
    return response.ok ? await imageToDataUrl(await response.blob()) : null
  } catch {
    return null
  }
}

/** Copies the sign-in email and the Google photo into the encrypted profile (runs once per app open, online). */
export function useGooglePhotoSync(): void {
  const { vault, profile, saveProfile } = useSession()
  const latest = useRef(profile)
  useEffect(() => {
    latest.current = profile
  }, [profile])

  useEffect(() => {
    if (!navigator.onLine) return
    let cancelled = false
    ;(async () => {
      const { currentUser } = await import('../auth/auth.ts')
      const user = await currentUser()
      if (cancelled || !user || user.id !== vault.userId) return // only the account that owns this vault
      let next = latest.current
      if (user.email && user.email !== next.email) next = { ...next, email: user.email }
      // The photo: unless the student picked or removed one, or it's already copied.
      if (user.image && next.photoFrom !== 'custom' && !(user.image === next.googlePhotoUrl && next.photo)) {
        const photo = await googlePhoto(user.image)
        if (photo) next = { ...next, photo, photoFrom: 'google', googlePhotoUrl: user.image }
      }
      if (!cancelled && next !== latest.current) await saveProfile(next)
    })().catch(() => {}) // offline or not signed in: keep what's saved
    return () => {
      cancelled = true
    }
  }, [vault, profile.photoFrom, profile.googlePhotoUrl, profile.email, saveProfile])
}
