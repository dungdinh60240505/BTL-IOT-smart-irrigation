'use client'

import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'aquasense-install-dismissed-at'
const DISMISS_DAYS = 7

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIosSafari() {
  const ua = navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isIos && isSafari
}

function recentlyDismissed() {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
  return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
}

// Banner gợi ý "Cài đặt ứng dụng" (Android) hoặc hướng dẫn "Thêm vào MH chính" (iOS Safari).
export function InstallPrompt() {
  const [mode, setMode] = useState<'android' | 'ios' | null>(null)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setMode('android')
      setVisible(true)
    }
    const onInstalled = () => setVisible(false)

    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)

    let timer: ReturnType<typeof setTimeout> | undefined
    if (isIosSafari()) {
      timer = setTimeout(() => {
        setMode('ios')
        setVisible(true)
      }, 2500)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setVisible(false)
    else dismiss()
  }

  if (!visible || !mode) return null

  return (
    <div
      role="dialog"
      aria-label="Cài đặt ứng dụng AquaSense"
      className="pwa-install-banner fixed inset-x-3 z-[100] mx-auto max-w-md animate-in fade-in slide-in-from-bottom-6 duration-500"
    >
      <div className="relative flex items-start gap-3 rounded-2xl border border-emerald-200/70 bg-white/85 p-4 shadow-[0_20px_45px_-20px_rgba(4,120,87,0.55)] backdrop-blur-xl">
        <img src="/icons/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl shadow-sm" />
        <div className="min-w-0 flex-1 pr-5">
          <p className="text-sm font-semibold text-emerald-950">Cài AquaSense lên điện thoại</p>
          {mode === 'android' ? (
            <>
              <p className="mt-0.5 text-xs text-emerald-800/80">Mở nhanh từ màn hình chính, dùng toàn màn hình như ứng dụng.</p>
              <button
                id="pwa-install-btn"
                type="button"
                onClick={install}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95"
              >
                <Download className="size-4" /> Cài đặt ứng dụng
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs leading-relaxed text-emerald-800/90">
              Nhấn <Share className="mx-0.5 inline size-4 -translate-y-0.5 text-sky-600" /> <b>Chia sẻ</b> ở thanh dưới, rồi chọn{' '}
              <SquarePlus className="mx-0.5 inline size-4 -translate-y-0.5" /> <b>Thêm vào MH chính</b>.
            </p>
          )}
        </div>
        <button
          id="pwa-install-dismiss"
          type="button"
          onClick={dismiss}
          aria-label="Đóng"
          className="absolute right-2 top-2 rounded-full p-1.5 text-emerald-900/50 transition hover:bg-emerald-50 hover:text-emerald-900"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
