import { describe, expect, it } from 'vitest'

import { cn } from './utils'

describe('cn', () => {
  it('빈 입력은 빈 문자열 반환', () => {
    expect(cn()).toBe('')
  })

  it('단일 문자열 반환', () => {
    expect(cn('px-4')).toBe('px-4')
  })

  it('여러 클래스 공백으로 결합', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
  })

  it('falsy 값은 무시', () => {
    expect(cn('px-4', false, undefined, null, '', 'py-2')).toBe('px-4 py-2')
  })

  it('조건부 (객체) 키 합치기', () => {
    expect(cn('px-4', { 'text-red-500': true, 'text-blue-500': false })).toBe(
      'px-4 text-red-500',
    )
  })

  it('Tailwind 충돌 시 마지막이 이김 (twMerge)', () => {
    // text-sm 다음 text-lg → text-lg 만 남음
    expect(cn('text-sm', 'text-lg')).toBe('text-lg')
    // 같은 prefix 충돌
    expect(cn('px-4', 'px-6')).toBe('px-6')
  })
})
