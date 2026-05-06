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
        {/* Preconnect for Inter font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* PWA / Theme — #0A0A0C matches new dark background */}
        <meta name="theme-color" content="#0A0A0C" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TimeFlow" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* Viewport: viewport-fit=cover for Dynamic Island / notch */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* Windows tile */}
        <meta name="msapplication-TileColor" content="#0A0A0C" />
        <meta name="msapplication-navbutton-color" content="#0A0A0C" />
      </head>
      <body>{children}<PWARegister /></body>
    </html>
  )
}
