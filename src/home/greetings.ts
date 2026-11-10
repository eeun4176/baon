/*
 * greetings.ts — The Home greeting, picked at random on each open (plan §6).
 * Local and rule-based (no network). Never shaming, never about skipping food.
 * Moves into i18n files when Filipino/Taglish arrives (Phase 2).
 */

const GREETINGS = [
  (name: string) => `${timeOfDay()}, ${name}!`,
  (name: string) => `Ready to spend wisely, ${name}?`,
  (name: string) => `Let’s make your baon last, ${name}!`,
  (name: string) => `Sakto lang today, ${name}?`,
  (name: string) => `Every peso has a plan, ${name}.`,
  (name: string) => `Small taps, big savings, ${name}!`,
  (name: string) => `Kumusta ang budget, ${name}?`,
  (name: string) => `You’ve got this week, ${name}!`,
]

const hourFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' })

/** "Good morning/afternoon/evening" by the current hour in Manila. */
function timeOfDay(now = new Date()): string {
  const hour = Number(hourFormat.format(now))
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

/**
 * First name for greetings: the first word of the full name ("John Ian Cabalquinto" → "John").
 * shortcut: two-word given names (e.g. "John Ian") keep only the first word; add an
 * editable "What should we call you?" field in Me if students ask for it.
 */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

/** One random greeting, addressing the student by first name. */
export function randomGreeting(fullName: string): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)](firstName(fullName))
}
