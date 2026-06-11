import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore'

import { db } from '../../firebase'
import type { SavedOrder } from '../../types/recipe'

// 저장된 발주 (DL-039): recipesssOrders/{uid}/items/{orderId}

function orderRef(uid: string, orderId: string) {
  return doc(db, `recipesssOrders/${uid}/items`, orderId)
}

export function useSavedOrders(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipesssOrders', uid],
    queryFn: async () => {
      const snap = await getDocs(
        collection(db, `recipesssOrders/${uid as string}/items`),
      )
      return snap.docs
        .map((docSnap) => ({ ...(docSnap.data() as SavedOrder), id: docSnap.id }))
        .sort((a, b) => b.createdAt - a.createdAt)
    },
    enabled: !!uid,
  })
}

export function useSaveOrder(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssOrders', uid]

  return useMutation({
    mutationFn: async ({
      presetIds,
      now,
    }: {
      presetIds: string[]
      now: number
    }) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      if (presetIds.length === 0) throw new Error('선택된 프리셋이 없습니다.')

      const id = `order_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`
      // 로컬(KST) 기준 날짜 — toISOString은 UTC라 저녁 저장 시 하루 밀림.
      const d = new Date(now)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const order: SavedOrder = { id, date, presetIds, createdAt: now }
      await setDoc(orderRef(uid, id), order)
      return order
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}

export function useDeleteOrder(uid: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['recipesssOrders', uid]

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!uid) throw new Error('로그인이 필요합니다.')
      await deleteDoc(orderRef(uid, orderId))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })
}
