import { supabaseServer } from './supabaseServer';

export interface UserProfile {
  id: string;
  email?: string | null;
  role: 'student' | 'parent' | 'teacher';
  // Some DBs use display_name; others only have student_name/parent_name/teacher_name.
  display_name?: string | null;
  username?: string | null;
  student_name: string | null;
  parent_name: string | null;
  teacher_name: string | null;
  deep_read_mode?: boolean | null;
}

/**
 * Haal het user profile op uit de profiles tabel
 * Gebruikt Supabase Auth om de huidige gebruiker op te halen
 */
export async function getUserProfile(userId?: string): Promise<UserProfile | null> {
  try {
    let targetUserId = userId;

    // Als er geen userId is opgegeven, haal de huidige sessie op
    if (!targetUserId) {
      const { data: { session }, error: sessionError } = await supabaseServer.auth.getSession();
      
      if (sessionError || !session?.user) {
        // Geen actieve sessie, return null
        return null;
      }
      
      targetUserId = session.user.id;
    }
    
    const { data, error } = await supabaseServer
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (error) {
      // Als profile niet bestaat, return null (niet crashen)
      console.log('[AUTH] Profile niet gevonden voor user:', targetUserId);
      return null;
    }

    return data as UserProfile;
  } catch (error) {
    console.error('[AUTH] Exception fetching profile:', error);
    return null;
  }
}

/**
 * Maak een fallback profile aan met role 'student'
 */
export function createFallbackProfile(userId?: string): UserProfile {
  return {
    id: userId || 'fallback-user',
    email: 'guest@anima.local',
    role: 'student',
    student_name: 'Rens',
    parent_name: null,
    teacher_name: null
  };
}

/**
 * Check of de gebruiker toegang heeft tot een specifieke resource
 */
export function hasAccess(userProfile: UserProfile | null, requiredRole: 'student' | 'parent' | 'teacher'): boolean {
  if (!userProfile) return false;
  return userProfile.role === requiredRole;
}

/**
 * Check of een student toegang heeft tot zijn eigen data
 */
export function canAccessStudentData(userProfile: UserProfile | null, studentName: string): boolean {
  if (!userProfile) return false;
  
  // Studenten kunnen alleen hun eigen data zien
  if (userProfile.role === 'student') {
    return userProfile.student_name === studentName;
  }
  
  // Ouders kunnen alleen data van hun kind zien
  if (userProfile.role === 'parent') {
    return userProfile.student_name === studentName;
  }
  
  // Leraren kunnen alle studenten zien (via classroom_students)
  if (userProfile.role === 'teacher') {
    return true; // Wordt verder gefilterd in TeacherDashboard
  }
  
  return false;
}

