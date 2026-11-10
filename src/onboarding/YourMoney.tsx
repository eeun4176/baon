/*
 * YourMoney.tsx — Onboarding screen 5 (design "5 Your money now"): cash in wallet,
 * optional e-wallet balances, running total, then "See my budget".
 */
import { formatPeso } from '../ledger/money.ts'
import { Button, Card, MoneyField, Screen, StepHeader, Switch, Title } from '../ui/kit.tsx'
import { moneyTotal, type MoneyAnswers } from './answers.ts'

/** Starting-balances form; the last step before the vault is created. */
export function YourMoney({ value, onChange, error, busy, onBack, onFinish }: {
  value: MoneyAnswers
  onChange: (v: MoneyAnswers) => void
  error: string
  busy: boolean
  onBack: () => void
  onFinish: () => void
}) {
  /** Updates one e-wallet row. */
  const setWallet = (id: string, patch: Partial<MoneyAnswers['eWallets'][number]>) =>
    onChange({ ...value, eWallets: value.eWallets.map((w) => (w.id === id ? { ...w, ...patch } : w)) })

  return (
    <Screen
      footer={
        <>
          <p className="mb-3 flex items-baseline justify-between px-1" aria-live="polite">
            <span className="text-lg font-extrabold text-muted">Total</span>
            <span className="text-[clamp(1.75rem,8vw,2.25rem)] font-black">{formatPeso(moneyTotal(value))}</span>
          </p>
          {error && <p role="alert" className="mb-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <Button disabled={busy} onClick={onFinish}>{busy ? 'Setting up…' : 'See my budget'}</Button>
        </>
      }
    >
      <StepHeader step={4} onBack={onBack} />
      <Title sub="A rough number is fine. Fix it anytime.">How much do you have now?</Title>

      <Card className="py-6">
        <MoneyField label="Cash in your wallet" value={value.cashText} onChange={(cashText) => onChange({ ...value, cashText })} />
      </Card>

      <Card className="mt-4 divide-y divide-pebble py-1">
        {value.eWallets.map((w) => (
          <div key={w.id} className="flex min-h-16 items-center gap-3 py-2">
            <span className="flex-1 text-lg font-black">{w.name}</span>
            {w.on && (
              <label className="flex min-h-11 w-32 items-center gap-1 rounded-full bg-pebble px-4">
                <span className="font-black text-muted" aria-hidden="true">₱</span>
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  aria-label={`${w.name} balance`}
                  value={w.text}
                  onChange={(e) => setWallet(w.id, { text: e.target.value })}
                  className="w-full bg-transparent text-right text-lg font-black outline-none"
                />
              </label>
            )}
            <Switch label={`Use ${w.name}`} checked={w.on} onChange={(on) => setWallet(w.id, { on })} />
          </div>
        ))}
      </Card>
    </Screen>
  )
}
