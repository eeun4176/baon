/*
 * main.tsx — Entry point. Mounts the React app into <div id="root"> in index.html
 * and loads the global styles (Tailwind, Nunito, color tokens).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
