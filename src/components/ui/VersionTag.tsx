'use client'

/**
 * VersionTag — compact monospace chip displaying a version string.
 * Truncates long sha hashes to 7 chars.
 */

interface VersionTagProps {
  version: string
  /** If true, treat version as a commit SHA and show first 7 chars */
  sha?: boolean
}

export function VersionTag({ version, sha = false }: VersionTagProps) {
  const display = sha && version.length > 9 ? version.slice(0, 7) : version

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 font-mono text-xs text-ink-secondary bg-surface-alt border border-line"
      style={{ borderRadius: '2px' }}
    >
      {sha && <span className="text-ink-quaternary mr-1 select-none">@</span>}
      {display}
    </span>
  )
}
