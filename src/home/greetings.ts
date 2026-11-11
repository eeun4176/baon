/*
 * greetings.ts — The Home greeting, picked at random on each open (plan §6).
 * Local and rule-based (no network). Never shaming, never about skipping food.
 * Short on purpose: with a first name it fits one line on a phone (Home also cuts it off as a last resort).
 * Moves into i18n files when Filipino/Taglish arrives (Phase 2).
 */
import { tr } from '../i18n/i18n.ts'

const GREETINGS = [
  (name: string) => tr('Hi, {0}!', name),
  (name: string) => tr('Kumusta, {0}?', name),
  (name: string) => tr('Sakto lang, {0}?', name),
  (name: string) => tr('Tipid mode, {0}!', name),
  (name: string) => tr('Let’s go, {0}!', name),
  (name: string) => tr('Kaya mo ’yan, {0}!', name),
  (name: string) => tr('Budget check, {0}!', name),
  (name: string) => tr('Ready, {0}?', name),
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
