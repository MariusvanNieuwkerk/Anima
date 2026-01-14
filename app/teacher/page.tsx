import TeacherDashboard from '@/components/TeacherDashboard'
import { getUserProfile, createFallbackProfile } from '@/utils/auth'

export default async function TeacherPage() {
  // Haal user profile op server-side
  const userProfile = await getUserProfile() || createFallbackProfile();
  
  // Extra check: alleen teachers kunnen hier komen (middleware zou dit al moeten blokkeren)
  if (userProfile.role !== 'teacher') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Toegang geweigerd. Alleen leraren kunnen deze pagina bekijken.</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-stone-50 overflow-hidden">
      <TeacherDashboard userProfile={userProfile} />
    </div>
  );
}

