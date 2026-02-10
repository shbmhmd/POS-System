import { useEffect, useCallback } from 'react'

type KeyCombo = {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
}

type HotkeyMap = {
  combo: KeyCombo
  handler: () => void
  description?: string
}

function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const keyMatch = event.key.toLowerCase() === combo.key.toLowerCase() ||
    event.code.toLowerCase() === combo.key.toLowerCase()
  const ctrlMatch = !!combo.ctrl === (event.ctrlKey || event.metaKey)
  const shiftMatch = !!combo.shift === event.shiftKey
  const altMatch = !!combo.alt === event.altKey

  return keyMatch && ctrlMatch && shiftMatch && altMatch
}

export function useHotkeys(hotkeys: HotkeyMap[], deps: any[] = []): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs (except F-keys)
      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      const isFunctionKey = event.key.startsWith('F') && event.key.length <= 3

      for (const hotkey of hotkeys) {
        if (matchesCombo(event, hotkey.combo)) {
          if (isInput && !isFunctionKey) continue

          event.preventDefault()
          event.stopPropagation()
          hotkey.handler()
          return
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Predefined keyboard shortcuts for the POS
export const POS_SHORTCUTS = {
  FOCUS_BARCODE: { key: 'F1' },
  OPEN_PAYMENT: { key: 'F2' },
  HOLD_SALE: { key: 'F3' },
  RESUME_SALE: { key: 'F4' },
  OPEN_SEARCH: { key: 'F5' },
  REPRINT_RECEIPT: { key: 'F8' },
  CANCEL: { key: 'Escape' },
  NEW_SALE: { key: 'n', ctrl: true },
  QUICK_CASH: { key: 'Enter', ctrl: true }
} as const
