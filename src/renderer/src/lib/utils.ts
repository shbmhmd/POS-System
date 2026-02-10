import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function calculateTax(
  amount: number,
  taxRate: number,
  taxMode: 'inclusive' | 'exclusive'
): { taxAmount: number; preTaxAmount: number; totalAmount: number } {
  if (taxMode === 'exclusive') {
    const taxAmount = amount * (taxRate / 100)
    return {
      preTaxAmount: amount,
      taxAmount,
      totalAmount: amount + taxAmount
    }
  } else {
    // Inclusive: tax is already included in the amount
    const preTaxAmount = amount / (1 + taxRate / 100)
    const taxAmount = amount - preTaxAmount
    return {
      preTaxAmount,
      taxAmount,
      totalAmount: amount
    }
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}
