'use client'

type ViewType = 'chat' | 'board'

interface CapsuleSwitchProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  hasNewImage?: boolean
}

export default function CapsuleSwitch({ activeView, onViewChange, hasNewImage }: CapsuleSwitchProps) {
  return (
    <div className="flex items-center bg-stone-100/90 backdrop-blur-sm rounded-full p-1.5 md:p-2 border border-stone-300 w-full max-w-xs md:max-w-sm shadow-md shadow-stone-300/40">
      <button
        onClick={() => onViewChange('chat')}
        className={`flex-1 px-6 py-2.5 md:px-8 md:py-4 rounded-full text-sm md:text-lg font-semibold transition-all duration-300 ease-out ${
          activeView === 'chat'
            ? 'bg-white text-stone-900 shadow-lg scale-[1.02]'
            : 'text-stone-700 hover:text-stone-900 active:scale-95'
        }`}
      >
        Chat
      </button>
      <button
        onClick={() => onViewChange('board')}
        className={`flex-1 px-6 py-2.5 md:px-8 md:py-4 rounded-full text-sm md:text-lg font-semibold transition-all duration-300 ease-out ${
          activeView === 'board'
            ? 'bg-white text-stone-900 shadow-lg scale-[1.02]'
            : hasNewImage
              ? 'bg-emerald-100 text-emerald-800 hover:text-emerald-900 active:scale-95'
            : 'text-stone-700 hover:text-stone-900 active:scale-95'
        }`}
      >
        Board
      </button>
    </div>
  )
}
