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
