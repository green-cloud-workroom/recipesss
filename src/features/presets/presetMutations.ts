import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, writeBatch } from 'firebase/firestore'

import { db } from '../../firebase'
import type { Preset } from '../../types/recipe'

function presetRef(uid: string, presetId: string) {
  return doc(db, `recipesssPresets/${uid}/items`, presetId)
}

// 레시피 상세 화면(DL-035)의 프리셋 저장/삭제 단일 진입점.
// 호출 측에서 normalizePresetCodes로 정규화한 결과를 upserts로 넘긴다.
export function useApplyDraftPresets(uid: string | undefined) {
  const queryClient = useQueryClient()
  const presetsQueryKey = ['recipesssPresets', uid]

  return useMutation({
    mutationFn: async ({
      upserts,
      deleteIds,
    }: {
      upserts: Preset[]
      deleteIds: string[]
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      if (upserts.length === 0 && deleteIds.length === 0) return

      const batch = writeBatch(db)
      for (const preset of upserts) {
        batch.set(presetRef(uid, preset.id), preset)
      }
      for (const presetId of deleteIds) {
        batch.delete(presetRef(uid, presetId))
      }
      await batch.commit()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: presetsQueryKey }),
  })
}
