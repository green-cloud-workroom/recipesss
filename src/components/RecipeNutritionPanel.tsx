import { useMemo, useState } from 'react'

import {
  evaluateDraft,
  evaluateRatios,
  type AdequacyResult,
  type AdequacyStatus,
  type Basis,
} from '../features/nutrition/evaluate'
import {
  CATEGORY_LABELS,
  NUTRIENT_META,
  nutrientMeta,
  type NutrientCategory,
} from '../features/nutrition/nutrientKeys'
import {
  getProfile,
  profilesForSpecies,
  resolveProfileId,
} from '../features/nutrition/profiles'
import { CARD_CLS, INPUT_CLS } from '../lib/ui'
import type { Ingredient, NutrientKey, RecipeDraft } from '../types/recipe'

const CATEGORY_ORDER: NutrientCategory[] = [
  'general',
  'amino',
  'fatty',
  'mineral',
  'vitamin',
]

const BASIS_LABEL: Record<Basis, string> = {
  per_1000_kcal_ME: '1000kcal ME당',
  dry_matter: '건물(DM) 100g당',
}

const STATUS_STYLE: Record<AdequacyStatus, string> = {
  ok: 'bg-green-50 text-green-700',
  deficient: 'bg-red-50 text-red-700',
  excess: 'bg-amber-50 text-amber-700',
}

const STATUS_LABEL: Record<AdequacyStatus, string> = {
  ok: '적정',
  deficient: '부족',
  excess: '초과',
}

function formatValue(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toPrecision(3)
}

function formatRange(min: number | undefined, max: number | undefined): string {
  const lo = min === undefined ? '—' : formatValue(min)
  const hi = max === undefined ? '∞' : formatValue(max)
  return `${lo} ~ ${hi}`
}

export function RecipeNutritionPanel({
  draft,
  ingredients,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
}) {
  const [basis, setBasis] = useState<Basis>('per_1000_kcal_ME')
  const [standardState, setStandardState] = useState({
    draftId: draft.id,
    standardId: resolveProfileId(draft.standardId),
  })
  if (standardState.draftId !== draft.id) {
    setStandardState({
      draftId: draft.id,
      standardId: resolveProfileId(draft.standardId),
    })
  }
  const standardId = standardState.standardId

  const ingredientMap = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.id, item])),
    [ingredients],
  )
  const profile = getProfile(standardId)
  const standardOptions =
    draft.species === null ? [] : profilesForSpecies(draft.species)

  const results = useMemo(
    () =>
      profile ? evaluateDraft(draft, ingredientMap, profile, basis) : [],
    [draft, ingredientMap, profile, basis],
  )
  const ratios = useMemo(
    () => (profile ? evaluateRatios(draft, ingredientMap, profile) : []),
    [draft, ingredientMap, profile],
  )

  const byNutrient = useMemo(() => {
    const map = new Map<NutrientKey, AdequacyResult>()
    for (const result of results) map.set(result.nutrient, result)
    return map
  }, [results])

  const summary = useMemo(() => {
    let deficient = 0
    let excess = 0
    for (const result of results) {
      if (result.status === 'deficient') deficient += 1
      if (result.status === 'excess') excess += 1
    }
    return { deficient, excess, total: results.length }
  }, [results])

  return (
    <div className={`mt-4 ${CARD_CLS} p-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">영양 매트릭스</h2>
          <p className="mt-1 text-xs text-gray-500">
            값은 확정값이 있으면 확정값, 없으면 계산값 기준 (DL-028).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              표준
            </span>
            <select
              className={INPUT_CLS}
              onChange={(event) =>
                setStandardState((current) => ({
                  ...current,
                  standardId: resolveProfileId(event.target.value),
                }))
              }
              value={standardId}
            >
              {standardOptions.length === 0 && (
                <option value={standardId}>{standardId}</option>
              )}
              {standardOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({option.standard})
                </option>
              ))}
            </select>
          </label>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 text-xs">
            {(['per_1000_kcal_ME', 'dry_matter'] as Basis[]).map((option) => (
              <button
                className={
                  basis === option
                    ? 'bg-gray-800 px-3 py-2 text-white'
                    : 'bg-white px-3 py-2 text-gray-600 hover:bg-gray-50'
                }
                key={option}
                onClick={() => setBasis(option)}
                type="button"
              >
                {BASIS_LABEL[option]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!profile && (
        <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          표준 프로파일 <b>{standardId}</b> 을 찾을 수 없습니다.
        </div>
      )}

      {profile && (
        <>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-3 py-1 ${
                summary.deficient + summary.excess === 0
                  ? STATUS_STYLE.ok
                  : STATUS_STYLE.deficient
              }`}
            >
              종합: 부족 {summary.deficient} · 초과 {summary.excess} / 평가{' '}
              {summary.total}
            </span>
            {ratios.map((ratio) => (
              <span
                className={`rounded-full px-3 py-1 ${STATUS_STYLE[ratio.status]}`}
                key={ratio.ratio}
              >
                Ca:P {formatValue(ratio.actual)} (기준{' '}
                {formatRange(ratio.min, ratio.max)})
              </span>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-3 py-2">영양소</th>
                  <th className="px-3 py-2 text-right">값</th>
                  <th className="px-3 py-2">단위</th>
                  <th className="px-3 py-2 text-right">표준 (min~max)</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((category) => {
                  const rows = NUTRIENT_META.filter(
                    (meta) =>
                      meta.category === category && byNutrient.has(meta.key),
                  )
                  if (rows.length === 0) return null
                  return (
                    <CategoryRows
                      byNutrient={byNutrient}
                      category={category}
                      key={category}
                      metas={rows}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function CategoryRows({
  byNutrient,
  category,
  metas,
}: {
  byNutrient: Map<NutrientKey, AdequacyResult>
  category: NutrientCategory
  metas: typeof NUTRIENT_META
}) {
  return (
    <>
      <tr className="bg-gray-50/60">
        <td
          className="px-3 py-1 text-xs font-semibold text-gray-500"
          colSpan={5}
        >
          {CATEGORY_LABELS[category]}
        </td>
      </tr>
      {metas.map((meta) => {
        const result = byNutrient.get(meta.key)
        if (!result) return null
        return (
          <tr className="border-b border-gray-100 text-gray-700" key={meta.key}>
            <td className="px-3 py-2">{nutrientMeta(meta.key).label}</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {formatValue(result.actual)}
            </td>
            <td className="px-3 py-2 text-xs text-gray-400">{meta.unit}</td>
            <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">
              {formatRange(result.min, result.max)}
            </td>
            <td className="px-3 py-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[result.status]}`}
              >
                {STATUS_LABEL[result.status]}
              </span>
            </td>
          </tr>
        )
      })}
    </>
  )
}
