import Workspace from '@/components/Workspace'
import { getUserProfile, createFallbackProfile } from '@/utils/auth'
import { redirect } from 'next/navigation'

export default async function Home() {
  // Haal user profile op server-side
  const userProfile = await getUserProfile() || createFallbackProfile();
  
  // LOGIN REDIRECT: Stuur naar juiste dashboard op basis van role
  if (userProfile.role === 'parent') {
    redirect('/parent');
  } else if (userProfile.role === 'teacher') {
    redirect('/teacher');
  }
  
  // Student blijft op home (desk)
  return <Workspace />
}