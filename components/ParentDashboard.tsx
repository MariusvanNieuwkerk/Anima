'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { MessageCircle } from 'lucide-react'
import { supabase } from '../utils/supabase'
import { type UserProfile } from '../utils/auth'

interface ParentDashboardProps {
  studentName?: string
  parentName?: string
  userProfile?: UserProfile | null
}

// Fallback test data (alleen als er geen echte insights zijn)
const fallbackFocusData = [
  { name: 'Wiskunde', value: 45, color: '#a8a29e', flowScore: 30, flowLabel: 'Pittig' },
  { name: 'Geschiedenis', value: 30, color: '#d6d3d1', flowScore: 90, flowLabel: 'In de zone' },
  { name: 'Engels', value: 25, color: '#e7e5e4', flowScore: 60, flowLabel: 'Stabiel' },
]

const fallbackConversationTip = "Vraag Rens hoe hij die moeilijke som met breuken uiteindelijk toch heeft opgelost."

export default function ParentDashboard({ studentName = 'Rens', parentName = 'Marius', userProfile }: ParentDashboardProps) {
  // PERSONALIZATION: Gebruik profile data, geen fallback "Gebruiker"
  const effectiveStudentName = userProfile?.student_name || studentName || 'Student';
  const effectiveParentName = userProfile?.parent_name || parentName || 'Ouder';
  const [deepReadMode, setDeepReadMode] = useState(false)
  const [focusData, setFocusData] = useState(fallbackFocusData)
  const [conversationTip, setConversationTip] = useState(fallbackConversationTip)
  const [totalMinutes, setTotalMinutes] = useState(fallbackFocusData.reduce((sum, item) => sum + item.value, 0))
  const [isLoading, setIsLoading] = useState(true)
  const [hasRealData, setHasRealData] = useState(false)

  // Haal echte insights data op uit Supabase
  useEffect(() => {
    const fetchInsights = async () => {
      try {
        console.log('[PARENT DASHBOARD] Fetching insights from Supabase...')
        
        // Filter: Alleen insights van de eigen student (gebruik al berekende effectiveStudentName)
        
        const { data: insights, error } = await supabase
          .from('insights')
          .select('*')
          .eq('student_name', effectiveStudentName) // Alleen eigen student
          .order('created_at', { ascending: false })
          .limit(10)

        if (error) {
          console.error('[PARENT DASHBOARD] Error fetching insights:', error)
          setIsLoading(false)
          return
        }

        if (insights && insights.length > 0) {
          console.log(`[PARENT DASHBOARD] ✅ Found ${insights.length} insights, using real data`)
          
          // Groepeer insights per topic en bereken gemiddelde flow_score
          const topicMap = new Map<string, { count: number, totalFlow: number, latestTip: string }>()
          
          insights.forEach(insight => {
            const existing = topicMap.get(insight.topic) || { count: 0, totalFlow: 0, latestTip: insight.parent_tip }
            topicMap.set(insight.topic, {
              count: existing.count + 1,
              totalFlow: existing.totalFlow + insight.flow_score,
              latestTip: insight.parent_tip // Gebruik meest recente tip
            })
          })

          // Converteer naar focusData formaat - alleen 3 meest recente
          const colors = ['#a8a29e', '#d6d3d1', '#e7e5e4'] // Stone-500, Stone-300, Stone-200
          const realFocusData = Array.from(topicMap.entries())
            .slice(0, 3) // Alleen 3 meest recente onderwerpen
            .map(([topic, data], index) => {
              const avgFlow = Math.round(data.totalFlow / data.count)
              const flowLabel = avgFlow < 50 ? 'Pittig' : avgFlow >= 70 ? 'In de zone' : 'Stabiel'
              return {
                name: topic.charAt(0).toUpperCase() + topic.slice(1),
                value: data.count * 10, // Simuleer minuten (1 insight = 10 min)
                color: colors[index % colors.length],
                flowScore: avgFlow,
                flowLabel: flowLabel
              }
            })

          if (realFocusData.length > 0) {
            setFocusData(realFocusData)
            setConversationTip(insights[0].parent_tip) // Meest recente tip
            setTotalMinutes(realFocusData.reduce((sum, item) => sum + item.value, 0))
            setHasRealData(true)
            console.log('[PARENT DASHBOARD] Updated with real insights data')
          } else {
            setHasRealData(false)
          }
        } else {
          console.log('[PARENT DASHBOARD] No insights found, using fallback data')
          setHasRealData(false)
        }
      } catch (error) {
        console.error('[PARENT DASHBOARD] Exception fetching insights:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchInsights()
  }, [])

  // Get today's date in Dutch format
  const today = new Date()
  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag']
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
  const dateString = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]}`

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50">
      <div className="max-w-6xl mx-auto mt-8 md:mt-12 p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold text-stone-900 mb-2 leading-tight">
            Hoi {effectiveParentName}, hier is de update van {effectiveStudentName}.
          </h1>
          <p className="text-stone-500 text-sm md:text-base">{dateString}</p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mb-6">
          {/* Focus Cirkel (Donut Chart) */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-4 md:p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Focus</h2>
            <div className="relative w-full" style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={focusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
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
                  <div className="text-2xl font-semibold text-stone-900">{totalMinutes}</div>
                  <div className="text-xs text-stone-500">min</div>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {hasRealData && focusData.length > 0 ? (
                focusData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-stone-700">{item.name}</span>
                    </div>
                    <span className="text-stone-600 font-medium">{item.value} min</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-stone-500 leading-relaxed">
                    {effectiveStudentName} heeft vandaag nog niet gewerkt. Zodra {effectiveStudentName === 'Rens' ? 'hij' : 'zij'} begint, zie je hier de updates.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Flow per Onderwerp */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-4 md:p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Flow</h2>
            <div className="space-y-4">
              {hasRealData && focusData.length > 0 ? (
                focusData.map((item, index) => {
                  const isLowFlow = item.flowScore < 50
                  const isHighFlow = item.flowScore >= 70
                  const barColor = isLowFlow ? 'bg-stone-300' : isHighFlow ? 'bg-stone-600' : 'bg-stone-400'
                  
                  return (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-stone-900">{item.name}</span>
                        <span className="text-xs text-stone-500">{item.flowLabel}</span>
                      </div>
                      <div className="relative h-2 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className={`absolute top-0 left-0 h-full ${barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${item.flowScore}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-stone-500 leading-relaxed">
                    {effectiveStudentName} heeft vandaag nog niet gewerkt. Zodra {effectiveStudentName === 'Rens' ? 'hij' : 'zij'} begint, zie je hier de updates.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Gespreksstarter */}
          <div className="bg-stone-100 rounded-3xl border border-stone-200 shadow-sm p-4 md:p-6 md:col-span-2 xl:col-span-1">
            <div className="flex items-start gap-3 mb-3">
              <MessageCircle className="w-5 h-5 text-stone-600 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <div className="flex-1">
                <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                  Tip voor aan tafel
                </div>
                <p className="text-base md:text-lg text-stone-900 leading-relaxed font-medium">
                  {conversationTip}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Diep-Lees Modus (Full Width) */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-4 md:p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Diep-Lees Modus</h2>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-base font-medium text-stone-900">Diep-Lees Modus</span>
                <button
                  onClick={() => setDeepReadMode(!deepReadMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 ${
                    deepReadMode ? 'bg-stone-800' : 'bg-stone-300'
                  }`}
                  role="switch"
                  aria-checked={deepReadMode}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      deepReadMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed">
                Activeer dit om de camera uit te schakelen. Dit dwingt je kind om de vraag rustig over te typen. Dit bevordert begrijpend lezen en vertraagt de haast.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
