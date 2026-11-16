/*
 * csv.ts — "Download as a spreadsheet": every entry as a CSV file that Excel, Google Sheets or
 * Numbers can open. Unlike a backup it is NOT scrambled and can't be restored; it's for the student
 * to look at their own records. One row per entry, oldest first, amounts in pesos.
 * Safety: a note like "=HYPERLINK(...)" would run as a formula when opened, so text cells that start
 * with = + - @ (or a tab/return) get a leading apostrophe, which spreadsheets show as plain text.
 */
import { categoryLabel } from '../add/categories.ts'
import { manilaDate } from '../budget/days.ts'
import type { Transaction, Wallet } from '../ledger/ledger.ts'
import { tr } from '../i18n/i18n.ts'

const KIND_LABEL: Record<Transaction['kind'], string> = {
  expense: tr('Expense'),
  refund: tr('Refund'),
  income: tr('Money in'),
  transfer: tr('Move'),
  save: tr('Saved'),
  withdraw: tr('Withdrawn'),
  borrow: tr('Borrowed'),
  repay: tr('Paid back'),
  lend: tr('Lent'),
  collect: tr('Got paid back'),
  'adjust-up': tr('Balance adjusted'),
  'adjust-down': tr('Balance adjusted'),
}

const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })

/** One cell: guards formulas, then quotes it if it has a comma, quote or line break. */
export function cell(value: string, text = true): string {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** The whole file: a header row, then one row per entry. Starts with a BOM so Excel reads ₱ and ñ right. */
export function toCsv(transactions: Transaction[], wallets: Wallet[]): string {
  const walletName = (id: string | undefined) => (id ? wallets.find((w) => w.id === id)?.name ?? '' : '')
  const header = [tr('Date'), tr('Time'), tr('Type'), tr('Category'), tr('Wallet'), tr('To wallet'), tr('Amount (₱)'), tr('Person'), tr('Note')]
  const rows = transactions.map((tx) => [
    cell(manilaDate(tx.occurredAt), false),
    cell(time.format(new Date(tx.occurredAt)), false),
    cell(KIND_LABEL[tx.kind]),
    cell(tx.categoryId ? categoryLabel(tx.categoryId) : ''),
    cell(walletName(tx.walletId)),
    cell(walletName(tx.toWalletId)),
    cell((tx.amountCentavos / 100).toFixed(2), false), // a number, never a formula
    cell(tx.person ?? ''),
    cell(tx.note ?? ''),
  ])
  return '﻿' + [header.map((h) => cell(h)), ...rows].map((r) => r.join(',')).join('\r\n') + '\r\n'
}
