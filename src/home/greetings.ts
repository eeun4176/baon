/*
 * greetings.ts — The Home greeting, picked at random on each open.
 * Local and rule-based (no network). Never shaming, never about skipping food.
 * Short on purpose: with a first name it fits one line on a phone (Home also cuts it off as a last resort).
 * Moves into i18n files when Filipino/Taglish arrives (Phase 2).
 */
import { tr } from '../i18n/i18n.ts'

const GREETINGS = [
  (name: string) => tr('Keep going, {0}!', name),
  (name: string) => tr('Let’s begin, {0}!', name),
  (name: string) => tr('Baon check, {0}!', name),
  (name: string) => tr('Welcome, {0}!', name),
  (name: string) => tr('Welcome back, {0}!', name),
  (name: string) => tr('How\'s it going, {0}?', name),
  (name: string) => tr('How\'s your baon, {0}?', name),
  (name: string) => tr('Baon on track, {0}', name),
]

const TIME_GREETINGS = {
  morning: [(name: string) => tr('Good morning, {0}', name)],
  afternoon: [(name: string) => tr('Good afternoon, {0}', name)],
  evening: [(name: string) => tr('Good evening, {0}', name)],
  night: [
    (name: string) => tr('Night owl, {0}?', name),
    (name: string) => tr('Gising pa, {0}?', name),
  ],
}

export type PhilippineGreetingTime = 'morning' | 'afternoon' | 'evening' | 'night'

/** The greeting period in Philippines time (UTC+8), regardless of the device timezone. */
export function philippineGreetingTime(date: Date = new Date()): PhilippineGreetingTime {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(date).find((part) => part.type === 'hour')?.value ?? '0')
  const normalizedHour = hour === 24 ? 0 : hour

  if (normalizedHour >= 5 && normalizedHour < 12) return 'morning'
  if (normalizedHour >= 12 && normalizedHour < 18) return 'afternoon'
  if (normalizedHour >= 18) return 'evening'
  return 'night'
}

/**
 * First name for greetings: the first word of the full name ("Juan Miguel Dela Cruz" → "Juan").
 * Known limit: two-word given names (e.g. "Juan Miguel") keep only the first word; add an
 * editable "What should we call you?" field in Me if students ask for it.
 */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

/** One greeting addressing the student by first name. `pick` (0–1) chooses which; keep it to keep the same greeting. */
export function randomGreeting(fullName: string, pick = Math.random(), date = new Date()): string {
  const time = philippineGreetingTime(date)
  const greetings = [...TIME_GREETINGS[time], ...GREETINGS]
  return greetings[Math.floor(pick * greetings.length)](firstName(fullName))
}
