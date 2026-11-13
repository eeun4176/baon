/*
 * YourMoney.tsx — Onboarding screen 5: cash in wallet,
 * GCash / Maya switches plus any bank or e-wallet the student names themselves
 * (BPI, SeaBank, GoTyme…), a running total, then "See my budget".
 */
import { formatPeso } from '../ledger/money.ts'
import { Button, Card, Icon, MoneyField, Switch } from '../ui/kit.tsx'
import { Step } from './Step.tsx'
import { moneyTotal, type MoneyAnswers } from './answers.ts'
import { tr } from '../i18n/i18n.ts'

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

  /** Adds an empty row for a bank or e-wallet the student names. */
  const addWallet = () =>
    onChange({ ...value, eWallets: [...value.eWallets, { id: crypto.randomUUID(), name: '', on: true, text: '', custom: true }] })

  /** Removes a row the student added. */
  const removeWallet = (id: string) => onChange({ ...value, eWallets: value.eWallets.filter((w) => w.id !== id) })

  return (
    <Step
      n={4}
      onBack={onBack}
      title={tr('How much do you have now?')}
      sub={tr('A rough number is fine. Fix it anytime.')}
      footer={
        <>
          <p className="mb-3 flex items-baseline justify-between px-1" aria-live="polite">
            <span className="text-lg font-extrabold text-muted">{tr('Total')}</span>
            <span className="text-[clamp(1.75rem,8vw,2.25rem)] font-black">{formatPeso(moneyTotal(value))}</span>
          </p>
          {error && <p role="alert" className="mb-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <Button disabled={busy} onClick={onFinish}>{busy ? tr('Setting up…') : tr('See my budget')}</Button>
        </>
      }
    >
      <Card className="py-5">
        <MoneyField label={tr('Cash in your wallet')} value={value.cashText} onChange={(cashText) => onChange({ ...value, cashText })} />
      </Card>

      <div className="mt-4 divide-y divide-pebble rounded-3xl border border-pebble-2 px-4 py-1">
        {value.eWallets.map((w) => (
          <div key={w.id} className="flex min-h-16 items-center gap-3 py-2">
            {w.custom ? (
              <input
                value={w.name}
                maxLength={40}
                autoFocus={!w.name}
                aria-label={tr('Bank or e-wallet name')}
                placeholder={tr('e.g. BPI, SeaBank')}
                onChange={(e) => setWallet(w.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-full bg-card px-4 py-2.5 text-lg font-black outline-none placeholder:font-bold placeholder:text-muted/70 focus:ring-2 focus:ring-blue/40"
              />
            ) : (
              <span className="flex-1 text-lg font-black">{w.name}</span>
            )}
            {w.on && (
              <label className="flex min-h-11 w-32 items-center gap-1 rounded-full bg-card px-4">
                <span className="font-black text-muted" aria-hidden="true">₱</span>
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  aria-label={`${w.name || tr('New wallet')} balance`}
                  value={w.text}
                  onChange={(e) => setWallet(w.id, { text: e.target.value })}
                  className="w-full bg-transparent text-right text-lg font-black outline-none"
                />
              </label>
            )}
            {w.custom ? (
              <button type="button" onClick={() => removeWallet(w.id)} aria-label={tr('Remove {0}', w.name || tr('this wallet'))} className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-pebble hover:text-ink">
                <Icon name="x" className="size-5" />
              </button>
            ) : (
              <Switch label={tr('Use {0}', w.name)} checked={w.on} onChange={(on) => setWallet(w.id, { on })} />
            )}
          </div>
        ))}
        <button type="button" onClick={addWallet} className="flex min-h-14 w-full items-center gap-2 font-black text-blue">
          <Icon name="plus" className="size-5" /> {tr('Add a bank or e-wallet')}</button>
      </div>
    </Step>
  )
}
