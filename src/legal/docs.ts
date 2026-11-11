/*
 * docs.ts — The text of the Privacy Policy, Terms and Conditions, and Local Storage Policy
 * (shown as a pop-up by Legal.tsx). Short, plain words, no technical terms or company names.
 * Keep it true to what the app does; update LAST_UPDATED whenever data handling changes.
 */
export const LAST_UPDATED = 'November 11, 2026'

export type DocId = 'privacy' | 'terms' | 'storage'

export const DOCS: Record<DocId, { title: string; intro: string; sections: [string, string][] }> = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'What baon collects, where your records are kept, and your rights under the Data Privacy Act of 2012.',
    sections: [
      ['What we collect', 'Only what signing in needs: your email, your name, and your Google photo if you sign in with Google.'],
      ['Your records', 'Your allowance, expenses, wallets, plans and streak are saved on your phone, scrambled. A scrambled copy is also kept online with your account, so they follow you to every device where you sign in.'],
      ['Who can see them', 'Only your signed-in account can get your records. We don’t look at them, and we never sell or share them. Anyone who gets into your Google or email account could sign in to baon as you, so keep that account safe.'],
      ['How we use it', 'Only to let you sign in and to sync your records between your devices. No ads and no tracking.'],
      ['Backups', 'Backups are extra files you save yourself. They open only with your recovery code.'],
      ['Your rights', 'You can see, correct, copy or delete your data anytime: edit your name on Me → Profile, save a copy on Backup, or use Delete account on Me → Security.'],
      ['Under 18?', 'Use baon with a parent’s or guardian’s permission.'],
      ['Keep in mind', 'Anyone who can unlock your phone can open baon, so keep your screen lock on. Lost your phone? Sign in on a new one and your records come back.'],
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: 'By signing in to baon, you agree to these terms.',
    sections: [
      ['What baon is', 'A tool to plan your allowance. Its numbers are estimates based on what you enter, not financial advice. baon never holds or moves money.'],
      ['Your account', 'Use your own account and keep your phone locked. Under 18? Use baon with a parent’s or guardian’s permission.'],
      ['Your records', 'Your records live on your phone and, as a scrambled copy, online with your account. Keeping your sign-in account safe is up to you.'],
      ['Fair use', 'Don’t misuse baon or use it to harm others.'],
      ['No guarantees', 'baon is provided as it is and may change or stop. We aren’t responsible for lost records or for money decisions made using it.'],
      ['Leaving', 'You can delete your account anytime on Me → Security.'],
      ['Changes', 'If these terms change, the date at the top changes too. These terms follow the laws of the Philippines.'],
    ],
  },
  storage: {
    title: 'Local Storage Policy',
    intro: 'baon saves your data on your phone, with a scrambled copy of your records online so your other devices get them. No ads or tracking cookies.',
    sections: [
      ['What it saves', 'Your records (scrambled), the names of accounts on this phone, your display choices, reminder settings, a note that you’re signed in, and baon’s own app files so it works without internet.'],
      ['Why', 'So baon opens fast, works without internet, and your records stay with you.'],
      ['Clearing it', 'Delete account on Me → Security removes everything baon saved on this phone and online. Clearing baon’s data in your browser settings removes it from this phone only — sign in again and your records come back.'],
    ],
  },
}
