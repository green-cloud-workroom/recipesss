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
import { profilesForSpecies } from '../features/nutrition/profiles'
import { CARD_CLS } from '../lib/ui'
import type {
  Ingredient,
  NutrientKey,
  NutrientProfile,
  RecipeDraft,
} from '../types/recipe'

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

const STATUS_PRIORITY: Record<AdequacyStatus, number> = {
  ok: 0,
  excess: 1,
  deficient: 2,
}

type ProfileEvaluation = {
  profile: NutrientProfile
  results: AdequacyResult[]
  ratios: ReturnType<typeof evaluateRatios>
}

type StandardTag = {
  profile: NutrientProfile
  result: AdequacyResult
}

type NutrientRow = {
  nutrient: NutrientKey
  actual: number
  status: AdequacyStatus
  tags: StandardTag[]
}

function formatValue(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toPrecision(3)
}

function formatRange(min: number | undefined, max: number | undefined): string {
  const lo = min === undefined ? '-' : formatValue(min)
  const hi = max === undefined ? '∞' : formatValue(max)
  return `${lo} ~ ${hi}`
}

function profileTag(profile: NutrientProfile): string {
  const stage =
    profile.lifeStage === 'adult'
      ? '성체'
      : profile.lifeStage === 'early_growth_repro'
        ? '성장'
        : profile.lifeStage === 'late_growth'
          ? '후기성장'
          : profile.lifeStage
  // MER은 숫자만 괄호로 (예: FEDIAF 성체(75)) — 성체 75/100 구분용.
  const merNum = profile.mer?.match(/\d+/)?.[0]
  const mer = merNum ? `(${merNum})` : ''
  return `${profile.standard} ${stage}${mer}`
}

// 임계값만 간결하게: 상한 없으면 min만, 있으면 min~max (∞ 제거).
function formatThreshold(
  min: number | undefined,
  max: number | undefined,
): string {
  const lo = min === undefined ? '-' : formatValue(min)
  if (max === undefined) return lo
  return `${lo}~${formatValue(max)}`
}

function worseStatus(
  current: AdequacyStatus,
  next: AdequacyStatus,
): AdequacyStatus {
  return STATUS_PRIORITY[next] > STATUS_PRIORITY[current] ? next : current
}

export function RecipeNutritionPanel({
  draft,
  ingredients,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
}) {
  const [basis, setBasis] = useState<Basis>('per_1000_kcal_ME')

  const ingredientMap = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.id, item])),
    [ingredients],
  )
  const profiles = useMemo(
    () => (draft.species === null ? [] : profilesForSpecies(draft.species)),
    [draft.species],
  )

  const evaluations = useMemo<ProfileEvaluation[]>(
    () =>
      profiles.map((profile) => ({
        profile,
        results: evaluateDraft(draft, ingredientMap, profile, basis),
        ratios: evaluateRatios(draft, ingredientMap, profile),
      })),
    [basis, draft, ingredientMap, profiles],
  )

  const rowsByNutrient = useMemo(() => {
    const map = new Map<NutrientKey, NutrientRow>()
    for (const evaluation of evaluations) {
      for (const result of evaluation.results) {
        const existing = map.get(result.nutrient)
        if (existing) {
          existing.status = worseStatus(existing.status, result.status)
          existing.tags.push({ profile: evaluation.profile, result })
        } else {
          map.set(result.nutrient, {
            nutrient: result.nutrient,
            actual: result.actual,
            status: result.status,
            tags: [{ profile: evaluation.profile, result }],
          })
        }
      }
    }
    return map
  }, [evaluations])

  const ratioRows = useMemo(
    () =>
      evaluations.flatMap((evaluation) =>
        evaluation.ratios.map((ratio) => ({
          profile: evaluation.profile,
          ratio,
        })),
      ),
    [evaluations],
  )

  const summary = useMemo(() => {
    let deficient = 0
    let excess = 0
    for (const row of rowsByNutrient.values()) {
      if (row.status === 'deficient') deficient += 1
      if (row.status === 'excess') excess += 1
    }
    return { deficient, excess, total: rowsByNutrient.size }
  }, [rowsByNutrient])

  return (
    <div className={`mt-4 ${CARD_CLS} p-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">영양 매트릭스</h2>
          <p className="mt-1 text-xs text-gray-500">
            값은 확정값이 있으면 확정값, 없으면 계산값 기준입니다. 같은 종의
            모든 표준을 함께 평가합니다 (DL-028/032).
          </p>
        </div>
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

      {profiles.length === 0 && (
        <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          종이 정해져 있지 않아 적용할 표준 프로파일이 없습니다.
        </div>
      )}

      {profiles.length > 0 && (
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
            {ratioRows.map(({ profile, ratio }) => (
              <span
                className={`rounded-full px-3 py-1 ${STATUS_STYLE[ratio.status]}`}
                key={`${profile.id}-${ratio.ratio}`}
              >
                Ca:P {formatValue(ratio.actual)} · {profileTag(profile)} 기준{' '}
                {formatRange(ratio.min, ratio.max)}
              </span>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th className="px-2 py-1">영양소</th>
                  <th className="px-2 py-1 text-right">값</th>
                  <th className="px-2 py-1">종합</th>
                  <th className="px-2 py-1">표준별 기준</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_ORDER.map((category) => {
                  const rows = NUTRIENT_META.filter(
                    (meta) =>
                      meta.category === category &&
                      rowsByNutrient.has(meta.key),
                  )
                  if (rows.length === 0) return null
                  return (
                    <CategoryRows
                      category={category}
                      key={category}
                      metas={rows}
                      rowsByNutrient={rowsByNutrient}
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
  category,
  metas,
  rowsByNutrient,
}: {
  category: NutrientCategory
  metas: typeof NUTRIENT_META
  rowsByNutrient: Map<NutrientKey, NutrientRow>
}) {
  return (
    <>
      <tr className="bg-gray-50/60">
        <td
          className="px-2 py-0.5 text-xs font-semibold text-gray-500"
          colSpan={4}
        >
          {CATEGORY_LABELS[category]}
        </td>
      </tr>
      {metas.map((meta) => {
        const row = rowsByNutrient.get(meta.key)
        if (!row) return null
        return (
          <tr className="border-b border-gray-100 text-gray-700" key={meta.key}>
            <td className="px-2 py-1">{nutrientMeta(meta.key).label}</td>
            <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">
              {formatValue(row.actual)}
              <span className="ml-0.5 text-gray-400">{meta.unit}</span>
            </td>
            <td className="px-2 py-1">
              <span
                className={`rounded px-1.5 py-0.5 ${STATUS_STYLE[row.status]}`}
              >
                {STATUS_LABEL[row.status]}
              </span>
            </td>
            <td className="px-2 py-1">
              <div className="flex flex-wrap gap-1">
                {row.tags.map(({ profile, result }) => (
                  <span
                    className={`whitespace-nowrap rounded px-1.5 py-0.5 ${
                      STATUS_STYLE[result.status]
                    }`}
                    key={profile.id}
                    title={`${profile.label} (${profile.standard})`}
                  >
                    {profileTag(profile)} {formatThreshold(result.min, result.max)}
                  </span>
                ))}
              </div>
            </td>
          </tr>
        )
      })}
    </>
  )
}
