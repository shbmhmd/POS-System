import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--primary)] text-[var(--primary-foreground)] shadow',
        secondary: 'border-transparent bg-[var(--secondary)] text-[var(--secondary-foreground)]',
        destructive: 'border-transparent bg-[var(--destructive)] text-white shadow',
        outline: 'text-[var(--foreground)]',
        success: 'border-transparent bg-[var(--success)] text-[var(--success-foreground)]',
        warning: 'border-transparent bg-[var(--warning)] text-[var(--warning-foreground)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
