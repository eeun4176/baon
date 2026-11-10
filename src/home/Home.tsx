/*
 * Home.tsx — Today at a glance. FIRST VERSION: header, date line, greeting and the
 * real safe-to-spend hero card, computed from the student's encrypted records.
 * The full design (week row, streak chip, one-tap add, set-aside preview,
 * floating nav, + button) is added in the feat/home branch.
 */
import { useEffect, useState } from 'react'
import logoIcon from '../assets/logo-icon.png'
import { loadAllowance } from '../budget/allowance.ts'
import { weekday } from '../budget/days.ts'
import { safeToSpend, type SafeToSpend } from '../budget/safeToSpend.ts'
import { formatPeso } from '../ledger/money.ts'
import { loadTransactions, loadWallets } from '../ledger/repo.ts'
import { Card, Screen } from '../ui/kit.tsx'
import type { Vault } from '../vault/vault.ts'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const dateLine = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })

/** Loads the records and computes today's numbers. */
async function loadToday(vault: Vault): Promise<{ result: SafeToSpend; nextDay: string } | null> {
  const allowance = await loadAllowance(vault)
  if (!allowance) return null
  const result = safeToSpend({
    wallets: await loadWallets(vault),
    transactions: await loadTransactions(vault),
    allowance,
    setAsideCentavos: 0, // school expenses arrive in feat/school-expenses
  })
  return { result, nextDay: DAY_NAMES[weekday(allowance.nextDate)] }
}

/** Home screen (first version). */
export function Home({ vault, name }: { vault: Vault; name: string }) {
  const [today, setToday] = useState<Awaited<ReturnType<typeof loadToday>>>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadToday(vault).then(setToday, () => setFailed(true))
  }, [vault])

  const r = today?.result
  return (
    <Screen>
      <header className="flex items-center gap-2.5 text-[34px] font-black tracking-tight">
        <img src={logoIcon} alt="" className="size-10" />
        baon
      </header>
      <p className="mt-6 text-sm font-extrabold tracking-[0.12em] text-muted uppercase">{dateLine.format(new Date())}</p>
      <h1 className="mt-1 text-[clamp(1.5rem,7vw,1.875rem)] leading-tight font-black">Sakto lang today, {name}?</h1>

      <Card className="mt-6 py-7 text-center">
        {failed && <p role="alert" className="font-bold">Couldn’t open your records. Close and reopen baon.</p>}
        {!r && !failed && <p className="font-bold text-muted">Loading…</p>}
        {r && (
          <>
            <p className="text-[17px] font-extrabold text-muted">{r.isClassDay ? 'Safe to spend today' : 'No class today'}</p>
            <p className="mt-1 text-[clamp(3.5rem,20vw,5.25rem)] leading-none font-black">
              <span className="text-[0.5em] text-muted">₱</span>
              {formatPeso(r.leftToday >= 0 ? r.leftToday : 0).slice(1)}
            </p>
            {r.leftToday < 0 && <p className="mt-2 font-extrabold">{formatPeso(-r.leftToday)} over today — tomorrow adjusts.</p>}
            <p className="mt-3 font-semibold text-muted">
              {formatPeso(r.readyToSpend)} left until {today.nextDay} · {r.budgetDays} {r.budgetDays === 1 ? 'day' : 'days'}
            </p>
            {r.allowanceDue && <p className="mt-3 font-extrabold text-blue">Allowance day — did your baon arrive?</p>}
          </>
        )}
      </Card>
    </Screen>
  )
}
