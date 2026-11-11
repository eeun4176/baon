/*
 * photo.ts — Profile photo helpers.
 *   imageToDataUrl()       shrinks any picture to a 256×256 JPEG (center crop) so it's small
 *                          enough to keep encrypted in the vault and shows offline
 *   useGooglePhotoSync()   when online and signed in with Google, copies the Google photo
 *                          (again if it changed) — unless the student picked or removed one
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

/** Copies the Google profile photo into the encrypted profile (runs once per app open). */
export function useGooglePhotoSync(): void {
  const { vault, profile, saveProfile } = useSession()
  const latest = useRef(profile)
  useEffect(() => {
    latest.current = profile
  }, [profile])

  useEffect(() => {
    if (profile.photoFrom === 'custom' || !navigator.onLine) return
    let cancelled = false
    ;(async () => {
      const { currentUser } = await import('../auth/auth.ts')
      const user = await currentUser()
      // Only the account that owns this vault; skip if the photo is already copied.
      if (cancelled || !user?.image || user.id !== vault.userId) return
      if (user.image === latest.current.googlePhotoUrl && latest.current.photo) return
      const response = await fetch(googlePhotoAtSize(user.image))
      if (!response.ok) return
      const photo = await imageToDataUrl(await response.blob())
      if (!cancelled) await saveProfile({ ...latest.current, photo, photoFrom: 'google', googlePhotoUrl: user.image })
    })().catch(() => {}) // offline, Google unreachable, or an unreadable image: keep the initial
    return () => {
      cancelled = true
    }
  }, [vault, profile.photoFrom, profile.googlePhotoUrl, saveProfile])
}
