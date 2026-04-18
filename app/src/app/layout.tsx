import './globals.css'

export const metadata = {
  title: 'TimeFlow',
  description: 'Smart scheduling with AI-powered availability engine',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0a0f' }}>{children}</body>
    </html>
  )
}
