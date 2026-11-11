/*
 * greetings.ts — The Home greeting, picked at random on each open (plan §6).
 * Local and rule-based (no network). Never shaming, never about skipping food.
 * Short on purpose: with a first name it fits one line on a phone (Home also cuts it off as a last resort).
 * Moves into i18n files when Filipino/Taglish arrives (Phase 2).
 */

const GREETINGS = [
  (name: string) => `Hi, ${name}!`,
  (name: string) => `Kumusta, ${name}?`,
  (name: string) => `Sakto lang, ${name}?`,
  (name: string) => `Tipid mode, ${name}!`,
  (name: string) => `Let’s go, ${name}!`,
  (name: string) => `Kaya mo ’yan, ${name}!`,
  (name: string) => `Budget check, ${name}!`,
  (name: string) => `Ready, ${name}?`,
]

/**
 * First name for greetings: the first word of the full name ("John Ian Cabalquinto" → "John").
 * shortcut: two-word given names (e.g. "John Ian") keep only the first word; add an
 * editable "What should we call you?" field in Me if students ask for it.
 */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

/** One greeting addressing the student by first name. `pick` (0–1) chooses which; keep it to keep the same greeting. */
export function randomGreeting(fullName: string, pick = Math.random()): string {
  return GREETINGS[Math.floor(pick * GREETINGS.length)](firstName(fullName))
}
