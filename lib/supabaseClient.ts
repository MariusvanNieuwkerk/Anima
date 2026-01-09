import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Harde check op .env.local - Verifieer project 'fajyyoulxtdjnhioxegy'
const isCorrectProject = supabaseUrl.includes('fajyyoulxtdjnhioxegy');

// Check if we have valid environment variables
const hasValidConfig = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== '' && 
  supabaseAnonKey !== '' &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseAnonKey.includes('placeholder') &&
  isCorrectProject; // Force check op correct project

// Create Supabase client with silent error handling
// If env variables are missing, create a mock client that fails gracefully
export const supabaseClient: SupabaseClient = hasValidConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

// Helper function to test connection (silent - no errors thrown)
export const testSupabaseConnection = async (): Promise<boolean> => {
  try {
    // Check if we have valid configuration
    if (!hasValidConfig) {
      return false;
    }
    // Try a simple query to test connection
    // Using profiles table (new schema) - if it doesn't exist yet, we'll get an error but that's OK
    // The important thing is to check if we can connect to Supabase
    const { error } = await supabaseClient.from('profiles').select('id').limit(1);
    // If no error or error is just "table doesn't exist" (which is OK), consider connected
    // Only return false on actual connection/network errors
    if (error) {
      // If error code suggests connection issue, return false
      // Otherwise (e.g., table doesn't exist yet), consider it connected
      return error.code !== 'PGRST116' && error.code !== '42P01';
    }
    return true;
  } catch {
    // Silent failure - return false if connection fails
    return false;
  }
};

