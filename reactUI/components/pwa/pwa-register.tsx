'use client'

import { useEffect } from 'react'

// Đăng ký service worker (chỉ ở production để tránh cache khi dev).
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const register = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
  }, [])

  return null
}
