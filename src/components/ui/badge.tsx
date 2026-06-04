import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

type BadgeVariant = 'danger' | 'muted' | 'success'

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}

export function Badge({
  className,
  variant = 'muted',
  ...props
}: BadgeProps) {
  return <span className={cn('fp-badge', `fp-badge-${variant}`, className)} {...props} />
}
