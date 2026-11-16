/*
 * WalletTile.tsx — One wallet as Home and Me show it (Home v2 / Me v2 designs):
 *   WalletChip  phones: small tile for a sideways-scrolling row (icon + name, amount)
 *   WalletTile  desktop: icon box, name, amount (Me adds "Spendable" / "Not spendable")
 * Savings gets a dashed border: it's kept apart from spendable money. A wallet with an interest rate
 * (Me → wallet) shows about what it earns a month: an estimate only, never part of the balance.
 * With onClick it's a button (Me: opens the wallet to rename, remove or match its balance).
 */
import type { ReactNode } from 'react'
import { monthlyInterest, type Wallet } from '../ledger/ledger.ts'
import { formatPeso } from '../ledger/money.ts'
import { Icon, type IconName } from './kit.tsx'
import { tr } from '../i18n/i18n.ts'

const E_WALLETS = new Set(['gcash', 'maya']) // set up from onboarding's switches; anything the student named is shown as a bank

/** Icon by kind: Cash, GCash/Maya, Savings, or a bank. */
const iconOf = (w: Wallet): IconName => (w.type === 'savings' ? 'piggy' : w.id === 'cash' ? 'wallet' : E_WALLETS.has(w.id) ? 'phone' : 'bank')

/** A button when it can be opened, else a plain box. */
function Box({ wallet, amount, onClick, className, children }: { wallet: Wallet; amount: number; onClick?: () => void; className: string; children: ReactNode }) {
  // relative: keeps the hidden screen-reader notes inside a scrolling row (else they widen the whole page)
  if (!onClick) return <div className={`relative ${className}`}>{children}</div>
  return (
    <button type="button" onClick={onClick} aria-label={tr('Edit {0}, {1}', wallet.name, formatPeso(amount))} className={`relative text-left ${className}`}>
      {children}
    </button>
  )
}

/** Screen readers hear what the dashed border shows. */
const SavingsNote = ({ wallet }: { wallet: Wallet }) => (wallet.type === 'savings' ? <span className="sr-only">{tr(' · Not counted as spendable')}</span> : null)

/** "≈ +₱2.66/mo" in green when the wallet has an interest rate and money in it; nothing otherwise. */
function Interest({ wallet, amount }: { wallet: Wallet; amount: number }) {
  const month = monthlyInterest(amount, wallet.interestRate)
  if (!month) return null
  return (
    <span className="text-[11px] leading-tight font-extrabold text-trend-down">
      <span aria-hidden="true">{tr('≈ +{0}/mo', formatPeso(month))}</span>
      <span className="sr-only">{tr('About {0} a month in interest', formatPeso(month))}</span>
    </span>
  )
}

/** Phone tile for a sideways-scrolling row. */
export function WalletChip({ wallet, amount, onClick }: { wallet: Wallet; amount: number; onClick?: () => void }) {
  const savings = wallet.type === 'savings'
  return (
    <Box wallet={wallet} amount={amount} onClick={onClick}
      className={`flex h-full min-w-28 flex-col gap-1 rounded-[18px] ${savings ? 'border-2 border-dashed border-bar bg-card px-2.5 py-2' : 'bg-page px-3 py-2.5'}`}>
      <span className="flex items-center gap-1.5 text-xs font-extrabold whitespace-nowrap text-muted">
        <Icon name={iconOf(wallet)} className={`size-3.5 shrink-0 ${savings ? '' : 'text-blue'}`} />
        {wallet.name}<SavingsNote wallet={wallet} />
      </span>
      <span className="text-[1.0625rem] font-black tracking-[-0.02em] whitespace-nowrap">{formatPeso(amount)}</span>
      <Interest wallet={wallet} amount={amount} />
    </Box>
  )
}

/** Desktop tile: icon box, name, amount; `showKind` adds "Spendable" / "Not spendable"; `stacked` puts the icon on top (Home). */
export function WalletTile({ wallet, amount, showKind = false, stacked = false, onClick }: { wallet: Wallet; amount: number; showKind?: boolean; stacked?: boolean; onClick?: () => void }) {
  const savings = wallet.type === 'savings'
  return (
    <Box wallet={wallet} amount={amount} onClick={onClick}
      className={`flex h-full w-full min-w-0 rounded-[20px] ${stacked ? 'flex-col items-start gap-2' : 'items-center gap-3'} ${savings ? 'border-2 border-dashed border-bar bg-card px-3 py-2.5' : 'bg-page px-3.5 py-3'} ${onClick ? 'hover:bg-pebble' : ''}`}>
      <span className={`grid shrink-0 place-items-center ${stacked ? 'size-[2.125rem] rounded-xl' : 'size-10 rounded-[14px]'} ${savings ? 'bg-page text-muted' : 'bg-card text-blue'}`}>
        <Icon name={iconOf(wallet)} className="size-5" />
      </span>
      <span className={`flex min-w-0 flex-col ${stacked ? 'w-full' : ''}`}>
        <span className="truncate text-[0.8125rem] font-extrabold text-muted">{wallet.name}</span>
        <span className="text-[1.1875rem] font-black tracking-[-0.02em] whitespace-nowrap">{formatPeso(amount)}</span>
        {monthlyInterest(amount, wallet.interestRate) > 0
          ? <Interest wallet={wallet} amount={amount} />
          : showKind
          ? <span className={`text-[11px] font-extrabold ${savings ? 'text-muted' : 'text-trend-down'}`}>{savings ? tr('Not spendable') : tr('Spendable')}</span>
          : <SavingsNote wallet={wallet} />}
      </span>
    </Box>
  )
}
