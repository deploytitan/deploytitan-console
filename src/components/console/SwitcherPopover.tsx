'use client'

/**
 * SwitcherPopover — inline dropdown for org/project selection in the sidebar.
 *
 * Renders a flat list in a bordered container anchored below its trigger.
 * Uses position: fixed via a portal to escape sidebar's stacking context.
 * Supports keyboard navigation (arrow keys, Enter, Escape).
 *
 * Design constraints (DeployTitan system):
 * - 2px border-radius everywhere
 * - Restrained color strategy: ink neutrals, amber only on active checkmark
 * - No cards, no glassmorphism, no gradient text
 * - Flat-at-rest (no shadow), compound amber-outline shadow on open
 * - JetBrains Mono for item names (machine-originated slugs / org identifiers)
 * - Instrument Sans for action labels ("New workspace")
 */

import {
  useRef,
  useEffect,
  useCallback,
  useId,
  type KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, Plus } from 'lucide-react'

export interface SwitcherItem {
  id: string
  name: string
  /** Shown below the name in a lighter mono label */
  slug?: string
}

interface SwitcherPopoverProps {
  /** Whether the popover is currently open */
  open: boolean
  /** Called to close the popover */
  onClose: () => void
  /** The trigger element's ref — used to position the popover */
  triggerRef: React.RefObject<HTMLButtonElement | null>
  /** The list of items to display */
  items: SwitcherItem[]
  /** The currently selected item id */
  selectedId: string | null
  /** Called when an item is selected */
  onSelect: (item: SwitcherItem) => void
  /** Loading state — shows skeleton items */
  isLoading?: boolean
  /** Shown at top when the list is empty and not loading */
  emptyMessage?: string
  /** Optional action rendered at the bottom of the list */
  action?: {
    label: string
    onAction: () => void
  }
  /** Accessible label for the listbox */
  label: string
}

/**
 * Tiny hook: closes the popover on outside click or Escape key.
 */
function useLightDismiss(
  open: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLDivElement | null>,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
) {
  useEffect(() => {
    if (!open) return

    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        containerRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      onClose()
    }

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, containerRef, triggerRef])
}

export function SwitcherPopover({
  open,
  onClose,
  triggerRef,
  items,
  selectedId,
  onSelect,
  isLoading = false,
  emptyMessage = 'Nothing here yet.',
  action,
  label,
}: SwitcherPopoverProps) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const activeIndexRef = useRef<number>(-1)

  useLightDismiss(open, onClose, containerRef, triggerRef)

  // Focus first item when popover opens.
  useEffect(() => {
    if (!open) return
    const firstItem = containerRef.current?.querySelector<HTMLElement>(
      '[role="option"]',
    )
    firstItem?.focus()
  }, [open])

  // Position the popover below the trigger.
  const getPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return {}
    return {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    }
  }, [triggerRef])

  const handleItemKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number, item: SwitcherItem) => {
      const options = containerRef.current?.querySelectorAll<HTMLElement>(
        '[role="option"]',
      )
      if (!options) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = options[Math.min(index + 1, options.length - 1)]
        next?.focus()
        activeIndexRef.current = Math.min(index + 1, options.length - 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (index === 0) {
          triggerRef.current?.focus()
          activeIndexRef.current = -1
        } else {
          const prev = options[index - 1]
          prev?.focus()
          activeIndexRef.current = index - 1
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect(item)
        onClose()
        triggerRef.current?.focus()
      }
    },
    [onSelect, onClose, triggerRef],
  )

  if (!open) return null

  const pos = getPosition()
  const isDark = document.documentElement.classList.contains('dark')

  // Shadow adapts for dark mode: black at 0% opacity is invisible on dark surfaces,
  // so we invert to a white-tinted shadow instead. The amber ring works on both.
  const shadow = isDark
    ? '0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,180,84,0.16)'
    : '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(201,168,76,0.12)'

  return createPortal(
    <div
      ref={containerRef}
      role="listbox"
      aria-label={label}
      id={listboxId}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        boxShadow: shadow,
        zIndex: 200,
      }}
      className="flex flex-col overflow-hidden rounded-[6px] border border-line bg-surface py-1"
    >
      {isLoading ? (
        <LoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        items.map((item, i) => {
          const isSelected = item.id === selectedId
          return (
            <button
              key={item.id}
              role="option"
              aria-selected={isSelected}
              tabIndex={0}
              onKeyDown={(e) => handleItemKeyDown(e, i, item)}
              onClick={() => {
                onSelect(item)
                onClose()
                triggerRef.current?.focus()
              }}
              className={[
                'flex min-h-[2rem] w-full items-center justify-between px-3 py-1.5 text-left',
                'transition-colors focus:outline-none focus-visible:bg-line-subtle',
                isSelected
                  ? 'bg-line-subtle text-ink'
                  : 'text-ink-secondary hover:bg-line-subtle hover:text-ink',
              ].join(' ')}
            >
              <span className="flex flex-col gap-0.5 min-w-0">
                <span
                  className={[
                    'truncate font-mono text-[11px] leading-none tracking-wide',
                    isSelected ? 'text-ink font-medium' : 'text-ink-secondary',
                  ].join(' ')}
                >
                  {item.name}
                </span>
                {item.slug && (
                  <span className="truncate font-mono text-[10px] leading-none tracking-wider text-ink-quaternary">
                    {item.slug}
                  </span>
                )}
              </span>
              {isSelected && (
                <Check
                  size={12}
                  strokeWidth={2.5}
                  className="ml-2 shrink-0 text-primary"
                />
              )}
            </button>
          )
        })
      )}

      {action && !isLoading && (
        <>
          <div className="mx-3 my-1 h-px bg-line" />
          <ActionButton label={action.label} onAction={action.onAction} onClose={onClose} />
        </>
      )}
    </div>,
    document.body,
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-2" aria-busy="true" aria-label="Loading">
      {[65, 85, 50].map((w, i) => (
        <div
          key={i}
          className="h-[8px] animate-pulse rounded-[1px] bg-line"
          style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-3 py-2.5 font-body text-[11px] text-ink-tertiary">
      {message}
    </div>
  )
}

function ActionButton({
  label,
  onAction,
  onClose,
}: {
  label: string
  onAction: () => void
  onClose: () => void
}) {
  return (
    <button
      role="option"
      aria-selected={false}
      tabIndex={0}
      onClick={() => {
        onAction()
        onClose()
      }}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-body text-[11px] text-ink-tertiary transition-colors hover:bg-line-subtle hover:text-ink focus:outline-none focus-visible:bg-line-subtle"
    >
      <Plus size={11} strokeWidth={2.5} className="shrink-0" />
      {label}
    </button>
  )
}

/**
 * Convenience: the trigger button used in the sidebar.
 * Accepts a ref so SwitcherPopover can position against it.
 */
interface SwitcherTriggerProps {
  label: string
  /** True when no selection exists — renders in dimmed style */
  dim?: boolean
  /** Left padding multiplier for indented project switcher */
  indent?: boolean
  open: boolean
  onClick: () => void
  'aria-expanded': boolean
  'aria-controls': string
  triggerRef: React.RefObject<HTMLButtonElement | null>
}

export function SwitcherTrigger({
  label,
  dim,
  indent,
  open,
  onClick,
  triggerRef,
  ...ariaProps
}: SwitcherTriggerProps) {
  return (
    <button
      ref={triggerRef}
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={ariaProps['aria-expanded']}
      aria-controls={ariaProps['aria-controls']}
      className={[
        'flex h-8 w-full items-center justify-between rounded-[6px] px-2.5 transition-colors',
        'hover:bg-sidebar-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring',
        indent ? 'pl-5' : '',
        dim ? 'text-sidebar-foreground/40' : 'text-sidebar-foreground font-medium',
        open ? 'bg-sidebar-accent' : '',
      ].join(' ')}
    >
      <span className="truncate font-mono text-[12px] tracking-wide">{label}</span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className={[
          'ml-1 shrink-0 text-ink-quaternary transition-transform duration-150',
          open ? 'rotate-180' : '',
        ].join(' ')}
        aria-hidden="true"
      >
        <path
          d="M2.5 4.5L6 8L9.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
