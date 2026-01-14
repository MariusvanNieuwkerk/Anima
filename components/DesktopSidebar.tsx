'use client'

import { Users, GraduationCap, Settings } from 'lucide-react'

type TutorMode = 'focus' | 'explorer' | 'growth'

interface DesktopSidebarProps {
  animaName: string
  tutorMode: TutorMode
  onSettingsClick: () => void
}

const modeIcons: Record<TutorMode, string> = {
  focus: '⚡️',
  explorer: '🧭',
  growth: '🌱',
}

export default function DesktopSidebar({ animaName, tutorMode, onSettingsClick }: DesktopSidebarProps) {
  const menuItems = [
    { icon: Users, label: 'Ouder Dashboard', onClick: () => console.log('Ouder Dashboard') },
    { icon: GraduationCap, label: 'Leraren Dashboard', onClick: () => console.log('Leraren Dashboard') },
    { icon: Settings, label: 'Settings', onClick: onSettingsClick },
  ]

  return (
    <aside className="hidden xl:flex flex-col w-56 bg-white/95 backdrop-blur-sm border-r border-stone-300 shadow-lg shadow-stone-300/30">
      {/* Header */}
      <div className="p-5 border-b border-stone-300">
        <h2 className="text-base font-semibold text-stone-900 flex items-center gap-2">
          <span>{modeIcons[tutorMode]}</span>
          <span>{animaName}</span>
        </h2>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-3">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-stone-800 hover:bg-stone-50/80 hover:text-stone-900 rounded-xl transition-all duration-200 text-left mb-1 hover:scale-[1.02] hover:translate-x-1 active:scale-95"
            >
              <Icon className="w-5 h-5 transition-transform duration-200 hover:scale-110 hover:rotate-6" strokeWidth={2} />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
