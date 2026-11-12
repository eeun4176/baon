/*
 * flame.ts — Which flame picture goes with a streak: orange to start, blue from 30 days,
 * violet from 100 days, and gray while today isn't logged yet. Every screen that shows the student's streak uses this.
 */
import flame from '../assets/streak-flame.png'
import flame30 from '../assets/streak-flame-30.svg'
import flame100 from '../assets/streak-flame-100.svg'
import flameGray from '../assets/streak-flame-gray.svg'

/** The flame picture for a streak of `days`; `pending` (nothing logged today yet) shows the gray one. */
export const streakFlame = (days: number, pending = false): string => (pending ? flameGray : days >= 100 ? flame100 : days >= 30 ? flame30 : flame)
