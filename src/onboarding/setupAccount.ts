/*
 * setupAccount.ts — What happens when the student taps "See my budget" (last
 * onboarding screen): create the encrypted vault, then save their wallets and
 * allowance setup into it. Kept apart from the screens so it can be tested.
 */
import { AllowanceSchema, saveAllowance, type Allowance } from '../budget/allowance.ts'
import { WalletSchema, type Wallet } from '../ledger/ledger.ts'
import { saveWallet } from '../ledger/repo.ts'
import { createVault, type Vault } from '../vault/vault.ts'

/** One e-wallet the student switched on in "How much do you have now?". */
export interface StartingWallet {
  id: string // 'gcash' | 'maya' | a random id for banks / e-wallets the student named
  name: string
  centavos: number
}

/**
 * Creates the account on this device (My phone mode). Wallets: Cash, every
 * e-wallet that was switched on, and a ₱0 Savings wallet (shown on the Me tab).
 */
export async function setupAccount(input: {
  userId: string
  name: string
  allowance: Allowance
  cashCentavos: number
  eWallets: StartingWallet[]
}): Promise<Vault> {
  // Validate everything BEFORE creating the vault: a half-made vault would block a retry.
  const allowance = AllowanceSchema.parse(input.allowance)
  const wallets: Wallet[] = [
    { id: 'cash', name: 'Cash', type: 'spending', openingCentavos: input.cashCentavos, archived: false },
    ...input.eWallets.map((w): Wallet => ({ id: w.id, name: w.name, type: 'spending', openingCentavos: w.centavos, archived: false })),
    { id: 'savings', name: 'Savings', type: 'savings', openingCentavos: 0, archived: false },
  ].map((w) => WalletSchema.parse(w))

  const vault = await createVault(input.userId, input.name)
  for (const wallet of wallets) await saveWallet(vault, wallet)
  await saveAllowance(vault, allowance)
  return vault
}
