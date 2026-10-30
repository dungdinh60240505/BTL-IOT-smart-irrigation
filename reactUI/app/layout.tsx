import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { PwaRegister } from '@/components/pwa/pwa-register'
import './globals.css'

export const metadata: Metadata = {
  title: 'AquaSense | Smart Watering Control Plane',
  description: 'Real-time greenhouse irrigation telemetry, analytics, and pump controls.',
  generator: 'v0.app',
  applicationName: 'AquaSense',
  manifest: '/manifest.webmanifest',
  // iOS: cho phép chạy standalone khi "Thêm vào MH chính"
  appleWebApp: {
    capable: true,
    title: 'AquaSense',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f0f8f2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi">
      <body className="antialiased bg-[#f0f8f2]">
        {children}
        <InstallPrompt />
        <PwaRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
