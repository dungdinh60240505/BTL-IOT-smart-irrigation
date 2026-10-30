'use client'

import { useState } from 'react'
import { Droplets, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiRequest } from '@/lib/api'

export function AuthScreen({
  onClose,
  onSuccess,
}: {
  onClose?: () => void
  onSuccess: (user: unknown) => void
}) {
  const [register, setRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const endpoint = register
        ? '/api/auth/register'
        : '/api/auth/login'
      const response = await apiRequest<{
        token?: string
        user: unknown
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })

      if (response.token) {
        localStorage.setItem('auth_token', response.token)
      }
      onSuccess(response.user)
      onClose?.()
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Lỗi xác thực',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl">
        <CardHeader>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Droplets className="size-5 text-cyan-600" />
              <span className="font-semibold">AquaSense</span>
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Đóng"
              >
                <X />
              </Button>
            )}
          </div>
          <CardTitle>
            {register ? 'Đăng ký tài khoản' : 'Đăng nhập hệ thống'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {register
              ? 'Thiết lập tài khoản quản lý tưới nước thông minh.'
              : 'Đăng nhập vào bảng điều khiển vườn.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="username">Tên người dùng (Username)</Label>
              <Input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="vd: admin"
                className="text-black"
                autoComplete="username"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="text-black"
                autoComplete={
                  register ? 'new-password' : 'current-password'
                }
                required
              />
            </div>
            <Button
              disabled={submitting}
              type="submit"
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting
                ? 'Đang xử lý...'
                : register
                  ? 'Đăng ký'
                  : 'Đăng nhập'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRegister((current) => !current)
                setError('')
              }}
            >
              {register
                ? 'Đã có tài khoản? Đăng nhập'
                : 'Chưa có tài khoản? Đăng ký ngay'}
            </Button>
          </form>

          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[11px] leading-relaxed text-emerald-800 sm:hidden">
            Có áp dụng trên điện thoại, hãy thêm vào MH chính.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
