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
    intro: 'What baon collects, what stays on your phone, and your rights under the Data Privacy Act of 2012.',
    sections: [
      ['What we collect', 'Only what signing in needs: your email, your name, and your Google photo if you sign in with Google.'],
      ['What stays on your phone', 'Your allowance, expenses, wallets, plans and streak are saved only on your phone, scrambled so only baon can read them. We never receive them.'],
      ['How we use it', 'Only to let you sign in. No ads, no tracking, and we never sell or share your information.'],
      ['Backups', 'Backups are files you save yourself. They open only with your recovery code — we can’t open them.'],
      ['Your rights', 'You can see, correct, copy or delete your data anytime: edit your name on Me → Profile, save a copy on Backup, or use Delete account on Me → Security.'],
      ['Under 18?', 'Use baon with a parent’s or guardian’s permission.'],
      ['Keep in mind', 'Anyone who can unlock your phone can open baon, so keep your screen lock on. If you lose your phone and your recovery code, your records can’t be brought back.'],
    ],
  },
  terms: {
    title: 'Terms and Conditions',
    intro: 'By signing in to baon, you agree to these terms.',
    sections: [
      ['What baon is', 'A tool to plan your allowance. Its numbers are estimates based on what you enter, not financial advice. baon never holds or moves money.'],
      ['Your account', 'Use your own account and keep your phone locked. Under 18? Use baon with a parent’s or guardian’s permission.'],
      ['Your records', 'Your records live on your phone. Keeping backups and your recovery code safe is up to you.'],
      ['Fair use', 'Don’t misuse baon or use it to harm others.'],
      ['No guarantees', 'baon is provided as it is and may change or stop. We aren’t responsible for lost records or for money decisions made using it.'],
      ['Leaving', 'You can delete your account anytime on Me → Security.'],
      ['Changes', 'If these terms change, the date at the top changes too. These terms follow the laws of the Philippines.'],
    ],
  },
  storage: {
    title: 'Local Storage Policy',
    intro: 'baon saves your data on your phone, not on our servers. No ads or tracking cookies.',
    sections: [
      ['What it saves', 'Your records (scrambled so only baon can read them), the names of accounts on this phone, your display choices, reminder settings, a note that you’re signed in, and baon’s own app files so it works without internet.'],
      ['Why', 'So baon opens fast, works without internet, and your records stay with you.'],
      ['Clearing it', 'Delete account on Me → Security removes everything baon saved on this phone. Clearing baon’s data in your browser settings does the same. Without a backup, your records are gone for good.'],
    ],
  },
}
