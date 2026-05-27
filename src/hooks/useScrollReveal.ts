import { useRef } from 'react'

export function useScrollReveal() {
  const ref = useRef<HTMLElement>(null)
  // useEffect(() => {
  //   const el = ref.current
  //   if (!el) return
  //   const targets = el.querySelectorAll('[data-reveal]')
  //   if (!targets.length) return
  //   // Initialize as hidden
  //   targets.forEach((t) => {
  //     const target = t as HTMLElement
  //     target.style.opacity = '0'
  //     target.style.transform = 'translateY(20px)'
  //   })
  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       entries.forEach((entry) => {
  //         if (!entry.isIntersecting) return
  //         const t = entry.target as HTMLElement
  //         const delay = parseInt(t.dataset['revealDelay'] ?? '0') * 80
  //         setTimeout(() => {
  //           t.style.transition =
  //             'opacity 800ms cubic-bezier(0.22,1,0.36,1), transform 800ms cubic-bezier(0.22,1,0.36,1)'
  //           t.style.opacity = '1'
  //           t.style.transform = 'translateY(0)'
  //           setTimeout(() => {
  //             t.style.transition = ''
  //             t.style.transform = ''
  //           }, 900)
  //         }, delay)
  //         observer.unobserve(t)
  //       })
  //     },
  //     { threshold: 0.08, rootMargin: '0px 0px -60px 0px' },
  //   )
  //   targets.forEach((t) => observer.observe(t))
  //   return () => observer.disconnect()
  // }, [])
  return ref
}
