import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  useDeleteIngredient,
  useUpdateIngredient,
} from '../features/ingredients/ingredientMutations'
import { useIngredients } from '../features/ingredients/ingredientQueries'
import {
  filterIngredients,
  groupByKind,
} from '../features/ingredients/ingredientSelectors'
import {
  defaultNutrientProfileFormValues,
  nutrientProfileFormSchema,
  type NutrientProfileFormInput,
  type NutrientProfileFormValues,
} from '../features/ingredients/nutrientProfileForm'
import {
  CATEGORY_LABELS,
  NUTRIENT_META,
  type NutrientCategory,
} from '../features/nutrition/nutrientKeys'
import {
  CARD_CLS,
  EMPTY_STATE_CLS,
  INPUT_CLS,
  PRIMARY_BTN_CLS,
  SECONDARY_BTN_CLS,
} from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { Ingredient } from '../types/recipe'

const EMPTY_INGREDIENTS: Ingredient[] = []
const CATEGORY_ORDER: NutrientCategory[] = [
  'general',
  'amino',
  'fatty',
  'mineral',
  'vitamin',
]

export function IngredientsPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const ingredientsQuery = useIngredients(uid)
  const updateIngredient = useUpdateIngredient(uid)
  const deleteIngredient = useDeleteIngredient(uid)
  const ingredients = ingredientsQuery.data ?? EMPTY_INGREDIENTS
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(
    null,
  )
  const [search, setSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const visibleIngredients = useMemo(
    () => filterIngredients(ingredients, search),
    [ingredients, search],
  )
  const groups = useMemo(
    () => groupByKind(visibleIngredients),
    [visibleIngredients],
  )
  const selectedIngredient = useMemo(() => {
    if (ingredients.length === 0) return undefined
    const selected = ingredients.find((item) => item.id === selectedIngredientId)
    return selected ?? ingredients[0]
  }, [ingredients, selectedIngredientId])

  async function handleSave(
    ingredient: Ingredient,
    values: NutrientProfileFormValues,
  ) {
    setErrorMsg('')
    try {
      await updateIngredient.mutateAsync({
        ...ingredient,
        nutrientProfile: values,
      })
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '원료 영양값 저장에 실패했습니다.',
      )
    }
  }

  async function handleToggleHidden(ingredient: Ingredient) {
    setErrorMsg('')
    try {
      await updateIngredient.mutateAsync({
        ...ingredient,
        hidden: !ingredient.hidden,
      })
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '원료 상태 변경에 실패했습니다.',
      )
    }
  }

  async function handleDelete(ingredient: Ingredient) {
    const label = ingredient.name || '(이름 없음)'
    if (!window.confirm(`'${label}' 원료를 삭제할까요? 되돌릴 수 없습니다.`)) {
      return
    }
    setErrorMsg('')
    try {
      await deleteIngredient.mutateAsync(ingredient.id)
      setSelectedIngredientId(null)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '원료 삭제에 실패했습니다.',
      )
    }
  }

  const mutationPending = updateIngredient.isPending || deleteIngredient.isPending

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-bold text-gray-800">원료 마스터</h1>
          <p className="mt-1 text-helper text-gray-500">
            원료별 100g당 영양값을 직접 입력합니다.
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
          원료 {ingredients.length}개
        </div>
      </div>

      {ingredientsQuery.isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {ingredientsQuery.isError && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {ingredientsQuery.error instanceof Error
            ? ingredientsQuery.error.message
            : '원료 데이터를 불러오지 못했습니다.'}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {errorMsg}
        </div>
      )}

      {!ingredientsQuery.isLoading &&
        !ingredientsQuery.isError &&
        ingredients.length === 0 && (
          <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
            원료가 없습니다. 백업·복원에서 마이그레이션하세요.
          </div>
        )}

      {!ingredientsQuery.isLoading &&
        !ingredientsQuery.isError &&
        ingredients.length > 0 &&
        selectedIngredient && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
            <IngredientList
              groups={groups}
              onSearch={setSearch}
              onSelect={setSelectedIngredientId}
              search={search}
              selectedIngredientId={selectedIngredient.id}
            />

            <NutrientProfileEditor
              ingredient={selectedIngredient}
              isPending={mutationPending}
              onDelete={() => void handleDelete(selectedIngredient)}
              onSave={(values) => void handleSave(selectedIngredient, values)}
              onToggleHidden={() => void handleToggleHidden(selectedIngredient)}
            />
          </div>
        )}
    </div>
  )
}

function IngredientList({
  groups,
  onSearch,
  onSelect,
  search,
  selectedIngredientId,
}: {
  groups: ReturnType<typeof groupByKind>
  onSearch: (value: string) => void
  onSelect: (ingredientId: string) => void
  search: string
  selectedIngredientId: string
}) {
  return (
    <div className={`${CARD_CLS} self-start`}>
      <div className="border-b border-gray-100 p-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            검색
          </span>
          <input
            className={INPUT_CLS}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="원료명, 치환명, alias"
            type="search"
            value={search}
          />
        </label>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        <IngredientGroup
          items={groups.ingredient}
          label="원료"
          onSelect={onSelect}
          selectedIngredientId={selectedIngredientId}
        />
        <IngredientGroup
          items={groups.supplement}
          label="영양제"
          onSelect={onSelect}
          selectedIngredientId={selectedIngredientId}
        />
      </div>
    </div>
  )
}

function IngredientGroup({
  items,
  label,
  onSelect,
  selectedIngredientId,
}: {
  items: Ingredient[]
  label: string
  onSelect: (ingredientId: string) => void
  selectedIngredientId: string
}) {
  return (
    <section>
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">
        {label} {items.length}개
      </div>
      {items.length === 0 ? (
        <div className="border-b border-gray-100 px-4 py-3 text-sm text-gray-400">
          없음
        </div>
      ) : (
        items.map((item) => (
          <button
            className={`flex w-full items-center justify-between gap-2 border-b border-gray-100 px-4 py-2 text-left text-sm ${
              item.id === selectedIngredientId
                ? 'bg-gray-800 text-white'
                : `hover:bg-gray-50 ${item.hidden ? 'text-gray-400' : 'text-gray-700'}`
            }`}
            key={item.id}
            onClick={() => onSelect(item.id)}
            type="button"
          >
            <span className="truncate">{item.name || '(이름 없음)'}</span>
            {item.hidden && (
              <span
                className={`shrink-0 text-xs ${
                  item.id === selectedIngredientId
                    ? 'text-gray-300'
                    : 'text-gray-400'
                }`}
              >
                비활성
              </span>
            )}
          </button>
        ))
      )}
    </section>
  )
}

function NutrientProfileEditor({
  ingredient,
  isPending,
  onDelete,
  onSave,
  onToggleHidden,
}: {
  ingredient: Ingredient
  isPending: boolean
  onDelete: () => void
  onSave: (values: NutrientProfileFormValues) => void
  onToggleHidden: () => void
}) {
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<NutrientProfileFormInput, unknown, NutrientProfileFormValues>({
    resolver: zodResolver(nutrientProfileFormSchema),
    defaultValues: defaultNutrientProfileFormValues(
      ingredient.nutrientProfile,
    ),
  })

  useEffect(() => {
    reset(defaultNutrientProfileFormValues(ingredient.nutrientProfile))
  }, [ingredient, reset])

  const metaByCategory = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: NUTRIENT_META.filter((meta) => meta.category === category),
    }))
  }, [])

  return (
    <form
      className={`${CARD_CLS} self-start`}
      onSubmit={(event) => void handleSubmit((values) => onSave(values))(event)}
    >
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">
            {ingredient.name || '(이름 없음)'}
            {ingredient.hidden && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                비활성
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            100g당 영양값 · 빈칸은 저장 시 생략
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={SECONDARY_BTN_CLS}
            disabled={isPending}
            onClick={onToggleHidden}
            type="button"
          >
            {ingredient.hidden ? '활성화' : '비활성'}
          </button>
          <button
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            disabled={isPending}
            onClick={onDelete}
            type="button"
          >
            삭제
          </button>
          <button
            className={SECONDARY_BTN_CLS}
            disabled={!isDirty || isPending}
            onClick={() =>
              reset(defaultNutrientProfileFormValues(ingredient.nutrientProfile))
            }
            type="button"
          >
            되돌리기
          </button>
          <button
            className={PRIMARY_BTN_CLS}
            disabled={isPending}
            type="submit"
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="max-h-[760px] overflow-y-auto p-4">
        {metaByCategory.map(({ category, items }) => (
          <section className="mb-6 last:mb-0" key={category}>
            <h3 className="mb-3 text-xs font-semibold text-gray-500">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((meta) => (
                <label className="block" key={meta.key}>
                  <span className="mb-1 flex items-center justify-between gap-2 text-xs font-medium text-gray-500">
                    <span>{meta.label}</span>
                    <span className="text-gray-400">{meta.unit}</span>
                  </span>
                  <input
                    className={INPUT_CLS}
                    min="0"
                    step="any"
                    type="number"
                    {...register(meta.key)}
                  />
                  {errors[meta.key]?.message && (
                    <span className="mt-1 block text-xs text-red-600">
                      {String(errors[meta.key]?.message)}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
    </form>
  )
}

export default IngredientsPage
