'use client'

import { Menu, Zap, Compass, Sprout } from 'lucide-react'
import CapsuleSwitch from './CapsuleSwitch'
import CreditBalance from './CreditBalance'

type TutorMode = 'focus' | 'explorer' | 'growth'

interface MobileHeaderProps {
  activeView: 'chat' | 'board'
  onViewChange: (view: 'chat' | 'board') => void
  animaName: string
  onMenuClick: () => void
  tutorMode: TutorMode
  hasNewImage?: boolean
}

const modeIcons: Record<TutorMode, typeof Zap> = {
  focus: Zap,
  explorer: Compass,
  growth: Sprout,
}

export default function MobileHeader({ activeView, onViewChange, animaName, onMenuClick, tutorMode, hasNewImage }: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-stone-50/98 backdrop-blur-md">
      {/* Top row: Menu and Name */}
      <div className="px-5 py-4 md:px-8 md:py-6 flex items-center justify-between">
        <button
          onClick={onMenuClick}
          className="p-2.5 md:p-3.5 text-stone-600 hover:text-stone-800 hover:bg-white/60 rounded-xl transition-all duration-200 -ml-1 active:scale-90 hover:scale-110 hover:rotate-90"
          aria-label="Menu"
        >
          <Menu className="w-7 h-7 md:w-9 md:h-9" strokeWidth={2} />
        </button>
        <h1 className="text-xl md:text-3xl font-semibold text-stone-900 flex-1 text-center tracking-tight flex items-center justify-center gap-2">
          {(() => {
            const Icon = modeIcons[tutorMode]
            return <Icon className="w-6 h-6 md:w-8 md:h-8" strokeWidth={2} />
          })()}
          <span>{animaName}</span>
        </h1>
        <div className="flex items-center justify-end min-w-12 md:min-w-16">
          <CreditBalance />
        </div>
      </div>
      {/* Bottom row: CapsuleSwitch */}
      <div className="px-5 pb-4 md:px-8 md:pb-6 flex justify-center">
        <CapsuleSwitch activeView={activeView} onViewChange={onViewChange} hasNewImage={hasNewImage} />
      </div>
    </header>
  )
}
