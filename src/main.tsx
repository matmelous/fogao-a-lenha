import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import App from './App.tsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (Capacitor.isNativePlatform()) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch((error) => {
          console.error('Erro ao limpar service workers no app nativo:', error)
        })
      return
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Erro ao registrar service worker:', error)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <App />
)
