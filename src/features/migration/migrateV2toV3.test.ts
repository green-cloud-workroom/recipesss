/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateV2toV3 } from './migrateV2toV3'
import type { V2State } from './v2State'

// 실제 마지막 v2 백업을 픽스처로 사용 (회귀 방지). src 밖이라 fs 로 로드.
const FIXTURE_PATH = resolve(
  process.cwd(),
  'backups/2026-06-03-pre-rewrite.json',
)
const v2 = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as V2State

const OPTS = { ownerUid: 'hodu-uid', now: 1_780_000_000_000 }

describe('migrateV2toV3 — 실제 백업 픽스처', () => {
  const result = migrateV2toV3(v2, OPTS)

  it('version 3 으로 변환', () => {
    expect(result.version).toBe(3)
  })

  it('products 27개 전부 recipeDrafts 로 변환', () => {
    expect(Object.keys(v2.products)).toHaveLength(27)
    expect(result.recipeDrafts).toHaveLength(27)
  })

  it('모든 draft status === draft', () => {
    expect(result.recipeDrafts.every((d) => d.status === 'draft')).toBe(true)
  })

  it('id prefix prod_ → draft_ 변환, draft id 충돌 없음', () => {
    expect(result.recipeDrafts.every((d) => d.id.startsWith('draft_'))).toBe(
      true,
    )
    const ids = new Set(result.recipeDrafts.map((d) => d.id))
    expect(ids.size).toBe(result.recipeDrafts.length)
  })

  it('recipeDrafts sortOrder 가 productOrder 순서를 단조증가로 반영', () => {
    const orders = result.recipeDrafts.map((d) => d.sortOrder)
    expect(orders).toEqual([...Array(27).keys()])
    // 첫 draft 는 productOrder[0] 에서 와야 한다.
    const firstExpected = `draft_${v2.productOrder[0]!.slice('prod_'.length)}`
    expect(result.recipeDrafts[0]!.id).toBe(firstExpected)
  })

  it('composition sortOrder 가 행마다 0부터 단조증가', () => {
    for (const draft of result.recipeDrafts) {
      const orders = draft.composition.map((c) => c.sortOrder)
      expect(orders).toEqual([...Array(draft.composition.length).keys()])
    }
  })

  it('ownerUid / 타임스탬프 주입 확인', () => {
    expect(
      result.recipeDrafts.every(
        (d) =>
          d.ownerUid === 'hodu-uid' &&
          d.createdAt === OPTS.now &&
          d.updatedAt === OPTS.now,
      ),
    ).toBe(true)
  })

  it('standardId 가 species 기반 성체 표준으로 매핑', () => {
    const byId = new Map(result.recipeDrafts.map((d) => [d.id, d]))
    for (const product of Object.values(v2.products)) {
      const draft = byId.get(`draft_${product.id.slice('prod_'.length)}`)!
      if (product.species === 'cat')
        expect(draft.standardId).toBe('AAFCO_2024_CAT_ADULT')
      else if (product.species === 'dog')
        expect(draft.standardId).toBe('AAFCO_2024_DOG_ADULT')
      else expect(draft.standardId).toBe('')
    }
  })

  it('defaultStandardId override 가 적용됨', () => {
    const overridden = migrateV2toV3(v2, {
      ...OPTS,
      defaultStandardId: () => 'CUSTOM_STD',
    })
    expect(
      overridden.recipeDrafts.every((d) => d.standardId === 'CUSTOM_STD'),
    ).toBe(true)
  })

  it('ingredients 91개 전부 변환, 영양제(supplement) 보존', () => {
    expect(Object.keys(v2.ingredients)).toHaveLength(91)
    expect(result.ingredients).toHaveLength(91)
    const supplements = result.ingredients.filter(
      (i) => i.kind === 'supplement',
    )
    expect(supplements).toHaveLength(24)
  })

  it('ingredient 는 nutrientProfile 빈 객체 + hidden false + sortOrder 부여', () => {
    expect(
      result.ingredients.every(
        (i) =>
          i.hidden === false &&
          typeof i.nutrientProfile === 'object' &&
          Object.keys(i.nutrientProfile!).length === 0,
      ),
    ).toBe(true)
    const orders = result.ingredients.map((i) => i.sortOrder)
    expect(orders).toEqual([...Array(91).keys()])
  })

  it('presets 100개 변환, draftId 가 draft_* 이고 실제 draft 를 참조', () => {
    expect(Object.keys(v2.presets)).toHaveLength(100)
    expect(result.presets).toHaveLength(100)
    const draftIds = new Set(result.recipeDrafts.map((d) => d.id))
    expect(
      result.presets.every(
        (p) => p.draftId.startsWith('draft_') && draftIds.has(p.draftId),
      ),
    ).toBe(true)
  })

  it('preset 에 sortOrder/createdAt 부여', () => {
    expect(result.presets.every((p) => p.createdAt === OPTS.now)).toBe(true)
    const orders = result.presets.map((p) => p.sortOrder)
    expect(orders).toEqual([...Array(100).keys()])
  })

  it('prices DL-024 보존 — 개수·값 그대로', () => {
    expect(Object.keys(result.prices)).toHaveLength(
      Object.keys(v2.prices).length,
    )
    for (const [id, price] of Object.entries(v2.prices)) {
      expect(result.prices[id]).toEqual({
        price: price.price,
        unit: price.unit,
      })
    }
  })
})

describe('migrateV2toV3 — 경계 케이스', () => {
  it('빈 입력 처리', () => {
    const empty: V2State = {
      version: 2,
      products: {},
      ingredients: {},
      presets: {},
      prices: {},
      productOrder: [],
    }
    const result = migrateV2toV3(empty, OPTS)
    expect(result).toEqual({
      version: 3,
      recipeDrafts: [],
      ingredients: [],
      presets: [],
      prices: {},
    })
  })

  it('productOrder 에 없는 product 는 뒤에 append', () => {
    const state: V2State = {
      version: 2,
      products: {
        prod_a: {
          id: 'prod_a',
          name: 'A',
          species: 'cat',
          unitLabel: '',
          unitIngredientId: 'ing_x',
          composition: [],
        },
        prod_b: {
          id: 'prod_b',
          name: 'B',
          species: 'dog',
          unitLabel: '',
          unitIngredientId: 'ing_y',
          composition: [],
        },
      },
      ingredients: {},
      presets: {},
      prices: {},
      productOrder: ['prod_b'], // prod_a 는 누락
    }
    const result = migrateV2toV3(state, OPTS)
    expect(result.recipeDrafts.map((d) => d.id)).toEqual([
      'draft_b', // productOrder 우선
      'draft_a', // 누락분 뒤에 append
    ])
  })
})
