import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function Table({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('fp-table', className)} role="table" {...props} />
}
