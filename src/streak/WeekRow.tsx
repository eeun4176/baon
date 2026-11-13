/*
 * WeekRow.tsx — This week's Su–Sa row: streak days are blue
 * circles with a ✓, today is a blue ring with a dot, other days are gray.
 * Used on Home (phone + desktop streak card) and on the Streak screen.
 */
import { addDays, weekday } from '../budget/days.ts'
import { Icon } from '../ui/kit.tsx'
import type { Streak } from './streak.ts'
import { tr } from '../i18n/i18n.ts'

const SHORT = [tr('Su'), tr('Mo'), tr('Tu'), tr('We'), tr('Th'), tr('Fr'), tr('Sa')]
const LONG = [tr('Sunday'), tr('Monday'), tr('Tuesday'), tr('Wednesday'), tr('Thursday'), tr('Friday'), tr('Saturday')]

/** Su–Sa circles for the week containing `today`. `dark` = on a dark card. */
export function WeekRow({ today, streak, dark = false }: { today: string; streak: Streak; dark?: boolean }) {
  const sunday = addDays(today, -weekday(today))
  return (
    <ol className="grid grid-cols-7 gap-1.5 text-center" aria-label={tr('This week')}>
      {SHORT.map((label, i) => {
        const day = addDays(sunday, i)
        const isToday = day === today
        const status = streak.days.get(day)?.status
        const on = status === 'on' || status === 'over' // every logged class day counts
        const circle = on
          ? 'grid place-items-center bg-blue text-white'
          : isToday
            ? `block border-[3px] border-blue ${dark ? 'bg-transparent' : 'bg-card'}`
            : `block ${dark ? 'bg-white/15' : 'bg-pebble-2'}`
        return (
          <li key={day} aria-current={isToday ? 'date' : undefined} aria-label={`${LONG[i]}${isToday ? tr(', today') : ''}${on ? tr(', counted') : ''}`}>
            <span className={`text-[0.9375rem] font-extrabold ${dark ? 'text-white/70' : ''}`} aria-hidden="true">{label}</span>
            <span aria-hidden="true" className={`mx-auto mt-2 aspect-square w-full max-w-11 animate-rise rounded-full ${circle}`} style={{ animationDelay: `${i * 30}ms` }}>
              {on && <Icon name="check" className="size-[55%]" />}
            </span>
            <span aria-hidden="true" className={`mx-auto mt-1.5 block size-1.5 rounded-full ${isToday ? 'bg-blue' : ''}`} />
          </li>
        )
      })}
    </ol>
  )
}
