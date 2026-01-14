'use client'

type UserRole = 'student' | 'parent' | 'teacher'

interface DevRoleSwitcherProps {
  currentRole: UserRole
  onRoleChange: (role: UserRole) => void
}

const roleCycle: UserRole[] = ['student', 'parent', 'teacher']

export default function DevRoleSwitcher({ currentRole, onRoleChange }: DevRoleSwitcherProps) {
  const handleClick = () => {
    const currentIndex = roleCycle.indexOf(currentRole)
    const nextIndex = (currentIndex + 1) % roleCycle.length
    onRoleChange(roleCycle[nextIndex])
  }

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 bg-stone-900 text-white text-xs px-3 py-1 rounded-full opacity-50 hover:opacity-100 transition-opacity duration-200"
      aria-label="Switch role"
    >
      {currentRole}
    </button>
  )
}

