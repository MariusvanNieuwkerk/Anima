import type { Metadata } from 'next'
import './globals.css'
import 'leaflet/dist/leaflet.css'
import 'katex/dist/katex.min.css'
import 'mafs/core.css'
import DemoModeInit from '@/components/DemoModeInit'

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
      <body>
        <DemoModeInit />
        {children}
      </body>
    </html>
  )
}
