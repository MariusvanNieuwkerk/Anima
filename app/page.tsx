import { redirect } from 'next/navigation'

export default async function Home() {
  // Middleware handles role-based routing; keep root as a simple redirect target.
  redirect('/student/desk')
}