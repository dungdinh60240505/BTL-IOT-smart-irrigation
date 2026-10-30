import type { MetadataRoute } from 'next'

// Web App Manifest: cho phép "Thêm vào MH chính" và chạy ở chế độ standalone (không thanh URL).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'AquaSense – Tưới cây thông minh',
    short_name: 'AquaSense',
    description: 'Giám sát cảm biến và điều khiển bơm tưới tự động theo thời gian thực.',
    lang: 'vi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f0f8f2',
    theme_color: '#047857',
    categories: ['utilities', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
