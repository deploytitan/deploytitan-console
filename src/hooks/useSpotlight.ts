import { useCallback } from 'react'

export function useSpotlight() {
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    e.currentTarget.style.setProperty('--spotlight-x', `${x}%`)
    e.currentTarget.style.setProperty('--spotlight-y', `${y}%`)
  }, [])
  return { onMouseMove }
}
