/*
 * YourBaon.tsx — Onboarding screen 4 (design "4 Your baon"): allowance amount,
 * how often, next allowance date, and which days are class days.
 */
import { addDays } from '../budget/days.ts'
import { Button, Card, Chip, MoneyField, Screen, StepHeader, Switch, Title } from '../ui/kit.tsx'
import { defaultNextDate, type BaonAnswers } from './answers.ts'

const FREQUENCIES = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['biweekly', 'Every 2 weeks'],
  ['monthly', 'Monthly'],
  ['irregular', 'Irregular'],
] as const

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Allowance setup form. `error` is the message from toAllowance, shown after Continue is tapped. */
export function YourBaon({ value, onChange, today, error, onBack, onContinue }: {
  value: BaonAnswers
  onChange: (v: BaonAnswers) => void
  today: string
  error: string
  onBack: () => void
  onContinue: () => void
}) {
  /** Updates one or more answers. */
  const set = (patch: Partial<BaonAnswers>) => onChange({ ...value, ...patch })

  /** Turns a class day on/off. */
  const toggleDay = (d: number) =>
    set({ classWeekdays: value.classWeekdays.includes(d) ? value.classWeekdays.filter((x) => x !== d) : [...value.classWeekdays, d] })

  return (
    <Screen
      footer={
        <>
          {error && <p role="alert" className="mb-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <Button onClick={onContinue}>Continue</Button>
        </>
      }
    >
      <StepHeader step={3} onBack={onBack} />
      <Title>Your baon</Title>

      <Card className="py-6">
        <MoneyField label="How much do you get?" value={value.amountText} onChange={(amountText) => set({ amountText })} />
      </Card>

      <fieldset className="mt-6">
        <legend className="mb-3 text-lg font-extrabold">How often?</legend>
        <div className="flex flex-wrap gap-2.5">
          {FREQUENCIES.map(([id, label]) => (
            <Chip
              key={id}
              selected={value.frequency === id}
              onClick={() => set({ frequency: id, nextDate: defaultNextDate(today, id) })}
            >
              {label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Card className="mt-6">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="text-lg font-black">{value.frequency === 'irregular' ? 'Make it last until' : 'Next allowance'}</span>
          <input
            type="date"
            required
            min={addDays(today, 1)}
            value={value.nextDate}
            onChange={(e) => set({ nextDate: e.target.value })}
            className="min-h-11 rounded-full bg-transparent text-right text-lg font-extrabold text-blue outline-blue"
          />
        </label>
      </Card>

      <Card className="mt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-black">Count only class days</p>
            <p className="font-semibold text-muted">Your daily budget spreads over school days.</p>
          </div>
          <Switch label="Count only class days" checked={value.countClassDays} onChange={(countClassDays) => set({ countClassDays })} />
        </div>
        {value.countClassDays && (
          <div className="mt-4 grid grid-cols-7 gap-1.5" role="group" aria-label="Class days">
            {DAYS.map((label, d) => {
              const on = value.classWeekdays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={`aspect-square min-h-11 rounded-full text-[clamp(0.8rem,3.6vw,1.05rem)] font-black ${on ? 'bg-blue text-white' : 'bg-pebble text-muted'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </Screen>
  )
}
