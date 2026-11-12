/*
 * YourBaon.tsx — Onboarding screen 4 (design "4 Your baon"): allowance amount,
 * how often, next allowance date, and which days are class days.
 */
import { FREQUENCIES } from '../budget/allowance.ts'
import { addDays } from '../budget/days.ts'
import { Button, Card, Chip, MoneyField, Switch } from '../ui/kit.tsx'
import { Step } from './Step.tsx'
import { defaultNextDate, type BaonAnswers } from './answers.ts'
import { tr } from '../i18n/i18n.ts'

const DAYS = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]
const DAY_NAMES = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]

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
    <Step
      n={3}
      onBack={onBack}
      title={tr('Tell us about your baon')}
      sub={tr('We’ll spread it until your next allowance.')}
      footer={
        <>
          {error && <p role="alert" className="mb-3 rounded-2xl bg-pebble p-3 text-center font-bold">{error}</p>}
          <Button onClick={onContinue}>{tr('Continue')}</Button>
        </>
      }
    >
      <Card className="py-5">
        <MoneyField label={tr('How much do you get?')} value={value.amountText} onChange={(amountText) => set({ amountText })} />
      </Card>

      <fieldset className="mt-4">
        <legend className="mb-2.5 font-extrabold">{tr('How often?')}</legend>
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

      <Card className="mt-4 py-2 sm:py-2">
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="font-extrabold">{value.frequency === 'irregular' ? tr('Make it last until') : tr('Next allowance')}</span>
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

      <Card className="mt-3 py-2 sm:py-2">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <p className="font-extrabold">{tr('Count only class days')}</p>
          <Switch label={tr('Count only class days')} checked={value.countClassDays} onChange={(countClassDays) => set({ countClassDays })} />
        </div>
        {value.countClassDays && (
          <div className="mt-2 mb-2 grid grid-cols-7 gap-1.5" role="group" aria-label={tr('Class days')}>
            {DAYS.map((label, d) => {
              const on = value.classWeekdays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={DAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={`aspect-square min-h-11 rounded-full text-[clamp(0.8rem,3.6vw,1.05rem)] font-black ${on ? 'bg-blue text-white' : 'bg-page text-muted'}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </Step>
  )
}
