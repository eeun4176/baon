/*
 * share.ts — "Share": draws a story-size (9:16) picture of the streak (no amounts, no name) and
 * opens the phone's share sheet, so it can go straight to an Instagram, Facebook or Messenger
 * story. Where sharing files isn't possible (most computers), the picture downloads instead.
 * Drawn on a canvas with the app's own font and colors; nothing leaves the device unless the
 * student picks somewhere to share it. The story frame (storyCanvas, toPng) and sharePicture
 * are reused by History → Share (history/shareSpending.ts).
 */
import flameUrl from '../assets/streak-flame.png'
import logoUrl from '../assets/logo-icon.png'
import { tr } from '../i18n/i18n.ts'

export const W = 1080 // story size (9:16), what Instagram/Facebook/Messenger stories expect
export const H = 1920
const HERO = '#1d1f1e'
const BLUE = '#1e5eff'
const DAYS = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]

/** The text that goes with the picture. */
export function shareCaption(days: number): string {
  if (days <= 0) return tr('Starting my Baon streak today — logging my baon every class day.')
  return tr('{0}-day streak on Baon — logging my baon every class day.', days)
}

/** Loads a bundled image for drawing. */
export function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** A blank story (1080×1920): dark background, a blue glow centered at `glowY`, the Baon logo on top. */
export async function storyCanvas(glowY: number): Promise<{ canvas: HTMLCanvasElement; c: CanvasRenderingContext2D }> {
  await Promise.all([document.fonts.load('900 100px Nunito'), document.fonts.load('800 40px Nunito')]).catch(() => {})
  const logo = await image(logoUrl)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  c.fillStyle = HERO
  c.fillRect(0, 0, W, H)
  // Soft blue glow behind the flame
  const glow = c.createRadialGradient(W / 2, glowY, 0, W / 2, glowY, 620)
  glow.addColorStop(0, 'rgba(30,94,255,0.45)')
  glow.addColorStop(1, 'rgba(30,94,255,0)')
  c.fillStyle = glow
  c.fillRect(0, 0, W, H)
  c.textBaseline = 'alphabetic'
  c.textAlign = 'center'

  // Brand, top (below the story's own top bar)
  c.font = '900 64px Nunito, sans-serif'
  const brand = tr('Baon')
  const bw = 88 + 24 + c.measureText(brand).width
  c.drawImage(logo, W / 2 - bw / 2, 270, 88, 88)
  c.fillStyle = '#fff'
  c.textAlign = 'left'
  c.fillText(brand, W / 2 - bw / 2 + 112, 338)
  c.textAlign = 'center'
  return { canvas, c }
}

/** The finished canvas as a PNG. */
export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(tr('Couldn’t make the picture')))), 'image/png'))
}

/** Draws the streak picture. `week`: this week's Su–Sa, true = logged; `todayIndex` 0–6. */
export async function streakImage(days: number, week: boolean[], todayIndex: number): Promise<Blob> {
  const [{ canvas, c }, flame] = await Promise.all([storyCanvas(760), image(flameUrl)])

  // Flame + number
  c.drawImage(flame, W / 2 - 190, 520, 380, 380)
  c.font = '900 300px Nunito, sans-serif'
  c.fillText(String(days), W / 2, 1200)
  c.fillStyle = 'rgba(255,255,255,0.85)'
  c.font = '800 76px Nunito, sans-serif'
  c.fillText(days === 1 ? tr('day in a row') : tr('days in a row'), W / 2, 1310)

  // This week
  const gap = 134
  const left = W / 2 - gap * 3
  for (let i = 0; i < 7; i++) {
    const x = left + i * gap
    c.fillStyle = 'rgba(255,255,255,0.6)'
    c.font = '800 36px Nunito, sans-serif'
    c.fillText(DAYS[i], x, 1450)
    c.beginPath()
    c.arc(x, 1525, 48, 0, Math.PI * 2)
    c.fillStyle = week[i] ? BLUE : 'rgba(255,255,255,0.14)'
    c.fill()
    if (week[i]) {
      c.strokeStyle = '#fff'
      c.lineWidth = 10
      c.lineCap = c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(x - 19, 1526)
      c.lineTo(x - 6, 1539)
      c.lineTo(x + 20, 1513)
      c.stroke()
    } else if (i === todayIndex) {
      c.strokeStyle = BLUE
      c.lineWidth = 7
      c.beginPath()
      c.arc(x, 1525, 44, 0, Math.PI * 2)
      c.stroke()
    }
  }

  // Tagline, kept above the story's reply bar
  c.fillStyle = 'rgba(255,255,255,0.7)'
  c.font = '800 44px Nunito, sans-serif'
  c.fillText(tr('Logging my baon every class day'), W / 2, 1680)

  return toPng(canvas)
}

/** Shares the streak picture (or downloads it). */
export async function shareStreak(days: number, week: boolean[], todayIndex: number) {
  return sharePicture(await streakImage(days, week, todayIndex), `baon-streak-${days}.png`, shareCaption(days))
}

/** Opens the share sheet with a picture, or downloads it where sharing files isn't possible. 'cancelled' = sheet closed. */
export async function sharePicture(png: Blob, fileName: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([png], fileName, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      throw e
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  return 'downloaded'
}
