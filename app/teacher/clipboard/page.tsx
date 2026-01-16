'use client'

import TeacherDashboard from '@/components/TeacherDashboard'

export default function TeacherClipboardPage() {
  return (
    <div
      className="min-h-screen bg-stone-50"
      style={{
        backgroundImage: 'radial-gradient(rgba(120,113,108,0.10) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <TeacherDashboard teacherName="Meneer Jansen" className="Groep 6B" />

      {/* Role badge */}
      <div className="fixed bottom-4 right-4 z-[60]">
        <div className="rounded-full bg-stone-700 text-white text-xs px-3 py-1 shadow-sm border border-stone-500">
          teacher
        </div>
      </div>
    </div>
  )
}


