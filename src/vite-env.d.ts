/*
 * vite-env.d.ts — TypeScript types for the values in .env.local,
 * so `import.meta.env.VITE_NEON_AUTH_URL` is known and type-checked.
 */
interface ImportMetaEnv {
  readonly VITE_NEON_AUTH_URL: string
  readonly VITE_NEON_DATA_API_URL: string
}
