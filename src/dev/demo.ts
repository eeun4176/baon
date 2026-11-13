/*
 * demo.ts — DEV ONLY (npm run dev): fills the signed-in account with sample data to try the
 * newer features, and removes it again. Never part of the live app: AppShell only imports it
 * when import.meta.env.DEV is true, so the production build leaves it out.
 *
 *   http://localhost:5173/?demo=add    adds the sample data
 *   http://localhost:5173/?demo=clear  removes exactly what "add" added (nothing of yours)
 *
 * What it adds, all in Cash:
 *   - a ₱3,000 scholarship from 14 days ago, made to "last until" 20 days from now
 *   - an expense on each class day of the last 14 days (more last week than this week → green ↓),
 *     each with that day's budget (₱150), so the Ipon outlook has 5+ days to work with
 *   - utang: borrowed ₱200 from Rei (due in 3 days, ₱50 paid back), lent ₱150 to Kiel (overdue)
 * Entries have ids starting with "demo-"; the day records it created are listed in "demo-seed".
 */
import type { Allowance } from '../budget/allowance.ts'
import { addDays, manilaDate } from '../budget/days.ts'
import { counts } from '../budget/safeToSpend.ts'
import type { Transaction } from '../ledger/ledger.ts'
import { loadTransactions, loadWallets, saveTransaction } from '../ledger/repo.ts'
import { loadSnapshots, saveSnapshot } from '../streak/streak.ts'
import type { Vault } from '../vault/vault.ts'

const SEED_RECORD = 'demo-seed' // { days: string[] } — day records the demo created

/** Noon (Manila) on `day`, as an entry time. */
const noon = (day: string) => `${day}T12:00:00+08:00`

/** Adds the sample data. Returns a message for the toast. */
async function add(vault: Vault, allowance: Allowance): Promise<string> {
  if (await vault.get(SEED_RECORD)) return 'Demo data is already in. Use ?demo=clear first.'
  const today = manilaDate()
  const wallets = await loadWallets(vault)
  const had = new Set((await loadSnapshots(vault)).map((s) => s.date))
  const created: string[] = []
  const entries: Transaction[] = []
  const put = (tx: Omit<Transaction, 'walletId'>) => entries.push({ walletId: 'cash', ...tx } as Transaction)

  put({ id: 'demo-scholarship', kind: 'income', source: 'scholarship', amountCentavos: 300000, occurredAt: noon(addDays(today, -14)), spreadUntil: addDays(today, 20), note: 'Scholarship stipend' })

  for (let i = 14; i >= 1; i--) {
    const day = addDays(today, -i)
    if (!counts(day, allowance)) continue
    const thisWeek = i < 7
    put({ id: `demo-food-${day}`, kind: 'expense', categoryId: i % 3 ? 'food' : 'snacks', amountCentavos: (thisWeek ? 9000 : 13000) + (i % 4) * 500, occurredAt: noon(day) })
    if (!had.has(day)) {
      await saveSnapshot(vault, { date: day, dailyBudgetCentavos: 15000, isClassDay: true })
      created.push(day)
    }
  }

  put({ id: 'demo-borrow-rei', kind: 'borrow', person: 'Rei', amountCentavos: 20000, occurredAt: noon(addDays(today, -5)), dueDate: addDays(today, 3) })
  put({ id: 'demo-repay-rei', kind: 'repay', person: 'Rei', linkedId: 'demo-borrow-rei', amountCentavos: 5000, occurredAt: noon(addDays(today, -2)) })
  put({ id: 'demo-lend-kiel', kind: 'lend', person: 'Kiel', amountCentavos: 15000, occurredAt: noon(addDays(today, -6)), dueDate: addDays(today, -1) })

  for (const tx of entries) await saveTransaction(vault, tx, wallets) // same checks as the app
  await vault.put('settings', SEED_RECORD, { days: created })
  return `Demo data added: ${entries.length} entries, ${created.length} past days.`
}

/** Removes every "demo-" entry and the day records the demo created. */
async function clear(vault: Vault): Promise<string> {
  const seed = (await vault.get(SEED_RECORD)) as { days?: string[] } | undefined
  const demo = (await loadTransactions(vault)).filter((tx) => tx.id.startsWith('demo-'))
  for (const tx of demo) await vault.remove(tx.id)
  for (const day of seed?.days ?? []) await vault.remove(`day-${day}`)
  if (seed) await vault.remove(SEED_RECORD)
  return demo.length || seed ? `Demo data removed: ${demo.length} entries, ${seed?.days?.length ?? 0} past days.` : 'No demo data to remove.'
}

/** Runs "?demo=add" or "?demo=clear". */
export async function runDemo(vault: Vault, allowance: Allowance, what: string): Promise<string> {
  if (what === 'add') return add(vault, allowance)
  if (what === 'clear') return clear(vault)
  return `Unknown demo "${what}". Use ?demo=add or ?demo=clear.`
}

