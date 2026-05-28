'use client'

/**
 * DeployTitan Modal — wraps the shadcn Dialog primitive.
 *
 * Drop-in replacement for the old custom Modal implementation.
 * All accessibility (focus trap, Escape, scroll lock, ARIA) is handled by
 * @base-ui/react/dialog under the hood.
 *
 * Usage:
 *   <Modal open={open} onClose={() => setOpen(false)} title="Confirm rollback">
 *     <p>Are you sure?</p>
 *   </Modal>
 */
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className={className}
        // Override panel styles to match the DeployTitan Instrument Panel:
        // 2px radius, surface bg, amber-ring shadow on the frame.
        style={{ borderRadius: '4px' }}
      >
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}
