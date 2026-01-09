// Helper function to get or create a user ID
export function getOrCreateUserId(): string {
  if (typeof window === 'undefined') {
    // Server-side: return empty string (shouldn't happen in client components)
    return '';
  }

  let userId = localStorage.getItem('anima_user_id');
  
  if (!userId) {
    // Generate a simple UUID-like ID
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('anima_user_id', userId);
  }

  return userId;
}

