import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Anima - Digital Desk',
  description: 'A minimal, distraction-free workspace',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
