"use client";

import React, { useState, useEffect } from 'react';
import { X, Search, Zap, Compass, Sprout, Check, RefreshCw, LogOut, Baby, School, GraduationCap, PartyPopper } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { getUserProfile, type UserProfile } from '../utils/auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tutorMode: 'focus' | 'explorer' | 'growth';
  onModeChange: (mode: 'focus' | 'explorer' | 'growth') => void;
  age: number;
  onAgeChange: (age: number) => void;
  onStartNewSession?: () => void;
  onLogout?: () => void;
}

const getInitials = (name: string) => {
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export default function SettingsModal({ isOpen, onClose, tutorMode, onModeChange, age, onAgeChange, onStartNewSession, onLogout }: SettingsModalProps) {
  const [searchLang, setSearchLang] = useState('');
  const [selectedLang, setSelectedLang] = useState('Nederlands');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // FETCH PROFILE NAME: Haal profile op bij het openen
  useEffect(() => {
    if (isOpen) {
      const fetchProfile = async () => {
        try {
          setIsLoadingProfile(true);
          const userProfile = await getUserProfile();
          setProfile(userProfile);
        } catch (error) {
          console.error('[SETTINGS] Error fetching profile:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      };
      fetchProfile();
    }
  }, [isOpen]);

  const languages = [
    { name: 'Nederlands', native: 'Dutch' },
    { name: 'English', native: 'English' },
    { name: 'Español', native: 'Spanish' },
    { name: 'Deutsch', native: 'German' },
    { name: 'Français', native: 'French' },
    { name: 'العربية', native: 'Arabic' },
  ];

  const filteredLangs = languages.filter(l => l.name.toLowerCase().includes(searchLang.toLowerCase()));

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-start">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Drawer Panel */}
      <div className="relative w-full max-w-[340px] h-full bg-stone-50 shadow-xl flex flex-col animate-in slide-in-from-left duration-300 border-r border-stone-300 overflow-y-auto">
        
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Header (Profiel) */}
          <div className="flex items-center gap-4 pb-4 border-b border-stone-200">
            <div className="w-16 h-16 rounded-full bg-stone-300 flex items-center justify-center text-stone-800 font-bold text-xl border-2 border-stone-400">
              {profile ? getInitials(profile.student_name || profile.parent_name || profile.teacher_name || 'GE') : 'LD'}
            </div>
            <div>
              <div className="font-semibold text-stone-900 text-lg">
                {isLoadingProfile ? 'Laden...' : (profile?.student_name || profile?.parent_name || profile?.teacher_name || 'Gebruiker')}
              </div>
              <div className="text-sm text-stone-500">
                {profile?.role === 'student' ? 'Student Account' : profile?.role === 'parent' ? 'Parent Account' : profile?.role === 'teacher' ? 'Teacher Account' : 'Account'}
              </div>
            </div>
          </div>
          
          {/* 1. Jouw Coach */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Jouw Coach</h3>
            <div className="space-y-2">
              {[
                { id: 'focus', label: 'Focus', sub: 'Kort en krachtig. Voor als je wilt knallen voor een toets.', icon: Zap },
                { id: 'explorer', label: 'Verkenner', sub: 'Nieuwsgierig. We ontdekken samen hoe het werkt.', icon: Compass },
                { id: 'growth', label: 'Groei', sub: 'Geduldig en fijn. Voor als je iets nieuws leert.', icon: Sprout }
              ].map((mode) => {
                const Icon = mode.icon
                const isSelected = tutorMode === mode.id
                return (
                  <button 
                    key={mode.id}
                    onClick={() => onModeChange(mode.id as 'focus' | 'explorer' | 'growth')}
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
                          {mode.label}
                        </div>
                        <div className="text-xs text-stone-600 leading-relaxed">{mode.sub}</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Jouw Leeftijd (Slider) - ZICHTBAAR OP ALLE SCHERMEN */}
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
                  onChange={(e) => onAgeChange(parseInt(e.target.value))}
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

          {/* 3. Taal */}
          <div>
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Taal</h3>
            {/* Search Bar */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" strokeWidth={2} />
              <input
                type="text"
                value={searchLang}
                onChange={(e) => setSearchLang(e.target.value)}
                placeholder="Zoek taal..."
                className="w-full pl-10 pr-3 py-2 bg-white border-2 border-stone-200 rounded-lg text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-stone-400 transition-all"
              />
            </div>
            {/* Language List */}
            <div className="max-h-40 overflow-y-auto border-2 border-stone-200 rounded-lg bg-white language-list">
              <div className="p-1 space-y-0.5">
                {filteredLangs.map((lang) => {
                  const isSelected = selectedLang === lang.name
                  return (
                    <button
                      key={lang.name}
                      onClick={() => setSelectedLang(lang.name)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-all duration-200 flex items-center gap-3 ${
                        isSelected
                          ? 'bg-stone-100 border border-stone-300'
                          : 'hover:bg-stone-50 border border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isSelected ? 'text-stone-900' : 'text-stone-700'}`}>
                          {lang.name}
                        </div>
                        <div className="text-xs text-stone-500">{lang.native}</div>
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

        {/* Footer (Acties) */}
        <div className="pt-4 border-t border-stone-200 space-y-2">
          <button 
            onClick={() => {
              onStartNewSession?.()
              onClose()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white border-2 border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 transition-all duration-200 text-left"
          >
            <RefreshCw className="w-5 h-5 text-stone-600" strokeWidth={2} />
            <span className="font-medium text-stone-700">Nieuwe Sessie Starten</span>
          </button>
          <button 
            onClick={() => {
              onLogout?.()
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
  );
}
