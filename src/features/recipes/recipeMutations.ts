import { useMutation, useQueryClient } from '@tanstack/react-query'
import { doc, updateDoc } from 'firebase/firestore'

import { db } from '../../firebase'

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
