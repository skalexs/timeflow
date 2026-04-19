import './globals.css'
import PWARegister from '@/components/PWARegister'

export const metadata = {
  title: 'TimeFlow',
  description: 'Planificación familiar con motor de disponibilidad inteligente',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TimeFlow',
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* PWA / Theme */}
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TimeFlow" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Viewport: viewport-fit=cover for Dynamic Island / notch */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* Color */}
        <meta name="msapplication-TileColor" content="#6366f1" />
        <meta name="msapplication-navbutton-color" content="#6366f1" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a0f' }}>{children}<PWARegister /></body>
    </html>
  )
}
