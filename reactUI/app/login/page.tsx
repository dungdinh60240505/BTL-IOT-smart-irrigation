'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthScreen } from '@/components/auth/auth-screen'
import { apiRequest } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    apiRequest<{ user?: unknown }>('/api/auth/me')
      .then((response) => {
        if (cancelled) return
        if (response?.user) {
          router.replace('/')
          return
        }
        setChecking(false)
      })
      .catch(() => {
        if (!cancelled) setChecking(false)
      })

    return () => {
      cancelled = true
    }
  }, [router])

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <p className="text-sm font-medium text-slate-600">
          Đang kiểm tra đăng nhập...
        </p>
      </div>
    )
  }

  return (
    <AuthScreen
      onSuccess={() => {
        router.replace('/')
      }}
    />
  )
}
