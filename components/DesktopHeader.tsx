'use client'

interface DesktopHeaderProps {
  animaName: string
}

export default function DesktopHeader({ animaName }: DesktopHeaderProps) {
  return (
    <header className="hidden xl:flex items-center px-6 py-6 border-b border-stone-200 bg-white">
      <h1 className="text-2xl font-semibold text-stone-800">{animaName}</h1>
    </header>
  )
}
