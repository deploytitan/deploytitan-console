'use client'

/**
 * Toaster — DeployTitan-branded sonner wrapper.
 *
 * Overrides sonner's default styles to match the design system:
 * - 2px border-radius (sharp, not pill)
 * - ink surface with token colors
 * - JetBrains Mono for message text
 * - bottom-right position, narrow gap
 */

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={6}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: [
            'dt-toast',
            'flex items-start gap-3 px-4 py-3',
            'border shadow-sm',
            'font-mono text-[11px] leading-snug tracking-[0.02em]',
          ].join(' '),
          title: 'font-mono text-[11px] font-medium leading-snug',
          description: 'font-mono text-[10px] leading-snug mt-0.5',
          actionButton: [
            'font-mono text-[10px] font-medium px-2 py-1',
            'border transition-colors',
          ].join(' '),
          closeButton: 'opacity-50 hover:opacity-100 transition-opacity',
          error: 'dt-toast--error',
          success: 'dt-toast--success',
          warning: 'dt-toast--warning',
          info: 'dt-toast--info',
        },
      }}
    />
  )
}
