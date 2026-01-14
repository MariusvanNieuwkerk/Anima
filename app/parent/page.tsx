import ParentDashboard from '@/components/ParentDashboard'
import { getUserProfile, createFallbackProfile } from '@/utils/auth'

export default async function ParentPage() {
  // Haal user profile op server-side
  const userProfile = await getUserProfile() || createFallbackProfile();
  
  // Extra check: alleen parents kunnen hier komen (middleware zou dit al moeten blokkeren)
  if (userProfile.role !== 'parent') {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-600">Toegang geweigerd. Alleen ouders kunnen deze pagina bekijken.</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-stone-50 overflow-hidden">
      <ParentDashboard 
        studentName={userProfile.student_name || 'Rens'} 
        parentName={userProfile.parent_name || 'Ouder'}
        userProfile={userProfile}
      />
    </div>
  );
}

