import { useQuery } from '@tanstack/react-query'
import { collection, getDocs } from 'firebase/firestore'

import { db } from '../../firebase'
import type { RecipeDraft } from '../../types/recipe'

export async function fetchRecipeDrafts(uid: string): Promise<RecipeDraft[]> {
  const snap = await getDocs(collection(db, `recipeDrafts/${uid}/items`))
  const drafts = snap.docs.map((docSnap) => ({
    ...(docSnap.data() as RecipeDraft),
    id: docSnap.id,
  }))

  return drafts.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function useRecipeDrafts(uid: string | undefined) {
  return useQuery({
    queryKey: ['recipeDrafts'],
    queryFn: () => fetchRecipeDrafts(uid as string),
    enabled: !!uid,
  })
}
