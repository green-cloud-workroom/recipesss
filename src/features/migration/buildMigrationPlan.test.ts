/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildMigrationPlan, summarizePlan } from './buildMigrationPlan'
import { migrateV2toV3 } from './migrateV2toV3'
import type { V2State } from './v2State'

const FIXTURE_PATH = resolve(
  process.cwd(),
  'backups/2026-06-03-pre-rewrite.json',
)
const v2 = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as V2State
const result = migrateV2toV3(v2, {
  ownerUid: 'hodu-uid',
  now: 1_780_000_000_000,
})

describe('buildMigrationPlan — 실제 픽스처', () => {
  const writes = buildMigrationPlan(result, 'hodu-uid')

  it('총 쓰기 수 = 드래프트27 + 원료91 + 프리셋100 = 218', () => {
    expect(writes).toHaveLength(218)
    expect(summarizePlan(writes)).toEqual({
      recipeDrafts: 27,
      ingredients: 91,
      presets: 100,
      total: 218,
    })
  })

  it('컬렉션 경로가 SPEC §4.9 + uid 를 반영', () => {
    const draft = writes.find((w) => w.kind === 'recipeDraft')!
    const ing = writes.find((w) => w.kind === 'ingredient')!
    const preset = writes.find((w) => w.kind === 'preset')!
    expect(draft.collectionPath).toBe('recipeDrafts/hodu-uid/items')
    expect(ing.collectionPath).toBe('recipesssIngredients/hodu-uid/items')
    expect(preset.collectionPath).toBe('recipesssPresets/hodu-uid/items')
  })

  it('docId 가 각 문서 id 와 일치', () => {
    expect(writes.every((w) => w.docId === (w.data as { id: string }).id)).toBe(
      true,
    )
  })

  it('prices 는 이전 대상에서 제외 (DL-031)', () => {
    // 어떤 write 도 price 형태(unit/price만)를 갖지 않는다.
    expect(writes.some((w) => w.collectionPath.includes('Prices'))).toBe(false)
  })

  it('Firestore 거부 방지 — data 에 undefined 값 키 없음', () => {
    for (const write of writes) {
      for (const value of Object.values(write.data)) {
        expect(value).not.toBeUndefined()
      }
    }
  })

  it('docId 가 컬렉션별로 유일', () => {
    for (const kind of ['recipeDraft', 'ingredient', 'preset'] as const) {
      const ids = writes.filter((w) => w.kind === kind).map((w) => w.docId)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})

describe('buildMigrationPlan — 경계', () => {
  it('빈 결과 → 빈 플랜', () => {
    const empty = buildMigrationPlan(
      {
        version: 3,
        recipeDrafts: [],
        ingredients: [],
        presets: [],
        prices: {},
      },
      'hodu-uid',
    )
    expect(empty).toEqual([])
    expect(summarizePlan(empty).total).toBe(0)
  })

  it('uid 없으면 throw', () => {
    expect(() => buildMigrationPlan(result, '')).toThrow(/uid/)
  })
})
