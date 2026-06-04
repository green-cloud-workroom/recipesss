import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function DialogPanel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('fp-dialog', className)} role="dialog" {...props} />
}
