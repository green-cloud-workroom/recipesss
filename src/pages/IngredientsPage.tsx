import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  useDeleteIngredient,
  useMergeIngredients,
  useUpdateIngredient,
} from '../features/ingredients/ingredientMutations'
import { buildIngredientMergePlan } from '../features/ingredients/ingredientMerge'
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
import { usePresets } from '../features/presets/presetQueries'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import {
  CARD_CLS,
  EMPTY_STATE_CLS,
  INPUT_CLS,
  PRIMARY_BTN_CLS,
  SECONDARY_BTN_CLS,
} from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { Ingredient, Preset, RecipeDraft } from '../types/recipe'

const EMPTY_INGREDIENTS: Ingredient[] = []
const EMPTY_PRESETS: Preset[] = []
const EMPTY_DRAFTS: RecipeDraft[] = []
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
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const updateIngredient = useUpdateIngredient(uid)
  const deleteIngredient = useDeleteIngredient(uid)
  const mergeIngredients = useMergeIngredients(uid)
  const ingredients = ingredientsQuery.data ?? EMPTY_INGREDIENTS
  const drafts = draftsQuery.data ?? EMPTY_DRAFTS
  const presets = presetsQuery.data ?? EMPTY_PRESETS
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(
    null,
  )
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([])
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [mergeName, setMergeName] = useState('')
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

  // 병합 경고용: 삭제 대상(= 첫 선택 제외)을 composition에 가진 등록 레시피 (DL-034 #4)
  const registeredDriftNames = useMemo(() => {
    const duplicateIds = mergeSelectedIds.slice(1)
    if (duplicateIds.length === 0) return []
    return drafts
      .filter(
        (draft) =>
          Boolean(draft.registeredRecipeId) &&
          draft.composition.some((row) =>
            duplicateIds.includes(row.ingredientId),
          ),
      )
      .map((draft) => draft.name || '(이름 없음)')
  }, [drafts, mergeSelectedIds])

  // 병합 경고용: 삭제 대상 중 영양값/출처가 입력돼 있어 소멸하는 원료 (DL-034 #5)
  const discardedProfileNames = useMemo(() => {
    const duplicateIds = new Set(mergeSelectedIds.slice(1))
    return ingredients
      .filter((ingredient) => duplicateIds.has(ingredient.id))
      .filter(
        (ingredient) =>
          (ingredient.nutrientProfile &&
            Object.keys(ingredient.nutrientProfile).length > 0) ||
          Boolean(ingredient.source),
      )
      .map((ingredient) => ingredient.name || '(이름 없음)')
  }, [ingredients, mergeSelectedIds])

  const mutationPending =
    updateIngredient.isPending ||
    deleteIngredient.isPending ||
    mergeIngredients.isPending

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

  async function handleRename(ingredient: Ingredient, name: string) {
    const nextName = name.trim()
    if (!nextName) {
      setErrorMsg('원료명을 입력하세요.')
      return
    }

    setErrorMsg('')
    try {
      await updateIngredient.mutateAsync({
        ...ingredient,
        name: nextName,
      })
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '원료명 수정에 실패했습니다.',
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
      setMergeSelectedIds((prev) => prev.filter((id) => id !== ingredient.id))
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '원료 삭제에 실패했습니다.',
      )
    }
  }

  function handleToggleMerge(ingredientId: string, checked: boolean) {
    setMergeSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(ingredientId)) return prev
        return [...prev, ingredientId]
      }
      return prev.filter((id) => id !== ingredientId)
    })
  }

  function handleOpenMergeModal() {
    const target = ingredients.find((item) => item.id === mergeSelectedIds[0])
    setMergeName(target?.name ?? '')
    setMergeModalOpen(true)
  }

  async function handleMerge() {
    setErrorMsg('')
    try {
      const plan = buildIngredientMergePlan({
        drafts,
        ingredients,
        presets,
        now: Date.now(),
        selectedIds: mergeSelectedIds,
        targetName: mergeName,
      })

      await mergeIngredients.mutateAsync(plan)
      setSelectedIngredientId(plan.target.id)
      setMergeSelectedIds([])
      setMergeModalOpen(false)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '원료 병합에 실패했습니다.',
      )
    }
  }

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
              isMergeDisabled={mutationPending || mergeSelectedIds.length < 2}
              mergeSelectedIds={mergeSelectedIds}
              onMerge={handleOpenMergeModal}
              onSearch={setSearch}
              onSelect={setSelectedIngredientId}
              onToggleMerge={handleToggleMerge}
              search={search}
              selectedIngredientId={selectedIngredient.id}
            />

            <NutrientProfileEditor
              ingredient={selectedIngredient}
              isPending={mutationPending}
              key={selectedIngredient.id}
              onDelete={() => void handleDelete(selectedIngredient)}
              onRename={(name) => void handleRename(selectedIngredient, name)}
              onSave={(values) => void handleSave(selectedIngredient, values)}
              onToggleHidden={() => void handleToggleHidden(selectedIngredient)}
            />
          </div>
        )}

      {mergeModalOpen && (
        <MergeIngredientModal
          ingredients={ingredients.filter((item) =>
            mergeSelectedIds.includes(item.id),
          )}
          isPending={mutationPending}
          name={mergeName}
          onClose={() => setMergeModalOpen(false)}
          onConfirm={() => void handleMerge()}
          onNameChange={setMergeName}
          discardedProfileNames={discardedProfileNames}
          registeredDriftNames={registeredDriftNames}
        />
      )}
    </div>
  )
}

function IngredientList({
  groups,
  isMergeDisabled,
  mergeSelectedIds,
  onMerge,
  onSearch,
  onSelect,
  onToggleMerge,
  search,
  selectedIngredientId,
}: {
  groups: ReturnType<typeof groupByKind>
  isMergeDisabled: boolean
  mergeSelectedIds: string[]
  onMerge: () => void
  onSearch: (value: string) => void
  onSelect: (ingredientId: string) => void
  onToggleMerge: (ingredientId: string, checked: boolean) => void
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
            placeholder="원료명"
            type="search"
            value={search}
          />
        </label>
        <button
          className={`${PRIMARY_BTN_CLS} mt-3 w-full`}
          disabled={isMergeDisabled}
          onClick={onMerge}
          type="button"
        >
          병합
        </button>
      </div>
      <div className="max-h-[720px] overflow-y-auto">
        <IngredientGroup
          items={groups.ingredient}
          label="원료"
          mergeSelectedIds={mergeSelectedIds}
          onSelect={onSelect}
          onToggleMerge={onToggleMerge}
          selectedIngredientId={selectedIngredientId}
        />
        <IngredientGroup
          items={groups.supplement}
          label="영양제"
          mergeSelectedIds={mergeSelectedIds}
          onSelect={onSelect}
          onToggleMerge={onToggleMerge}
          selectedIngredientId={selectedIngredientId}
        />
      </div>
    </div>
  )
}

function IngredientGroup({
  items,
  label,
  mergeSelectedIds,
  onSelect,
  onToggleMerge,
  selectedIngredientId,
}: {
  items: Ingredient[]
  label: string
  mergeSelectedIds: string[]
  onSelect: (ingredientId: string) => void
  onToggleMerge: (ingredientId: string, checked: boolean) => void
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
        items.map((item) => {
          const checked = mergeSelectedIds.includes(item.id)
          const active = item.id === selectedIngredientId

          return (
            <div
              className={`flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-sm ${
                active
                  ? 'bg-gray-800 text-white'
                  : `hover:bg-gray-50 ${item.hidden ? 'text-gray-400' : 'text-gray-700'}`
              }`}
              key={item.id}
            >
              <input
                checked={checked}
                className="h-4 w-4 shrink-0 rounded border-gray-300"
                onChange={(event) =>
                  onToggleMerge(item.id, event.target.checked)
                }
                type="checkbox"
              />
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => onSelect(item.id)}
                type="button"
              >
                <span className="block truncate">
                  {item.name || '(이름 없음)'}
                </span>
              </button>
              {item.hidden && (
                <span
                  className={`shrink-0 text-xs ${
                    active ? 'text-gray-300' : 'text-gray-400'
                  }`}
                >
                  비활성
                </span>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}

function NutrientProfileEditor({
  ingredient,
  isPending,
  onDelete,
  onRename,
  onSave,
  onToggleHidden,
}: {
  ingredient: Ingredient
  isPending: boolean
  onDelete: () => void
  onRename: (name: string) => void
  onSave: (values: NutrientProfileFormValues) => void
  onToggleHidden: () => void
}) {
  const [name, setName] = useState(ingredient.name)
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
  const isNameDirty = name.trim() !== ingredient.name

  return (
    <form
      className={`${CARD_CLS} self-start`}
      onSubmit={(event) => void handleSubmit((values) => onSave(values))(event)}
    >
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
              원료명은 이 id를 쓰는 레시피 표시명에도 같이 반영됩니다.
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
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            className={INPUT_CLS}
            onChange={(event) => setName(event.target.value)}
            placeholder="원료명"
            type="text"
            value={name}
          />
          <button
            className={PRIMARY_BTN_CLS}
            disabled={!isNameDirty || !name.trim() || isPending}
            onClick={() => onRename(name)}
            type="button"
          >
            원료명 수정
          </button>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-b border-gray-100 px-4 py-3">
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
        <button className={PRIMARY_BTN_CLS} disabled={isPending} type="submit">
          {isPending ? '저장 중...' : '영양값 저장'}
        </button>
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

function MergeIngredientModal({
  ingredients,
  isPending,
  name,
  onClose,
  onConfirm,
  onNameChange,
  discardedProfileNames,
  registeredDriftNames,
}: {
  ingredients: Ingredient[]
  isPending: boolean
  name: string
  onClose: () => void
  onConfirm: () => void
  onNameChange: (name: string) => void
  discardedProfileNames: string[]
  registeredDriftNames: string[]
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-800">원료 병합</h2>
          <p className="mt-1 text-xs text-gray-500">
            첫 번째로 선택한 원료를 남기고, 나머지 원료 id는 레시피에서 이 원료로 치환됩니다.
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            {ingredients.map((ingredient) => ingredient.name || '(이름 없음)').join(' / ')}
          </div>
          {discardedProfileNames.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ 다음 원료의 입력된 영양값/출처가 삭제됩니다:{' '}
              <b>{discardedProfileNames.join(', ')}</b>. 병합 후 남는 원료에 다시
              입력해야 합니다.
            </div>
          )}
          {registeredDriftNames.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠️ 등록된 레시피 {registeredDriftNames.length}건은 재푸시 전까지 옛
              원료를 유지합니다(자동 반영 안 됨): <b>{registeredDriftNames.join(', ')}</b>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              병합 후 원료명
            </span>
            <input
              className={INPUT_CLS}
              onChange={(event) => onNameChange(event.target.value)}
              type="text"
              value={name}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
          <button
            className={SECONDARY_BTN_CLS}
            disabled={isPending}
            onClick={onClose}
            type="button"
          >
            취소
          </button>
          <button
            className={PRIMARY_BTN_CLS}
            disabled={isPending || !name.trim()}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? '병합 중...' : '병합'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default IngredientsPage
