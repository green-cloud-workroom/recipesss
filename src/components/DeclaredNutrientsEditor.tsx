import { useMemo, useState } from 'react'

import { sumRecipeNutrients, totalWeightG } from '../features/nutrition/calc'
import {
  CATEGORY_LABELS,
  NUTRIENT_META,
  type NutrientCategory,
} from '../features/nutrition/nutrientKeys'
import { useSaveDeclaredNutrients } from '../features/recipes/recipeMutations'
import {
  CARD_CLS,
  CELL_INPUT_CLS,
  PRIMARY_BTN_CLS,
  SECONDARY_BTN_CLS,
} from '../lib/ui'
import type {
  Ingredient,
  NutrientKey,
  NutrientValues,
  RecipeDraft,
} from '../types/recipe'

const CATEGORY_ORDER: NutrientCategory[] = [
  'general',
  'amino',
  'fatty',
  'mineral',
  'vitamin',
]

function formatValue(value: number): string {
  if (value === 0) return '0'
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 1) return value.toFixed(2)
  return value.toPrecision(3)
}

export function DeclaredNutrientsEditor({
  draft,
  ingredients,
  uid,
}: {
  draft: RecipeDraft
  ingredients: Ingredient[]
  uid: string | undefined
}) {
  const save = useSaveDeclaredNutrients(uid)
  const [errorMsg, setErrorMsg] = useState('')

  const ingredientMap = useMemo(
    () => Object.fromEntries(ingredients.map((item) => [item.id, item])),
    [ingredients],
  )
  const totalWeight = totalWeightG(draft)
  const calcTotals = useMemo(
    () => sumRecipeNutrients(draft, ingredientMap),
    [draft, ingredientMap],
  )

  const per100g = (total: number) =>
    totalWeight > 0 ? (total * 100) / totalWeight : 0

  // 입력값: 확정값 있으면 100g당으로 환산해 표시, 없으면 빈칸(계산값 추적).
  const initialForm = useMemo(() => {
    const form: Partial<Record<NutrientKey, string>> = {}
    for (const meta of NUTRIENT_META) {
      const declaredTotal = draft.declaredNutrients?.[meta.key]
      form[meta.key] =
        declaredTotal === undefined ? '' : formatValue(per100g(declaredTotal))
    }
    return form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, draft.declaredNutrients, totalWeight])

  const [form, setForm] = useState<Partial<Record<NutrientKey, string>>>(
    initialForm,
  )
  const [formKey, setFormKey] = useState(draft.id)
  if (formKey !== draft.id) {
    setFormKey(draft.id)
    setForm(initialForm)
  }

  function setField(key: NutrientKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function buildDeclared(): NutrientValues | null {
    const declared: NutrientValues = {}
    for (const meta of NUTRIENT_META) {
      const raw = (form[meta.key] ?? '').trim()
      if (raw === '') continue
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) {
        setErrorMsg(`${meta.label} 값이 올바르지 않습니다.`)
        return null
      }
      // 100g당 → totals 환산.
      declared[meta.key] = (value * totalWeight) / 100
    }
    return declared
  }

  async function handleSave() {
    setErrorMsg('')
    const declared = buildDeclared()
    if (!declared) return
    try {
      await save.mutateAsync({
        draftId: draft.id,
        declaredNutrients: declared,
        now: Date.now(),
      })
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '확정값 저장에 실패했습니다.',
      )
    }
  }

  async function handleReset() {
    setErrorMsg('')
    try {
      await save.mutateAsync({
        draftId: draft.id,
        declaredNutrients: {},
        now: Date.now(),
      })
      setForm({})
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '초기화에 실패했습니다.',
      )
    }
  }

  if (totalWeight <= 0) {
    return (
      <div className={`mt-4 ${CARD_CLS} p-4`}>
        <h2 className="text-sm font-semibold text-gray-800">
          확정값 (보장성분, 100g당)
        </h2>
        <p className="mt-2 text-xs text-gray-400">
          구성 원료 중량이 없어 확정값을 편집할 수 없습니다.
        </p>
      </div>
    )
  }

  return (
    <div className={`mt-4 ${CARD_CLS} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            확정값 (보장성분, 100g당)
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            빈칸은 계산값을 그대로 사용합니다. 입력하면 그 영양소만 확정값으로
            덮어씁니다 (DL-027/028). ⚠️ 구성 원료를 저장하면 확정값은 새 계산값으로
            초기화됩니다 (DL-029) — 라벨 직전 단계에서 입력하세요.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={SECONDARY_BTN_CLS}
            disabled={save.isPending}
            onClick={() => void handleReset()}
            type="button"
          >
            계산값으로 초기화
          </button>
          <button
            className={PRIMARY_BTN_CLS}
            disabled={save.isPending}
            onClick={() => void handleSave()}
            type="button"
          >
            {save.isPending ? '저장 중...' : '확정값 저장'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
              <th className="px-3 py-2">영양소</th>
              <th className="px-3 py-2 text-right">계산값 (100g당)</th>
              <th className="px-3 py-2 text-right">확정값 (100g당)</th>
              <th className="px-3 py-2">단위</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((category) => (
              <CategorySection
                calcPer100g={(key) => per100g(calcTotals[key] ?? 0)}
                category={category}
                form={form}
                key={category}
                onChange={setField}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategorySection({
  calcPer100g,
  category,
  form,
  onChange,
}: {
  calcPer100g: (key: NutrientKey) => number
  category: NutrientCategory
  form: Partial<Record<NutrientKey, string>>
  onChange: (key: NutrientKey, value: string) => void
}) {
  const metas = NUTRIENT_META.filter((meta) => meta.category === category)
  return (
    <>
      <tr className="bg-gray-50/60">
        <td className="px-3 py-1 text-xs font-semibold text-gray-500" colSpan={4}>
          {CATEGORY_LABELS[category]}
        </td>
      </tr>
      {metas.map((meta) => (
        <tr className="border-b border-gray-100 text-gray-700" key={meta.key}>
          <td className="px-3 py-2">{meta.label}</td>
          <td className="px-3 py-2 text-right text-xs text-gray-500 tabular-nums">
            {formatValue(calcPer100g(meta.key))}
          </td>
          <td className="px-3 py-2">
            <input
              className={`${CELL_INPUT_CLS} text-right`}
              inputMode="decimal"
              onChange={(event) => onChange(meta.key, event.target.value)}
              placeholder={formatValue(calcPer100g(meta.key))}
              type="number"
              value={form[meta.key] ?? ''}
            />
          </td>
          <td className="px-3 py-2 text-xs text-gray-400">{meta.unit}</td>
        </tr>
      ))}
    </>
  )
}
