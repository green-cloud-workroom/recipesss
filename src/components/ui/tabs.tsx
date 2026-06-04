import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function Tabs({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('fp-tabs', className)} {...props} />
}
