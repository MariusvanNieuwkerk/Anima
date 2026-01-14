'use client'

import { useState, useEffect } from 'react'
import { X, Zap, Compass, Sprout, RefreshCw, LogOut, Search, Baby, GraduationCap, BookOpen, Check, PartyPopper, School } from 'lucide-react'

type TutorMode = 'focus' | 'explorer' | 'growth'
type Language = 'nl' | 'en' | 'es' | 'de' | 'fr' | 'it' | 'pt' | 'zh' | 'ar' | 'hi'
type EducationLevel = '6-12' | '13-17' | '18+'

interface SideMenuProps {
  isOpen: boolean
  onClose: () => void
  studentName?: string
  tutorMode: TutorMode
  onTutorModeChange: (mode: TutorMode) => void
  language: Language
  onLanguageChange: (lang: Language) => void
  educationLevel: EducationLevel
  onEducationLevelChange: (level: EducationLevel) => void
  onStartNewSession: () => void
  onLogout: () => void
}

const tutorModes = [
  {
    id: 'focus' as TutorMode,
    icon: Zap,
    title: 'Focus',
    description: 'Kort en krachtig. Voor als je wilt knallen voor een toets.',
  },
  {
    id: 'explorer' as TutorMode,
    icon: Compass,
    title: 'Verkenner',
    description: 'Nieuwsgierig. We ontdekken samen hoe het werkt.',
  },
  {
    id: 'growth' as TutorMode,
    icon: Sprout,
    title: 'Groei',
    description: 'Geduldig en fijn. Voor als je iets nieuws leert.',
  },
]

const allLanguages = [
  { id: 'en' as Language, flag: '🇬🇧', name: 'English', nativeName: 'English' },
  { id: 'nl' as Language, flag: '🇳🇱', name: 'Dutch', nativeName: 'Nederlands' },
  { id: 'es' as Language, flag: '🇪🇸', name: 'Spanish', nativeName: 'Español' },
  { id: 'de' as Language, flag: '🇩🇪', name: 'German', nativeName: 'Deutsch' },
  { id: 'fr' as Language, flag: '🇫🇷', name: 'French', nativeName: 'Français' },
  { id: 'it' as Language, flag: '🇮🇹', name: 'Italian', nativeName: 'Italiano' },
  { id: 'pt' as Language, flag: '🇵🇹', name: 'Portuguese', nativeName: 'Português' },
  { id: 'zh' as Language, flag: '🇨🇳', name: 'Chinese', nativeName: '中文' },
  { id: 'ar' as Language, flag: '🇸🇦', name: 'Arabic', nativeName: 'العربية' },
  { id: 'hi' as Language, flag: '🇮🇳', name: 'Hindi', nativeName: 'हिन्दी' },
]

const getInitials = (name: string) => {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export default function SideMenu({
  isOpen,
  onClose,
  studentName = 'Rens',
  tutorMode,
  onTutorModeChange,
  language,
  onLanguageChange,
  educationLevel,
  onEducationLevelChange,
  onStartNewSession,
  onLogout,
}: SideMenuProps) {
  const [languageSearchQuery, setLanguageSearchQuery] = useState('')
  
  // Converteer educationLevel naar age voor de slider
  const getAgeFromLevel = (level: EducationLevel): number => {
    if (level === '6-12') return 10
    if (level === '13-17') return 15
    return 19 // 18+
  }
  
  const [age, setAge] = useState(getAgeFromLevel(educationLevel))
  
  // Synchroniseer age met educationLevel wanneer prop verandert
  useEffect(() => {
    setAge(getAgeFromLevel(educationLevel))
  }, [educationLevel])
  
  // Converteer age terug naar educationLevel
  const handleAgeChange = (newAge: number) => {
    setAge(newAge)
    if (newAge <= 12) {
      onEducationLevelChange('6-12')
    } else if (newAge <= 17) {
      onEducationLevelChange('13-17')
    } else {
      onEducationLevelChange('18+')
    }
  }
  
  // Bepaal icoon en label op basis van leeftijd
  const getAgeIcon = () => {
    if (age <= 12) return <PartyPopper className="w-8 h-8 text-stone-600" strokeWidth={2} />; // 6-12
    if (age <= 17) return <School className="w-8 h-8 text-stone-600" strokeWidth={2} />;      // 13-17
    return <GraduationCap className="w-8 h-8 text-stone-600" strokeWidth={2} />;               // 18+
  };

  const getAgeLabel = () => {
    if (age <= 12) return 'Primary (Basisschool)';
    if (age <= 17) return 'Secondary (Middelbaar)';
    return 'Academic (Student)';
  };

  if (!isOpen) return null

  // Filter languages based on search
  const filteredLanguages = allLanguages.filter(
    (lang) =>
      lang.name.toLowerCase().includes(languageSearchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(languageSearchQuery.toLowerCase())
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[100] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Side Panel */}
      <div className="fixed left-0 top-0 bottom-0 w-full max-w-[340px] bg-stone-50 border-r border-stone-300 z-[100] shadow-xl overflow-y-auto">
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-stone-300 sticky top-0 bg-stone-50 z-10">
          <h2 className="text-lg md:text-xl font-semibold text-stone-900">Instellingen</h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-white/50 rounded-xl transition-all duration-200 active:scale-90 hover:scale-110 hover:rotate-90"
            aria-label="Sluit menu"
          >
            <X className="w-6 h-6 md:w-7 md:h-7" strokeWidth={2} />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {/* A. Header (Profiel) */}
          <div className="flex items-center gap-4 pb-4 border-b border-stone-200">
            <div className="w-16 h-16 rounded-full bg-stone-300 flex items-center justify-center text-stone-800 font-bold text-xl border-2 border-stone-400">
              {getInitials(studentName)}
            </div>
            <div>
              <div className="font-semibold text-stone-900 text-lg">{studentName}</div>
              <div className="text-sm text-stone-500">Student Account</div>
            </div>
          </div>

          {/* B. Sectie: Jouw Coach */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Jouw Coach</h3>
            <div className="space-y-2">
              {tutorModes.map((mode) => {
                const Icon = mode.icon
                const isSelected = tutorMode === mode.id
                return (
                  <button
                    key={mode.id}
                    onClick={() => onTutorModeChange(mode.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? 'border-stone-400 bg-stone-200 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-stone-800' : 'text-stone-500'}`}
                        strokeWidth={2}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm mb-0.5 ${isSelected ? 'text-stone-900' : 'text-stone-700'}`}>
                          {mode.title}
                        </div>
                        <div className="text-xs text-stone-600 leading-relaxed">{mode.description}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* C. Sectie: Jouw Leeftijd (Slider) */}
          <div className="space-y-6">
          <div>
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Jouw Leeftijd</h3>
              <div className="bg-white p-5 rounded-2xl border-2 border-stone-200 shadow-sm">
                <div className="flex flex-col items-center mb-4">
                   <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mb-2 border-2 border-stone-100 transition-all">
                      {getAgeIcon()}
                   </div>
                   <span className="text-2xl font-bold text-stone-800">{age >= 19 ? '18+' : age} <span className="text-sm font-normal text-stone-400">jaar</span></span>
                   <span className="text-xs text-stone-400 font-medium bg-stone-100 px-2 py-1 rounded-full mt-1">{getAgeLabel()}</span>
                </div>
                
                <input 
                  type="range" 
                  min="6" 
                  max="19" 
                  value={age} 
                  onChange={(e) => handleAgeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-offset-2"
                />
                <div className="flex justify-between text-[10px] text-stone-400 mt-2 font-medium px-1">
                   <span>6</span>
                   <span>12</span>
                   <span>18+</span>
                </div>
              </div>
              <p className="text-xs text-stone-500 italic mt-2 text-center px-4 leading-relaxed">
                Anima past het taalgebruik en de voorbeelden aan op deze leeftijd.
              </p>
              </div>

              {/* Taal */}
              <div>
              <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Taal</h3>
                {/* Search Bar */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" strokeWidth={2} />
                  <input
                    type="text"
                    value={languageSearchQuery}
                    onChange={(e) => setLanguageSearchQuery(e.target.value)}
                    placeholder="Zoek taal..."
                    className="w-full pl-10 pr-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all"
                  />
                </div>
                {/* Language List */}
                <div className="max-h-40 overflow-y-auto border-2 border-stone-200 rounded-lg bg-white language-list">
                  <div className="p-1 space-y-0.5">
                    {filteredLanguages.map((lang) => {
                      const isSelected = language === lang.id
                      return (
                        <button
                          key={lang.id}
                          onClick={() => onLanguageChange(lang.id)}
                          className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 flex items-center gap-3 ${
                            isSelected
                              ? 'bg-stone-100 border border-stone-300'
                              : 'hover:bg-stone-50 border border-transparent'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isSelected ? 'text-stone-900' : 'text-stone-700'}`}>
                              {lang.nativeName}
                            </div>
                            <div className="text-xs text-stone-500">{lang.name}</div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-stone-600 flex-shrink-0" strokeWidth={2.5} />
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>

          {/* D. Footer (Acties) */}
          <div className="pt-4 border-t border-stone-200 space-y-2">
            <button
              onClick={() => {
                onStartNewSession()
                onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 text-left"
            >
              <RefreshCw className="w-5 h-5 text-stone-600" strokeWidth={2} />
              <span className="font-medium text-stone-700">Nieuwe Sessie Starten</span>
            </button>
            <button
              onClick={() => {
                onLogout()
                onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 text-left"
            >
              <LogOut className="w-5 h-5 text-orange-600" strokeWidth={2} />
              <span className="font-medium text-orange-700">Uitloggen</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
