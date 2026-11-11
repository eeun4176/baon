/*
 * Avatar.tsx — The student's round picture: their photo (Google or uploaded) if they
 * have one, otherwise the first letter of their name on light blue.
 * Decorative (the name is always shown next to it).
 */
import { firstName } from '../home/greetings.ts'
import { useSession } from '../session.ts'

/** Round avatar; size and text size come from `className` (e.g. "size-10 text-base"). */
export function Avatar({ className = 'size-10' }: { className?: string }) {
  const { name, profile } = useSession()
  if (profile.photo) return <img src={profile.photo} alt="" className={`shrink-0 rounded-full object-cover ${className}`} />
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-blue-tint font-black text-blue ${className}`} aria-hidden="true">
      {firstName(name).charAt(0).toUpperCase()}
    </span>
  )
}
