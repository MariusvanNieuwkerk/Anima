'use client'

import { X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface StudentDetailSheetProps {
  studentName: string
  onClose: () => void
}

// Mock data per student (similar to ParentDashboard)
const studentData: Record<string, { focusData: Array<{ name: string; value: number; color: string; flowScore: number; flowLabel: string }>; diagnoseText: string }> = {
  Rens: {
    focusData: [
      { name: 'Wiskunde', value: 45, color: '#a8a29e', flowScore: 30, flowLabel: 'Pittig' },
      { name: 'Geschiedenis', value: 30, color: '#d6d3d1', flowScore: 90, flowLabel: 'In de zone' },
      { name: 'Engels', value: 25, color: '#e7e5e4', flowScore: 60, flowLabel: 'Stabiel' },
    ],
    diagnoseText: "Rens worstelt met de tafels bij het oplossen van breuken. Hij begrijpt het concept, maar maakt rekenfouten. Frustratie-niveau was hoog.",
  },
  Sofie: {
    focusData: [
      { name: 'Wiskunde', value: 50, color: '#a8a29e', flowScore: 25, flowLabel: 'Pittig' },
      { name: 'Engels', value: 30, color: '#e7e5e4', flowScore: 70, flowLabel: 'Stabiel' },
      { name: 'Geschiedenis', value: 20, color: '#d6d3d1', flowScore: 85, flowLabel: 'In de zone' },
    ],
    diagnoseText: "Sofie heeft moeite met het herkennen van breuken in context. Ze snapt de theorie, maar kan het niet toepassen in verhaaltjessommen.",
  },
  Ahmed: {
    focusData: [
      { name: 'Begrijpend Lezen', value: 60, color: '#a8a29e', flowScore: 35, flowLabel: 'Pittig' },
      { name: 'Wiskunde', value: 25, color: '#d6d3d1', flowScore: 75, flowLabel: 'Stabiel' },
      { name: 'Engels', value: 15, color: '#e7e5e4', flowScore: 80, flowLabel: 'In de zone' },
    ],
    diagnoseText: "Ahmed heeft problemen met het identificeren van de hoofdgedachte in teksten. Hij blijft hangen in details en mist de grote lijn.",
  },
  Lisa: {
    focusData: [
      { name: 'Topografie', value: 55, color: '#a8a29e', flowScore: 95, flowLabel: 'In de zone' },
      { name: 'Wiskunde', value: 30, color: '#d6d3d1', flowScore: 85, flowLabel: 'In de zone' },
      { name: 'Engels', value: 15, color: '#e7e5e4', flowScore: 70, flowLabel: 'Stabiel' },
    ],
    diagnoseText: "Lisa heeft alle basisstof onder de knie en is klaar voor verdieping. Ze zoekt uitdaging en kan zelfstandig complexere opdrachten aan.",
  },
  Tom: {
    focusData: [
      { name: 'Topografie', value: 50, color: '#a8a29e', flowScore: 90, flowLabel: 'In de zone' },
      { name: 'Geschiedenis', value: 35, color: '#d6d3d1', flowScore: 80, flowLabel: 'In de zone' },
      { name: 'Wiskunde', value: 15, color: '#e7e5e4', flowScore: 75, flowLabel: 'Stabiel' },
    ],
    diagnoseText: "Tom beheerst de topografie volledig. Hij kan zelfstandig werken aan extra projecten en zou baat hebben bij meer creatieve opdrachten.",
  },
}

// Default data for students not in the list
const defaultData = {
  focusData: [
    { name: 'Wiskunde', value: 45, color: '#a8a29e', flowScore: 50, flowLabel: 'Stabiel' },
    { name: 'Geschiedenis', value: 30, color: '#d6d3d1', flowScore: 60, flowLabel: 'Stabiel' },
    { name: 'Engels', value: 25, color: '#e7e5e4', flowScore: 65, flowLabel: 'Stabiel' },
  ],
  diagnoseText: "Deze leerling werkt gestaag aan verschillende onderwerpen. Er zijn geen bijzondere knelpunten gemeld.",
}

export default function StudentDetailSheet({ studentName, onClose }: StudentDetailSheetProps) {
  const data = studentData[studentName] || defaultData
  const { focusData, diagnoseText } = data
  const totalMinutes = focusData.reduce((sum, item) => sum + item.value, 0)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl border-l border-stone-300 z-50 overflow-y-auto transform transition-transform duration-300 ease-out">
        <div className="p-5 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6 md:mb-6 border-b border-stone-200 pb-4">
            <h2 className="text-2xl md:text-2xl font-bold text-stone-900 flex-1 min-w-0">{studentName}</h2>
            <button
              onClick={onClose}
              className="p-2 text-stone-700 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-all duration-200 active:scale-90 hover:scale-110 hover:rotate-90 flex-shrink-0 ml-3"
              aria-label="Sluit"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>

          {/* Section 1: AI Diagnose */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-stone-900 mb-3 md:mb-3">AI Diagnose</h3>
            <div className="bg-stone-100 rounded-2xl md:rounded-2xl border border-stone-300 p-4 md:p-4 shadow-sm">
              <p className="text-sm md:text-sm text-stone-800 leading-relaxed font-medium">{diagnoseText}</p>
            </div>
          </div>

          {/* Section 2: Focus Donut Chart */}
          <div className="mb-6 md:mb-8">
            <h3 className="text-base md:text-lg font-bold text-stone-900 mb-4 md:mb-4">Focus</h3>
            <div className="bg-white rounded-2xl border border-stone-300 p-4 shadow-sm">
              <div className="relative w-full mb-4" style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={focusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {focusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl md:text-2xl font-bold text-stone-900">{totalMinutes}</div>
                    <div className="text-xs text-stone-600 font-medium">min</div>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 md:space-y-2 border-t border-stone-200 pt-4">
                {focusData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm md:text-sm">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-3.5 h-3.5 md:w-3 md:h-3 rounded-full flex-shrink-0 border border-stone-300" style={{ backgroundColor: item.color }}></div>
                      <span className="text-stone-900 font-medium truncate">{item.name}</span>
                    </div>
                    <span className="text-stone-700 font-semibold flex-shrink-0 ml-2">{item.value} min</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Flow per Onderwerp */}
          <div>
            <h3 className="text-base md:text-lg font-bold text-stone-900 mb-4 md:mb-4">Flow</h3>
            <div className="bg-white rounded-2xl border border-stone-300 p-4 shadow-sm space-y-4 md:space-y-4">
              {focusData.map((item, index) => {
                const isLowFlow = item.flowScore < 50
                const isHighFlow = item.flowScore >= 70
                const barColor = isLowFlow ? 'bg-orange-400' : isHighFlow ? 'bg-stone-700' : 'bg-stone-500'

                return (
                  <div key={index} className="space-y-2 md:space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm md:text-sm font-semibold text-stone-900 truncate">{item.name}</span>
                      <span className="text-xs md:text-xs text-stone-600 font-medium flex-shrink-0 bg-stone-100 px-2.5 py-1 rounded-full">{item.flowLabel}</span>
                    </div>
                    <div className="relative h-2.5 md:h-2 bg-stone-200 rounded-full overflow-hidden border border-stone-300">
                      <div
                        className={`absolute top-0 left-0 h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${item.flowScore}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
