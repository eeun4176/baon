/*
 * main.tsx — Entry point. Applies the saved Light/Dark/Device theme and language before the
 * first paint, starts listening for "can install" (install.ts), loads the global styles and
 * mounts the React app into <div id="root"> in index.html.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './install.ts'
import App from './App.tsx'
import { language } from './i18n/i18n.ts'
import { applyTheme, getTheme } from './theme.ts'

applyTheme(getTheme())
document.documentElement.lang = language // screen readers read Filipino text as Filipino

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
