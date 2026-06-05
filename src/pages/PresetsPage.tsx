import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { Modal } from '../components/common/Modal'
import { generatePresetCode } from '../features/presets/presetCodes'
import {
  useDeletePreset,
  useUpsertPreset,
} from '../features/presets/presetMutations'
import { usePresets } from '../features/presets/presetQueries'
import {
  nextSortOrder,
  selectPresetsByDraft,
} from '../features/presets/presetSelectors'
import {
  presetFormSchema,
  type PresetFormInput,
  type PresetFormValues,
} from '../features/presets/presetForm'
import { useRecipeDrafts } from '../features/recipes/recipeQueries'
import {
  CARD_CLS,
  EMPTY_STATE_CLS,
  INPUT_CLS,
  PRIMARY_BTN_CLS,
  SECONDARY_BTN_CLS,
} from '../lib/ui'
import { useAuthStore } from '../stores/authStore'
import type { Preset, RecipeDraft } from '../types/recipe'

const EMPTY_DRAFTS: RecipeDraft[] = []
const EMPTY_PRESETS: Preset[] = []

type PresetModalState =
  | { mode: 'create' }
  | { mode: 'edit'; preset: Preset }
  | null

function newPresetId(): string {
  return `preset_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
}

function defaultFormValues(
  preset?: Preset,
  generatedCode = '',
): PresetFormInput {
  return {
    code: preset?.code ?? generatedCode,
    targetWeight: preset?.targetWeight ?? 0,
    label: preset?.label ?? '',
    inputAmount: preset?.inputAmount ?? 0,
    inputUnitLabel: preset?.inputUnitLabel ?? '',
  }
}

export function PresetsPage() {
  const uid = useAuthStore((state) => state.user?.uid)
  const draftsQuery = useRecipeDrafts(uid)
  const presetsQuery = usePresets(uid)
  const upsertPreset = useUpsertPreset(uid)
  const deletePreset = useDeletePreset(uid)

  const drafts = draftsQuery.data ?? EMPTY_DRAFTS
  const presets = presetsQuery.data ?? EMPTY_PRESETS
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [modalState, setModalState] = useState<PresetModalState>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const selectedDraft = useMemo(() => {
    if (drafts.length === 0) return undefined
    const selected = drafts.find((draft) => draft.id === selectedDraftId)
    return selected ?? drafts[0]
  }, [drafts, selectedDraftId])

  const visiblePresets = useMemo(() => {
    if (!selectedDraft) return EMPTY_PRESETS
    return selectPresetsByDraft(presets, selectedDraft.id)
  }, [presets, selectedDraft])

  const isLoading = draftsQuery.isLoading || presetsQuery.isLoading
  const isError = draftsQuery.isError || presetsQuery.isError
  const queryError = draftsQuery.error ?? presetsQuery.error
  const mutationPending = upsertPreset.isPending || deletePreset.isPending
  const generatedPresetCode = useMemo(() => {
    if (!selectedDraft || modalState?.mode !== 'create') return ''
    return generatePresetCode(presets, drafts, selectedDraft.id)
  }, [drafts, modalState, presets, selectedDraft])

  async function handleSave(values: PresetFormValues, editing?: Preset) {
    if (!selectedDraft) return
    setErrorMsg('')

    const preset: Preset = {
      id: editing?.id ?? newPresetId(),
      draftId: selectedDraft.id,
      code: values.code.trim(),
      targetWeight: values.targetWeight,
      label: values.label,
      unitIngredientId: selectedDraft.unitIngredientId,
      inputAmount: values.inputAmount,
      inputUnitLabel: values.inputUnitLabel,
      sortOrder:
        editing?.sortOrder ?? nextSortOrder(presets, selectedDraft.id),
      createdAt: editing?.createdAt ?? Date.now(),
    }

    try {
      await upsertPreset.mutateAsync(preset)
      setModalState(null)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '프리셋 저장에 실패했습니다.',
      )
    }
  }

  async function handleDelete(preset: Preset) {
    const ok = window.confirm(`${preset.code} 프리셋을 삭제할까요?`)
    if (!ok) return
    setErrorMsg('')

    try {
      await deletePreset.mutateAsync(preset.id)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '프리셋 삭제에 실패했습니다.',
      )
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title font-bold text-gray-800">프리셋 설정</h1>
          <p className="mt-1 text-helper text-gray-500">
            레시피별 발주 프리셋을 조회하고 관리합니다.
          </p>
        </div>
        <button
          className={PRIMARY_BTN_CLS}
          disabled={!selectedDraft || mutationPending}
          onClick={() => setModalState({ mode: 'create' })}
          type="button"
        >
          프리셋 추가
        </button>
      </div>

      {isLoading && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>불러오는 중...</div>
      )}

      {isError && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {queryError instanceof Error
            ? queryError.message
            : '프리셋 데이터를 불러오지 못했습니다.'}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {errorMsg}
        </div>
      )}

      {!isLoading && !isError && drafts.length === 0 && (
        <div className={`mt-4 ${EMPTY_STATE_CLS}`}>
          레시피가 없습니다. 백업·복원에서 마이그레이션하세요.
        </div>
      )}

      {!isLoading && !isError && drafts.length > 0 && selectedDraft && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
          <RecipeList
            drafts={drafts}
            selectedDraftId={selectedDraft.id}
            onSelect={setSelectedDraftId}
          />

          <div className={CARD_CLS}>
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                {selectedDraft.name}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                프리셋 {visiblePresets.length}개
              </p>
            </div>

            {visiblePresets.length === 0 ? (
              <div className="p-6 text-sm text-gray-400">
                이 레시피에 등록된 프리셋이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                      <th className="px-4 py-3">코드</th>
                      <th className="px-4 py-3 text-right">목표량(g)</th>
                      <th className="px-4 py-3">라벨</th>
                      <th className="px-4 py-3">생산단위 투입량</th>
                      <th className="px-4 py-3 text-right">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePresets.map((preset) => (
                      <tr
                        className="border-b border-gray-100 text-gray-700"
                        key={preset.id}
                      >
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {preset.code}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {preset.targetWeight}
                        </td>
                        <td className="px-4 py-3">{preset.label || '-'}</td>
                        <td className="px-4 py-3">
                          {preset.inputAmount} {preset.inputUnitLabel}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              className={SECONDARY_BTN_CLS}
                              disabled={mutationPending}
                              onClick={() =>
                                setModalState({ mode: 'edit', preset })
                              }
                              type="button"
                            >
                              편집
                            </button>
                            <button
                              className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              disabled={mutationPending}
                              onClick={() => void handleDelete(preset)}
                              type="button"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {modalState && selectedDraft && (
        <PresetFormModal
          draft={selectedDraft}
          generatedCode={generatedPresetCode}
          isPending={upsertPreset.isPending}
          modalState={modalState}
          onClose={() => setModalState(null)}
          onSave={(values, editing) => void handleSave(values, editing)}
        />
      )}
    </div>
  )
}

function RecipeList({
  drafts,
  selectedDraftId,
  onSelect,
}: {
  drafts: RecipeDraft[]
  selectedDraftId: string
  onSelect: (draftId: string) => void
}) {
  return (
    <div className={`${CARD_CLS} overflow-hidden`}>
      <div className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
        레시피
      </div>
      <div className="max-h-[640px] overflow-y-auto">
        {drafts.map((draft) => (
          <button
            className={`block w-full border-b border-gray-100 px-4 py-3 text-left text-sm ${
              draft.id === selectedDraftId
                ? 'bg-gray-800 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
            key={draft.id}
            onClick={() => onSelect(draft.id)}
            type="button"
          >
            <span className="block font-medium">{draft.name}</span>
            <span
              className={`mt-1 block text-xs ${
                draft.id === selectedDraftId ? 'text-gray-200' : 'text-gray-400'
              }`}
            >
              구성 원료 {draft.composition.length}개
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PresetFormModal({
  draft,
  generatedCode,
  isPending,
  modalState,
  onClose,
  onSave,
}: {
  draft: RecipeDraft
  generatedCode: string
  isPending: boolean
  modalState: Exclude<PresetModalState, null>
  onClose: () => void
  onSave: (values: PresetFormValues, editing?: Preset) => void
}) {
  const editing = modalState.mode === 'edit' ? modalState.preset : undefined
  const formId = 'preset-form'
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<PresetFormInput, unknown, PresetFormValues>({
    resolver: zodResolver(presetFormSchema),
    defaultValues: defaultFormValues(editing, generatedCode),
  })

  return (
    <Modal
      footer={
        <>
          <button className={SECONDARY_BTN_CLS} onClick={onClose} type="button">
            취소
          </button>
          <button
            className={PRIMARY_BTN_CLS}
            disabled={isPending}
            form={formId}
            type="submit"
          >
            {isPending ? '저장 중...' : '저장'}
          </button>
        </>
      }
      onClose={onClose}
      title={editing ? '프리셋 편집' : '프리셋 추가'}
    >
      <form
        className="space-y-4"
        id={formId}
        onSubmit={(event) => void handleSubmit((v) => onSave(v, editing))(event)}
      >
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          {draft.name}
        </div>

        <Field label="코드" error={errors.code?.message}>
          <input className={INPUT_CLS} {...register('code')} />
        </Field>

        <Field label="목표량(g)" error={errors.targetWeight?.message}>
          <input
            className={INPUT_CLS}
            min="0"
            step="1"
            type="number"
            {...register('targetWeight')}
          />
        </Field>

        <Field label="라벨" error={errors.label?.message}>
          <input className={INPUT_CLS} {...register('label')} />
        </Field>

        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="생산단위 투입량" error={errors.inputAmount?.message}>
            <input
              className={INPUT_CLS}
              min="0"
              step="0.01"
              type="number"
              {...register('inputAmount')}
            />
          </Field>
          <Field label="단위" error={errors.inputUnitLabel?.message}>
            <input className={INPUT_CLS} {...register('inputUnitLabel')} />
          </Field>
        </div>
      </form>
    </Modal>
  )
}

function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode
  error?: string
  label: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export default PresetsPage
