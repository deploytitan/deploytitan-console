'use client'

/**
 * UserAvatar — displays a user's profile picture or initials fallback.
 *
 * Used in Navbar to show the currently authenticated user.
 */

interface UserAvatarProps {
  profilePictureUrl?: string | null | undefined
  firstName?: string | null | undefined
  lastName?: string | null | undefined
  email: string
  size?: 'sm' | 'md'
}

function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  email: string,
): string {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function UserAvatar({
  profilePictureUrl,
  firstName,
  lastName,
  email,
  size = 'sm',
}: UserAvatarProps) {
  const dim = size === 'sm' ? 28 : 36
  const fontSize = size === 'sm' ? '10px' : '13px'

  if (profilePictureUrl) {
    return (
      <img
        src={profilePictureUrl}
        alt={firstName ?? email}
        width={dim}
        height={dim}
        style={{
          borderRadius: '4px',
          objectFit: 'cover',
          border: '1px solid var(--color-line)',
          display: 'block',
        }}
      />
    )
  }

  const initials = getInitials(firstName, lastName, email)

  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: '4px',
        background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--color-primary-accessible)',
        fontWeight: 600,
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
