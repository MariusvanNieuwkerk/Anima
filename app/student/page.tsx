import Workspace from '@/components/Workspace'
import { getUserProfile, createFallbackProfile } from '@/utils/auth'
import { redirect } from 'next/navigation'

export default async function StudentPage() {
  // Haal user profile op server-side
  const userProfile = await getUserProfile() || createFallbackProfile();
  
  // Als gebruiker niet student is, redirect naar juiste dashboard
  if (userProfile.role === 'parent') {
    redirect('/parent');
  } else if (userProfile.role === 'teacher') {
    redirect('/teacher');
  }
  
  // Student blijft op student dashboard (desk)
  return <Workspace />
}

