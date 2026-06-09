import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteField, doc, updateDoc } from 'firebase/firestore'

import { db } from '../../firebase'
import type { NutrientValues } from '../../types/recipe'

function draftRef(uid: string, draftId: string) {
  return doc(db, `recipeDrafts/${uid}/items`, draftId)
}

// 원료 병합으로 합산된 draft의 확인 게이트 해제 (DL-034).
export function useClearMergeReview(uid: string | undefined) {
  const queryClient = useQueryClient()
  const draftsQueryKey = ['recipeDrafts', uid]

  return useMutation({
    mutationFn: async (draftId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await updateDoc(draftRef(uid, draftId), { mergeReviewPending: false })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: draftsQueryKey }),
  })
}

// 확정값(declaredNutrients) 저장. totals로 저장(§6 evaluate가 totals 가정).
// declared가 비면(전부 계산값 추적) 필드 제거 → effectiveNutrients가 계산값 사용.
export function useSaveDeclaredNutrients(uid: string | undefined) {
  const queryClient = useQueryClient()
  const draftsQueryKey = ['recipeDrafts', uid]

  return useMutation({
    mutationFn: async ({
      draftId,
      declaredNutrients,
      now,
    }: {
      draftId: string
      declaredNutrients: NutrientValues
      now: number
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      const hasAny = Object.keys(declaredNutrients).length > 0
      await updateDoc(draftRef(uid, draftId), {
        declaredNutrients: hasAny ? declaredNutrients : deleteField(),
        declaredNutrientsUpdatedAt: hasAny ? now : deleteField(),
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: draftsQueryKey }),
  })
}
