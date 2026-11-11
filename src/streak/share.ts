/*
 * share.ts — "Share": draws a square picture of the streak (no amounts, no name) and opens the
 * phone's share sheet (Messenger, Instagram story…). Where sharing files isn't possible (most
 * computers), the picture downloads instead. Drawn on a canvas with the app's own font and
 * colors; nothing leaves the device unless the student picks somewhere to share it.
 */
import flameUrl from '../assets/streak-flame.png'
import logoUrl from '../assets/logo-icon.png'
import { tr } from '../i18n/i18n.ts'

const SIZE = 1080
const HERO = '#1d1f1e'
const BLUE = '#1e5eff'
const DAYS = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]

/** The text that goes with the picture. */
export function shareCaption(days: number): string {
  if (days <= 0) return tr('Starting my Baon streak today — logging my baon every class day.')
  return tr('{0}-day streak on Baon — logging my baon every class day.', days)
}

/** Loads a bundled image for drawing. */
function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Draws the picture. `week`: this week's Su–Sa, true = logged; `todayIndex` 0–6. */
export async function streakImage(days: number, week: boolean[], todayIndex: number): Promise<Blob> {
  await Promise.all([document.fonts.load('900 100px Nunito'), document.fonts.load('800 40px Nunito')]).catch(() => {})
  const [flame, logo] = await Promise.all([image(flameUrl), image(logoUrl)])
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const c = canvas.getContext('2d')!
  c.fillStyle = HERO
  c.fillRect(0, 0, SIZE, SIZE)
  c.textBaseline = 'alphabetic'

  // Brand, top left
  c.drawImage(logo, 80, 80, 88, 88)
  c.fillStyle = '#fff'
  c.font = '900 64px Nunito, sans-serif'
  c.fillText(tr('Baon'), 192, 148)

  // Flame + number
  c.drawImage(flame, SIZE / 2 - 120, 230, 240, 240)
  c.textAlign = 'center'
  c.font = '900 200px Nunito, sans-serif'
  c.fillText(String(days), SIZE / 2, 670)
  c.fillStyle = 'rgba(255,255,255,0.8)'
  c.font = '800 56px Nunito, sans-serif'
  c.fillText(days === 1 ? tr('day in a row') : tr('days in a row'), SIZE / 2, 750)

  // This week
  const gap = 132
  const left = SIZE / 2 - gap * 3
  for (let i = 0; i < 7; i++) {
    const x = left + i * gap
    c.fillStyle = 'rgba(255,255,255,0.6)'
    c.font = '800 34px Nunito, sans-serif'
    c.fillText(DAYS[i], x, 860)
    c.beginPath()
    c.arc(x, 930, 44, 0, Math.PI * 2)
    c.fillStyle = week[i] ? BLUE : 'rgba(255,255,255,0.14)'
    c.fill()
    if (week[i]) {
      c.strokeStyle = '#fff'
      c.lineWidth = 9
      c.lineCap = c.lineJoin = 'round'
      c.beginPath()
      c.moveTo(x - 17, 931)
      c.lineTo(x - 5, 943)
      c.lineTo(x + 18, 919)
      c.stroke()
    } else if (i === todayIndex) {
      c.strokeStyle = BLUE
      c.lineWidth = 7
      c.beginPath()
      c.arc(x, 930, 40, 0, Math.PI * 2)
      c.stroke()
    }
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(tr('Couldn’t make the picture')))), 'image/png'))
}

/** Shares the picture (or downloads it). 'cancelled' = the student closed the share sheet. */
export async function shareStreak(days: number, week: boolean[], todayIndex: number): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([await streakImage(days, week, todayIndex)], `baon-streak-${days}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareCaption(days) })
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
