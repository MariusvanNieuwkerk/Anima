// Supabase Database Types
// Deze types worden gebruikt voor type-safety bij Supabase queries

export type Database = {
  public: {
    Tables: {
      messages: {
        Row: {
          id: number;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: string;
          role: 'user' | 'assistant';
          content: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          created_at?: string;
        };
      };
      mobile_uploads: {
        Row: {
          id: number;
          session_id: string;
          image_data: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          session_id: string;
          image_data: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          session_id?: string;
          image_data?: string;
          created_at?: string;
        };
      };
      visual_misses: {
        Row: {
          id: number;
          keyword: string;
          topic: string | null;
          query: string;
          age: number | null;
          coach: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          keyword: string;
          topic?: string | null;
          query: string;
          age?: number | null;
          coach?: string | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          keyword?: string;
          topic?: string | null;
          query?: string;
          age?: number | null;
          coach?: string | null;
          error?: string | null;
          created_at?: string;
        };
      };
      insights: {
        Row: {
          id: string; // uuid
          topic: string;
          sentiment: string;
          flow_score: number;
          summary: string;
          parent_tip: string;
          needs_attention: boolean;
          knelpunt_detail: string;
          student_name: string | null; // Koppeling naar student
          created_at: string;
        };
        Insert: {
          id?: string; // uuid
          topic: string;
          sentiment: string;
          flow_score: number;
          summary: string;
          parent_tip: string;
          needs_attention?: boolean;
          knelpunt_detail?: string;
          student_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          topic?: string;
          sentiment?: string;
          flow_score?: number;
          summary?: string;
          parent_tip?: string;
          needs_attention?: boolean;
          knelpunt_detail?: string;
          student_name?: string | null;
          created_at?: string;
        };
      };
      classrooms: {
        Row: {
          id: number;
          name: string;
          teacher_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          teacher_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: string;
          teacher_id?: string | null;
          created_at?: string;
        };
      };
      classroom_students: {
        Row: {
          id: number;
          classroom_id: number;
          student_name: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          classroom_id: number;
          student_name: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          classroom_id?: number;
          student_name?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string; // uuid (user_id from auth.users)
          email: string;
          role: 'student' | 'parent' | 'teacher';
          student_name: string | null; // Voor studenten: hun eigen naam. Voor ouders: naam van hun kind.
          parent_name: string | null; // Voor ouders: hun eigen naam
          teacher_name: string | null; // Voor leraren: hun eigen naam
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role: 'student' | 'parent' | 'teacher';
          student_name?: string | null;
          parent_name?: string | null;
          teacher_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          role?: 'student' | 'parent' | 'teacher';
          student_name?: string | null;
          parent_name?: string | null;
          teacher_name?: string | null;
          created_at?: string;
        };
      };
    };
  };
};

