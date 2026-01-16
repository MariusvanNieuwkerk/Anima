import { redirect } from 'next/navigation'

export default async function ParentPage() {
  redirect('/parent/dashboard')
}

