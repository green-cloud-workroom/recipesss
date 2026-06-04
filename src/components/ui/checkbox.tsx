import type { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function Checkbox({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn('fp-checkbox', className)}
      type="checkbox"
      {...props}
    />
  )
}
