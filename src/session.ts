/*
 * session.ts — The unlocked account, shared with every screen through React context
 * so pages don't pass the vault around by hand. Holds only the vault handle
 * (which keeps the key in memory) and the display name — nothing is persisted.
 */
import { createContext, useContext } from 'react'
import type { Vault } from './vault/vault.ts'

export interface Session {
  vault: Vault
  name: string
}

export const SessionContext = createContext<Session | null>(null)

/** The current unlocked account. Only used inside the signed-in app. */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession used outside the unlocked app')
  return session
}
